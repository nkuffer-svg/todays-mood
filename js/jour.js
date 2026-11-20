/* Gestion des dates : jour courant avec heure de bascule, formats. Dates au format AAAA-MM-JJ. */

const p2 = (n) => String(n).padStart(2, '0');

export function versTexte(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function depuisTexte(texte) {
  const [a, m, j] = texte.split('-').map(Number);
  return new Date(a, m - 1, j);
}

/** Jour de la fiche courante : avant l'heure de bascule, on est encore « hier ». */
export function jourCourant(bascule = 4, maintenant = new Date()) {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (maintenant.getHours() < bascule) d.setDate(d.getDate() - 1);
  return versTexte(d);
}

export function decaler(texte, jours) {
  const d = depuisTexte(texte);
  d.setDate(d.getDate() + jours);
  return versTexte(d);
}

const fmtLong = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtAnnee = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Vendredi 20 novembre » (avec l'année si ce n'est pas l'année du jour courant). */
export function formatLong(texte, reference) {
  const d = depuisTexte(texte);
  const memeAnnee = reference && texte.slice(0, 4) === reference.slice(0, 4);
  return majuscule((memeAnnee ? fmtLong : fmtAnnee).format(d).replace(',', ''));
}

/** « Aujourd'hui », « Hier », « Avant-hier » ou chaîne vide. */
export function relatif(texte, aujourdhui) {
  if (texte === aujourdhui) return "Aujourd'hui";
  if (texte === decaler(aujourdhui, -1)) return 'Hier';
  if (texte === decaler(aujourdhui, -2)) return 'Avant-hier';
  return '';
}
