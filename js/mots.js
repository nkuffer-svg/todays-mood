/* Mot du jour : un seul mot (sans espace, 25 caractères au plus) pour résumer la journée. */

export const LONGUEUR_MOT = 25;

/** Retire les espaces et coupe à 25 caractères. */
export const nettoyerMot = (texte) => String(texte ?? '').replace(/\s+/g, '').slice(0, LONGUEUR_MOT);

/** Clé de comparaison : minuscules, sans accents. */
export const cleMot = (mot) => String(mot ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mots déjà utilisés, du plus fréquent au moins fréquent : [{ mot, nombre, dernier }].
 * Deux écritures du même mot (majuscules, accents) comptent ensemble ; on garde la plus récente.
 */
export function motsUtilises(fiches, { sauf } = {}) {
  const parCle = new Map();
  for (const f of fiches) {
    const mot = nettoyerMot(f.mot_du_jour);
    if (!mot || f.date === sauf) continue;
    const cle = cleMot(mot);
    const e = parCle.get(cle) || { mot, nombre: 0, dernier: '' };
    e.nombre++;
    if (f.date > e.dernier) { e.dernier = f.date; e.mot = mot; }
    parCle.set(cle, e);
  }
  return [...parCle.values()].sort((a, b) => b.nombre - a.nombre || (a.dernier < b.dernier ? 1 : -1));
}
