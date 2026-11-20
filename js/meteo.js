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

/** Récupère la météo d'une journée. Renvoie les champs de la fiche + le nom du lieu. */
export async function chercherMeteo(date) {
  const pos = await position();
  const ancien = date < decaler(versTexte(new Date()), -80); // au-delà, on passe par les archives
  const base = ancien ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: pos.lat.toFixed(4),
    longitude: pos.lon.toFixed(4),
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,sunshine_duration,weather_code',
    hourly: 'cloud_cover',
    timezone: 'Europe/Zurich',
    start_date: date,
    end_date: date,
  });
  let rep;
  try {
    rep = await fetch(`${base}?${params}`);
  } catch {
    throw new Error('Open-Meteo injoignable (réseau ?).');
  }
  const json = await rep.json().catch(() => ({}));
  if (!rep.ok || json.error) throw new Error('Open-Meteo : ' + (json.reason || `erreur ${rep.status}`));

  const jour = (cle) => (json.daily && Array.isArray(json.daily[cle]) ? json.daily[cle][0] : null);
  const nuages = ((json.hourly && json.hourly.cloud_cover) || []).filter((v) => v != null);
  const soleilSecondes = jour('sunshine_duration');
  return {
    lieu: pos.nom,
    champs: {
      meteo_tmin: arrondi(jour('temperature_2m_min')),
      meteo_tmax: arrondi(jour('temperature_2m_max')),
      meteo_pluie_mm: arrondi(jour('precipitation_sum')),
      meteo_soleil_h: soleilSecondes == null ? null : arrondi(soleilSecondes / 3600),
      meteo_nuages_pct: nuages.length ? Math.round(nuages.reduce((a, b) => a + b, 0) / nuages.length) : null,
      meteo_code: jour('weather_code') == null ? null : Number(jour('weather_code')),
    },
  };
}
