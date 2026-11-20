/* Pensées du jour : base de citations (data/pensees.json), tirage sans répétition, favoris. */
import { reglage, definirReglage } from './reglages.js';

let base = null;

/** Charge la base de citations (mise en cache par le service worker pour le hors-ligne). */
export async function chargerBase() {
  if (base) return base;
  const rep = await fetch('data/pensees.json');
  if (!rep.ok) throw new Error('Base de citations introuvable.');
  base = await rep.json();
  return base;
}

export async function trouverPensee(id) {
  if (!id) return null;
  return (await chargerBase()).find((p) => p.id === id) || null;
}

async function etats() {
  return new Map((await TMDB.tout('pensees')).map((p) => [p.id, p]));
}

/**
 * Tire une citation pour `date` : jamais une citation déjà vue dans le cycle en cours.
 * Le cycle recommence quand toute la base a été vue.
 */
export async function tirerPensee(date) {
  const ids = (await chargerBase()).map((p) => p.id);
  const vus = await etats();
  let debut = reglage('penseesDebutCycle') || '';
  const nonVues = (limite) => ids.filter((id) => {
    const d = vus.get(id)?.derniere;
    return !d || (limite && d < limite);
  });
  let candidats = nonVues(debut);
  if (!candidats.length) {
    // Tour complet : nouveau cycle (on évite seulement la citation du jour même).
    debut = date;
    await definirReglage('penseesDebutCycle', debut);
    candidats = nonVues(debut);
    if (!candidats.length) candidats = ids;
  }
  const id = candidats[Math.floor(Math.random() * candidats.length)];
  await TMDB.modifierPensee(id, { derniere: date });
  return id;
}

export async function estFavori(id) {
  return !!(await TMDB.lire('pensees', id))?.favori;
}

export async function definirFavori(id, favori) {
  await TMDB.modifierPensee(id, { favori });
}

/** Citations favorites, dans l'ordre de la base. */
export async function favoris() {
  const vus = await etats();
  return (await chargerBase()).filter((p) => vus.get(p.id)?.favori);
}
