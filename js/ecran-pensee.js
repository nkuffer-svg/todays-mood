/* Pensée du jour en plein écran, et liste « Mes pensées favorites ». */
import { el, bascule } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { trouverPensee, estFavori, definirFavori, favoris } from './pensees.js';

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
export async function afficherPensee({ id, duree = 30, surFavori }) {
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
  corps.append(
    el('p', { class: 'pensee-categorie' }, p.categorie),
    zone,
    el('div', { class: 'pensee-actions' },
      etoile,
      el('button', { type: 'button', class: 'bouton', onClick: fermer }, 'Fermer')),
    barre);
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
