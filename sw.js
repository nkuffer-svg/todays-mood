/* Service worker de Today's Mood.
   - Reçoit les partages de l'Enregistreur (POST ./partage), les stocke dans IndexedDB et ouvre l'app.
   - Met l'app en cache pour qu'elle fonctionne hors ligne. */
'use strict';
importScripts('./db.js');

const VERSION = 'v5b-1';
const CACHE = 'todays-mood-' + VERSION;
const CACHE_POLICES = 'todays-mood-polices';
const FICHIERS = [
  './',
  './index.html',
  './style.css',
  './db.js',
  './manifest.webmanifest',
  './data/pensees.json',
  './js/app.js',
  './js/astro.js',
  './js/boss.js',
  './js/carte-defi.js',
  './js/carte-photo.js',
  './js/cartes-meteo.js',
  './js/compteurs.js',
  './js/docx.js',
  './js/ecran-bilan.js',
  './js/defis.js',
  './js/donnees.js',
  './js/ecran-pensee.js',
  './js/ecran.js',
  './js/ecran-historique.js',
  './js/ecran-medailles.js',
  './js/ecran-partage.js',
  './js/ecran-reglages.js',
  './js/jauge.js',
  './js/jour.js',
  './js/livre.js',
  './js/maison.js',
  './js/durees.js',
  './js/medailles.js',
  './js/meteo.js',
  './js/molette.js',
  './js/mots.js',
  './js/odometre.js',
  './js/onglets.js',
  './js/pensees.js',
  './js/perso.js',
  './js/poele.js',
  './js/photos.js',
  './js/reglages.js',
  './js/reglages-v4.js',
  './js/series.js',
  './js/sommeil.js',
  './js/stats.js',
  './js/sync.js',
  './js/ui.js',
  './js/verrou.js',
  './js/whatsup.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/raccourci-eau-192.png',
  './icons/raccourci-cafe-192.png',
  './icons/raccourci-guitare-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles
        .filter((c) => c.startsWith('todays-mood-') && c !== CACHE && c !== CACHE_POLICES)
        .map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/partage')) {
    event.respondWith(recevoirPartage(req));
    return;
  }
  if (req.method !== 'GET') return;

  // Polices Google : cache d'abord (elles ne changent pas).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE_POLICES).then(async (c) => {
      const enCache = await c.match(req);
      if (enCache) return enCache;
      const rep = await fetch(req);
      if (rep.ok || rep.type === 'opaque') c.put(req, rep.clone());
      return rep;
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Fichiers de l'app : réseau d'abord (pour recevoir les mises à jour), cache si pas de réseau ou trop lent.
  event.respondWith(reseauPuisCache(req));
});

async function reseauPuisCache(req) {
  const cache = await caches.open(CACHE);
  const depuisCache = () => cache.match(req, { ignoreSearch: true })
    .then((r) => r || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
  try {
    const rep = await Promise.race([
      fetch(req),
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error('lent')), 4000)),
    ]);
    if (rep.ok) cache.put(req, rep.clone());
    return rep;
  } catch {
    const r = await depuisCache();
    return r || fetch(req);
  }
}

async function recevoirPartage(req) {
  const retour = new URL('./', self.registration.scope);
  try {
    const donnees = await req.formData();
    const elements = [];
    const texte = donnees.get('text');
    if (typeof texte === 'string' && texte.trim()) elements.push({ forme: 'texte', contenu: texte });
    for (const f of donnees.getAll('fichiers')) {
      if (f && typeof f === 'object' && typeof f.text === 'function') {
        elements.push({ forme: 'fichier', nom: f.name || '', type: f.type || '', taille: f.size, contenu: await f.text() });
      }
    }
    const titre = donnees.get('title');
    const id = await self.TMDB.ajouterPartage({
      recuLe: new Date().toISOString(),
      titre: typeof titre === 'string' ? titre : '',
      elements,
    });
    retour.searchParams.set('partage', String(id));
  } catch (err) {
    retour.searchParams.set('erreur-partage', String((err && err.message) || err));
  }
  return Response.redirect(retour.href, 303);
}
