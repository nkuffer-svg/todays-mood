/* Today's Mood — point d'entrée de l'app. */
import { el, icone } from './ui.js';
import { COLONNES, ONGLETS, PASTILLES_DEFAUT } from './donnees.js';
import { jourCourant, decaler, formatLong, relatif } from './jour.js';
import { chargerReglages, reglage } from './reglages.js';
import { synchroniser, planifier, surEtat, surDonnees, surPhotoEnvoyee } from './sync.js';
import { rendreOnglet, carteMeteo } from './onglets.js';
import { chercherMeteo } from './meteo.js';
import { enregistrerPhoto, supprimerPhoto, photoAffichable } from './photos.js';
import { ouvrirReglages } from './ecran-reglages.js';
import { traiterPartage } from './ecran-partage.js';

export const VERSION = 'etape3-v1';

const etat = {
  aujourdhui: null, // jour courant selon l'heure de bascule
  date: null,       // jour affiché
  onglet: 'matin',
  fiche: null,
  pastilles: [],    // [{ nom, ordre, visible }]
};

const $ = (id) => document.getElementById(id);

/* ---------- Fiches ---------- */

function ficheVide(date) {
  const f = {};
  for (const c of COLONNES) f[c] = null;
  f.date = date;
  return f;
}

async function chargerFiche(date) {
  const f = await TMDB.lire('fiches', date);
  return { ...ficheVide(date), ...(f || {}) };
}

/* Enregistrement : seuls les champs modifiés sont écrits (et envoyés au Sheet).
   Les écritures sont mises à la suite pour garder l'ordre. */
let chaine = Promise.resolve();
let minuteurTexte = null;
let texteEnAttente = null; // { date, modifs } : texte en cours de frappe

function sauver(date, modifs) {
  const modifieLe = new Date().toISOString();
  if (etat.fiche && etat.fiche.date === date) etat.fiche.modifie_le = modifieLe;
  chaine = chaine.then(() => TMDB.modifierFiche(date, modifs, modifieLe)).catch((err) => {
    console.error(err);
    alert('Impossible d’enregistrer sur le téléphone : ' + err.message);
  });
  planifier();
  return chaine;
}

/** Enregistre tout de suite une saisie en attente (texte en cours de frappe). */
function viderSaisieEnAttente() {
  clearTimeout(minuteurTexte);
  if (texteEnAttente) {
    const { date, modifs } = texteEnAttente;
    texteEnAttente = null;
    return sauver(date, modifs);
  }
  return chaine;
}

function normaliser(valeur) {
  if (typeof valeur === 'string' && valeur.trim() === '') return null;
  return valeur ?? null;
}

/** Applique des valeurs à la fiche d'un jour (celle affichée ou une autre) et les enregistre. */
function appliquerChamps(date, champs) {
  const modifs = {};
  for (const [k, v] of Object.entries(champs)) modifs[k] = normaliser(v);
  if (etat.fiche && etat.fiche.date === date) Object.assign(etat.fiche, modifs);
  if (texteEnAttente && texteEnAttente.date === date) {
    for (const k of Object.keys(modifs)) delete texteEnAttente.modifs[k];
  }
  return sauver(date, modifs);
}

/* ---------- Météo ---------- */

const meteoEtat = { date: null, etat: 'repos', message: '', lieu: '' };
const meteoTentees = new Set();

function majCarteMeteo() {
  const ancienne = document.getElementById('carte-meteo');
  if (ancienne) ancienne.replaceWith(carteMeteo(ctx));
}

async function actualiserMeteo(date, { auto = false } = {}) {
  if (auto) {
    if (meteoTentees.has(date) || !navigator.onLine) return;
    meteoTentees.add(date);
  }
  Object.assign(meteoEtat, { date, etat: 'encours', message: '' });
  majCarteMeteo();
  try {
    const { lieu, champs } = await chercherMeteo(date);
    await appliquerChamps(date, champs);
    Object.assign(meteoEtat, { date, etat: 'ok', lieu });
  } catch (err) {
    Object.assign(meteoEtat, { date, etat: 'erreur', message: err.message });
  }
  majCarteMeteo();
}

/** À la première ouverture du jour : la fiche du jour n'a pas encore de météo → on la récupère. */
async function meteoAutomatique() {
  const date = etat.aujourdhui;
  const f = etat.fiche && etat.fiche.date === date ? etat.fiche : await TMDB.lire('fiches', date);
  if (f && f.meteo_code != null) return;
  actualiserMeteo(date, { auto: true });
}

const ctx = {
  get fiche() { return etat.fiche; },
  get meteo() { return meteoEtat.date === etat.date ? meteoEtat : { etat: 'repos' }; },
  actualiserMeteo: () => actualiserMeteo(etat.date),
  photo: {
    affichable: (champ) => photoAffichable(etat.date, champ, etat.fiche[champ]),
    async ajouter(champ, fichier) {
      const date = etat.date;
      await enregistrerPhoto(date, champ, fichier, etat.fiche[champ]);
      planifier(500);
    },
    async supprimer(champ) {
      const date = etat.date;
      await supprimerPhoto(date, champ, etat.fiche[champ]);
      await appliquerChamps(date, { [champ]: null });
    },
  },
  get pastilles() { return etat.pastilles.filter((p) => p.visible !== false).sort((a, b) => a.ordre - b.ordre).map((p) => p.nom); },
  modifier(champ, valeur) {
    return appliquerChamps(etat.fiche.date, { [champ]: valeur });
  },
  modifierTexte(champ, valeur) {
    const date = etat.fiche.date;
    etat.fiche[champ] = normaliser(valeur);
    if (texteEnAttente && texteEnAttente.date !== date) viderSaisieEnAttente();
    texteEnAttente = texteEnAttente || { date, modifs: {} };
    texteEnAttente.modifs[champ] = etat.fiche[champ];
    clearTimeout(minuteurTexte);
    minuteurTexte = setTimeout(viderSaisieEnAttente, 600);
  },
  async ajouterPastille(nom) {
    if (etat.pastilles.some((p) => p.nom.toLowerCase() === nom.toLowerCase())) {
      const p = etat.pastilles.find((x) => x.nom.toLowerCase() === nom.toLowerCase());
      if (p.visible === false) { p.visible = true; await TMDB.enregistrerPastilles(etat.pastilles); planifier(); }
      return;
    }
    const ordre = Math.max(0, ...etat.pastilles.map((p) => p.ordre || 0)) + 1;
    etat.pastilles = [...etat.pastilles, { nom, ordre, visible: true }];
    await TMDB.enregistrerPastilles(etat.pastilles);
    planifier();
  },
};

async function chargerPastilles() {
  const stockees = await TMDB.tout('pastilles');
  etat.pastilles = stockees.length
    ? stockees
    : PASTILLES_DEFAUT.map((nom, i) => ({ nom, ordre: i + 1, visible: true }));
}

/* ---------- Affichage ---------- */

function majEntete() {
  const rel = relatif(etat.date, etat.aujourdhui);
  $('date-libelle').textContent = formatLong(etat.date, etat.aujourdhui);
  $('date-relatif').textContent = rel || 'Fiche passée';
  $('date-relatif').classList.toggle('passe', !rel || rel !== "Aujourd'hui");
  $('date-input').value = etat.date;
  $('date-input').max = etat.aujourdhui;
  $('jour-suiv').disabled = etat.date >= etat.aujourdhui;
  $('retour-aujourdhui').hidden = etat.date === etat.aujourdhui;
  for (const b of document.querySelectorAll('.onglet')) {
    const actif = b.dataset.onglet === etat.onglet;
    b.setAttribute('aria-selected', String(actif));
    b.tabIndex = actif ? 0 : -1;
  }
}

function rendre() {
  majEntete();
  const contenu = $('contenu');
  contenu.setAttribute('aria-labelledby', 'onglet-' + etat.onglet);
  contenu.replaceChildren(...rendreOnglet(etat.onglet, ctx));
}

export async function allerA(date, { onglet } = {}) {
  await viderSaisieEnAttente();
  if (date > etat.aujourdhui) date = etat.aujourdhui;
  etat.date = date;
  if (onglet) etat.onglet = onglet;
  etat.fiche = await chargerFiche(date);
  rendre();
}

function changerOnglet(id) {
  if (id === etat.onglet) return;
  viderSaisieEnAttente();
  etat.onglet = id;
  rendre();
  window.scrollTo({ top: 0 });
}

function ongletSelonHeure() {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return 'matin';
  if (h >= 11 && h < 18) return 'journee';
  return 'soir';
}

/* ---------- En-tête ---------- */

const TEXTES_SYNCHRO = {
  inconnu: '…',
  ok: 'Synchro OK',
  encours: 'Synchro…',
  attente: 'En attente',
  horsligne: 'Hors ligne',
  config: 'À configurer',
  jeton: 'Jeton refusé',
  erreur: 'Erreur synchro',
};

function construireEntete() {
  $('btn-reglages').append(icone('reglages'));
  $('jour-prec').append(icone('gauche'));
  $('jour-suiv').append(icone('droite'));

  $('jour-prec').addEventListener('click', () => allerA(decaler(etat.date, -1)));
  $('jour-suiv').addEventListener('click', () => allerA(decaler(etat.date, 1)));
  $('retour-aujourdhui').addEventListener('click', () => allerA(etat.aujourdhui));
  $('date-bouton').addEventListener('click', () => {
    const input = $('date-input');
    try { input.showPicker(); } catch { input.focus(); input.click(); }
  });
  $('date-input').addEventListener('change', (e) => { if (e.target.value) allerA(e.target.value); });

  const nav = $('onglets');
  for (const o of ONGLETS) {
    const b = el('button', {
      type: 'button', role: 'tab', class: 'onglet', id: 'onglet-' + o.id, 'aria-controls': 'contenu',
    }, o.id === 'perso' ? icone('cadenas', 'petite') : null, o.nom);
    b.dataset.onglet = o.id;
    b.addEventListener('click', () => changerOnglet(o.id));
    nav.append(b);
  }
  nav.addEventListener('keydown', (e) => {
    const i = ONGLETS.findIndex((o) => o.id === etat.onglet);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % ONGLETS.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + ONGLETS.length) % ONGLETS.length;
    if (j != null) { changerOnglet(ONGLETS[j].id); $('onglet-' + ONGLETS[j].id).focus(); }
  });

  $('btn-reglages').addEventListener('click', () => ouvrirReglages({ synchroComplete, reglagesModifies }));
  $('btn-sync').addEventListener('click', () => ouvrirReglages({ synchroComplete, reglagesModifies }));

  surEtat((s) => {
    const b = $('btn-sync');
    b.dataset.code = s.code;
    let texte = TEXTES_SYNCHRO[s.code] || s.code;
    if ((s.code === 'attente' || s.code === 'horsligne' || s.code === 'erreur') && s.attente) texte += ` (${s.attente})`;
    b.textContent = texte;
    b.title = s.message || texte;
  });
}

/* ---------- Synchronisation ---------- */

async function apresSynchro(resultat) {
  if (resultat.pastillesModifiees) await chargerPastilles();
  const ficheAffecteeEnCours = resultat.datesModifiees.has(etat.date);
  if (ficheAffecteeEnCours && !texteEnAttente) {
    etat.fiche = await chargerFiche(etat.date);
    rendre();
  } else if (resultat.pastillesModifiees) {
    rendre();
  }
}

export async function synchroComplete() {
  await viderSaisieEnAttente();
  return synchroniser({ tirer: true });
}

/* ---------- Cycle de vie ---------- */

function verifierChangementDeJour() {
  const nouveau = jourCourant(reglage('bascule'));
  if (nouveau === etat.aujourdhui) return false;
  const etaitAujourdhui = etat.date === etat.aujourdhui;
  etat.aujourdhui = nouveau;
  if (etaitAujourdhui) allerA(nouveau); else majEntete();
  return true;
}

export function reglagesModifies() {
  verifierChangementDeJour();
  majEntete();
}

async function demarrer() {
  // Nettoyage de la base de test de l'étape 1.
  try { indexedDB.deleteDatabase('todays-mood-partage'); } catch { /* sans importance */ }

  await chargerReglages();
  await chargerPastilles();
  construireEntete();
  surDonnees(apresSynchro);
  surPhotoEnvoyee(async (date, champ, lien) => {
    await appliquerChamps(date, { [champ]: lien });
    if (date === etat.date && (etat.onglet === 'matin' || etat.onglet === 'journee')) rendre();
  });
  $('version').textContent = VERSION;

  etat.aujourdhui = jourCourant(reglage('bascule'));
  await allerA(etat.aujourdhui, { onglet: ongletSelonHeure() });

  const params = new URLSearchParams(location.search);
  if (params.has('partage') || params.has('erreur-partage')) {
    history.replaceState(null, '', location.pathname);
    await traiterPartage({
      id: Number(params.get('partage')),
      erreur: params.get('erreur-partage'),
      jour: () => etat.aujourdhui,
      chargerFiche,
      enregistrer: (date, modifs) => appliquerChamps(date, modifs),
      ouvrirRecit: async () => {
        await allerA(etat.aujourdhui, { onglet: 'soir' });
        document.getElementById('carte-recit')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
    });
  }

  // D'abord relire le Sheet (la météo du jour y est peut-être déjà), puis la météo automatique.
  synchroComplete().finally(meteoAutomatique);

  // Les copies locales des photos de plus de 60 jours sont effacées (elles restent sur Drive).
  TMDB.purgerPhotos(decaler(etat.aujourdhui, -60)).catch(() => {});

  window.addEventListener('online', () => { synchroComplete(); meteoAutomatique(); });
  window.addEventListener('offline', () => synchroniser());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      viderSaisieEnAttente().then(() => synchroniser());
    } else {
      verifierChangementDeJour();
      synchroComplete();
      meteoAutomatique();
    }
  });
  window.addEventListener('pagehide', () => { viderSaisieEnAttente(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker :', err));
  }
}

demarrer().catch((err) => {
  console.error(err);
  $('contenu').replaceChildren(el('section', { class: 'carte' },
    el('h2', {}, 'Erreur au démarrage'), el('p', { class: 'erreur' }, String(err && err.message || err))));
});
