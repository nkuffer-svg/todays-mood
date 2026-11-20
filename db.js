/* Stockage IndexedDB des partages reçus.
   Script classique : utilisé à la fois par la page (index.html) et par le service worker (importScripts). */
(function (global) {
  'use strict';

  const NOM_BASE = 'todays-mood-partage';
  const VERSION = 1;
  const MAGASIN = 'partages';
  const MAX_PARTAGES = 5;

  function ouvrir() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NOM_BASE, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MAGASIN)) {
          db.createObjectStore(MAGASIN, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function attendre(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  /** Ajoute un partage et ne garde que les 5 plus récents. Renvoie l'id créé. */
  async function ajouter(partage) {
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readwrite');
    const magasin = tx.objectStore(MAGASIN);
    let id;
    magasin.add(partage).onsuccess = (e) => { id = e.target.result; };
    // Purge : les clés auto-incrémentées sont dans l'ordre d'arrivée.
    magasin.getAllKeys().onsuccess = (e) => {
      const cles = e.target.result;
      const enTrop = cles.length - MAX_PARTAGES;
      for (let i = 0; i < enTrop; i++) magasin.delete(cles[i]);
    };
    await attendre(tx);
    db.close();
    return id;
  }

  /** Liste des partages, du plus récent au plus ancien. */
  async function lister() {
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readonly');
    const req = tx.objectStore(MAGASIN).getAll();
    await attendre(tx);
    db.close();
    return req.result.sort((a, b) => b.id - a.id);
  }

  async function vider() {
    const db = await ouvrir();
    const tx = db.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).clear();
    await attendre(tx);
    db.close();
  }

  global.PartageDB = { ajouter, lister, vider, MAX_PARTAGES };
})(self);
