/* Onglet What's up : cuisine du soir, guitare, feux de poêle / barbecues, moto ou voiture.
   Tous les totaux sont calculés à partir des fiches, jamais stockés.
   ctx (en plus de l'habituel) : fiches() → toutes les fiches locales, cuisiniers, hiver { debut, fin } (« MM-JJ ») */
import { el, svg, icone, carte, segments, clac } from './ui.js';
import { depuisTexte, decaler } from './jour.js';
import { plaque } from './series.js';

const fmt = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });
const fmtDate = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const nombre = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);
const pluriel = (n, mot) => `${fmt.format(n)} ${mot}${n > 1 ? 's' : ''}`;
const feux = (n) => `${fmt.format(n)} feu${n > 1 ? 'x' : ''}`;

/** Les noms d'une valeur « cuisine » (« Nico,Danis »). */
export const nomsCuisine = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);

/* ---------- Saisons (hiver = poêle, été = barbecue) ---------- */

/** Vrai si la date (AAAA-MM-JJ) tombe dans l'hiver défini par deux bornes « MM-JJ » incluses. */
export function estHiver(date, { debut, fin }) {
  const md = date.slice(5);
  return debut <= fin ? md >= debut && md <= fin : md >= debut || md <= fin;
}

const saisonDe = (date, hiver) => (estHiver(date, hiver) ? 'hiver' : 'ete');

/** Bornes de la saison `type` qui contient `date`, ou de la dernière saison de ce type avant `date`. */
export function bornesSaison(date, type, hiver) {
  let d = date;
  for (let i = 0; i < 400 && saisonDe(d, hiver) !== type; i++) d = decaler(d, -1);
  let debut = d;
  for (let i = 0; i < 400 && saisonDe(decaler(debut, -1), hiver) === type; i++) debut = decaler(debut, -1);
  let fin = d;
  for (let i = 0; i < 400 && saisonDe(decaler(fin, 1), hiver) === type; i++) fin = decaler(fin, 1);
  return { debut, fin };
}

/** Nom d'une saison : « 2026-2027 » (à cheval sur deux années) ou « 2026 ». */
export function libelleSaison({ debut, fin }) {
  const a = debut.slice(0, 4);
  const b = fin.slice(0, 4);
  return a === b ? a : `${a}-${b}`;
}

/** Report d'une saison (feux ou barbecues faits avant l'app) : { nombre, premier } ou null. */
function reportDe(reports, type, saison) {
  return reports.find((r) => r.type === type && r.saison === saison) || null;
}

/* ---------- Petits composants ---------- */

/** Totaux sous un compteur : le chiffre du jour est déjà affiché en grand à côté du bouton. */
function blocTotaux(cases) {
  return el('dl', { class: 'totaux totaux-deux' }, ...cases.map(([libelle, valeur, detail]) => el('div', {},
    el('dt', {}, libelle), el('dd', {}, valeur), detail ? el('dd', { class: 'detail' }, detail) : null)));
}

/** Gros bouton rond laiton (+1) avec une icône foncée. */
function grosBouton({ nomIcone, libelle, onClick }) {
  return el('button', { type: 'button', class: 'bouton-plus-un', 'aria-label': libelle, onClick },
    icone(nomIcone, 'icone-grande'), el('span', { class: 'mention' }, '+1'));
}

/** Compteur +1 / −1 générique, avec ses totaux recalculés à chaque changement. */
function compteur(ctx, { champ, nomIcone, libelle, totaux }) {
  const valeur = el('span', { class: 'compteur-valeur', 'aria-live': 'polite' });
  const moins = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': `${libelle} : moins un` }, icone('moins'));
  const zoneTotaux = el('div');
  async function maj() {
    const n = nombre(ctx.fiche[champ]);
    valeur.textContent = fmt.format(n);
    moins.disabled = n === 0;
    zoneTotaux.replaceChildren(...(await totaux(await ctx.fiches())).filter(Boolean));
  }
  async function changer(delta) {
    clac();
    const n = Math.max(0, nombre(ctx.fiche[champ]) + delta);
    await ctx.modifier(champ, n === 0 ? null : n);
    maj();
  }
  moins.addEventListener('click', () => changer(-1));
  maj();
  return el('div', { class: 'compteur-plus-un' },
    el('div', { class: 'ligne-plus-un' },
      grosBouton({ nomIcone, libelle: `${libelle} : plus un`, onClick: () => changer(1) }),
      el('div', { class: 'jour-plus-un' }, el('span', { class: 'biscotte-etiquette' }, 'Aujourd’hui'), valeur),
      moins),
    zoneTotaux);
}

/* ---------- Who's the cook ? ---------- */

function drapeauDamier() {
  const s = svg('svg', { viewBox: '0 0 48 12', class: 'damier', 'aria-hidden': 'true' });
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 4; y++) {
      if ((x + y) % 2 === 0) s.append(svg('rect', { x: x * 3, y: y * 3, width: 3, height: 3 }));
    }
  }
  return s;
}

function tableauDesChefs(fiches, date) {
  const mois = date.slice(0, 7);
  const parNom = new Map();
  let carnivore = 0;
  let vegetarien = 0;
  for (const f of fiches) {
    if (!f.date.startsWith(mois)) continue;
    for (const nom of nomsCuisine(f.cuisine)) parNom.set(nom, (parNom.get(nom) || 0) + 1);
    if (f.repas_type === 'carnivore') carnivore++;
    if (f.repas_type === 'vegetarien') vegetarien++;
  }
  const classement = [...parNom.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const nomMois = new Intl.DateTimeFormat('fr-CH', { month: 'long' }).format(depuisTexte(date));
  return el('div', { class: 'panneau-course' },
    el('div', { class: 'panneau-tete' }, drapeauDamier(), el('span', {}, `Tableau des chefs · ${nomMois}`), drapeauDamier()),
    classement.length
      ? el('ol', { class: 'classement' }, ...classement.map(([nom, n], i) => el('li', {},
        el('span', { class: 'position' }, `P${i + 1}`),
        el('span', { class: 'pilote' }, nom),
        el('span', { class: 'score' }, fmt.format(n)))))
      : el('p', { class: 'panneau-vide' }, 'Aucun repas noté ce mois-ci'),
    el('div', { class: 'panneau-pied' },
      el('span', {}, icone('pilon', 'petite'), ` Carnivore ${fmt.format(carnivore)}`),
      el('span', {}, icone('feuille', 'petite'), ` Végétarien ${fmt.format(vegetarien)}`)));
}

function carteCuisine(ctx) {
  const noms = [...ctx.cuisiniers];
  for (const n of nomsCuisine(ctx.fiche.cuisine)) if (!noms.includes(n)) noms.push(n); // nom retiré de la liste
  const choisis = new Set(nomsCuisine(ctx.fiche.cuisine));
  const zoneTableau = el('div');
  const majTableau = async () => zoneTableau.replaceChildren(tableauDesChefs(await ctx.fiches(), ctx.fiche.date));

  const pastilles = el('div', { class: 'pastilles', role: 'group', 'aria-label': 'Qui a cuisiné' }, ...noms.map((nom) => {
    const b = el('button', { type: 'button', class: 'pastille', 'aria-pressed': String(choisis.has(nom)) }, nom);
    b.addEventListener('click', async () => {
      if (choisis.has(nom)) choisis.delete(nom); else choisis.add(nom);
      b.setAttribute('aria-pressed', String(choisis.has(nom)));
      const valeur = noms.filter((n) => choisis.has(n)).join(',');
      await ctx.modifier('cuisine', valeur || null);
      majTableau();
    });
    return b;
  }));

  let type = ctx.fiche.repas_type ?? null;
  const TYPES = [
    { valeur: 'carnivore', libelle: 'Carnivore', icone: 'pilon' },
    { valeur: 'vegetarien', libelle: 'Végétarien', icone: 'feuille' },
  ];
  const tuiles = TYPES.map((t) => el('button', {
    type: 'button', class: 'tuile-visage tuile-repas', 'aria-pressed': String(type === t.valeur), 'aria-label': t.libelle,
    onClick: async () => {
      type = type === t.valeur ? null : t.valeur;
      tuiles.forEach((x, i) => x.setAttribute('aria-pressed', String(type === TYPES[i].valeur)));
      await ctx.modifier('repas_type', type);
      majTableau();
    },
  }, icone(t.icone), el('span', {}, t.libelle)));

  majTableau();
  return carte('Who’s the cook ?',
    el('p', { class: 'sous-titre-champ' }, 'Aux fourneaux ce soir'),
    pastilles,
    el('p', { class: 'sous-titre-champ' }, 'Au menu'),
    el('div', { class: 'repas' }, ...tuiles),
    zoneTableau);
}

/* ---------- Tu grattes ou quoi ? ---------- */

function carteGuitare(ctx) {
  return carte('Tu grattes ou quoi ?', compteur(ctx, {
    champ: 'guitare', nomIcone: 'mediator', libelle: 'Guitare',
    totaux: async (fiches) => {
      const mois = ctx.fiche.date.slice(0, 7);
      const serie = (await ctx.series()).guitare;
      let m = 0;
      let t = 0;
      for (const f of fiches) {
        const n = nombre(f.guitare);
        t += n;
        if (f.date.startsWith(mois)) m += n;
      }
      return [blocTotaux([['Mois', pluriel(m, 'session')], ['Total', pluriel(t, 'session')]]), plaque(serie)];
    },
  }));
}

/* ---------- Burn on the fire ---------- */

const modesForces = new Map(); // date → 'hiver' | 'ete' choisi à la main (le temps de la session)

function carteFeu(ctx) {
  const date = ctx.fiche.date;
  const auto = saisonDe(date, ctx.hiver);
  let mode = modesForces.get(date) || auto;
  const zone = el('div');

  function dessiner() {
    const hiver = mode === 'hiver';
    const champ = hiver ? 'feux_poele' : 'barbecues';
    zone.replaceChildren(compteur(ctx, {
      champ,
      nomIcone: hiver ? 'flamme' : 'gril',
      libelle: hiver ? 'Feu de poêle' : 'Barbecue',
      totaux: (fiches) => {
        const saison = bornesSaison(date, mode, ctx.hiver);
        // Reports de saison (Réglages) : feux ou barbecues faits avant l'app, ajoutés aux totaux.
        const reports = ctx.reportsSaisons.filter((r) => r.type === mode);
        const reportActuel = reportDe(reports, mode, libelleSaison(saison));
        let s = nombre(reportActuel?.nombre);
        let t = reports.reduce((somme, r) => somme + nombre(r.nombre), 0);
        for (const f of fiches) {
          const n = nombre(f[champ]);
          t += n;
          if (f.date >= saison.debut && f.date <= saison.fin) s += n;
        }
        const compte = (n) => (hiver ? feux(n) : pluriel(n, 'barbecue'));
        const blocs = [blocTotaux([['Cette saison', compte(s)], ['Total', compte(t)]])];
        if (hiver) {
          const precedente = bornesSaison(decaler(saison.debut, -1), 'hiver', ctx.hiver);
          // Une date de premier feu saisie dans le report remplace celle calculée depuis les fiches.
          const premier = (b) => reportDe(reports, 'hiver', libelleSaison(b))?.premier
            || fiches.filter((f) => nombre(f.feux_poele) > 0 && f.date >= b.debut && f.date <= b.fin).map((f) => f.date).sort()[0];
          const p1 = premier(saison);
          const p0 = premier(precedente);
          blocs.push(el('dl', { class: 'premiers-feux' },
            el('div', {}, el('dt', {}, 'Premier feu de la saison'), el('dd', {}, p1 ? fmtDate.format(depuisTexte(p1)) : 'pas encore')),
            el('div', {}, el('dt', {}, 'Saison précédente'), el('dd', {}, p0 ? fmtDate.format(depuisTexte(p0)) : 'aucun feu noté'))));
        }
        return blocs;
      },
    }));
  }

  const choix = segments({
    etiquette: 'Saison', obligatoire: true, valeur: mode,
    options: [{ valeur: 'hiver', libelle: 'Hiver' }, { valeur: 'ete', libelle: 'Été' }],
    onChange: (v) => {
      mode = v;
      if (v === auto) modesForces.delete(date); else modesForces.set(date, v);
      dessiner();
    },
  });
  dessiner();
  return carte('Burn on the fire', choix, el('p', { class: 'discret aide-saison' },
    `Choisi selon la date (${auto === 'hiver' ? 'hiver' : 'été'}) ; tu peux changer à la main.`), zone);
}

/* ---------- Fangio ou Rossi ? ---------- */

/** Phrases taquines quand on prend la voiture par beau temps ({t} = température max du jour). */
const CLINS_FANGIO = [
  '{t}° et grand soleil… et t’as pris la voiture ?',
  '{t}° au thermomètre, et la moto qui prend la poussière au garage…',
  'Fangio, vraiment ? Avec {t}° et ce soleil, Rossi te regarde de travers.',
  '{t}° et du soleil à revendre : le casque s’est senti bien seul aujourd’hui.',
  'Un temps à rouler cheveux au vent, {t}°… et toi, tu choisis la clim ?',
];

/** Phrase du jour (elle tourne d'un jour à l'autre), ou null si le clin d'œil n'a pas lieu d'être. */
export function clinFangio(fiche) {
  const t = Number(fiche.meteo_tmax);
  const soleil = Number(fiche.meteo_soleil_h);
  if (fiche.deplacement !== 'voiture' || fiche.meteo_tmax == null || fiche.meteo_soleil_h == null || t < 15 || soleil < 4) return null;
  const n = Number(fiche.date.replace(/-/g, '')) % CLINS_FANGIO.length;
  return CLINS_FANGIO[n].replace('{t}', String(Math.round(t)));
}

function carteDeplacement(ctx) {
  let choix = ctx.fiche.deplacement ?? null;
  const OPTIONS = [
    { valeur: 'moto', libelle: 'Moto', sous: 'Rossi', icone: 'casque' },
    { valeur: 'voiture', libelle: 'Voiture', sous: 'Fangio', icone: 'volant' },
  ];
  const compteurs = OPTIONS.map(() => el('span', { class: 'tuile-compteurs' }));
  async function majCompteurs() {
    const fiches = await ctx.fiches();
    const mois = ctx.fiche.date.slice(0, 7);
    OPTIONS.forEach((o, i) => {
      const toutes = fiches.filter((f) => f.deplacement === o.valeur);
      compteurs[i].textContent = `Mois ${fmt.format(toutes.filter((f) => f.date.startsWith(mois)).length)} · Total ${fmt.format(toutes.length)}`;
    });
  }
  const tuiles = OPTIONS.map((o, i) => el('button', {
    type: 'button', class: 'grande-tuile', 'aria-pressed': String(choix === o.valeur), 'aria-label': `${o.libelle} (${o.sous})`,
    onClick: async () => {
      choix = choix === o.valeur ? null : o.valeur;
      tuiles.forEach((x, j) => x.setAttribute('aria-pressed', String(choix === OPTIONS[j].valeur)));
      await ctx.modifier('deplacement', choix);
      majCompteurs();
    },
  }, icone(o.icone, 'icone-grande'), el('span', { class: 'tuile-nom' }, o.sous), compteurs[i]));
  const zoneClin = el('div');
  const majClin = () => {
    const phrase = clinFangio(ctx.fiche);
    zoneClin.replaceChildren(phrase ? el('p', { class: 'clin-oeil' }, icone('soleil'), el('em', {}, phrase)) : '');
  };
  tuiles.forEach((t) => t.addEventListener('click', () => setTimeout(majClin, 0)));
  majClin();
  majCompteurs();
  return carte('Fangio ou Rossi ?', el('div', { class: 'grandes-tuiles' }, ...tuiles), zoneClin);
}

export function cartesWhatsUp(ctx) {
  return [
    el('h2', { class: 'titre-onglet' }, 'What’s up Today ?'),
    carteCuisine(ctx),
    carteGuitare(ctx),
    carteFeu(ctx),
    carteDeplacement(ctx),
  ];
}

