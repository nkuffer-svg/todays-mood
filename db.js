/* Today's Mood — accès à IndexedDB.
   Script classique (pas un module) : chargé par la page ET par le service worker (importScripts).
   Expose self.TMDB.

   Magasins :
   - fiches    : une fiche par jour (clé : date AAAA-MM-JJ)
   - file      : file de synchronisation (clé : "fiche:AAAA-MM-JJ" ou "pastilles")
   - reglages  : réglages locaux (clé, valeur) — dont l'URL et le jeton, qui ne quittent jamais le téléphone
   - pastilles : catégories d'événement (clé : nom)
   - partages  : derniers partages reçus de l'Enregistreur (5 au maximum) */
(function (global) {
  'use strict';

  const NOM_BASE = 'todays-mood';
  const VERSION = 1;
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

  /** Enregistre une fiche ET la place dans la file de synchronisation (même transaction). */
  async function enregistrerFiche(fiche) {
    const db = await ouvrir();
    const tx = db.transaction(['fiches', 'file'], 'readwrite');
    tx.objectStore('fiches').put(fiche);
    tx.objectStore('file').put({ cle: 'fiche:' + fiche.date, type: 'fiche', date: fiche.date });
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
      if (e.target.result) return; // modification locale en attente : elle a priorité
      tx.objectStore('fiches').get(distante.date).onsuccess = (e2) => {
        const locale = e2.target.result;
        if (!locale || (distante.modifie_le || '') > (locale.modifie_le || '')) {
          tx.objectStore('fiches').put(distante);
          change = true;
        }
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

  global.TMDB = {
    lire, tout, ecrire, supprimer,
    enregistrerFiche, retirerFicheDeLaFile, fusionnerFicheDistante, enregistrerPastilles, remplacerPastilles, ajouterPartage,
  };
})(self);
