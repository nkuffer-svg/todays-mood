/* La maison (version 5 A) : relevé intérieur Netatmo de 7 h (Matin) et de 20 h (Soir).
   Température en grand (corrigeable ou saisie à la main), humidité, CO2, écart, pastilles CO2 et air sec. */
import { el, icone } from './ui.js';
import { heurePassee } from './meteo.js';
import { maintenant, decaler } from './jour.js';
import { reglage } from './reglages.js';

const nf = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ent = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Seuils réglables : CO2 élevé au-dessus de 1200 ppm, air sec sous 35 %. */
export function seuilsMaison() {
  const co2 = Number(reglage('co2Max'));
  const hum = Number(reglage('humMin'));
  return { co2Max: co2 > 0 ? co2 : 1200, humMin: hum > 0 ? hum : 35 };
}

/** Pastilles d'alerte (« Aère ! CO2 élevé », « Air sec »). */
export function pastillesMaison(co2, hum) {
  const s = seuilsMaison();
  const items = [];
  if (co2 != null && co2 > s.co2Max) items.push(el('span', { class: 'pastille statique pastille-alerte' }, el('span', { class: 'voyant-alerte', 'aria-hidden': 'true' }), 'Aère ! CO2 élevé'));
  if (hum != null && hum < s.humMin) items.push(el('span', { class: 'pastille statique pastille-meteo bise' }, 'Air sec'));
  return items.length ? el('div', { class: 'pastilles pastilles-meteo' }, ...items) : null;
}

const ecartTexte = (d, depuis) => {
  if (Math.abs(d) < 0.05) return `Comme ${depuis}`;
  return `${d > 0 ? '+' : '−'}${nf.format(Math.abs(d))}° ${depuis}`;
};

/** Petit formulaire pour corriger ou saisir la température à la main. */
function formulaireTemp(ctx, heure, valeur, fermer) {
  const champ = el('input', {
    type: 'text', inputmode: 'decimal', class: 'champ champ-temp-maison', 'aria-label': `Température intérieure à ${heure} h`,
    value: valeur == null ? '' : String(valeur).replace('.', ','), placeholder: 'ex. 20,5',
  });
  const alerte = el('p', { class: 'avertissement', hidden: true }, 'Température invalide (ex. 20,5).');
  const form = el('form', { class: 'form-temp-maison' },
    el('div', { class: 'ligne-champ' }, champ, el('span', { class: 'unite-champ' }, '°C')),
    alerte,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'submit', class: 'bouton petit' }, 'Enregistrer'),
      el('button', { type: 'button', class: 'bouton petit discret', onClick: fermer }, 'Annuler')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = champ.value.trim().replace(',', '.');
    const v = t === '' ? null : Number(t);
    if (t !== '' && (!Number.isFinite(v) || v < -20 || v > 45)) { alerte.hidden = false; return; }
    await ctx.modifierChamps({ [`maison${heure}_temp`]: v == null ? null : Math.round(v * 10) / 10, maison_source: 'manuel' });
    fermer();
  });
  requestAnimationFrame(() => champ.focus());
  return form;
}

/**
 * Carte « La maison » pour le relevé de `heure` (7 ou 20).
 * ctx.netatmo : { etat: 'repos' | 'encours' | 'ok' | 'erreur', message, code } ; ctx.releverMaison() : réessayer.
 */
export function carteMaison(ctx, heure) {
  const id = `carte-maison-${heure}`;
  const carteNoeud = el('section', { class: 'carte carte-maison', id });

  function dessiner(edition = false) {
    const f = ctx.fiche;
    const v = (c) => num(f[`maison${heure}_${c}`]);
    const temp = v('temp');
    const corps = [];
    const n = ctx.netatmo;

    if (edition) {
      corps.push(formulaireTemp(ctx, heure, temp, () => dessiner(false)));
    } else if (temp == null) {
      const avant = !heurePassee(f.date, heure, maintenant());
      corps.push(el('p', { class: 'releve-attente' }, avant ? `Relevé à ${heure} h` : `Relevé de ${heure} h pas encore récupéré.`));
      if (!avant || n.etat === 'erreur') {
        if (n.etat === 'encours') corps.push(el('p', { class: 'meteo-statut' }, 'Lecture de la station Netatmo…'));
        else if (n.etat === 'erreur') corps.push(el('p', { class: 'meteo-statut erreur' }, n.message + (n.code === 'netatmo_config' ? '' : ' L’app réessaiera plus tard.')));
        corps.push(el('div', { class: 'rangee-boutons' },
          n.code === 'netatmo_config' ? null : el('button', { type: 'button', class: 'bouton petit discret bouton-actualiser', disabled: n.etat === 'encours', onClick: () => ctx.releverMaison() }, icone('actualiser'), 'Réessayer'),
          el('button', { type: 'button', class: 'bouton petit discret', onClick: () => dessiner(true) }, 'Saisir à la main')));
      }
    } else {
      // Écart : le matin avec la veille à 20 h, le soir avec le matin même.
      const ecart = el('p', { class: 'maison-ecart' });
      if (heure === 20 && num(f.maison7_temp) != null) ecart.textContent = ecartTexte(temp - num(f.maison7_temp), 'depuis ce matin');
      if (heure === 7) {
        TMDB.lire('fiches', decaler(f.date, -1)).then((veille) => {
          const t = num(veille?.maison20_temp);
          if (t != null) ecart.textContent = ecartTexte(temp - t, 'depuis hier à 20 h');
        }).catch(() => {});
      }
      const details = [];
      if (v('hum') != null) details.push(el('div', {}, el('dt', {}, 'Humidité'), el('dd', {}, ent.format(v('hum')), el('span', { class: 'unite' }, ' %'))));
      if (v('co2') != null) details.push(el('div', {}, el('dt', {}, 'CO2'), el('dd', {}, ent.format(v('co2')), el('span', { class: 'unite' }, ' ppm'))));
      corps.push(
        el('div', { class: 'meteo-principal' },
          el('div', { class: 'meteo-icone' }, icone('maison')),
          el('div', {},
            el('p', { class: 'releve-heure' }, `Relevé de ${heure} h`),
            el('button', {
              type: 'button', class: 'temp-maison', title: 'Corriger la température',
              'aria-label': `Température intérieure ${nf.format(temp)} degrés. Toucher pour corriger.`, onClick: () => dessiner(true),
            }, `${nf.format(temp)}°`),
            ecart)),
        details.length ? el('dl', { class: 'meteo-details deux' }, ...details) : null,
        pastillesMaison(v('co2'), v('hum')),
        el('p', { class: 'mention-source' }, f.maison_source === 'manuel' ? 'Saisie ou corrigée à la main' : 'Mesuré par ta station Netatmo'));
    }
    carteNoeud.replaceChildren(el('h2', {}, 'La maison'), ...corps);
  }
  dessiner();
  return carteNoeud;
}
