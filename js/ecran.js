/* Écrans plein écran (Réglages, Partage) qui se ferment avec le bouton Retour d'Android. */
import { el, icone } from './ui.js';

let courant = null;

window.addEventListener('popstate', () => {
  if (courant) fermerSansHistorique();
});

function fermerSansHistorique() {
  const e = courant;
  courant = null;
  e.noeud.remove();
  document.body.classList.remove('ecran-ouvert');
  e.surFermeture?.();
}

/** Ouvre un écran. Renvoie { corps, fermer }. */
export function ouvrirEcran({ titre, surFermeture, fermable = true }) {
  if (courant) fermerSansHistorique();
  const corps = el('div', { class: 'ecran-corps' });
  const fermer = () => { if (courant && courant.noeud === noeud) history.back(); };
  const noeud = el('div', { class: 'ecran', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ecran-titre' },
    el('div', { class: 'ecran-tete' },
      el('h2', { id: 'ecran-titre' }, titre),
      fermable ? el('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Fermer', onClick: fermer }, icone('fermer')) : null),
    corps);
  document.body.append(noeud);
  document.body.classList.add('ecran-ouvert');
  history.pushState({ ecran: titre }, '');
  courant = { noeud, surFermeture };
  noeud.querySelector('button, input, select, textarea')?.focus({ preventScroll: true });
  return { corps, fermer };
}
