/* Vitrine des médailles et animation « médaille obtenue » (version 5 B). */
import { el, icone } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte } from './jour.js';
import { reglage } from './reglages.js';
import { texteProgression } from './medailles.js';

const fmtDate = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });

/** Médaille ronde : laiton en relief si obtenue, sombre sinon (« ? » pour une secrète). */
export function medailleRonde(m, obtenue, taille = 'normale') {
  const cachee = m.secrete && !obtenue;
  return el('span', { class: `medaille ${taille} ${obtenue ? 'obtenue' : 'a-gagner'}`, 'aria-hidden': 'true' },
    el('span', { class: 'medaille-face' }, icone(cachee ? 'secret' : m.icone)));
}

/** Petite vibration de fête (sauf si désactivée, ou refusée par Chrome). */
function vibrerFete() {
  if (reglage('vibration') === false) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.([25, 60, 25, 60, 90]); } catch { /* sans vibreur */ }
}

/**
 * Plein écran quelques secondes : la médaille tourne, puis l'écran se ferme (elle rejoint la vitrine).
 * @returns {Promise<void>} résolue à la fermeture
 */
export function celebrerMedaille(m, date, { test = false } = {}) {
  return new Promise((resolve) => {
    let minuteur = null;
    const { corps, fermer } = ouvrirEcran({ titre: 'Médaille', classe: 'ecran-medaille', surFermeture: () => { clearTimeout(minuteur); resolve(); } });
    corps.append(
      el('p', { class: 'medaille-annonce' }, test ? 'Médaille obtenue ! (test)' : 'Médaille obtenue !'),
      el('div', { class: 'medaille-scene' }, medailleRonde(m, true, 'geante')),
      el('p', { class: 'medaille-nom' }, m.nom),
      el('p', { class: 'medaille-description' }, m.description),
      date ? el('p', { class: 'medaille-date' }, `Le ${fmtDate.format(depuisTexte(date))}`) : null,
      el('div', { class: 'rangee-boutons' }, el('button', { type: 'button', class: 'bouton', onClick: () => fermer() }, 'Dans la vitrine !')));
    vibrerFete();
    minuteur = setTimeout(() => fermer(), 6000);
  });
}

/**
 * Vitrine : grille de médailles rondes. Obtenues : laiton, date d'obtention. À gagner : sombres, progression.
 * @param {Array} medailles   calculerMedailles(...)
 * @param {Map<string,{date:string,test?:boolean}>} obtenues
 */
export function ouvrirVitrine(medailles, obtenues) {
  const { corps } = ouvrirEcran({ titre: 'Vitrine des médailles', classe: 'ecran-vitrine' });
  const nb = medailles.filter((m) => obtenues.has(m.id)).length;
  corps.append(
    el('p', { class: 'vitrine-compte' }, el('strong', {}, `${nb} / ${medailles.length}`), ' médailles obtenues'),
    el('ul', { class: 'vitrine' }, ...medailles.map((m) => {
      const o = obtenues.get(m.id);
      const cachee = m.secrete && !o;
      const pct = Math.max(0, Math.min(1, m.cible ? m.valeur / m.cible : 0));
      return el('li', { class: 'vitrine-case' + (o ? ' obtenue' : '') },
        medailleRonde(m, !!o),
        el('p', { class: 'vitrine-nom' }, cachee ? '? Secrète' : m.nom),
        o
          ? el('p', { class: 'vitrine-detail' }, o.test ? 'forcée (test)' : fmtDate.format(depuisTexte(o.date)))
          : cachee
            ? el('p', { class: 'vitrine-detail' }, 'À découvrir')
            : [el('p', { class: 'vitrine-detail' }, texteProgression(m)),
              m.cible > 1 && !m.sansObjectif ? el('span', { class: 'vitrine-barre' }, el('span', { style: `width:${Math.round(pct * 100)}%` })) : null],
        cachee ? null : el('p', { class: 'vitrine-description' }, m.description));
    })));
}
