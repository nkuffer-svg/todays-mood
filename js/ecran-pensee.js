/* Pensée du jour en plein écran, et liste « Mes pensées favorites ». */
import { el, bascule } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { trouverPensee, estFavori, definirFavori, favoris } from './pensees.js';
import { ilYAUnAn, depuisTexte } from './jour.js';
import { LIBELLES, RESSENTIS } from './donnees.js';

const fmtAnnee = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Carte « Il y a un an » : la fiche du même jour l'année précédente (rien si elle n'existe pas). */
async function carteIlYAUnAn(date) {
  const avant = date && ilYAUnAn(date);
  const f = avant ? await TMDB.lire('fiches', avant) : null;
  if (!f) return null;
  const humeurs = [f.humeur_matin, f.humeur_soir].filter((v) => v != null).map(Number);
  const humeur = humeurs.length ? LIBELLES.humeur[Math.round(humeurs.reduce((a, b) => a + b, 0) / humeurs.length) - 1] : null;
  const ressenti = RESSENTIS.find((r) => r.valeur === Number(f.meteo_ressenti));
  const meteo = [f.meteo_tmax != null ? `${Math.round(Number(f.meteo_tmax))}°` : null, ressenti ? ressenti.libelle.toLowerCase() : null].filter(Boolean).join(', ');
  const lignes = [
    humeur ? ['Humeur', humeur] : null,
    f.mot_du_jour ? ['Mot du jour', f.mot_du_jour] : null,
    meteo ? ['Météo', meteo] : null,
    f.evt_appreciation || f.evt_categorie ? ['Événement', [f.evt_appreciation, f.evt_categorie].filter(Boolean).join(' · ')] : null,
  ].filter(Boolean);
  if (!lignes.length && !f.evt_texte) return null;
  const titre = fmtAnnee.format(depuisTexte(avant)).replace(',', '');
  return el('section', { class: 'il-y-a-un-an' },
    el('h3', {}, 'Il y a un an'),
    el('p', { class: 'iyau-date' }, titre.charAt(0).toUpperCase() + titre.slice(1)),
    el('dl', {}, ...lignes.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))),
    f.evt_texte ? el('p', { class: 'iyau-texte' }, `« ${f.evt_texte} »`) : null);
}

function citation(p) {
  return el('figure', { class: 'pensee' },
    el('blockquote', {}, `« ${p.texte} »`),
    el('figcaption', {},
      el('span', { class: 'pensee-auteur' }, p.auteur),
      p.source ? el('span', { class: 'pensee-source' }, p.source) : null));
}

/**
 * Affiche une citation en plein écran pendant `duree` secondes (refermable à tout moment).
 * `surFavori(favori)` est appelé quand l'étoile change.
 */
export async function afficherPensee({ id, date, duree = 30, surFavori }) {
  const p = await trouverPensee(id);
  if (!p) return;
  let minuteur = null;
  const { corps, fermer } = ouvrirEcran({
    titre: 'Pensée du jour',
    classe: 'ecran-pensee',
    surFermeture: () => clearTimeout(minuteur),
  });
  const barre = el('div', { class: 'pensee-progression' }, el('span'));
  const etoile = bascule({
    nomIcone: 'etoile', libelle: 'Favori', actif: await estFavori(id),
    onChange: async (v) => { await definirFavori(id, v); surFavori?.(v); },
  });
  const zone = citation(p);
  zone.addEventListener('click', fermer);
  const annee = await carteIlYAUnAn(date);
  corps.append(
    barre,
    el('p', { class: 'pensee-categorie' }, p.categorie),
    zone,
    el('div', { class: 'pensee-actions' },
      etoile,
      el('button', { type: 'button', class: 'bouton', onClick: fermer }, 'Fermer')),
    annee);
  // Barre qui se vide pendant la durée d'affichage.
  const remplissage = barre.firstChild;
  remplissage.style.transitionDuration = `${duree}s`;
  requestAnimationFrame(() => requestAnimationFrame(() => { remplissage.style.transform = 'scaleX(0)'; }));
  minuteur = setTimeout(fermer, duree * 1000);
}

/** Écran listant les pensées favorites (l'étoile permet de retirer un favori). */
export async function ouvrirFavoris({ surChangement } = {}) {
  const { corps } = ouvrirEcran({ titre: 'Mes pensées favorites', surFermeture: () => surChangement?.() });
  const liste = await favoris();
  if (!liste.length) {
    corps.append(el('p', { class: 'etat-vide' }, 'Aucune pensée favorite pour l’instant. Touche l’étoile sous une pensée pour l’ajouter ici.'));
    return;
  }
  corps.append(el('p', { class: 'discret' }, `${liste.length} pensée${liste.length > 1 ? 's' : ''} favorite${liste.length > 1 ? 's' : ''}`));
  for (const p of liste) {
    corps.append(el('section', { class: 'carte carte-favori' },
      citation(p),
      el('div', { class: 'pensee-actions' },
        bascule({ nomIcone: 'etoile', libelle: 'Favori', actif: true, onChange: (v) => definirFavori(p.id, v) }))));
  }
}
