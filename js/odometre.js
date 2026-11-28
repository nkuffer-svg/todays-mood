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

/**
 * Compteur horaire à rouleaux : « 03 H 12 » (heures sur cases sombres, minutes sur cases crème).
 * @param {number|null} minutes  durée en minutes (null : « -- H -- » éteint)
 * @param {object} [o]
 * @param {string} [o.cle]       identifiant pour animer depuis la valeur précédente
 */
export function compteurHoraire(minutes, { cle } = {}) {
  const vide = minutes == null;
  const v = vide ? 0 : Math.max(0, Math.round(Number(minutes) || 0));
  const avant = cle && precedents.has(cle) ? precedents.get(cle) : v;
  if (cle) precedents.set(cle, v);
  const deux = (n) => String(n).padStart(2, '0').slice(-2).split('');
  const cible = [...deux(Math.floor(v / 60)), ...deux(v % 60)];
  const depart = [...deux(Math.floor(avant / 60)), ...deux(avant % 60)];
  const rouleaux = cible.map((c, i) => [rouleau(depart[i], i >= 2), c]);
  const cases = rouleaux.map(([r]) => r.noeud);
  const libelle = vide ? 'Non saisi' : `${Math.floor(v / 60)} heure${v >= 120 ? 's' : ''} ${v % 60} minute${v % 60 > 1 ? 's' : ''}`;
  const noeud = el('span', { class: 'odometre compteur-horaire' + (vide ? ' vide' : ''), role: 'img', 'aria-label': libelle },
    el('span', { class: 'odometre-cases' }, cases[0], cases[1]),
    el('span', { class: 'odometre-unite' }, 'H'),
    el('span', { class: 'odometre-cases' }, cases[2], cases[3]));
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
