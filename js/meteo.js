/* Météo du jour via Open-Meteo (gratuit, sans clé). */
import { reglage } from './reglages.js';
import { decaler, versTexte } from './jour.js';

export const LIEU_DEFAUT = { nom: 'Lavaux', lat: 46.49, lon: 6.73 };

/** Codes météo WMO → description et icône. */
export function decrireCode(code) {
  if (code == null) return null;
  const c = Number(code);
  if (c === 0) return { texte: 'Ciel dégagé', icone: 'soleil' };
  if (c === 1) return { texte: 'Plutôt dégagé', icone: 'soleil' };
  if (c === 2) return { texte: 'Partiellement nuageux', icone: 'peu-nuageux' };
  if (c === 3) return { texte: 'Couvert', icone: 'nuage' };
  if (c === 45 || c === 48) return { texte: 'Brouillard', icone: 'brouillard' };
  if (c >= 51 && c <= 55) return { texte: 'Bruine', icone: 'pluie' };
  if (c === 56 || c === 57) return { texte: 'Bruine verglaçante', icone: 'pluie' };
  if (c === 61) return { texte: 'Pluie faible', icone: 'pluie' };
  if (c === 63) return { texte: 'Pluie', icone: 'pluie' };
  if (c === 65) return { texte: 'Forte pluie', icone: 'pluie' };
  if (c === 66 || c === 67) return { texte: 'Pluie verglaçante', icone: 'pluie' };
  if (c === 71) return { texte: 'Neige faible', icone: 'neige' };
  if (c === 73) return { texte: 'Neige', icone: 'neige' };
  if (c === 75) return { texte: 'Forte neige', icone: 'neige' };
  if (c === 77) return { texte: 'Grains de neige', icone: 'neige' };
  if (c >= 80 && c <= 82) return { texte: 'Averses', icone: 'pluie' };
  if (c === 85 || c === 86) return { texte: 'Averses de neige', icone: 'neige' };
  if (c === 95) return { texte: 'Orage', icone: 'orage' };
  if (c === 96 || c === 99) return { texte: 'Orage avec grêle', icone: 'orage' };
  return { texte: `Code météo ${c}`, icone: 'nuage' };
}

function lieuFixe() {
  const lat = Number(reglage('lieuLat'));
  const lon = Number(reglage('lieuLon'));
  const valide = Number.isFinite(lat) && Number.isFinite(lon) && reglage('lieuLat') !== '' && reglage('lieuLat') != null;
  return valide
    ? { nom: reglage('lieuNom') || 'Lieu fixe', lat, lon }
    : { ...LIEU_DEFAUT };
}

/** Position du téléphone si le réglage le permet, sinon le lieu fixe. */
export async function position() {
  if (reglage('meteoMode') !== 'fixe' && 'geolocation' in navigator) {
    try {
      const p = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 12000, maximumAge: 60 * 60 * 1000, enableHighAccuracy: false,
      }));
      return { nom: 'Position du téléphone', lat: p.coords.latitude, lon: p.coords.longitude };
    } catch {
      const l = lieuFixe();
      return { ...l, nom: `${l.nom} (GPS indisponible)` };
    }
  }
  return lieuFixe();
}

const arrondi = (v, decimales = 1) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10 ** decimales) / 10 ** decimales);
const entier = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));

/** Heures des deux relevés (onglet Matin et onglet Soir). */
export const HEURES_RELEVES = [8, 16];

/** Vrai quand l'heure du relevé est passée pour la fiche `date` (à `quand`). */
export function heurePassee(date, heure, quand) {
  const [a, m, j] = date.split('-').map(Number);
  return quand >= new Date(a, m - 1, j, heure, 0, 0);
}

const HORAIRE = 'temperature_2m,cloud_cover,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl';
const JOURNALIER = 'temperature_2m_min,temperature_2m_max,precipitation_sum,sunshine_duration,weather_code,sunset,daylight_duration';

async function interroger(base, extra) {
  const pos = await position();
  const params = new URLSearchParams({
    latitude: pos.lat.toFixed(4),
    longitude: pos.lon.toFixed(4),
    daily: JOURNALIER,
    hourly: HORAIRE,
    timezone: 'Europe/Zurich',
    ...extra,
  });
  let rep;
  try {
    rep = await fetch(`${base}?${params}`);
  } catch {
    throw new Error('Open-Meteo injoignable (réseau ?).');
  }
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok || json.error) throw new Error('Open-Meteo : ' + (json.reason || `erreur ${rep.status}`));
  return { lieu: pos.nom, jours: analyser(json) };
}

/**
 * Découpe la réponse d'Open-Meteo par jour. Pour chaque date :
 *  - journee : résumé de la journée (champs meteo_*) ;
 *  - soleil  : coucher_soleil (« HH:MM ») et duree_jour_min ;
 *  - releves : { 8: champs meteo8_*, 16: champs meteo16_* } (absent si l'heure manque) ;
 *  - extra   : tendances de pression (t8, t16 : 1, 0 ou −1), durée du jour et de la veille en secondes.
 */
function analyser(json) {
  const jours = new Map();
  const d = json.daily || {};
  const h = json.hourly || {};
  const temps = d.time || [];
  const indexHeure = new Map((h.time || []).map((t, i) => [t, i]));
  const val = (cle, i) => (Array.isArray(h[cle]) ? h[cle][i] : null);
  const dureeS = new Map(temps.map((t, k) => [t, (d.daylight_duration || [])[k]]));

  temps.forEach((date, k) => {
    const jd = (cle) => (Array.isArray(d[cle]) ? d[cle][k] : null);
    const nuagesJour = (h.time || []).map((t, i) => (t.startsWith(date) ? val('cloud_cover', i) : null)).filter((v) => v != null);
    const soleilS = jd('sunshine_duration');
    const coucher = jd('sunset');
    const duree = jd('daylight_duration');
    const veille = decaler(date, -1);

    const entree = {
      journee: {
        meteo_tmin: arrondi(jd('temperature_2m_min')),
        meteo_tmax: arrondi(jd('temperature_2m_max')),
        meteo_pluie_mm: arrondi(jd('precipitation_sum')),
        meteo_soleil_h: soleilS == null ? null : arrondi(soleilS / 3600),
        meteo_nuages_pct: nuagesJour.length ? Math.round(nuagesJour.reduce((a, b) => a + b, 0) / nuagesJour.length) : null,
        meteo_code: entier(jd('weather_code')),
      },
      soleil: {
        coucher_soleil: typeof coucher === 'string' && coucher.includes('T') ? coucher.slice(11, 16) : null,
        duree_jour_min: duree == null ? null : arrondi(duree / 60),
      },
      releves: {},
      extra: { jourS: duree ?? null, veilleS: dureeS.get(veille) ?? null },
    };

    for (const heure of HEURES_RELEVES) {
      const i = indexHeure.get(`${date}T${String(heure).padStart(2, '0')}:00`);
      if (i == null || val('temperature_2m', i) == null) continue;
      const p = (cle) => `meteo${heure}_${cle}`;
      entree.releves[heure] = {
        [p('temp')]: arrondi(val('temperature_2m', i)),
        [p('nuages')]: entier(val('cloud_cover', i)),
        [p('pluie')]: arrondi(val('precipitation', i)),
        [p('code')]: entier(val('weather_code', i)),
        [p('vent')]: entier(val('wind_speed_10m', i)),
        [p('vent_dir')]: entier(val('wind_direction_10m', i)),
        [p('pression')]: arrondi(val('pressure_msl', i)),
      };
      const avant = indexHeure.get(`${date}T${String(heure - 3).padStart(2, '0')}:00`);
      const p0 = avant == null ? null : val('pressure_msl', avant);
      const p1 = val('pressure_msl', i);
      entree.extra['t' + heure] = p0 == null || p1 == null ? null : tendance(p1 - p0);
    }
    jours.set(date, entree);
  });
  return jours;
}

/** Tendance de la pression sur 3 h : 1 (hausse), −1 (baisse) ou 0 (stable), seuil 1 hPa. */
export const tendance = (ecart) => (ecart >= 1 ? 1 : ecart <= -1 ? -1 : 0);

/** Météo d'une journée (et de la veille, pour l'écart de durée du jour). */
export async function chercherMeteo(date) {
  const ancien = date < decaler(versTexte(new Date()), -80); // au-delà, on passe par les archives
  const base = ancien ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  return interroger(base, { start_date: decaler(date, -1), end_date: date });
}

/** Les 92 derniers jours d'un coup (paramètre past_days), pour compléter les fiches existantes. */
export function chercherDerniersJours() {
  return interroger('https://api.open-meteo.com/v1/forecast', { past_days: '92', forecast_days: '1' });
}

/** Une période plus ancienne, depuis les archives d'Open-Meteo. */
export function chercherArchives(debut, fin) {
  return interroger('https://archive-api.open-meteo.com/v1/archive', { start_date: decaler(debut, -1), end_date: fin });
}

/* ---------- Vent, bise et pression ---------- */

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Direction du vent (degrés, d'où il vient) → N, NE, E… */
export function pointCardinal(deg) {
  if (deg == null || !Number.isFinite(Number(deg))) return '';
  return POINTS[Math.round((((Number(deg) % 360) + 360) % 360) / 45) % 8];
}

/** Seuils de la bise (réglables) : vent du nord-est entre dirMin et dirMax degrés, à vitesseMin km/h ou plus. */
export function seuilsBise() {
  const n = (cle, defaut) => (Number.isFinite(Number(reglage(cle))) && reglage(cle) !== '' && reglage(cle) != null ? Number(reglage(cle)) : defaut);
  return { vitesseMin: n('biseVitesse', 15), dirMin: n('biseDirMin', 20), dirMax: n('biseDirMax', 100) };
}

/** Vrai si le vent est de la bise. Calculé, jamais stocké. */
export function estBise(vitesse, direction, seuils = seuilsBise()) {
  if (vitesse == null || direction == null) return false;
  return Number(vitesse) >= seuils.vitesseMin && Number(direction) >= seuils.dirMin && Number(direction) <= seuils.dirMax;
}

/**
 * Vent d'un relevé (8 ou 16 h) : l'anémomètre Netatmo en priorité, Open-Meteo en secours.
 * Renvoie { vent, dir, source: 'netatmo' | 'open-meteo' } (vent null si rien).
 */
export function ventDe(f, heure) {
  const nv = f[`nt${heure}_vent`];
  if (nv != null && nv !== '') return { vent: Number(nv), dir: f[`nt${heure}_vent_dir`] == null || f[`nt${heure}_vent_dir`] === '' ? null : Number(f[`nt${heure}_vent_dir`]), source: 'netatmo' };
  const ov = f[`meteo${heure}_vent`];
  return { vent: ov == null || ov === '' ? null : Number(ov), dir: f[`meteo${heure}_vent_dir`] == null ? null : Number(f[`meteo${heure}_vent_dir`]), source: 'open-meteo' };
}

export const FLECHES_TENDANCE = { 1: '↗', 0: '→', '-1': '↘' };

/** « 1 021 » : espace fine insécable pour les milliers. */
export function formatPression(hpa) {
  return String(Math.round(Number(hpa))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
