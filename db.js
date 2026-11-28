/* Today's Mood — accès à IndexedDB.
   Script classique (pas un module) : chargé par la page ET par le service worker (importScripts).
   Expose self.TMDB.

   Magasins :
   - fiches    : une fiche par jour (clé : date AAAA-MM-JJ)
   - file      : file de synchronisation (clé : "fiche:AAAA-MM-JJ" ou "pastilles")
   - reglages  : réglages locaux (clé, valeur) — dont l'URL et le jeton, qui ne quittent jamais le téléphone
   - pastilles : catégories d'événement (clé : nom)
   - partages  : derniers partages reçus de l'Enregistreur (5 au maximum)
   - photos    : photos compressées (clé : "AAAA-MM-JJ:photo_ciel"), en attente d'envoi ou copie locale
   - marches   : une marche (clé : id), plusieurs par jour possibles
   - tentations : une tentation de Who's the Boss ? (clé : id), plusieurs par jour possibles
   - defis     : un défi du mois (clé : mois AAAA-MM)
   - pensees   : état d'une citation (clé : id) : favori, dernière apparition */
(function (global) {
  'use strict';

  const NOM_BASE = 'todays-mood';
  const VERSION = 5;
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
        creer('marches', { keyPath: 'id' });
        creer('pensees', { keyPath: 'id' });
        creer('tentations', { keyPath: 'id' }); // version 4 B : Who's the Boss ?
        creer('defis', { keyPath: 'mois' });     // version 4 B : défi du mois
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

  /* ---------- Marches ---------- */

  async function ajouterMarche(marche) {
    const db = await ouvrir();
    const tx = db.transaction(['marches', 'file'], 'readwrite');
    tx.objectStore('marches').put(marche);
    tx.objectStore('file').put({ cle: 'marche:' + marche.id, type: 'marche', id: marche.id, op: 'ajout' });
    return fin(tx);
  }

  async function supprimerMarche(id) {
    const db = await ouvrir();
    const tx = db.transaction(['marches', 'file'], 'readwrite');
    tx.objectStore('marches').delete(id);
    tx.objectStore('file').put({ cle: 'marche:' + id, type: 'marche', id, op: 'suppression' });
    return fin(tx);
  }

  /** Retire une entrée de la file seulement si elle n'a pas changé de nature pendant l'envoi. */
  async function retirerMarcheDeLaFile(id, op) {
    const db = await ouvrir();
    const tx = db.transaction('file', 'readwrite');
    const file = tx.objectStore('file');
    file.get('marche:' + id).onsuccess = (e) => {
      if (e.target.result && e.target.result.op === op) file.delete('marche:' + id);
    };
    return fin(tx);
  }

  /** Aligne les marches locales sur celles du Sheet, sauf celles qui attendent d'être envoyées. */
  async function fusionnerMarches(distantes) {
    const db = await ouvrir();
    const tx = db.transaction(['marches', 'file'], 'readwrite');
    const magasin = tx.objectStore('marches');
    let change = false;
    tx.objectStore('file').getAll().onsuccess = (e) => {
      const enAttente = new Set(e.target.result.filter((x) => x.type === 'marche').map((x) => x.id));
      const parId = new Map(distantes.map((m) => [m.id, m]));
      magasin.getAll().onsuccess = (e2) => {
        for (const locale of e2.target.result) {
          if (enAttente.has(locale.id)) continue;
          const d = parId.get(locale.id);
          if (!d) { magasin.delete(locale.id); change = true; }
          else if (d.date !== locale.date || d.km !== locale.km) { magasin.put(d); change = true; }
          parId.delete(locale.id);
        }
        for (const d of parId.values()) {
          if (!enAttente.has(d.id)) { magasin.put(d); change = true; }
        }
      };
    };
    await fin(tx);
    return change;
  }

  /* ---------- Enregistrements à clé (tentations, défis) : même principe que les marches ---------- */

  const CLES = { tentations: 'id', defis: 'mois' };

  /** Ajoute ou modifie un enregistrement et le place dans la file (une version par modification). */
  async function ecrireEnregistrement(magasin, objet) {
    const id = objet[CLES[magasin]];
    const db = await ouvrir();
    const tx = db.transaction([magasin, 'file'], 'readwrite');
    tx.objectStore(magasin).put(objet);
    tx.objectStore('file').put({ cle: magasin + ':' + id, type: 'enreg', magasin, id, op: 'ajout', version: Date.now() + Math.random() });
    return fin(tx);
  }

  async function supprimerEnregistrement(magasin, id) {
    const db = await ouvrir();
    const tx = db.transaction([magasin, 'file'], 'readwrite');
    tx.objectStore(magasin).delete(id);
    tx.objectStore('file').put({ cle: magasin + ':' + id, type: 'enreg', magasin, id, op: 'suppression', version: Date.now() + Math.random() });
    return fin(tx);
  }

  /** Retire une entrée de la file seulement si elle n'a pas été modifiée pendant l'envoi. */
  async function retirerEnregistrementDeLaFile(cle, version) {
    const db = await ouvrir();
    const tx = db.transaction('file', 'readwrite');
    const file = tx.objectStore('file');
    file.get(cle).onsuccess = (e) => {
      if (e.target.result && e.target.result.version === version) file.delete(cle);
    };
    return fin(tx);
  }

  /** Aligne un magasin sur le Sheet, sauf les enregistrements qui attendent d'être envoyés. */
  async function fusionnerEnregistrements(magasin, distants) {
    const cleId = CLES[magasin];
    const db = await ouvrir();
    const tx = db.transaction([magasin, 'file'], 'readwrite');
    const store = tx.objectStore(magasin);
    let change = false;
    const pareil = (a, b) => JSON.stringify(a, Object.keys(a).sort()) === JSON.stringify(b, Object.keys(b).sort());
    tx.objectStore('file').getAll().onsuccess = (e) => {
      const enAttente = new Set(e.target.result.filter((x) => x.type === 'enreg' && x.magasin === magasin).map((x) => x.id));
      const parId = new Map(distants.map((d) => [d[cleId], d]));
      store.getAll().onsuccess = (e2) => {
        for (const locale of e2.target.result) {
          const id = locale[cleId];
          if (enAttente.has(id)) { parId.delete(id); continue; }
          const d = parId.get(id);
          if (!d) { store.delete(id); change = true; }
          else if (!pareil(d, locale)) { store.put(d); change = true; }
          parId.delete(id);
        }
        for (const d of parId.values()) {
          if (!enAttente.has(d[cleId])) { store.put(d); change = true; }
        }
      };
    };
    await fin(tx);
    return change;
  }

  /* ---------- Pensées ---------- */

  /** Modifie l'état d'une citation (favori, dernière apparition) et la place dans la file. */
  async function modifierPensee(id, modifs) {
    const db = await ouvrir();
    const tx = db.transaction(['pensees', 'file'], 'readwrite');
    const magasin = tx.objectStore('pensees');
    magasin.get(id).onsuccess = (e) => {
      magasin.put(Object.assign(e.target.result || { id, favori: false, derniere: null }, modifs));
    };
    tx.objectStore('file').put({ cle: 'pensee:' + id, type: 'pensee', id });
    return fin(tx);
  }

  /** Retire une citation de la file si son état n'a pas changé depuis l'envoi. */
  async function retirerPenseeDeLaFile(envoyee) {
    const db = await ouvrir();
    const tx = db.transaction(['pensees', 'file'], 'readwrite');
    tx.objectStore('pensees').get(envoyee.id).onsuccess = (e) => {
      const p = e.target.result;
      if (!p || (p.favori === envoyee.favori && p.derniere === envoyee.derniere)) {
        tx.objectStore('file').delete('pensee:' + envoyee.id);
      }
    };
    return fin(tx);
  }

  /** Intègre l'état des citations venu du Sheet (sauf celles qui attendent d'être envoyées). */
  async function fusionnerPensees(distantes) {
    const db = await ouvrir();
    const tx = db.transaction(['pensees', 'file'], 'readwrite');
    const magasin = tx.objectStore('pensees');
    let change = false;
    tx.objectStore('file').getAll().onsuccess = (e) => {
      const enAttente = new Set(e.target.result.filter((x) => x.type === 'pensee').map((x) => x.id));
      magasin.getAll().onsuccess = (e2) => {
        const locales = new Map(e2.target.result.map((p) => [p.id, p]));
        for (const d of distantes) {
          if (enAttente.has(d.id)) continue;
          const l = locales.get(d.id);
          if (!l || l.favori !== d.favori || l.derniere !== d.derniere) {
            magasin.put({ id: d.id, favori: !!d.favori, derniere: d.derniere || null });
            change = true;
          }
        }
      };
    };
    await fin(tx);
    return change;
  }

  /* ---------- Réglages partagés avec le Sheet ---------- */

  async function ecrireReglagePartage(cle, valeur) {
    const db = await ouvrir();
    const tx = db.transaction(['reglages', 'file'], 'readwrite');
    tx.objectStore('reglages').put({ cle, valeur });
    tx.objectStore('file').put({ cle: 'reglages', type: 'reglages', version: Date.now() });
    return fin(tx);
  }

  /** Retire les réglages de la file s'ils n'ont pas changé pendant l'envoi. */
  async function retirerReglagesDeLaFile(version) {
    const db = await ouvrir();
    const tx = db.transaction('file', 'readwrite');
    const file = tx.objectStore('file');
    file.get('reglages').onsuccess = (e) => {
      if (e.target.result && e.target.result.version === version) file.delete('reglages');
    };
    return fin(tx);
  }

  global.TMDB = {
    ecrireReglagePartage, retirerReglagesDeLaFile,
    modifierPensee, retirerPenseeDeLaFile, fusionnerPensees,
    ajouterMarche, supprimerMarche, retirerMarcheDeLaFile, fusionnerMarches,
    ecrireEnregistrement, supprimerEnregistrement, retirerEnregistrementDeLaFile, fusionnerEnregistrements,
    enregistrerPhotoLocale, marquerPhotoEnvoyee, supprimerPhotoLocale, mettreALaCorbeille, purgerPhotos,
    lire, tout, ecrire, supprimer,
    modifierFiche, retirerFicheDeLaFile, fusionnerFicheDistante, enregistrerPastilles, remplacerPastilles, ajouterPartage,
  };
})(self);
