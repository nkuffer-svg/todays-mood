/* Cartes météo : Météo du matin (relevé de 8 h + « La journée »), Météo du soir (relevé de 16 h + ressenti),
   Coucher de soleil (+ photo du ciel du soir), pastilles vent / bise / pression, dessin de la lune. */
import { el, svg, icone, carte } from './ui.js';
import { RESSENTIS } from './donnees.js';
import { decrireCode, heurePassee, pointCardinal, estBise, formatPression, FLECHES_TENDANCE, ventDe } from './meteo.js';
import { maintenant, decaler } from './jour.js';
import { prochainSolstice, nomPhase, croissante } from './astro.js';
import { blocPhoto } from './carte-photo.js';

const nombre = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 });
const fmt = (v) => (v == null ? '–' : nombre.format(v));
const ESPACE = ' '; // espace fine insécable

const detail = (libelle, valeur, unite) => el('div', {},
  el('dt', {}, libelle), el('dd', {}, valeur, el('span', { class: 'unite' }, ' ' + unite)));

/* ---------- Vent, bise, pression ---------- */

const MOTS_TENDANCE = { 1: 'en hausse', 0: 'stable', '-1': 'en baisse' };

/** Pastilles « Bise · 22 km/h NE » (ou « Vent 12 km/h SO ») et « 1 021 hPa ↗ ». */
export function pastillesVent(vent, direction, pression, tendance) {
  const items = [];
  if (vent != null) {
    const bise = estBise(vent, direction);
    const point = pointCardinal(direction);
    const texte = `${bise ? 'Bise · ' : 'Vent '}${Math.round(vent)}${ESPACE}km/h${point ? ' ' + point : ''}`;
    items.push(el('span', { class: 'pastille statique pastille-meteo' + (bise ? ' bise' : '') }, texte));
  }
  if (pression != null) {
    const fleche = tendance == null ? '' : FLECHES_TENDANCE[tendance];
    items.push(el('span', {
      class: 'pastille statique pastille-meteo',
      'aria-label': `Pression ${formatPression(pression)} hectopascals${tendance == null ? '' : ', ' + MOTS_TENDANCE[tendance]}`,
    }, `${formatPression(pression)}${ESPACE}hPa`, fleche ? el('span', { class: 'fleche-tendance', 'aria-hidden': 'true' }, ' ' + fleche) : null));
  }
  return items.length ? el('div', { class: 'pastilles pastilles-meteo' }, ...items) : null;
}

/* ---------- Relevé horaire ---------- */

function blocReleve(ctx, heure) {
  const f = ctx.fiche;
  const v = (c) => f[`meteo${heure}_${c}`];
  if (v('temp') == null) {
    const avant = !heurePassee(f.date, heure, maintenant());
    return el('p', { class: 'releve-attente' }, avant ? `Relevé à ${heure} h` : `Relevé de ${heure} h pas encore récupéré.`);
  }
  const a = decrireCode(v('code'));
  const vent = ventDe(f, heure);
  const ext = f[`nt${heure}_temp_ext`];
  return el('div', { class: 'releve' },
    el('div', { class: 'meteo-principal' },
      el('div', { class: 'meteo-icone' }, icone(a ? a.icone : 'nuage')),
      el('div', {},
        el('p', { class: 'releve-heure' }, `Relevé de ${heure} h`),
        el('p', { class: 'meteo-temp' }, `${fmt(v('temp'))}°`),
        el('p', { class: 'meteo-desc' }, a ? a.texte : ''))),
    el('dl', { class: 'meteo-details deux' },
      detail('Nuages', fmt(v('nuages')), '%'),
      detail('Pluie', fmt(v('pluie')), 'mm')),
    pastillesVent(vent.vent, vent.dir, v('pression'), ctx.meteoExtra(f.date)['t' + heure]),
    ext != null && ext !== '' ? el('p', { class: 'mention-station' }, 'Ta station dehors : ', el('strong', {}, `${fmt(Number(ext))}°`)) : null,
    vent.source === 'netatmo' ? el('p', { class: 'mention-source' }, 'Vent mesuré par ton anémomètre') : null);
}

/** Statut de la récupération et bouton Actualiser (partagés par les deux cartes météo). */
function statutEtBouton(ctx, libelleVide) {
  const m = ctx.meteo;
  let statut = null;
  if (m.etat === 'encours') statut = el('p', { class: 'meteo-statut' }, 'Récupération de la météo…');
  else if (m.etat === 'erreur') statut = el('p', { class: 'meteo-statut erreur' }, m.message);
  else if (m.etat === 'ok' && m.lieu) statut = el('p', { class: 'meteo-statut' }, 'Lieu : ' + m.lieu);
  const bouton = el('button', {
    type: 'button', class: 'bouton petit discret bouton-actualiser', disabled: m.etat === 'encours',
    onClick: () => ctx.actualiserMeteo(),
  }, icone('actualiser'), libelleVide || 'Actualiser');
  return [statut, bouton];
}

/* ---------- Matin ---------- */

export function carteMeteoMatin(ctx) {
  const f = ctx.fiche;
  const a = decrireCode(f.meteo_code);
  const aDesDonnees = f.meteo_code != null || f.meteo_tmax != null || f.meteo_tmin != null;
  const journee = aDesDonnees
    ? el('div', { class: 'encadre-journee' },
      el('p', { class: 'encadre-titre' }, 'La journée'),
      el('div', { class: 'journee-ligne' },
        icone(a ? a.icone : 'nuage', 'petite'),
        el('span', { class: 'journee-temp' }, `${fmt(f.meteo_tmin)}° / ${fmt(f.meteo_tmax)}°`),
        el('span', { class: 'journee-desc' }, a ? a.texte : '')),
      el('dl', { class: 'meteo-details compact' },
        detail('Pluie', fmt(f.meteo_pluie_mm), 'mm'),
        detail('Soleil', fmt(f.meteo_soleil_h), 'h'),
        detail('Nuages', fmt(f.meteo_nuages_pct), '%')),
      f.nt_pluie_jour != null && f.nt_pluie_jour !== '' ? el('p', { class: 'mention-station' }, 'Ton pluviomètre : ', el('strong', {}, `${fmt(Number(f.nt_pluie_jour))} mm`)) : null)
    : el('p', { class: 'etat-vide encadre-vide' }, 'Pas encore de météo pour la journée.');
  const vide = !aDesDonnees && f.meteo8_temp == null;
  return el('section', { class: 'carte', id: 'carte-meteo' },
    el('h2', {}, 'Météo du matin'),
    blocReleve(ctx, 8),
    journee,
    ...statutEtBouton(ctx, vide ? 'Récupérer la météo' : null));
}

/** Les 4 icônes de météo ressentie (matin : meteo_ressenti, soir : meteo_soir_ressenti). */
export function tuilesRessenti(ctx, champ) {
  let actuel = ctx.fiche[champ] ?? null;
  const tuiles = RESSENTIS.map((r) => el('button', {
    type: 'button', class: 'tuile-visage tuile-ressenti', 'aria-pressed': String(actuel === r.valeur), 'aria-label': r.libelle,
    onClick: () => {
      actuel = actuel === r.valeur ? null : r.valeur;
      tuiles.forEach((t, i) => t.setAttribute('aria-pressed', String(actuel === RESSENTIS[i].valeur)));
      ctx.modifier(champ, actuel);
    },
  }, icone(r.icone), el('span', {}, r.libelle)));
  return el('div', { class: 'ressentis' }, ...tuiles);
}

export function carteRessentiMatin(ctx) {
  return carte('Météo ressentie', tuilesRessenti(ctx, 'meteo_ressenti'));
}

/* ---------- Soir ---------- */

export function carteMeteoSoir(ctx) {
  const f = ctx.fiche;
  const manque = f.meteo16_temp == null && heurePassee(f.date, 16, maintenant());
  return el('section', { class: 'carte', id: 'carte-meteo-soir' },
    el('h2', {}, 'Météo du soir'),
    blocReleve(ctx, 16),
    ...(manque || ctx.meteo.etat !== 'repos' ? statutEtBouton(ctx, manque ? 'Récupérer le relevé' : null) : []),
    el('p', { class: 'sous-titre-champ' }, 'Ressenti du soir'),
    tuilesRessenti(ctx, 'meteo_soir_ressenti'));
}

/* ---------- Coucher de soleil ---------- */

const heureLisible = (hhmm) => String(hhmm).replace(':', ' h ');

function dureeLisible(minutes) {
  const total = Math.round(Number(minutes));
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
}

/** Écart de durée du jour avec la veille, en secondes → « −2 min depuis hier ». */
export function texteEcart(secondes) {
  const signe = secondes < 0 ? '−' : '+';
  const abs = Math.abs(secondes);
  const min = Math.round(abs / 60);
  if (min >= 1) return `${signe}${min}${ESPACE}min depuis hier`;
  if (Math.round(abs) >= 1) return `${signe}${Math.round(abs)}${ESPACE}s depuis hier`;
  return 'Comme hier';
}

export function texteSolstice(date) {
  const { jours, type } = prochainSolstice(date);
  const ensuite = type === 'decembre' ? 'les jours rallongent' : 'les jours raccourcissent';
  if (jours === 0) return `Solstice aujourd’hui : dès demain, ${ensuite}`;
  if (jours === 1) return `Solstice demain, ensuite ${ensuite}`;
  return `Solstice dans ${jours} jours, ensuite ${ensuite}`;
}

export function carteCoucher(ctx) {
  const f = ctx.fiche;
  const ecart = el('p', { class: 'coucher-ecart' });
  const extra = ctx.meteoExtra(f.date);
  if (extra.jourS != null && extra.veilleS != null) {
    ecart.textContent = texteEcart(extra.jourS - extra.veilleS);
  } else if (f.duree_jour_min != null) {
    // Sinon, d'après la fiche de la veille (si elle existe et a sa durée du jour).
    TMDB.lire('fiches', decaler(f.date, -1)).then((v) => {
      if (v && v.duree_jour_min != null) ecart.textContent = texteEcart((f.duree_jour_min - v.duree_jour_min) * 60);
    }).catch(() => {});
  }
  const corps = f.coucher_soleil
    ? [
      el('div', { class: 'meteo-principal' },
        el('div', { class: 'meteo-icone' }, icone('coucher')),
        el('div', {},
          el('p', { class: 'releve-heure' }, 'Coucher du soleil'),
          el('p', { class: 'meteo-temp' }, heureLisible(f.coucher_soleil)),
          f.duree_jour_min != null ? el('p', { class: 'meteo-desc' }, `Durée du jour : ${dureeLisible(f.duree_jour_min)}`) : null)),
      ecart,
    ]
    : [el('p', { class: 'etat-vide' }, 'Pas encore d’heure de coucher pour ce jour.')];
  return el('section', { class: 'carte', id: 'carte-coucher' },
    el('h2', {}, 'Coucher de soleil'),
    ...corps,
    el('p', { class: 'coucher-solstice' }, texteSolstice(f.date)),
    el('p', { class: 'sous-titre-champ' }, 'Photo du ciel du soir'),
    blocPhoto(ctx, 'photo_ciel_soir', 'Photo du ciel du soir'));
}

/* ---------- Lune ---------- */

/** Petit dessin de la lune : disque sombre, part éclairée crème (à droite quand elle croît). */
export function dessinLune(phase, pct, taille = 22) {
  const s = svg('svg', { viewBox: '0 0 24 24', width: taille, height: taille, class: 'dessin-lune', 'aria-hidden': 'true' });
  s.append(svg('circle', { cx: 12, cy: 12, r: 10, class: 'lune-sombre' }));
  const k = Math.max(0, Math.min(1, Number(pct) / 100));
  if (k >= 0.99) {
    s.append(svg('circle', { cx: 12, cy: 12, r: 10, class: 'lune-claire' }));
  } else if (k > 0.01) {
    const rx = (Math.abs(1 - 2 * k) * 10).toFixed(2);
    const d = croissante(phase)
      ? `M12 2A10 10 0 0 1 12 22A${rx} 10 0 0 ${k < 0.5 ? 0 : 1} 12 2Z`
      : `M12 2A10 10 0 0 0 12 22A${rx} 10 0 0 ${k < 0.5 ? 1 : 0} 12 2Z`;
    s.append(svg('path', { d, class: 'lune-claire' }));
  }
  s.append(svg('circle', { cx: 12, cy: 12, r: 10, class: 'lune-bord' }));
  return s;
}

/** Contenu de la pastille de lune de l'en-tête. */
export function contenuLune(phase, pct) {
  return {
    noeuds: [dessinLune(phase, pct, 22), el('span', {}, `${pct}${ESPACE}%`)],
    libelle: `${nomPhase(phase)}, ${pct} % éclairée`,
  };
}
