/* Réglages locaux, conservés dans IndexedDB (magasin « reglages »).
   L'URL de la Web App et le jeton restent sur le téléphone : ils ne sont jamais envoyés au Sheet ni au dépôt. */

const DEFAUTS = {
  url: '',
  jeton: '',
  bascule: 4,
  derniereSynchro: null,
};

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
  await TMDB.ecrire('reglages', { cle, valeur });
}
