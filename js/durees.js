/* Durées en minutes : sommeil (nuit à cheval sur minuit) et temps d'écran. */
import { lundiDe, decaler } from './jour.js';

const p2 = (n) => String(n).padStart(2, '0');

/** « HH:MM » → minutes depuis minuit (ou null). */
export function minutesDe(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  return h < 24 && mn < 60 ? h * 60 + mn : null;
}

/**
 * Durée de la nuit, en minutes. L'heure de coucher appartient à la nuit précédente :
 * couché à 23:10 et levé à 06:45 → 7 h 35 ; couché à 00:40 et levé à 07:10 → 6 h 30.
 */
export function dureeNuit(coucher, lever) {
  const c = minutesDe(coucher);
  const l = minutesDe(lever);
  if (c == null || l == null) return null;
  const d = (l - c + 1440) % 1440;
  return d === 0 ? null : d;
}

/** 455 → « 7 h 35 » ; 45 → « 0 h 45 ». */
export function formatDuree(min) {
  if (min == null || !Number.isFinite(Number(min))) return '—';
  const t = Math.round(Number(min));
  return `${Math.floor(t / 60)} h ${p2(t % 60)}`;
}

/** Écart en minutes → « +20 min », « −1 h 05 », « pareil ». */
export function formatEcart(min) {
  const t = Math.round(Number(min));
  if (!t) return 'pareil';
  const signe = t > 0 ? '+' : '−';
  const a = Math.abs(t);
  return a < 60 ? `${signe}${a} min` : `${signe}${Math.floor(a / 60)} h ${p2(a % 60)}`;
}

const valeur = (f, champ) => (f && f[champ] != null && f[champ] !== '' && Number.isFinite(Number(f[champ])) ? Number(f[champ]) : null);

/**
 * Pour la fiche du jour `date` : valeur de la veille, écart avec la veille et moyenne de la semaine
 * (du lundi jusqu'à ce jour compris, jours saisis seulement).
 */
export function statsSemaine(fiches, date, champ) {
  const parDate = new Map(fiches.map((f) => [f.date, f]));
  const jour = valeur(parDate.get(date), champ);
  const veille = valeur(parDate.get(decaler(date, -1)), champ);
  const lundi = lundiDe(date);
  const semaine = fiches.filter((f) => f.date >= lundi && f.date <= date).map((f) => valeur(f, champ)).filter((v) => v != null);
  return {
    veille,
    ecart: jour != null && veille != null ? jour - veille : null,
    moyenne: semaine.length ? semaine.reduce((a, b) => a + b, 0) / semaine.length : null,
    nbJours: semaine.length,
  };
}

/** Moyenne d'un champ sur une liste de fiches (jours saisis seulement), ou null. */
export function moyenneChamp(fiches, champ) {
  const v = fiches.map((f) => valeur(f, champ)).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
