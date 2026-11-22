/* Gestion des dates : jour courant avec heure de bascule, formats. Dates au format AAAA-MM-JJ. */

const p2 = (n) => String(n).padStart(2, '0');

export function versTexte(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function depuisTexte(texte) {
  const [a, m, j] = texte.split('-').map(Number);
  return new Date(a, m - 1, j);
}

/* ---------- Mode simulation (tests des fonctions liées à la date) ----------
   Réglages → Outils de test : on choisit une date et une heure ; l'app fait comme si on y était
   (le temps continue de s'écouler). Rien n'est enregistré tant que la simulation est active.
   Stocké dans sessionStorage : la simulation s'arrête en fermant l'app. */

const CLE_SIMULATION = 'todaysMoodSimulation';

function lireDecalage() {
  try {
    const v = sessionStorage.getItem(CLE_SIMULATION);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

/** Vrai si une date simulée est active. */
export const simulationActive = () => lireDecalage() !== 0;

/** « Maintenant », éventuellement simulé. À utiliser partout à la place de new Date(). */
export function maintenant() {
  return new Date(Date.now() + lireDecalage());
}

/** Démarre la simulation à la date-heure donnée (objet Date). */
export function demarrerSimulation(date) {
  sessionStorage.setItem(CLE_SIMULATION, String(date.getTime() - Date.now() || 1));
}

export function arreterSimulation() {
  sessionStorage.removeItem(CLE_SIMULATION);
}

/** Vrai à partir de l'heure du soir (18 h par défaut) pour la fiche du jour `jour`,
    y compris après minuit tant que la fiche n'a pas basculé. */
export function estLeSoir(jour, heureSoir = 18, quand = maintenant()) {
  return versTexte(quand) !== jour || quand.getHours() >= heureSoir;
}

/** Jour de la fiche courante : avant l'heure de bascule, on est encore « hier ». */
export function jourCourant(bascule = 4, maintenant = maintenantSimule()) {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  if (maintenant.getHours() < bascule) d.setDate(d.getDate() - 1);
  return versTexte(d);
}

function maintenantSimule() {
  return maintenant();
}

/** Même jour, un an plus tôt (null pour un 29 février). */
export function ilYAUnAn(texte) {
  const [a, m, j] = texte.split('-');
  if (m === '02' && j === '29') return null;
  return `${Number(a) - 1}-${m}-${j}`;
}

/** Lundi de la semaine qui contient `texte`. */
export function lundiDe(texte) {
  const d = depuisTexte(texte);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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
