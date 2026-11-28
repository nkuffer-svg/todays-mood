/* Molette de sélection (façon réveil) : liste verticale qui se cale sur une valeur.
   Le cran choisi est au centre, dans un bandeau laiton. Un appui sur une valeur la centre. */
import { el, clac } from './ui.js';

const H = 44; // hauteur d'une ligne (cible tactile ≥ 44 px)

/**
 * @param {object} o
 * @param {Array} o.valeurs              valeurs possibles, dans l'ordre (null = « non saisi »)
 * @param {*} o.valeur                   valeur de départ
 * @param {string} o.etiquette           nom lu par le lecteur d'écran
 * @param {(v:*)=>string} o.format       texte affiché pour une valeur
 * @param {(v:*)=>void} o.onChange       appelé quand la molette s'arrête sur une nouvelle valeur
 * @returns {{ noeud: HTMLElement, regler: (v:*)=>void, valeur: ()=>* }}
 */
export function molette({ valeurs, valeur, etiquette, format, onChange }) {
  let index = Math.max(0, valeurs.indexOf(valeur ?? null));
  const items = valeurs.map((v, i) => {
    const item = el('div', { class: 'molette-item', 'aria-hidden': 'true' }, format(v));
    item.addEventListener('click', () => aller(i));
    return item;
  });
  const liste = el('div', {
    class: 'molette-liste', role: 'spinbutton', tabindex: '0', 'aria-label': etiquette,
  }, ...items);
  const noeud = el('div', { class: 'molette' }, liste);

  function marquer(i) {
    items.forEach((it, k) => it.classList.toggle('choisi', k === i));
    liste.setAttribute('aria-valuetext', format(valeurs[i]));
  }
  function aller(i, lisse = true) {
    const j = Math.max(0, Math.min(valeurs.length - 1, i));
    liste.scrollTo({ top: j * H, behavior: lisse ? 'smooth' : 'auto' });
    if (!lisse) arreter();
  }
  function arreter() {
    const i = Math.max(0, Math.min(valeurs.length - 1, Math.round(liste.scrollTop / H)));
    marquer(i);
    if (i === index) return;
    index = i;
    clac();
    onChange(valeurs[i]);
  }

  let minuteur = null;
  liste.addEventListener('scroll', () => {
    marquer(Math.round(liste.scrollTop / H));
    clearTimeout(minuteur);
    minuteur = setTimeout(arreter, 140); // fin du défilement (secours si « scrollend » n'existe pas)
  }, { passive: true });
  liste.addEventListener('scrollend', () => { clearTimeout(minuteur); arreter(); });
  liste.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); aller(index - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); aller(index + 1); }
  });

  marquer(index);
  // La position ne peut être réglée qu'une fois la molette dans la page.
  requestAnimationFrame(() => { liste.scrollTop = index * H; });

  return {
    noeud,
    valeur: () => valeurs[index],
    regler(v) {
      const i = valeurs.indexOf(v ?? null);
      if (i < 0 || i === index) return;
      index = i;
      marquer(i);
      liste.scrollTop = i * H;
    },
  };
}
