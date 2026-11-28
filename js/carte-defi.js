/* Affichage du défi du mois : plaque laiton (What's up, bilan du dimanche) et annonce du résultat. */
import { el, svg } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte } from './jour.js';

const fmt = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 });
const fmtMois = new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' });
const fmtJour = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long' });

export const nomMois = (mois) => fmtMois.format(depuisTexte(mois + '-01'));

function vis() {
  return svg('svg', { viewBox: '0 0 12 12', class: 'vis', 'aria-hidden': 'true' },
    svg('circle', { cx: 6, cy: 6, r: 4.6 }), svg('path', { d: 'M3.4 4.6l5.2 2.8' }));
}

/** Texte d'état sous la barre : jours restants, réussi, raté… */
export function etatDefi(defi, e) {
  if (e.avant) return `Commence le ${fmtJour.format(depuisTexte(defi.mois + '-01'))}`;
  const resultat = defi.resultat || (e.termine ? (e.reussi ? 'reussi' : 'rate') : null);
  if (resultat === 'reussi' || (e.reussi && defi.type === 'fois')) return e.termine ? 'Réussi !' : 'Réussi ! Bravo';
  if (resultat === 'rate') return 'Raté';
  if (e.rate) return 'Raté pour ce mois';
  if (e.joursRestants === 1) return 'Dernier jour';
  return `Encore ${e.joursRestants} jours`;
}

/** Plaque laiton : libellé, barre de progression, « 14 / 20 », état. */
export function plaqueDefi(defi, e, { titre = 'Défi du mois' } = {}) {
  const pct = Math.round(Math.max(0, Math.min(1, e.progression)) * 100);
  const etat = etatDefi(defi, e);
  const classe = etat.startsWith('Réussi') ? ' reussi' : etat.startsWith('Raté') ? ' rate' : '';
  return el('div', { class: 'plaque-defi' + classe, role: 'group', 'aria-label': `${titre} : ${defi.libelle}` },
    el('div', { class: 'plaque-defi-tete' }, vis(), el('span', { class: 'plaque-defi-titre' }, titre), vis()),
    el('p', { class: 'plaque-defi-libelle' }, defi.libelle),
    el('div', {
      class: 'barre-defi', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct),
      'aria-valuetext': `${fmt.format(e.fait)} sur ${fmt.format(e.total)}`,
    }, el('span', { style: `width:${pct}%` })),
    el('p', { class: 'plaque-defi-pied' },
      el('strong', {}, `${fmt.format(e.fait)} / ${fmt.format(e.total)}`),
      el('span', { class: 'plaque-defi-etat' }, etat)));
}

/** Écran de résultat, à la première ouverture du mois suivant. */
export function annoncerResultat(defi, e) {
  return new Promise((resolve) => {
    const { corps, fermer } = ouvrirEcran({ titre: 'Défi du mois', classe: 'ecran-defi', surFermeture: resolve });
    const reussi = defi.resultat === 'reussi';
    corps.append(
      el('p', { class: 'annonce-defi-mois' }, nomMois(defi.mois)),
      el('p', { class: 'annonce-defi-resultat' + (reussi ? ' reussi' : ' rate') }, reussi ? 'Défi réussi !' : 'Défi raté'),
      el('p', { class: 'annonce-defi-phrase' }, reussi
        ? 'Chapeau. Mister Discipline a tenu la distance tout le mois.'
        : 'Pas cette fois. Nouveau mois, nouveau départ : choisis le prochain défi dans les Réglages.'),
      plaqueDefi(defi, e),
      el('div', { class: 'rangee-boutons' }, el('button', { type: 'button', class: 'bouton', onClick: () => fermer() }, 'Fermer')));
  });
}
