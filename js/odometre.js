/* Compteur kilométrique à rouleaux : cases sombres à chiffres crème, décimale sur case crème.
   Quand la valeur change, les rouleaux se déroulent jusqu'aux nouveaux chiffres. */
import { el } from './ui.js';

const precedents = new Map(); // clé → dernière valeur affichée (pour animer depuis l'ancienne)

function chiffres(valeur, decimales, minEntiers) {
  const fixe = Math.max(0, valeur).toFixed(decimales);
  const [entiers, deci = ''] = fixe.split('.');
  return { entiers: entiers.padStart(minEntiers, '0').split(''), deci: deci.split('') };
}

function rouleau(chiffre, decimal) {
  const bande = el('span', { class: 'rouleau-bande' }, ...Array.from({ length: 10 }, (_, i) => el('span', {}, String(i))));
  bande.style.transform = `translateY(-${Number(chiffre) * 10}%)`;
  return { noeud: el('span', { class: 'rouleau' + (decimal ? ' decimal' : '') }, bande), bande };
}

/**
 * @param {number} valeur
 * @param {object} o
 * @param {number} [o.decimales=0]  0 ou 1 (la décimale est sur une case crème)
 * @param {string} [o.unite]
 * @param {string} [o.cle]           identifiant pour animer depuis la valeur précédente
 * @param {number} [o.minEntiers=5]
 */
export function odometre(valeur, { decimales = 0, unite = '', cle, minEntiers = 5 } = {}) {
  const v = Number(valeur) || 0;
  const avant = cle && precedents.has(cle) ? precedents.get(cle) : v;
  if (cle) precedents.set(cle, v);
  const cible = chiffres(v, decimales, minEntiers);
  const depart = chiffres(avant, decimales, cible.entiers.length);
  // Même nombre de cases au départ et à l'arrivée.
  while (depart.entiers.length < cible.entiers.length) depart.entiers.unshift('0');
  while (depart.entiers.length > cible.entiers.length) depart.entiers.shift();

  const rouleaux = [];
  const cases = [];
  cible.entiers.forEach((c, i) => { const r = rouleau(depart.entiers[i], false); rouleaux.push([r, c]); cases.push(r.noeud); });
  if (decimales) {
    cases.push(el('span', { class: 'odometre-virgule', 'aria-hidden': 'true' }, ','));
    cible.deci.forEach((c, i) => { const r = rouleau(depart.deci[i] ?? '0', true); rouleaux.push([r, c]); cases.push(r.noeud); });
  }
  const texte = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
  const noeud = el('span', { class: 'odometre', role: 'img', 'aria-label': `${texte}${unite ? ' ' + unite : ''}` },
    el('span', { class: 'odometre-cases' }, ...cases),
    unite ? el('span', { class: 'odometre-unite' }, unite) : null);
  if (avant !== v) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const [r, c] of rouleaux) {
        r.bande.classList.add('anime');
        r.bande.style.transform = `translateY(-${Number(c) * 10}%)`;
      }
    }));
  }
  return noeud;
}
