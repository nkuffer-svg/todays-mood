/* Today's Mood — accès à IndexedDB.
   Script classique (pas un module) : chargé par la page ET par le service worker (importScripts).
   Expose self.TMDB.

   Magasins :
   - fiches    : une fiche par jour (clé : date AAAA-MM-JJ)
   - file      : file de synchronisation (clé : "fiche:AAAA-MM-JJ" ou "pastilles")
   - reglages  : réglages locaux (clé, valeur) — dont l'URL et le jeton, qui ne quittent jamais le téléphone
   - pastilles : catégories d'événement (clé : nom)
   - partages  : derniers partages reçus de l'Enregistreur (5 au maximum)
   - photos    : photos compressées (clé : "AAAA-MM-JJ:photo_ciel"), en attente d'envoi ou copie locale */
(function (global) {
  'use strict';

  const NOM_BASE = 'todays-mood';
  const VERSION = 2;
  const MAX_PARTAGES = 5;
  let ouverture = null;

  function ouvrir() {
    if (ouverture) return ouverture;
    ouverture = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOM_BASE, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const creer = (nom, options) => {
          if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, options);
        };
        creer('fiches', { keyPath: 'date' });
        creer('file', { keyPath: 'cle' });
        creer('reglages', { keyPath: 'cle' });
        creer('pastilles', { keyPath: 'nom' });
        creer('partages', { keyPath: 'id', autoIncrement: true });
        creer('photos', { keyPath: 'cle' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); ouverture = null; };
        resolve(db);
      };
      req.onerror = () => { ouverture = null; reject(req.error); };
    });
    return ouverture;
  }

  function fin(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
    });
  }

  function resultat(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function lire(magasin, cle) {
    const db = await ouvrir();
    return resultat(db.transaction(magasin).objectStore(magasin).get(cle));
  }

  async function tout(magasin) {
    const db = await ouvrir();
    return resultat(db.transaction(magasin).objectStore(magasin).getAll());
  }

  async function ecrire(magasin, valeur) {
    const db = await ouvrir();
    const tx = db.transaction(magasin, 'readwrite');
    tx.objectStore(magasin).put(valeur);
    return fin(tx);
  }

  async function supprimer(magasin, cle) {
    const db = await ouvrir();
    const tx = db.transaction(magasin, 'readwrite');
    tx.objectStore(magasin).delete(cle);
    return fin(tx);
  }

  /** Modifie quelques champs d'une fiche ET note ces champs dans la file de synchronisation
      (même transaction). Seuls les champs modifiés seront envoyés au Sheet. */
  async function modifierFiche(date, modifs, modifieLe) {
    const db = await ouvrir();
    const tx = db.transaction(['fiches', 'file'], 'readwrite');
    const fiches = tx.objectStore('fiches');
    const file = tx.objectStore('file');
    fiches.get(date).onsuccess = (e) => {
      const fiche = Object.assign(e.target.result || { date }, modifs, { modifie_le: modifieLe });
      fiches.put(fiche);
    };
    file.get('fiche:' + date).onsuccess = (e) => {
      const entree = e.target.result || { cle: 'fiche:' + date, type: 'fiche', date, champs: [] };
      // Une entrée sans liste de champs (ancienne version) envoie la fiche complète : on la garde telle quelle.
      if (Array.isArray(entree.champs)) {
        entree.champs = [...new Set([...entree.champs, ...Object.keys(modifs)])];
      }
      file.put(entree);
    };
    return fin(tx);
  }

  /** Retire une fiche de la file, seulement si elle n'a pas été modifiée depuis l'envoi
      (vérification et suppression dans la même transaction). */
  async function retirerFicheDeLaFile(date, modifieLeEnvoye) {
    const db = await ouvrir();
    const tx = db.transaction(['fiches', 'file'], 'readwrite');
    tx.objectStore('fiches').get(date).onsuccess = (e) => {
      const f = e.target.result;
      if (!f || f.modifie_le === modifieLeEnvoye) tx.objectStore('file').delete('fiche:' + date);
    };
    return fin(tx);
  }

  /** Intègre une fiche venue du Sheet si elle est plus récente que la fiche locale
      et que la fiche locale n'attend pas d'être envoyée. Renvoie true si la fiche locale a changé. */
  async function fusionnerFicheDistante(distante) {
    const db = await ouvrir();
    const tx = db.transaction(['fiches', 'file'], 'readwrite');
    let change = false;
    tx.objectStore('file').get('fiche:' + distante.date).onsuccess = (e) => {
      const enAttente = e.target.result;
      tx.objectStore('fiches').get(distante.date).onsuccess = (e2) => {
        const locale = e2.target.result;
        if (!enAttente) {
          // Rien n'attend d'être envoyé : le Sheet fait foi (il réunit les saisies de tous les appareils).
          if (!locale || (distante.modifie_le || '') >= (locale.modifie_le || '')) {
            const differe = !locale || Object.keys({ ...locale, ...distante })
              .some((k) => (locale[k] ?? null) !== (distante[k] ?? null));
            if (differe) {
              tx.objectStore('fiches').put(distante);
              change = true;
            }
          }
          return;
        }
        // Des champs locaux attendent d'être envoyés : ils ont priorité ; les autres viennent du Sheet.
        if (!Array.isArray(enAttente.champs) || !locale) return;
        const fusion = { ...locale };
        for (const [champ, valeur] of Object.entries(distante)) {
          if (champ === 'date' || champ === 'modifie_le' || enAttente.champs.includes(champ)) continue;
          if (fusion[champ] !== valeur) { fusion[champ] = valeur; change = true; }
        }
        if (change) tx.objectStore('fiches').put(fusion);
      };
    };
    await fin(tx);
    return change;
  }

  /** Remplace toute la liste des pastilles ET la place dans la file de synchronisation. */
  async function enregistrerPastilles(liste) {
    const db = await ouvrir();
    const tx = db.transaction(['pastilles', 'file'], 'readwrite');
    const magasin = tx.objectStore('pastilles');
    magasin.clear();
    for (const p of liste) magasin.put(p);
    tx.objectStore('file').put({ cle: 'pastilles', type: 'pastilles' });
    return fin(tx);
  }

  /** Remplace les pastilles locales par celles du Sheet (sans repasser par la file). */
  async function remplacerPastilles(liste) {
    const db = await ouvrir();
    const tx = db.transaction('pastilles', 'readwrite');
    const magasin = tx.objectStore('pastilles');
    magasin.clear();
    for (const p of liste) magasin.put(p);
    return fin(tx);
  }

  /** Ajoute un partage reçu et ne garde que les 5 plus récents. Renvoie l'id créé. */
  async function ajouterPartage(partage) {
    const db = await ouvrir();
    const tx = db.transaction('partages', 'readwrite');
    const magasin = tx.objectStore('partages');
    let id;
    magasin.add(partage).onsuccess = (e) => { id = e.target.result; };
    magasin.getAllKeys().onsuccess = (e) => {
      const cles = e.target.result;
      for (let i = 0; i < cles.length - MAX_PARTAGES; i++) magasin.delete(cles[i]);
    };
    await fin(tx);
    return id;
  }

  /* ---------- Photos ---------- */

  /** Enregistre une nouvelle photo (à envoyer) et la place dans la file. */
  async function enregistrerPhotoLocale(photo) {
    const db = await ouvrir();
    const tx = db.transaction(['photos', 'file'], 'readwrite');
    tx.objectStore('photos').put(photo);
    tx.objectStore('file').put({ cle: 'photo:' + photo.cle, type: 'photo', photo: photo.cle });
    return fin(tx);
  }

  /** Après l'envoi : marque la photo envoyée, si elle n'a pas été remplacée entre-temps. Renvoie true si c'est le cas. */
  async function marquerPhotoEnvoyee(cle, version, driveId) {
    const db = await ouvrir();
    const tx = db.transaction(['photos', 'file'], 'readwrite');
    let ok = false;
    tx.objectStore('photos').get(cle).onsuccess = (e) => {
      const p = e.target.result;
      if (p && p.version === version) {
        p.etat = 'envoyee';
        p.driveId = driveId;
        p.remplace = null;
        tx.objectStore('photos').put(p);
        tx.objectStore('file').delete('photo:' + cle);
        ok = true;
      }
    };
    await fin(tx);
    return ok;
  }

  /** Supprime une photo locale ; met à la corbeille Drive les fichiers indiqués. */
  async function supprimerPhotoLocale(cle, idsCorbeille) {
    const db = await ouvrir();
    const tx = db.transaction(['photos', 'file'], 'readwrite');
    tx.objectStore('photos').delete(cle);
    tx.objectStore('file').delete('photo:' + cle);
    for (const id of idsCorbeille) {
      if (id) tx.objectStore('file').put({ cle: 'corbeille:' + id, type: 'corbeille', id });
    }
    return fin(tx);
  }

  /** Ajoute un fichier Drive à mettre à la corbeille. */
  async function mettreALaCorbeille(id) {
    return ecrire('file', { cle: 'corbeille:' + id, type: 'corbeille', id });
  }

  /** Efface les copies locales de photos déjà envoyées et antérieures à une date (elles restent sur Drive). */
  async function purgerPhotos(avant) {
    const db = await ouvrir();
    const tx = db.transaction('photos', 'readwrite');
    const magasin = tx.objectStore('photos');
    magasin.openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      if (c.value.etat === 'envoyee' && c.value.date < avant) c.delete();
      c.continue();
    };
    return fin(tx);
  }

  global.TMDB = {
    enregistrerPhotoLocale, marquerPhotoEnvoyee, supprimerPhotoLocale, mettreALaCorbeille, purgerPhotos,
    lire, tout, ecrire, supprimer,
    modifierFiche, retirerFicheDeLaFile, fusionnerFicheDistante, enregistrerPastilles, remplacerPastilles, ajouterPartage,
  };
})(self);
