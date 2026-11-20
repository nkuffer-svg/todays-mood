/* Today's Mood — étape 1 : affichage des partages reçus. */
'use strict';

const fmtDate = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'full', timeStyle: 'medium' });
const fmtNombre = new Intl.NumberFormat('fr-CH');

function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else n.setAttribute(k, v);
  }
  for (const e of enfants) if (e != null) n.append(e);
  return n;
}

function pluriel(n, mot) {
  return fmtNombre.format(n) + ' ' + mot + (n > 1 ? 's' : '');
}

function decrireElement(e) {
  const nbCar = [...e.contenu].length; // compte les caractères (et non les unités UTF-16)
  const nbMots = (e.contenu.trim().match(/\S+/g) || []).length;
  const meta = el('ul', { class: 'meta' },
    el('li', { class: 'pastille forte' }, e.forme === 'texte' ? 'Texte' : 'Fichier'),
    el('li', { class: 'pastille' }, pluriel(nbCar, 'caractère')),
    el('li', { class: 'pastille' }, pluriel(nbMots, 'mot')),
  );
  if (e.forme === 'fichier') {
    meta.append(
      el('li', { class: 'pastille brut' }, e.nom),
      el('li', { class: 'pastille brut' }, e.type),
      el('li', { class: 'pastille' }, pluriel(e.taille, 'octet')),
    );
  }
  const contenu = e.contenu.length
    ? el('pre', { class: 'contenu' }, e.contenu)
    : el('p', { class: 'vide' }, '(contenu vide)');
  return el('div', { class: 'element' }, meta, contenu);
}

function decrirePartage(p) {
  const bloc = el('div');
  bloc.append(el('p', { class: 'date' }, 'Reçu le ' + fmtDate.format(new Date(p.recuLe))));
  if (p.titre) bloc.append(el('p', { class: 'discret' }, 'Titre : ' + p.titre));
  if (p.lien) bloc.append(el('p', { class: 'discret' }, 'Lien : ' + p.lien));
  if (p.elements.length === 0) {
    bloc.append(el('p', { class: 'vide' },
      'Partage reçu, mais sans texte ni fichier. Champs reçus : ' + (p.champsRecus.join(', ') || 'aucun') + '.'));
  }
  for (const e of p.elements) bloc.append(decrireElement(e));
  return bloc;
}

function resume(p) {
  const formes = p.elements.map((e) => e.forme === 'texte' ? 'texte' : 'fichier').join(' + ') || 'vide';
  const nbCar = p.elements.reduce((s, e) => s + [...e.contenu].length, 0);
  const d = new Date(p.recuLe);
  return [
    el('strong', {}, d.toLocaleDateString('fr-CH') + ' ' + d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })),
    ' · ' + formes + ' · ' + pluriel(nbCar, 'caractère'),
  ];
}

async function afficher() {
  const params = new URLSearchParams(location.search);
  const zoneDernier = document.getElementById('dernier');
  const zoneHisto = document.getElementById('historique');
  zoneDernier.replaceChildren();
  zoneHisto.replaceChildren();

  if (params.has('erreur')) {
    zoneDernier.append(el('p', { class: 'erreur' }, 'Erreur à la réception du partage : ' + params.get('erreur')));
  }

  let partages = [];
  try {
    partages = await PartageDB.lister();
  } catch (err) {
    zoneDernier.append(el('p', { class: 'erreur' }, 'Impossible de lire IndexedDB : ' + err.message));
    return;
  }

  if (partages.length === 0) {
    if (!params.has('erreur')) zoneDernier.append(el('p', { class: 'vide' }, 'Aucun partage reçu pour l\'instant.'));
    zoneHisto.append(el('p', { class: 'vide' }, 'L\'historique est vide.'));
    return;
  }

  zoneDernier.append(decrirePartage(partages[0]));

  const liste = el('ul', { class: 'historique-liste' });
  for (const p of partages) {
    liste.append(el('li', {},
      el('details', {}, el('summary', {}, ...resume(p)), el('div', { class: 'corps' }, decrirePartage(p)))));
  }
  zoneHisto.append(liste);
}

document.getElementById('nb-max').textContent = PartageDB.MAX_PARTAGES;

document.getElementById('vider').addEventListener('click', async () => {
  if (!confirm('Effacer les partages enregistrés ?')) return;
  await PartageDB.vider();
  history.replaceState(null, '', location.pathname);
  afficher();
});

// Après un partage, on nettoie l'adresse pour qu'un rechargement n'affiche pas un ancien paramètre.
afficher().then(() => {
  if (location.search) history.replaceState(null, '', location.pathname);
});

const etatSw = document.getElementById('etat-sw');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { etatSw.textContent = 'hors ligne prêt'; })
    .catch((err) => { etatSw.textContent = 'service worker en erreur : ' + err.message; });
} else {
  etatSw.textContent = 'service worker non pris en charge';
}
