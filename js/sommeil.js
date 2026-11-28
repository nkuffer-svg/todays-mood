/* Onglet Matin : le sommeil de la nuit précédente (couché, levé, durée, qualité). */
import { el, carte } from './ui.js';
import { creerJauge } from './jauge.js';
import { LIBELLES } from './donnees.js';
import { dureeNuit, formatDuree, formatEcart, statsSemaine, minutesDe } from './durees.js';

const caseTotal = (libelle, valeur) => el('div', {}, el('dt', {}, libelle), el('dd', {}, valeur));

export function carteSommeil(ctx) {
  const f = ctx.fiche;
  const couche = el('input', { type: 'time', id: 'sommeil-coucher', class: 'champ champ-heure', value: f.sommeil_coucher ?? '' });
  const leve = el('input', { type: 'time', id: 'sommeil-lever', class: 'champ champ-heure', value: f.sommeil_lever ?? '' });
  const precision = el('p', { class: 'discret precision-coucher' });
  const resultat = el('div', { class: 'sommeil-resultat', 'aria-live': 'polite' });

  function majPrecision() {
    const c = minutesDe(couche.value);
    precision.textContent = c == null ? '' : c >= 12 * 60 ? 'La veille au soir' : 'Après minuit';
  }

  async function majResultat() {
    const d = ctx.fiche.sommeil_duree_min;
    if (d == null) {
      resultat.replaceChildren(el('p', { class: 'etat-vide' }, 'Indique l’heure du coucher et du lever : la durée se calcule toute seule.'));
      return;
    }
    const s = statsSemaine(await ctx.fiches(), ctx.fiche.date, 'sommeil_duree_min');
    resultat.replaceChildren(
      el('p', { class: 'sommeil-duree' }, el('strong', {}, formatDuree(d)), ' de nuit'),
      el('dl', { class: 'totaux totaux-deux' },
        caseTotal('Par rapport à la veille', s.ecart == null ? '—' : formatEcart(s.ecart)),
        caseTotal('Moyenne de la semaine', formatDuree(s.moyenne))));
  }

  async function enregistrer() {
    majPrecision();
    const c = couche.value || null;
    const l = leve.value || null;
    await ctx.modifierChamps({ sommeil_coucher: c, sommeil_lever: l, sommeil_duree_min: dureeNuit(c, l) });
    majResultat();
  }
  couche.addEventListener('change', enregistrer);
  leve.addEventListener('change', enregistrer);
  majPrecision();
  majResultat();

  return carte('Le sommeil',
    el('div', { class: 'deux-colonnes' },
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'sommeil-coucher' }, 'Couché'), couche, precision),
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'sommeil-lever' }, 'Levé'), leve)),
    resultat,
    el('h3', { class: 'sous-titre-champ titre-qualite' }, 'Qualité'),
    creerJauge({
      titre: 'Qualité du sommeil', nomCadran: 'Sommeil', libelles: LIBELLES.sommeil, valeur: f.sommeil_qualite,
      onChange: (v) => ctx.modifier('sommeil_qualite', v),
    }));
}
