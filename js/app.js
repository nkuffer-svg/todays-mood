/* Today's Mood — point d'entrée de l'app. */
import { el, icone } from './ui.js';
import { COLONNES, ONGLETS, PASTILLES_DEFAUT } from './donnees.js';
import { jourCourant, decaler, formatLong, relatif } from './jour.js';
import { chargerReglages, reglage } from './reglages.js';
import { synchroniser, planifier, surEtat, surDonnees } from './sync.js';
import { rendreOnglet } from './onglets.js';
import { ouvrirReglages } from './ecran-reglages.js';
import { traiterPartage } from './ecran-partage.js';

export const VERSION = 'etape2-v1';

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

/* Enregistrement : les écritures sont mises à la suite pour garder l'ordre. */
let chaine = Promise.resolve();
let minuteurTexte = null;
let ficheEnAttente = null;

function sauver(fiche) {
  fiche.modifie_le = new Date().toISOString();
  const copie = { ...fiche };
  chaine = chaine.then(() => TMDB.enregistrerFiche(copie)).catch((err) => {
    console.error(err);
    alert('Impossible d’enregistrer sur le téléphone : ' + err.message);
  });
  planifier();
  return chaine;
}

/** Enregistre tout de suite une saisie en attente (texte en cours de frappe). */
function viderSaisieEnAttente() {
  clearTimeout(minuteurTexte);
  if (ficheEnAttente) {
    const f = ficheEnAttente;
    ficheEnAttente = null;
    return sauver(f);
  }
  return chaine;
}

function normaliser(valeur) {
  if (typeof valeur === 'string' && valeur.trim() === '') return null;
  return valeur ?? null;
}

const ctx = {
  get fiche() { return etat.fiche; },
  get pastilles() { return etat.pastilles.filter((p) => p.visible !== false).sort((a, b) => a.ordre - b.ordre).map((p) => p.nom); },
  modifier(champ, valeur) {
    const f = etat.fiche;
    f[champ] = normaliser(valeur);
    clearTimeout(minuteurTexte);
    ficheEnAttente = null;
    return sauver(f);
  },
  modifierTexte(champ, valeur) {
    const f = etat.fiche;
    f[champ] = normaliser(valeur);
    ficheEnAttente = f;
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
  if (ficheAffecteeEnCours && !ficheEnAttente) {
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
      enregistrer: async (fiche) => { await sauver(fiche); },
      ouvrirRecit: async () => {
        await allerA(etat.aujourdhui, { onglet: 'soir' });
        document.getElementById('carte-recit')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      },
    });
  }

  synchroComplete();

  window.addEventListener('online', () => synchroComplete());
  window.addEventListener('offline', () => synchroniser());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      viderSaisieEnAttente().then(() => synchroniser());
    } else {
      verifierChangementDeJour();
      synchroComplete();
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
