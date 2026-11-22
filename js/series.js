/* Séries « N jours d'affilée », calculées depuis les données (rien n'est stocké). */
import { el, svg } from './ui.js';
import { decaler } from './jour.js';

const nombre = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);

export const SERIES = [
  { id: 'guitare', nom: 'Guitare' },
  { id: 'eau', nom: 'Objectif d’eau' },
  { id: 'marche', nom: 'Marche' },
  { id: 'journal', nom: 'Journal' },
];

/**
 * Longueur de chaque série qui se termine le jour `date`.
 * Si le jour même n'est pas (encore) réussi, la série compte jusqu'à la veille : elle est « en cours ».
 */
export function calculerSeries(fiches, marches, date, objectifEau = 2000) {
  const parDate = new Map(fiches.map((f) => [f.date, f]));
  const joursMarche = new Set(marches.map((m) => m.date));
  const tests = {
    guitare: (d) => nombre(parDate.get(d)?.guitare) > 0,
    eau: (d) => nombre(parDate.get(d)?.eau_ml) >= objectifEau,
    marche: (d) => joursMarche.has(d),
    journal: (d) => parDate.get(d)?.humeur_matin != null && parDate.get(d)?.humeur_soir != null,
  };
  const resultat = {};
  for (const [id, test] of Object.entries(tests)) {
    let d = test(date) ? date : decaler(date, -1);
    let n = 0;
    while (test(d) && n < 5000) { n++; d = decaler(d, -1); }
    resultat[id] = n;
  }
  return resultat;
}

function vis() {
  return svg('svg', { viewBox: '0 0 12 12', class: 'vis', 'aria-hidden': 'true' },
    svg('circle', { cx: 6, cy: 6, r: 4.6 }),
    svg('path', { d: 'M3.4 4.6l5.2 2.8' }));
}

/** Plaque laiton « N jours d'affilée » (rien si moins de 2 jours). Avec `nom`, le nom de la série précède. */
export function plaque(n, nom) {
  if (!n || n < 2) return null;
  return el('div', { class: 'plaque', role: 'note' },
    vis(),
    el('span', { class: 'plaque-texte' }, nom ? `${nom} · ${n} jours d’affilée` : `${n} jours d’affilée`),
    vis());
}
