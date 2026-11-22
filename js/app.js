/* Today's Mood — point d'entrée de l'app. */
import { el, icone } from './ui.js';
import { COLONNES, ONGLETS, PASTILLES_DEFAUT } from './donnees.js';
import { jourCourant, decaler, formatLong, relatif, maintenant, simulationActive, arreterSimulation, estLeSoir } from './jour.js';
import { chargerReglages, reglage, definirReglage } from './reglages.js';
import { synchroniser, planifier, surEtat, surDonnees, surPhotoEnvoyee } from './sync.js';
import { rendreOnglet, carteMeteo } from './onglets.js';
import { chercherMeteo } from './meteo.js';
import { enregistrerPhoto, supprimerPhoto, photoAffichable } from './photos.js';
import { calculerTotaux } from './stats.js';
import { calculerSeries } from './series.js';
import { ouvrirReglages } from './ecran-reglages.js';
import { traiterPartage } from './ecran-partage.js';
import * as verrou from './verrou.js';
import { tirerPensee, definirFavori, chargerBase } from './pensees.js';
import { ouvrirBilan, bilanAutomatique } from './ecran-bilan.js';
import { attendreAucunEcran } from './ecran.js';
import { afficherPensee, ouvrirFavoris } from './ecran-pensee.js';
import { ouvrirHistorique } from './ecran-historique.js';

export const VERSION = 'v2b-1';

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
  // Mode simulation : on montre l'effet à l'écran, mais rien n'est enregistré.
  if (simulationActive()) {
    majVoyants();
    return chaine;
  }
  const modifieLe = new Date().toISOString();
  if (etat.fiche && etat.fiche.date === date) etat.fiche.modifie_le = modifieLe;
  chaine = chaine.then(() => TMDB.modifierFiche(date, modifs, modifieLe)).catch((err) => {
    console.error(err);
    alert('Impossible d’enregistrer sur le téléphone : ' + err.message);
  });
  planifier();
  chaine.then(() => majVoyants());
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
  if (simulationActive()) return;
  const date = etat.aujourdhui;
  const f = etat.fiche && etat.fiche.date === date ? etat.fiche : await TMDB.lire('fiches', date);
  if (f && f.meteo_code != null) return;
  actualiserMeteo(date, { auto: true });
}

/* ---------- Eau : pile des ajouts du jour (pour « annuler le dernier ajout ») ---------- */

const cleAjoutsEau = (date) => 'eauAjouts:' + date;
const ajoutsEau = (date) => reglage(cleAjoutsEau(date)) || [];

/* ---------- Pensée du jour ---------- */

const dureePensee = () => Number(reglage('dureePensee')) || 30;

let penseeEnCours = null;

/** À la première ouverture du jour : tire la pensée (si la fiche n'en a pas) et l'affiche une fois. */
function penseeDuJour() {
  if (!penseeEnCours) penseeEnCours = executerPenseeDuJour().finally(() => { penseeEnCours = null; });
  return penseeEnCours;
}

async function executerPenseeDuJour() {
  const date = etat.aujourdhui;
  try {
    let id = (etat.fiche && etat.fiche.date === date ? etat.fiche : await chargerFiche(date)).pensee_id;
    if (!id && simulationActive()) {
      // Simulation : une pensée au hasard, sans rien enregistrer.
      const base = await chargerBase();
      id = base[Math.floor(Math.random() * base.length)].id;
    } else if (!id) {
      id = await tirerPensee(date);
      await appliquerChamps(date, { pensee_id: id });
      planifier();
      if (etat.date === date && etat.onglet === 'matin') rendre();
    }
    if (reglage('penseeAfficheeLe') === date) return;
    await definirReglage('penseeAfficheeLe', date);
    await afficherPensee({ id, date, duree: dureePensee(), surFavori: () => planifier() });
  } catch (err) {
    console.warn('Pensée du jour :', err);
  }
}

/* ---------- Bilan du dimanche ---------- */

/** Le dimanche, à la première ouverture après l'heure du soir : le bilan de la semaine (une fois). */
async function bilanDuDimanche() {
  await penseeEnCours;
  await attendreAucunEcran();
  await bilanAutomatique({
    aujourdhui: etat.aujourdhui,
    heureSoir: heureSoir(),
    objectifEau: ctx.objectifEau,
    hiver: ctx.hiver,
    reports: ctx.reportsSaisons,
  });
}

/* ---------- Voyants du tableau de bord ---------- */

const heureSoir = () => Number(reglage('heureSoir')) || 18;

/** Champs à remplir chaque jour, par onglet (`soir` : seulement à partir de l'heure du soir). */
const VOYANTS = {
  matin: { soir: false, champs: ['humeur_matin', 'energie', 'inspiration', 'meteo_ressenti'] },
  journee: { soir: true, champs: ['pas'] },
  soir: { soir: true, champs: ['humeur_soir', 'bilan', 'evt_appreciation', 'accord_parole', 'accord_personnel', 'accord_supposition', 'accord_mieux'] },
  whatsup: { soir: true, champs: ['cuisine', 'deplacement'] },
};

let voyantsEnCours = null;
async function majVoyants() {
  if (voyantsEnCours) return voyantsEnCours;
  voyantsEnCours = (async () => {
    const jour = etat.aujourdhui;
    if (!jour) return;
    const f = etat.fiche && etat.fiche.date === jour ? etat.fiche : await chargerFiche(jour);
    const leSoir = estLeSoir(jour, heureSoir(), maintenant());
    for (const b of document.querySelectorAll('.onglet')) {
      const regle = VOYANTS[b.dataset.onglet];
      const allume = !!regle && (!regle.soir || leSoir) && regle.champs.some((c) => f[c] == null || f[c] === '');
      const voyant = b.querySelector('.voyant');
      if (!voyant) continue;
      voyant.classList.toggle('allume', allume);
      b.setAttribute('aria-description', allume ? 'reste à remplir aujourd’hui' : '');
    }
  })().finally(() => { voyantsEnCours = null; });
  return voyantsEnCours;
}

let demandeEmpreinte = false;

const CUISINIERS_DEFAUT = 'Nico,Danis,Commande';

const ctx = {
  get fiche() { return etat.fiche; },
  /** Séries en cours (jours d'affilée) au jour affiché. */
  async series() {
    await viderSaisieEnAttente();
    const [fiches, marches] = await Promise.all([TMDB.tout('fiches'), TMDB.tout('marches')]);
    // En simulation, la fiche affichée n'est pas enregistrée : on tient compte de ce qui est à l'écran.
    const avecCourante = fiches.filter((f) => f.date !== etat.fiche.date).concat([etat.fiche]);
    return calculerSeries(avecCourante, marches, etat.date, ctx.objectifEau);
  },
  /** Toutes les fiches locales, après enregistrement de la saisie en cours. */
  async fiches() {
    await viderSaisieEnAttente();
    return TMDB.tout('fiches');
  },
  get cuisiniers() {
    return String(reglage('cuisiniers') ?? CUISINIERS_DEFAUT).split(',').map((x) => x.trim()).filter(Boolean);
  },
  /** Reports de saison (Réglages) : [{ type: 'hiver' | 'ete', saison, nombre, premier? }] */
  get reportsSaisons() {
    try {
      const r = JSON.parse(reglage('reportsSaisons') || '[]');
      return Array.isArray(r) ? r : [];
    } catch {
      return [];
    }
  },
  get hiver() {
    return { debut: reglage('hiverDebut') || '10-01', fin: reglage('hiverFin') || '04-30' };
  },
  pensee: {
    revoir: (id) => afficherPensee({ id, duree: dureePensee(), surFavori: () => { planifier(); rendre(); } }),
    async favori(id, v) { await definirFavori(id, v); planifier(); },
    ouvrirFavoris: () => ouvrirFavoris({ surChangement: () => { planifier(); if (etat.onglet === 'matin') rendre(); } }),
  },
  /** Vrai une seule fois juste après un appui sur l'onglet Perso : l'empreinte est alors demandée tout de suite. */
  consommerDemandeEmpreinte() {
    const d = demandeEmpreinte;
    demandeEmpreinte = false;
    return d;
  },
  get objectifEau() { return Number(reglage('objectifEau')) || 2000; },
  async totaux() {
    await viderSaisieEnAttente();
    return calculerTotaux(etat.date, ctx.objectifEau);
  },
  eau: {
    ajouts: () => ajoutsEau(etat.date),
    async ajouter(ml) {
      const date = etat.date;
      await definirReglage(cleAjoutsEau(date), [...ajoutsEau(date), ml]);
      return appliquerChamps(date, { eau_ml: (etat.fiche.eau_ml || 0) + ml });
    },
    async annuler() {
      const date = etat.date;
      const pile = ajoutsEau(date);
      if (!pile.length) return;
      const ml = pile[pile.length - 1];
      await definirReglage(cleAjoutsEau(date), pile.slice(0, -1));
      const reste = Math.max(0, (etat.fiche.eau_ml || 0) - ml);
      return appliquerChamps(date, { eau_ml: reste === 0 ? null : reste });
    },
  },
  marches: {
    async ajouter(km) {
      if (simulationActive()) return;
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      await TMDB.ajouterMarche({ id, date: etat.date, km });
      planifier();
    },
    async supprimer(id) {
      await TMDB.supprimerMarche(id);
      planifier();
    },
  },
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

/* ---------- Catégories d'événement (Réglages) ---------- */

const triees = () => [...etat.pastilles].sort((a, b) => a.ordre - b.ordre);

async function enregistrerCategories(liste) {
  etat.pastilles = liste.map((p, i) => ({ ...p, ordre: i + 1 }));
  await TMDB.enregistrerPastilles(etat.pastilles);
  planifier();
}

const categories = {
  liste: triees,
  async ajouter(nom) {
    if (etat.pastilles.some((p) => p.nom.toLowerCase() === nom.toLowerCase())) return { ok: false, message: 'Cette catégorie existe déjà.' };
    await enregistrerCategories([...triees(), { nom, visible: true }]);
    return { ok: true };
  },
  async renommer(ancien, nouveau) {
    if (!nouveau) return { ok: false, message: 'Le nom ne peut pas être vide.' };
    if (nouveau === ancien) return { ok: true };
    if (etat.pastilles.some((p) => p.nom !== ancien && p.nom.toLowerCase() === nouveau.toLowerCase())) {
      return { ok: false, message: 'Une autre catégorie porte déjà ce nom.' };
    }
    await enregistrerCategories(triees().map((p) => (p.nom === ancien ? { ...p, nom: nouveau } : p)));
    // Les fiches qui utilisaient l'ancien nom suivent le renommage.
    await viderSaisieEnAttente();
    const concernees = (await TMDB.tout('fiches')).filter((f) => f.evt_categorie === ancien);
    for (const f of concernees) await appliquerChamps(f.date, { evt_categorie: nouveau });
    return { ok: true, message: concernees.length ? `${concernees.length} fiche(s) mise(s) à jour.` : '' };
  },
  async basculerVisible(nom) {
    await enregistrerCategories(triees().map((p) => (p.nom === nom ? { ...p, visible: p.visible === false } : p)));
  },
  async deplacer(nom, delta) {
    const liste = triees();
    const i = liste.findIndex((p) => p.nom === nom);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    await enregistrerCategories(liste);
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
  majVoyants();
}

export async function allerA(date, { onglet } = {}) {
  await viderSaisieEnAttente();
  if (date > etat.aujourdhui) date = etat.aujourdhui;
  etat.date = date;
  if (onglet && etat.onglet === 'perso' && onglet !== 'perso') verrou.verrouiller();
  if (onglet) etat.onglet = onglet;
  etat.fiche = await chargerFiche(date);
  rendre();
}

function changerOnglet(id) {
  if (id === etat.onglet) return;
  viderSaisieEnAttente();
  if (etat.onglet === 'perso') verrou.verrouiller(); // Perso se reverrouille dès qu'on le quitte
  demandeEmpreinte = id === 'perso';
  etat.onglet = id;
  rendre();
  window.scrollTo({ top: 0 });
}

function ongletSelonHeure() {
  const h = maintenant().getHours();
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
    }, o.id === 'perso' ? icone('cadenas', 'petite') : null, o.nom, el('span', { class: 'voyant', 'aria-hidden': 'true' }));
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

  const reglagesComplets = () => ouvrirReglages({
    synchroComplete, categories,
    reglagesModifies: () => reglagesModifies(),
  });
  $('btn-reglages').addEventListener('click', reglagesComplets);
  $('btn-sync').addEventListener('click', reglagesComplets);
  $('btn-historique').append(icone('historique'));
  $('btn-historique').addEventListener('click', async () => {
    await viderSaisieEnAttente();
    ouvrirHistorique({
      aujourdhui: etat.aujourdhui,
      categories: triees().map((p) => p.nom),
      allerA: (date, onglet) => allerA(date, { onglet }),
      ouvrirFavoris: () => ctx.pensee.ouvrirFavoris(),
      ouvrirBilan: () => ouvrirBilan({
        semaine: etat.aujourdhui, aujourdhui: etat.aujourdhui, objectifEau: ctx.objectifEau, hiver: ctx.hiver, reports: ctx.reportsSaisons,
      }),
    });
  });

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
  if (texteEnAttente) return; // ne pas effacer une saisie en cours ; la suite viendra à la prochaine synchro
  if (resultat.reglagesModifies && verifierChangementDeJour()) return;
  let redessiner = false;
  if (resultat.pastillesModifiees) {
    await chargerPastilles();
    redessiner = true;
  }
  if (resultat.datesModifiees.has(etat.date)) {
    etat.fiche = await chargerFiche(etat.date);
    redessiner = true;
  }
  if (resultat.marchesModifiees && etat.onglet === 'journee') redessiner = true;
  if (resultat.penseesModifiees && etat.onglet === 'matin') redessiner = true;
  if (resultat.reglagesModifies) redessiner = true;
  if (redessiner) rendre();
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
  if (!verifierChangementDeJour()) rendre();
}

function afficherBandeauSimulation() {
  if (!simulationActive()) return;
  const fmt = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const texte = el('span');
  const maj = () => { texte.textContent = `Simulation : ${fmt.format(maintenant())} · rien n’est enregistré`; };
  maj();
  setInterval(maj, 30000);
  document.body.prepend(el('div', { class: 'bandeau-simulation', role: 'status' }, texte,
    el('button', { type: 'button', class: 'bouton petit', onClick: () => { arreterSimulation(); location.reload(); } }, 'Arrêter')));
}

async function demarrer() {
  // Nettoyage de la base de test de l'étape 1.
  try { indexedDB.deleteDatabase('todays-mood-partage'); } catch { /* sans importance */ }

  await chargerReglages();
  await chargerPastilles();
  construireEntete();
  surDonnees(apresSynchro);
  verrou.surChangement(() => { if (etat.onglet === 'perso') rendre(); });
  surPhotoEnvoyee(async (date, champ, lien) => {
    await appliquerChamps(date, { [champ]: lien });
    if (date === etat.date && (etat.onglet === 'matin' || etat.onglet === 'journee')) rendre();
  });
  $('version').textContent = VERSION;
  afficherBandeauSimulation();

  etat.aujourdhui = jourCourant(reglage('bascule'));
  await allerA(etat.aujourdhui, { onglet: ongletSelonHeure() });

  const params = new URLSearchParams(location.search);
  const ouvertParPartage = params.has('partage') || params.has('erreur-partage');
  if (ouvertParPartage) {
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
      ouvrirMyLove: async () => {
        await allerA(etat.aujourdhui, { onglet: 'perso' });
        document.getElementById('carte-mylove')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
    });
  }

  // D'abord relire le Sheet (la météo et la pensée du jour y sont peut-être déjà), puis la météo
  // automatique. La pensée n'attend la synchro que 3 s au plus, pour s'afficher dès l'ouverture.
  const premiereSynchro = synchroComplete();
  premiereSynchro.finally(meteoAutomatique);
  if (!ouvertParPartage) {
    Promise.race([premiereSynchro, new Promise((r) => setTimeout(r, 3000))]).then(penseeDuJour).then(bilanDuDimanche);
  }
  // Voyants et passage de 18 h (ou de l'heure de bascule) pendant que l'app reste ouverte.
  setInterval(() => { verifierChangementDeJour(); majVoyants(); }, 60 * 1000);

  // Les copies locales des photos de plus de 60 jours sont effacées (elles restent sur Drive).
  TMDB.purgerPhotos(decaler(etat.aujourdhui, -60)).catch(() => {});

  window.addEventListener('online', () => { synchroComplete(); meteoAutomatique(); });
  window.addEventListener('offline', () => synchroniser());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Arrière-plan : Perso se reverrouille (sauf pendant la demande d'empreinte elle-même).
      if (!verrou.authentificationActive() && verrou.estDeverrouille()) verrou.verrouiller();
      viderSaisieEnAttente().then(() => synchroniser());
    } else {
      const nouveauJour = verifierChangementDeJour();
      synchroComplete();
      meteoAutomatique();
      majVoyants();
      if (nouveauJour || reglage('penseeAfficheeLe') !== etat.aujourdhui) penseeDuJour().then(bilanDuDimanche);
      else bilanDuDimanche();
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
