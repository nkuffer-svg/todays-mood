/* Défi du mois (version 4 B) : trois types, calculés à partir des données (jamais stockés, sauf le résultat final).
   Un défi : { mois: 'AAAA-MM', type: 'fois' | 'chaque_jour' | 'jamais_semaine', compteur, cible, libelle, resultat: null | 'reussi' | 'rate' } */
import { depuisTexte, decaler } from './jour.js';

const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));

/* Chaque entrée : nom affiché et valeur d'un jour (j = { fiche, marches: [...], tentations: [...] }). */
export const CATALOGUE = {
  fois: {
    guitare: { nom: 'Sessions de guitare', valeur: (j) => n(j.fiche?.guitare) },
    chien_balades: { nom: 'Balades du chien', valeur: (j) => n(j.fiche?.chien_balades) },
    chien_education: { nom: 'Séances d’éducation', valeur: (j) => n(j.fiche?.chien_education) },
    marches: { nom: 'Marches', valeur: (j) => j.marches.length },
    km: { nom: 'Kilomètres de marche', valeur: (j) => j.marches.reduce((s, m) => s + n(m.km), 0) },
    natation: { nom: 'Séances de natation', valeur: (j) => (n(j.fiche?.natation_m) > 0 ? 1 : 0) },
    moto: { nom: 'Jours à moto (Rossi)', valeur: (j) => (j.fiche?.deplacement === 'moto' ? 1 : 0) },
    feux_poele: { nom: 'Feux de poêle', valeur: (j) => n(j.fiche?.feux_poele) },
    barbecues: { nom: 'Barbecues', valeur: (j) => n(j.fiche?.barbecues) },
    mister_me: { nom: 'Victoires de Mister Me', valeur: (j) => j.tentations.filter((t) => t.gagnant === 'me').length },
    revolut: { nom: 'CHF Go to Revolut', valeur: (j) => j.tentations.reduce((s, t) => s + (t.gagnant === 'me' ? n(t.montant_chf) : 0), 0) },
  },
  chaque_jour: {
    eau: { nom: 'Objectif d’eau atteint', valeur: (j, o) => (n(j.fiche?.eau_ml) >= o.objectifEau ? 1 : 0) },
    marche: { nom: 'Au moins une marche', valeur: (j) => (j.marches.length ? 1 : 0) },
    guitare: { nom: 'Au moins une session de guitare', valeur: (j) => (n(j.fiche?.guitare) > 0 ? 1 : 0) },
    balade: { nom: 'Au moins une balade du chien', valeur: (j) => (n(j.fiche?.chien_balades) > 0 ? 1 : 0) },
    journal: { nom: 'Journal rempli (humeur matin et soir)', valeur: (j) => (j.fiche?.humeur_matin != null && j.fiche?.humeur_soir != null ? 1 : 0) },
    mot: { nom: 'Mot du jour noté', valeur: (j) => (j.fiche?.mot_du_jour ? 1 : 0) },
  },
  jamais_semaine: {
    alcool: { nom: 'Bière + vin', valeur: (j) => n(j.fiche?.biere) + n(j.fiche?.vin) },
    biere: { nom: 'Bière', valeur: (j) => n(j.fiche?.biere) },
    vin: { nom: 'Vin', valeur: (j) => n(j.fiche?.vin) },
    cafe: { nom: 'Café', valeur: (j) => n(j.fiche?.cafe) },
    plaisir: { nom: 'Victoire du plaisir', valeur: (j) => j.tentations.filter((t) => t.gagnant === 'plaisir').length },
    voiture: { nom: 'Voiture (Fangio)', valeur: (j) => (j.fiche?.deplacement === 'voiture' ? 1 : 0) },
  },
};

export const TYPES = [
  { valeur: 'fois', libelle: 'Faire X fois' },
  { valeur: 'chaque_jour', libelle: 'Chaque jour' },
  { valeur: 'jamais_semaine', libelle: 'Jamais en semaine' },
];

export function libelleParDefaut({ type, compteur, cible }) {
  const c = CATALOGUE[type]?.[compteur];
  if (!c) return '';
  if (type === 'fois') return `${c.nom} : ${cible} ${compteur === 'revolut' ? '' : 'fois'}`.trim();
  if (type === 'chaque_jour') return `Chaque jour : ${c.nom.charAt(0).toLowerCase()}${c.nom.slice(1)}`;
  return `Pas de ${c.nom.charAt(0).toLowerCase()}${c.nom.slice(1)} en semaine`;
}

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export function bornesMois(mois) {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(a, m, 0).getDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(dernier).padStart(2, '0')}`, nbJours: dernier };
}

const enSemaine = (date) => { const j = depuisTexte(date).getDay(); return j >= 1 && j <= 5; };

/**
 * État d'un défi au jour `jusqua` (aujourd'hui, ou le dimanche d'un bilan).
 * @returns {{ fait, total, progression, termine, reussi, rate, joursRestants, avant, texte }}
 *   fait / total : « 14 / 20 » ; termine : le mois est passé ; avant : le mois n'a pas commencé.
 */
export function evaluerDefi(defi, { fiches, marches, tentations, objectifEau }, jusqua) {
  const { debut, fin, nbJours } = bornesMois(defi.mois);
  const regle = CATALOGUE[defi.type]?.[defi.compteur];
  const termine = jusqua > fin;
  const avant = jusqua < debut;
  const borne = termine ? fin : jusqua;
  const joursRestants = termine || avant ? 0 : Math.round((depuisTexte(fin) - depuisTexte(jusqua)) / 86400000) + 1;
  if (!regle) return { fait: 0, total: 0, progression: 0, termine, avant, reussi: false, rate: termine, joursRestants, texte: '—' };

  const parDate = new Map(fiches.map((f) => [f.date, f]));
  const grouper = (liste) => {
    const m = new Map();
    for (const x of liste) { if (!m.has(x.date)) m.set(x.date, []); m.get(x.date).push(x); }
    return m;
  };
  const marchesParDate = grouper(marches);
  const tentationsParDate = grouper(tentations);
  const jour = (d) => ({ fiche: parDate.get(d), marches: marchesParDate.get(d) || [], tentations: tentationsParDate.get(d) || [] });
  const valeur = (d) => regle.valeur(jour(d), { objectifEau });

  const jours = [];
  for (let d = debut; d <= borne && !avant; d = decaler(d, 1)) jours.push(d);
  // Jours écoulés : ceux qui ne peuvent plus changer (avant aujourd'hui, ou tout le mois une fois terminé).
  const ecoule = (d) => termine || d < jusqua;

  if (defi.type === 'fois') {
    const cible = n(defi.cible) || 1;
    const fait = Math.round(jours.reduce((s, d) => s + valeur(d), 0) * 10) / 10;
    const reussi = fait >= cible;
    return { fait, total: cible, progression: Math.min(1, fait / cible), termine, avant, reussi, rate: termine && !reussi, joursRestants };
  }
  if (defi.type === 'chaque_jour') {
    const fait = jours.filter((d) => valeur(d) > 0).length;
    const rate = jours.some((d) => ecoule(d) && valeur(d) <= 0);
    return { fait, total: nbJours, progression: fait / nbJours, termine, avant, reussi: termine && !rate, rate, joursRestants };
  }
  // Jamais en semaine : du lundi au vendredi, le compteur reste à 0.
  const semaine = [];
  for (let d = debut; d <= fin; d = decaler(d, 1)) if (enSemaine(d)) semaine.push(d);
  const passes = jours.filter(enSemaine);
  const fait = passes.filter((d) => valeur(d) <= 0).length;
  const rate = passes.some((d) => valeur(d) > 0);
  return { fait, total: semaine.length, progression: fait / semaine.length, termine, avant, reussi: termine && !rate, rate, joursRestants };
}
