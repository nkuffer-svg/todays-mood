/* Réglages, conservés dans IndexedDB (magasin « reglages »).
   - Les réglages « partagés » (heure de bascule, objectif d'eau, position météo…) sont aussi enregistrés
     dans l'onglet Reglages du Sheet, pour être retrouvés après une réinstallation.
   - L'URL de la Web App, le jeton et la clé d'empreinte restent sur le téléphone : jamais envoyés. */

const DEFAUTS = {
  url: '',
  jeton: '',
  bascule: 4,
  derniereSynchro: null,
};

/** Réglages enregistrés aussi dans le Sheet. */
export const REGLAGES_PARTAGES = [
  'bascule', 'objectifEau', 'dureePensee', 'meteoMode', 'lieuNom', 'lieuLat', 'lieuLon',
  'penseesDebutCycle', 'dernierExport',
];

const cache = { ...DEFAUTS };

export async function chargerReglages() {
  const lignes = await TMDB.tout('reglages');
  for (const { cle, valeur } of lignes) cache[cle] = valeur;
  return cache;
}

export function reglage(cle) {
  return cache[cle];
}

export async function definirReglage(cle, valeur) {
  cache[cle] = valeur;
  if (REGLAGES_PARTAGES.includes(cle)) await TMDB.ecrireReglagePartage(cle, valeur);
  else await TMDB.ecrire('reglages', { cle, valeur });
}

/** Valeurs des réglages partagés, pour l'envoi au Sheet. */
export function reglagesPartages() {
  const r = {};
  for (const cle of REGLAGES_PARTAGES) if (cache[cle] !== undefined && cache[cle] !== null) r[cle] = cache[cle];
  return r;
}

/** Applique les réglages venus du Sheet (sauf si des réglages locaux attendent d'être envoyés).
    Renvoie la liste des réglages modifiés. */
export async function fusionnerReglages(distants) {
  const enAttente = await TMDB.lire('file', 'reglages');
  if (enAttente) return [];
  const modifies = [];
  for (const cle of REGLAGES_PARTAGES) {
    if (!(cle in distants)) continue;
    const v = distants[cle];
    if (cache[cle] === v) continue;
    cache[cle] = v;
    await TMDB.ecrire('reglages', { cle, valeur: v });
    modifies.push(cle);
  }
  return modifies;
}
