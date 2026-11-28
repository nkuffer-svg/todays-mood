/* Historique : calendrier des fiches, recherche par événement, mémos marqués et export Word. */
import { el, icone, segments } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte, versTexte } from './jour.js';
import { reglage, definirReglage } from './reglages.js';
import { creerDocx } from './docx.js';
import * as verrou from './verrou.js';
import { LIBELLES } from './donnees.js';
import { decrireCode, estBise, seuilsBise, ventDe } from './meteo.js';
import { lune, nomPhase } from './astro.js';
import { cleMot, motsUtilises } from './mots.js';

const fmtCourt = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMois = new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' });
const fmtHorodatage = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeStyle: 'short' });
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dateCourte = (d) => fmtCourt.format(depuisTexte(d));
const dateLongue = (d) => majuscule(fmtLong.format(depuisTexte(d)).replace(',', ''));
const debut = (texte, n = 110) => {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
};

/** Une fiche contient-elle autre chose que sa date ? */
const ficheRemplie = (f) => Object.entries(f).some(([k, v]) => k !== 'date' && k !== 'modifie_le' && v != null && v !== '');

/** Sélection multiple de pastilles (chaque pastille s'allume ou s'éteint). */
function pastillesMultiples({ options, choisies, onChange, etiquette }) {
  const groupe = el('div', { class: 'pastilles', role: 'group', 'aria-label': etiquette });
  for (const opt of options) {
    const b = el('button', { type: 'button', class: 'pastille', 'aria-pressed': String(choisies.has(opt.valeur)) }, opt.libelle);
    b.addEventListener('click', () => {
      if (choisies.has(opt.valeur)) choisies.delete(opt.valeur); else choisies.add(opt.valeur);
      b.setAttribute('aria-pressed', String(choisies.has(opt.valeur)));
      onChange();
    });
    groupe.append(b);
  }
  return groupe;
}

/* ---------- Calendrier ---------- */

function vueCalendrier({ fiches, aujourdhui, ouvrir, etatVue }) {
  const zone = el('div', { class: 'calendrier' });
  const parDate = new Map(fiches.filter(ficheRemplie).map((f) => [f.date, f]));

  function dessiner() {
    const [a, m] = etatVue.mois.split('-').map(Number);
    const premier = new Date(a, m - 1, 1);
    const nbJours = new Date(a, m, 0).getDate();
    const decalage = (premier.getDay() + 6) % 7; // lundi en premier
    const moisSuivant = versTexte(new Date(a, m, 1)).slice(0, 7);
    const grille = el('div', { class: 'cal-grille', role: 'grid' },
      ...['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => el('span', { class: 'cal-entete', 'aria-hidden': 'true' }, j)),
      ...Array.from({ length: decalage }, () => el('span')));
    let nbFiches = 0;
    for (let j = 1; j <= nbJours; j++) {
      const date = `${etatVue.mois}-${String(j).padStart(2, '0')}`;
      const f = parDate.get(date);
      if (f) nbFiches++;
      const marque = f && f.evt_appreciation ? (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') : '';
      grille.append(el('button', {
        type: 'button',
        class: ['cal-jour', f ? 'avec-fiche' : '', date === aujourdhui ? 'aujourdhui' : '', marque].filter(Boolean).join(' '),
        disabled: date > aujourdhui,
        'aria-label': dateLongue(date) + (f ? ', fiche remplie' : ''),
        onClick: () => ouvrir(date),
      }, String(j)));
    }
    zone.replaceChildren(
      el('div', { class: 'cal-tete' },
        el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Mois précédent', onClick: () => { etatVue.mois = versTexte(new Date(a, m - 2, 1)).slice(0, 7); dessiner(); } }, icone('gauche')),
        el('p', { class: 'cal-titre' }, majuscule(fmtMois.format(premier))),
        el('button', {
          type: 'button', class: 'bouton-rond', 'aria-label': 'Mois suivant', disabled: moisSuivant > aujourdhui.slice(0, 7),
          onClick: () => { etatVue.mois = moisSuivant; dessiner(); },
        }, icone('droite'))),
      grille,
      el('p', { class: 'discret cal-resume' }, nbFiches ? `${nbFiches} fiche${nbFiches > 1 ? 's' : ''} remplie${nbFiches > 1 ? 's' : ''} ce mois-ci` : 'Aucune fiche ce mois-ci'),
      el('p', { class: 'cal-legende' },
        el('span', { class: 'puce avec-fiche' }), 'fiche remplie',
        el('span', { class: 'puce cool' }), 'événement cool',
        el('span', { class: 'puce pascool' }), 'pas cool'));
  }
  dessiner();
  return zone;
}

/* ---------- Événements ---------- */

function vueEvenements({ fiches, categories, ouvrir, etatVue }) {
  const resultats = el('div', { class: 'resultats' });
  const avecEvenement = fiches
    .filter((f) => f.evt_appreciation || f.evt_categorie || f.evt_texte)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const toutesCategories = [...new Set([...categories, ...avecEvenement.map((f) => f.evt_categorie).filter(Boolean)])];

  function filtrer() {
    const liste = avecEvenement.filter((f) => (!etatVue.appreciation || f.evt_appreciation === etatVue.appreciation)
      && (etatVue.categories.size === 0 || etatVue.categories.has(f.evt_categorie)));
    resultats.replaceChildren(
      el('p', { class: 'discret' }, liste.length ? `${liste.length} événement${liste.length > 1 ? 's' : ''}` : 'Aucun événement ne correspond.'),
      el('ul', { class: 'liste-resultats' }, ...liste.map((f) => el('li', {},
        el('button', { type: 'button', class: 'resultat', onClick: () => ouvrir(f.date, 'soir') },
          el('span', { class: 'resultat-date' }, dateCourte(f.date)),
          el('span', { class: 'resultat-marques' },
            f.evt_appreciation ? el('span', { class: 'pastille statique ' + (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') }, f.evt_appreciation) : null,
            f.evt_categorie ? el('span', { class: 'pastille statique' }, f.evt_categorie) : null),
          f.evt_texte ? el('span', { class: 'resultat-texte' }, debut(f.evt_texte)) : null)))));
  }

  const appreciation = segments({
    etiquette: 'Appréciation',
    options: [{ valeur: 'Cool', libelle: 'Cool' }, { valeur: 'Pas cool', libelle: 'Pas cool' }],
    valeur: etatVue.appreciation,
    onChange: (v) => { etatVue.appreciation = v; filtrer(); },
  });
  filtrer();
  return el('div', {},
    el('p', { class: 'sous-titre-champ' }, 'Appréciation'),
    appreciation,
    el('p', { class: 'discret aide-filtre' }, 'Sans choix : toutes. Touche à nouveau pour désélectionner.'),
    el('p', { class: 'sous-titre-champ' }, 'Catégories'),
    pastillesMultiples({ options: toutesCategories.map((c) => ({ valeur: c, libelle: c })), choisies: etatVue.categories, onChange: filtrer, etiquette: 'Catégories' }),
    el('p', { class: 'discret aide-filtre' }, 'Sans choix : toutes les catégories.'),
    resultats);
}

/* ---------- Humeur moyenne (recherches Météo et Mot) ---------- */

const nf = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Humeur d'un jour : moyenne du matin et du soir (ce qui est saisi), ou null. */
function humeurDuJour(f) {
  const v = [f.humeur_matin, f.humeur_soir].filter((x) => x != null && x !== '').map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function humeurMoyenne(fiches) {
  const v = fiches.map(humeurDuJour).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const texteHumeur = (m) => (m == null ? '—' : `${nf.format(m)} · ${LIBELLES.humeur[Math.min(9, Math.max(1, Math.round(m))) - 1]}`);

/** En-tête des résultats : nombre de jours, humeur moyenne de ces jours et des autres jours. */
function resumeRecherche(trouves, autres) {
  const m = humeurMoyenne(trouves);
  const a = humeurMoyenne(autres);
  const ecart = m != null && a != null ? m - a : null;
  const signe = ecart == null ? '' : ecart > 0.05 ? '+' : ecart < -0.05 ? '−' : '±';
  return el('div', { class: 'resume-recherche' },
    el('p', { class: 'resume-nombre' }, el('strong', {}, String(trouves.length)), trouves.length > 1 ? ' jours trouvés' : ' jour trouvé'),
    el('dl', { class: 'resume-humeurs' },
      el('div', {}, el('dt', {}, 'Humeur de ces jours'), el('dd', {}, texteHumeur(m))),
      el('div', {}, el('dt', {}, 'Les autres jours'), el('dd', {}, texteHumeur(a),
        ecart != null ? el('span', { class: 'ecart-humeur' + (ecart > 0.05 ? ' plus' : ecart < -0.05 ? ' moins' : '') }, ` (${signe}${nf.format(Math.abs(ecart))} pour ces jours)`) : null))));
}

/** « 6 → 7 » : humeur du matin vers le soir. */
function evolutionHumeur(f) {
  const m = f.humeur_matin ?? null;
  const s = f.humeur_soir ?? null;
  if (m == null && s == null) return null;
  const titre = `Humeur : matin ${m == null ? 'non saisie' : LIBELLES.humeur[m - 1]}, soir ${s == null ? 'non saisie' : LIBELLES.humeur[s - 1]}`;
  const sens = m != null && s != null ? (s > m ? ' monte' : s < m ? ' baisse' : '') : '';
  return el('span', { class: 'evolution-humeur' + sens, title: titre, 'aria-label': titre },
    m ?? '–', el('span', { 'aria-hidden': 'true' }, ' → '), s ?? '–');
}

const pastilleAppreciation = (f) => (f.evt_appreciation
  ? el('span', { class: 'pastille statique ' + (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') }, f.evt_appreciation)
  : null);

/* ---------- Météo ---------- */

const FILTRES_METEO = [
  { valeur: 'soleil', libelle: 'Grand soleil' },
  { valeur: 'pluie', libelle: 'Pluie' },
  { valeur: 'neige', libelle: 'Neige' },
  { valeur: 'bise', libelle: 'Bise' },
  { valeur: 'gel', libelle: 'Gel (< 0°)' },
  { valeur: 'chaud', libelle: 'Chaud (> 25°)' },
  { valeur: 'pression', libelle: 'Pression basse' },
  { valeur: 'lune', libelle: 'Pleine lune' },
];

const MOMENTS = [
  { valeur: '8', libelle: '8 h' },
  { valeur: '16', libelle: '16 h' },
  { valeur: 'journee', libelle: 'Journée' },
];

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Météo d'une fiche pour un moment (relevé de 8 h, de 16 h ou journée), ou null si elle manque. */
function meteoDe(f, moment) {
  if (moment === 'journee') {
    if (f.meteo_code == null && f.meteo_tmax == null && f.meteo_tmin == null) return null;
    const pressions = [num(f.meteo8_pression), num(f.meteo16_pression)].filter((p) => p != null);
    const seuils = seuilsBise();
    const v8 = ventDe(f, 8);
    const v16 = ventDe(f, 16);
    // Le pluviomètre Netatmo, s'il existe, a la priorité sur Open-Meteo.
    return {
      code: num(f.meteo_code), tmin: num(f.meteo_tmin), tmax: num(f.meteo_tmax),
      pluie: num(f.nt_pluie_jour) ?? num(f.meteo_pluie_mm), nuages: num(f.meteo_nuages_pct),
      soleil: num(f.meteo_soleil_h), dureeJour: num(f.duree_jour_min),
      bise: estBise(v8.vent, v8.dir, seuils) || estBise(v16.vent, v16.dir, seuils),
      pression: pressions.length ? Math.min(...pressions) : null,
    };
  }
  const v = (c) => num(f[`meteo${moment}_${c}`]);
  if (v('temp') == null) return null;
  // Ta station (module extérieur, anémomètre) en priorité sur Open-Meteo.
  const temp = num(f[`nt${moment}_temp_ext`]) ?? v('temp');
  const vent = ventDe(f, Number(moment));
  return {
    code: v('code'), tmin: temp, tmax: temp, temp,
    pluie: v('pluie'), nuages: v('nuages'),
    bise: estBise(vent.vent, vent.dir),
    pression: v('pression'),
  };
}

const TESTS_METEO = {
  soleil: (m, moment) => [0, 1].includes(m.code)
    || (moment === 'journee'
      ? m.soleil != null && m.dureeJour ? (m.soleil * 60) / m.dureeJour >= 0.7 : false
      : m.nuages != null && m.nuages <= 20),
  pluie: (m, moment) => {
    const ic = decrireCode(m.code)?.icone;
    return ic === 'pluie' || ic === 'orage' || (ic !== 'neige' && m.pluie != null && m.pluie >= (moment === 'journee' ? 1 : 0.1));
  },
  neige: (m) => decrireCode(m.code)?.icone === 'neige',
  bise: (m) => m.bise,
  gel: (m) => m.tmin != null && m.tmin < 0,
  chaud: (m) => m.tmax != null && m.tmax > 25,
  pression: (m) => m.pression != null && m.pression < 1005,
};

const pleineLune = (f) => nomPhase(f.lune_phase ?? lune(f.date).phase) === 'Pleine lune';

function temperatures(f, moment) {
  const m = meteoDe(f, moment);
  if (!m) return null;
  const t = (x) => `${nf.format(x).replace(/,0$/, '')}°`;
  if (moment === 'journee') return m.tmin == null && m.tmax == null ? null : `${m.tmin == null ? '–' : t(m.tmin)} / ${m.tmax == null ? '–' : t(m.tmax)}`;
  return `${moment} h : ${t(m.temp)}`;
}

function vueMeteo({ fiches, ouvrir, etatVue }) {
  const resultats = el('div', { class: 'resultats' });
  const remplies = fiches.filter(ficheRemplie);

  function filtrer() {
    const choisis = [...etatVue.meteo];
    if (!choisis.length) {
      resultats.replaceChildren(el('p', { class: 'etat-vide' }, 'Choisis au moins un filtre.'));
      return;
    }
    const moment = etatVue.moment;
    const tests = choisis.filter((c) => c !== 'lune');
    // Avec un filtre météo, seuls les jours qui ont la météo de ce moment comptent (aussi pour « les autres jours »).
    const base = tests.length ? remplies.filter((f) => meteoDe(f, moment)) : remplies;
    const trouves = base.filter((f) => {
      if (etatVue.meteo.has('lune') && !pleineLune(f)) return false;
      const m = tests.length ? meteoDe(f, moment) : null;
      return tests.every((c) => TESTS_METEO[c](m, moment));
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
    const ids = new Set(trouves.map((f) => f.date));
    const autres = base.filter((f) => !ids.has(f.date));
    const onglet = moment === '16' ? 'soir' : 'matin';
    resultats.replaceChildren(
      resumeRecherche(trouves, autres),
      trouves.length
        ? el('ul', { class: 'liste-resultats' }, ...trouves.map((f) => {
          const icone_ = decrireCode(meteoDe(f, moment)?.code);
          return el('li', {},
            el('button', { type: 'button', class: 'resultat resultat-meteo', onClick: () => ouvrir(f.date, onglet) },
              el('span', { class: 'resultat-date' }, dateCourte(f.date)),
              el('span', { class: 'resultat-marques' },
                icone_ ? el('span', { class: 'resultat-icone', title: icone_.texte }, icone(icone_.icone, 'petite')) : null,
                temperatures(f, moment) ? el('span', { class: 'resultat-temp' }, temperatures(f, moment)) : null,
                evolutionHumeur(f),
                pastilleAppreciation(f))));
        }))
        : el('p', { class: 'etat-vide' }, 'Aucun jour ne correspond.'));
  }

  filtrer();
  return el('div', {},
    el('p', { class: 'sous-titre-champ' }, 'Moment'),
    segments({
      etiquette: 'Moment', obligatoire: true, valeur: etatVue.moment, options: MOMENTS,
      onChange: (v) => { etatVue.moment = v; filtrer(); },
    }),
    el('p', { class: 'sous-titre-champ' }, 'Météo'),
    pastillesMultiples({ options: FILTRES_METEO, choisies: etatVue.meteo, onChange: filtrer, etiquette: 'Filtres météo' }),
    el('p', { class: 'discret aide-filtre' }, 'Les filtres se combinent (tous doivent être vrais). Pleine lune ne dépend pas du moment.'),
    resultats);
}

/* ---------- Mot du jour ---------- */

function vueMots({ fiches, ouvrir, etatVue }) {
  const resultats = el('div', { class: 'resultats' });
  const avecMot = fiches.filter((f) => f.mot_du_jour);
  const mots = motsUtilises(fiches);
  const champ = el('input', {
    type: 'search', class: 'champ', placeholder: 'Chercher un mot', 'aria-label': 'Mot du jour à chercher',
    autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', value: etatVue.mot,
  });
  const nuage = el('div', { class: 'pastilles nuage-mots', role: 'group', 'aria-label': 'Mots les plus utilisés' });

  function filtrer() {
    const cle = cleMot(etatVue.mot.trim());
    for (const b of nuage.children) b.setAttribute('aria-pressed', String(!!cle && cleMot(b.dataset.mot) === cle));
    if (!cle) {
      resultats.replaceChildren(el('p', { class: 'etat-vide' },
        avecMot.length ? 'Tape un mot ou touche un des mots ci-dessus.' : 'Aucun mot du jour pour l’instant (onglet Soir).'));
      return;
    }
    const trouves = avecMot
      .filter((f) => (etatVue.motExact ? cleMot(f.mot_du_jour) === cle : cleMot(f.mot_du_jour).includes(cle)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const ids = new Set(trouves.map((f) => f.date));
    const autres = fiches.filter(ficheRemplie).filter((f) => !ids.has(f.date));
    resultats.replaceChildren(
      resumeRecherche(trouves, autres),
      trouves.length
        ? el('ul', { class: 'liste-resultats' }, ...trouves.map((f) => el('li', {},
          el('button', { type: 'button', class: 'resultat', onClick: () => ouvrir(f.date, 'soir') },
            el('span', { class: 'resultat-date' }, dateCourte(f.date)),
            el('span', { class: 'resultat-marques' },
              el('strong', { class: 'resultat-mot' }, f.mot_du_jour),
              evolutionHumeur(f),
              pastilleAppreciation(f))))))
        : el('p', { class: 'etat-vide' }, 'Aucun jour avec ce mot.'));
  }

  nuage.append(...mots.slice(0, 30).map((m) => {
    const b = el('button', { type: 'button', class: 'pastille', 'aria-pressed': 'false' }, m.mot, el('small', {}, ` ${m.nombre}`));
    b.dataset.mot = m.mot;
    b.addEventListener('click', () => {
      const deja = cleMot(etatVue.mot) === cleMot(m.mot);
      etatVue.mot = deja ? '' : m.mot;
      etatVue.motExact = !deja;
      champ.value = etatVue.mot;
      filtrer();
    });
    return b;
  }));
  champ.addEventListener('input', () => { etatVue.mot = champ.value; etatVue.motExact = false; filtrer(); });
  filtrer();
  return el('div', {},
    champ,
    mots.length ? el('p', { class: 'sous-titre-champ' }, 'Mots les plus utilisés') : null,
    nuage,
    resultats);
}

/* ---------- Mémos marqués + export ---------- */

const TYPES = { recit: 'Récit du jour', mylove: 'My Love' };

function memosMarques(fiches, deverrouille) {
  const memos = [];
  for (const f of fiches) {
    for (const champ of ['recit', 'mylove']) {
      if (champ === 'mylove' && !deverrouille) continue;
      const texte = (f[champ] || '').trim();
      const favori = !!f[champ + '_favori'];
      const piment = !!f[champ + '_piment'];
      if (texte && (favori || piment)) memos.push({ date: f.date, champ, texte, favori, piment, modifieLe: f.modifie_le || '' });
    }
  }
  return memos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.champ === 'recit' ? -1 : 1));
}

const libelleMarques = (m) => [m.favori ? 'Favori' : null, m.piment ? 'Piment' : null].filter(Boolean).join(' · ');

function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function vueMemos({ fiches, ouvrir, etatVue, redessiner }) {
  const deverrouille = verrou.estDeverrouille();
  const tous = memosMarques(fiches, deverrouille);
  const resultats = el('div', { class: 'resultats' });
  const zoneExport = el('div', { class: 'zone-export' });
  const message = el('p', { class: 'resultat-test', role: 'status' });

  const filtres = () => tous.filter((m) => etatVue.types.has(m.champ)
    && ((etatVue.marques.has('favori') && m.favori) || (etatVue.marques.has('piment') && m.piment)));

  function dessinerListe() {
    message.textContent = '';
    const liste = filtres();
    resultats.replaceChildren(
      el('p', { class: 'discret' }, liste.length ? `${liste.length} mémo${liste.length > 1 ? 's' : ''}` : 'Aucun mémo marqué ne correspond.'),
      el('ul', { class: 'liste-resultats' }, ...liste.map((m) => el('li', {},
        el('details', { class: 'memo' },
          el('summary', { class: 'resultat' },
            el('span', { class: 'resultat-date' }, dateCourte(m.date)),
            el('span', { class: 'resultat-marques' },
              el('span', { class: 'pastille statique' }, TYPES[m.champ]),
              m.favori ? el('span', { class: 'marque-icone', title: 'Favori' }, icone('etoile', 'pleine')) : null,
              m.piment ? el('span', { class: 'marque-icone piment', title: 'Piment' }, icone('piment', 'pleine')) : null),
            el('span', { class: 'resultat-texte' }, debut(m.texte))),
          el('div', { class: 'memo-corps' },
            el('p', { class: 'memo-texte' }, m.texte),
            el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrir(m.date, m.champ === 'recit' ? 'soir' : 'perso') }, 'Ouvrir la fiche')))))));
    dessinerExport();
  }

  function dessinerExport() {
    const dernier = reglage('dernierExport');
    const depuis = el('input', { type: 'checkbox', id: 'export-depuis', checked: !!dernier && etatVue.depuisDernier });
    depuis.disabled = !dernier;
    depuis.addEventListener('change', () => { etatVue.depuisDernier = depuis.checked; });
    const bouton = el('button', { type: 'button', class: 'bouton' }, icone('telecharger'), 'Exporter en Word');
    bouton.addEventListener('click', async () => {
      let liste = filtres();
      if (depuis.checked && dernier) liste = liste.filter((m) => m.modifieLe > dernier);
      if (!liste.length) {
        message.className = 'resultat-test erreur';
        message.textContent = 'Rien à exporter avec ces filtres.';
        return;
      }
      const maintenant = new Date();
      const blocs = [
        { type: 'titre', texte: 'Today’s Mood — mémos marqués' },
        { type: 'meta', texte: `Exporté le ${fmtHorodatage.format(maintenant)} · ${liste.length} mémo${liste.length > 1 ? 's' : ''}` + (depuis.checked && dernier ? ` · depuis l’export du ${fmtHorodatage.format(new Date(dernier))}` : '') },
      ];
      for (const m of [...liste].reverse()) { // ordre chronologique dans le document
        blocs.push(
          { type: 'titre1', texte: `${dateLongue(m.date)} — ${TYPES[m.champ]}` },
          { type: 'meta', texte: libelleMarques(m) },
          { type: 'texte', texte: m.texte });
      }
      const nom = `todays-mood-memos-${versTexte(maintenant)}.docx`;
      const blob = creerDocx(blocs);
      const fichier = new File([blob], nom, { type: blob.type });
      let partage = false;
      if (etatVue.viaPartage && navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try {
          await navigator.share({ files: [fichier], title: 'Today’s Mood — mémos marqués' });
          partage = true;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      if (!partage) telecharger(blob, nom);
      await definirReglage('dernierExport', maintenant.toISOString());
      dessinerExport();
      message.className = 'resultat-test succes';
      message.textContent = partage
        ? `${liste.length} mémo(s) exporté(s).`
        : `${liste.length} mémo(s) exporté(s) : fichier « ${nom} » dans tes Téléchargements.`;
    });
    const peutPartager = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })] }));
    const viaPartage = el('input', { type: 'checkbox', id: 'export-partage', checked: etatVue.viaPartage });
    viaPartage.addEventListener('change', () => { etatVue.viaPartage = viaPartage.checked; });
    zoneExport.replaceChildren(...[
      el('h3', { class: 'sous-titre-champ' }, 'Export Word (pour OneNote)'),
      el('p', { class: 'discret' }, 'Exporte les mémos affichés ci-dessus (filtres compris)'
        + (deverrouille ? '.' : ', sans les My Love tant qu’ils sont verrouillés.')),
      el('label', { class: 'case' }, depuis, el('span', {}, 'Seulement depuis le dernier export',
        dernier ? el('small', {}, ` (${fmtHorodatage.format(new Date(dernier))})`) : el('small', {}, ' (aucun export pour l’instant)'))),
      peutPartager ? el('label', { class: 'case' }, viaPartage, el('span', {}, 'Envoyer directement vers une app (OneNote, Drive…)')) : null,
      el('div', { class: 'rangee-boutons' }, bouton),
      message,
    ].filter(Boolean));
  }

  const avertissement = deverrouille ? null : el('div', { class: 'encart' },
    el('p', {}, 'Les My Love sont masqués tant que Perso est verrouillé.'),
    el('button', {
      type: 'button', class: 'bouton petit', onClick: async () => {
        const r = await verrou.demanderAcces();
        if (r.ok) redessiner(); else alert(r.message);
      },
    }, icone('cadenas', 'petite'), ' Afficher les My Love'));

  dessinerListe();
  return el('div', {},
    avertissement,
    el('p', { class: 'sous-titre-champ' }, 'Type'),
    pastillesMultiples({ options: [{ valeur: 'recit', libelle: 'Récit du jour' }, { valeur: 'mylove', libelle: 'My Love' }], choisies: etatVue.types, onChange: dessinerListe, etiquette: 'Type' }),
    el('p', { class: 'sous-titre-champ' }, 'Marque'),
    pastillesMultiples({ options: [{ valeur: 'favori', libelle: 'Favori' }, { valeur: 'piment', libelle: 'Piment' }], choisies: etatVue.marques, onChange: dessinerListe, etiquette: 'Marque' }),
    resultats,
    zoneExport);
}

/* ---------- Écran ---------- */

/**
 * @param {object} o
 * @param {string} o.aujourdhui
 * @param {string[]} o.categories   toutes les catégories (y compris masquées)
 * @param {(date:string, onglet?:string)=>void} o.allerA
 * @param {()=>void} o.ouvrirFavoris
 */
export async function ouvrirHistorique({ aujourdhui, categories, allerA, ouvrirFavoris, ouvrirBilan, ouvrirLivre }) {
  let desabonner = null;
  const { corps, fermer } = ouvrirEcran({ titre: 'Historique', surFermeture: () => desabonner?.() });
  const etatVue = {
    vue: 'calendrier',
    mois: aujourdhui.slice(0, 7),
    appreciation: null,
    categories: new Set(),
    types: new Set(['recit', 'mylove']),
    marques: new Set(['favori', 'piment']),
    depuisDernier: true,
    viaPartage: false,
    moment: 'journee',
    meteo: new Set(),
    mot: '',
    motExact: false,
  };
  const zone = el('div', { class: 'historique-vue' });

  const ouvrir = (date, onglet) => {
    fermer();
    allerA(date, onglet);
  };

  async function redessiner() {
    const fiches = await TMDB.tout('fiches');
    const vues = {
      calendrier: () => vueCalendrier({ fiches, aujourdhui, ouvrir, etatVue }),
      evenements: () => vueEvenements({ fiches, categories, ouvrir, etatVue }),
      meteo: () => vueMeteo({ fiches, ouvrir, etatVue }),
      mots: () => vueMots({ fiches, ouvrir, etatVue }),
      memos: () => vueMemos({ fiches, ouvrir, etatVue, redessiner }),
    };
    zone.replaceChildren(vues[etatVue.vue]());
  }

  // Si Perso se reverrouille (app en arrière-plan), les My Love disparaissent aussitôt de la liste.
  desabonner = verrou.surChangement(() => { if (etatVue.vue === 'memos') redessiner(); });

  const choixVue = segments({
      etiquette: 'Vue', obligatoire: true, valeur: etatVue.vue,
      options: [
        { valeur: 'calendrier', libelle: 'Date' }, { valeur: 'evenements', libelle: 'Événement' },
        { valeur: 'meteo', libelle: 'Météo' }, { valeur: 'mots', libelle: 'Mot' }, { valeur: 'memos', libelle: 'Mémos' }],
      onChange: (v) => { etatVue.vue = v; redessiner(); },
    });
  choixVue.classList.add('segments-vues');
  corps.append(
    choixVue,
    zone,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrirBilan() }, icone('calendrier', 'petite'), ' Bilan du dimanche'),
      ouvrirLivre ? el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrirLivre() }, icone('livre', 'petite'), ' Livre de bord') : null,
      el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrirFavoris() }, icone('etoile', 'petite'), ' Mes pensées favorites')));
  await redessiner();
}
