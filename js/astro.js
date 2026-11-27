/* Petits calculs d'astronomie faits par l'app, sans service externe :
   phase de la Lune et dates des solstices (formules simplifiées de Jean Meeus, « Astronomical Algorithms »). */
import { depuisTexte, versTexte } from './jour.js';

const RAD = Math.PI / 180;
const sin = (deg) => Math.sin(deg * RAD);
const cos = (deg) => Math.cos(deg * RAD);
const mod360 = (x) => ((x % 360) + 360) % 360;

/** Jour julien d'un instant (objet Date). */
const jourJulien = (d) => d.getTime() / 86400000 + 2440587.5;

/**
 * Phase de la Lune pour une date AAAA-MM-JJ, calculée à 21 h (heure du téléphone).
 * Renvoie { phase, pct, nom } :
 *   phase : fraction du cycle, de 0 (nouvelle lune) à 0,5 (pleine lune) puis vers 1 ;
 *   pct   : part éclairée du disque, en % (0 à 100).
 */
export function lune(date) {
  const d = depuisTexte(date);
  d.setHours(21, 0, 0, 0);
  const T = (jourJulien(d) - 2451545) / 36525;
  const D = mod360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868 - T ** 4 / 113065000);
  const M = mod360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T ** 3 / 24490000);
  const Mp = mod360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699 - T ** 4 / 14712000);
  // Angle de phase (Meeus, chap. 48)
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  const eclaire = (1 + cos(i)) / 2;
  const phase = mod360(180 - i) / 360;
  return { phase: Math.round(phase * 1000) / 1000, pct: Math.round(eclaire * 100), nom: nomPhase(phase) };
}

export function nomPhase(phase) {
  const p = Number(phase);
  if (p < 0.03 || p >= 0.97) return 'Nouvelle lune';
  if (p < 0.22) return 'Premier croissant';
  if (p < 0.28) return 'Premier quartier';
  if (p < 0.47) return 'Gibbeuse croissante';
  if (p < 0.53) return 'Pleine lune';
  if (p < 0.72) return 'Gibbeuse décroissante';
  if (p < 0.78) return 'Dernier quartier';
  return 'Dernier croissant';
}

/** Vrai si la Lune croît (partie éclairée à droite, vue de Suisse). */
export const croissante = (phase) => Number(phase) < 0.5;

/** Date locale (AAAA-MM-JJ) des solstices de juin et de décembre d'une année. */
function solstices(annee) {
  const Y = (annee - 2000) / 1000;
  const juin = 2451716.56767 + 365241.62603 * Y + 0.00325 * Y ** 2 + 0.00888 * Y ** 3 - 0.0003 * Y ** 4;
  const dec = 2451900.05952 + 365242.74049 * Y - 0.06223 * Y ** 2 - 0.00823 * Y ** 3 + 0.00032 * Y ** 4;
  const versDate = (jj) => versTexte(new Date((jj - 2440587.5) * 86400000));
  return { juin: versDate(juin), decembre: versDate(dec) };
}

/**
 * Prochain solstice à partir d'une date (le jour même compris).
 * Renvoie { jours, type: 'juin' | 'decembre' } : après le solstice de décembre, les jours rallongent.
 */
export function prochainSolstice(date) {
  const annee = Number(date.slice(0, 4));
  const candidats = [
    { date: solstices(annee).juin, type: 'juin' },
    { date: solstices(annee).decembre, type: 'decembre' },
    { date: solstices(annee + 1).juin, type: 'juin' },
  ];
  const s = candidats.find((c) => c.date >= date);
  const jours = Math.round((depuisTexte(s.date) - depuisTexte(date)) / 86400000);
  return { jours, type: s.type };
}
