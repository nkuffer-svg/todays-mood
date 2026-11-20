/* Service worker de Today's Mood — étape 1 : test du partage. */
'use strict';
importScripts('./db.js');

const VERSION = 'etape1-v1';
const CACHE = 'todays-mood-' + VERSION;
const FICHIERS = [
  './',
  './index.html',
  './app.js',
  './db.js',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('todays-mood-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cible de partage Android : POST multipart vers ./partage
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/partage')) {
    event.respondWith(recevoirPartage(req));
    return;
  }

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Réseau d'abord (pour voir les mises à jour), cache en secours (hors ligne).
  event.respondWith(
    fetch(req)
      .then((rep) => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return rep;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});

async function recevoirPartage(req) {
  const urlRetour = new URL('./', self.registration.scope);
  try {
    const donnees = await req.formData();
    const elements = [];

    const texte = donnees.get('text');
    if (typeof texte === 'string' && texte.length > 0) {
      elements.push({ forme: 'texte', contenu: texte });
    }

    for (const f of donnees.getAll('fichiers')) {
      if (f && typeof f === 'object' && 'text' in f) {
        elements.push({
          forme: 'fichier',
          nom: f.name || '(sans nom)',
          type: f.type || '(type inconnu)',
          taille: f.size,
          contenu: await f.text(),
        });
      }
    }

    const titre = donnees.get('title');
    const lien = donnees.get('url');
    const id = await self.PartageDB.ajouter({
      recuLe: new Date().toISOString(),
      titre: typeof titre === 'string' ? titre : '',
      lien: typeof lien === 'string' ? lien : '',
      champsRecus: [...new Set([...donnees.keys()])],
      elements,
    });
    urlRetour.searchParams.set('partage', String(id));
  } catch (err) {
    urlRetour.searchParams.set('erreur', String(err && err.message || err));
  }
  return Response.redirect(urlRetour.href, 303);
}
