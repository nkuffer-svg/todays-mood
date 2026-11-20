/* Photos du ciel et du jour : compression sur le téléphone, stockage local, envoi vers Drive (via sync.js). */
import { appeler } from './sync.js';

const COTE_MAX = 1600;
const QUALITE = 0.8;

export const cleePhoto = (date, champ) => `${date}:${champ}`;

/** Extrait l'identifiant Drive d'un lien (ou renvoie l'identifiant tel quel). */
export function idDepuisLien(lien) {
  if (!lien) return null;
  const s = String(lien);
  const m = s.match(/\/d\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(s) ? s : null;
}

/** JPEG, côté le plus long 1600 px, qualité 0,8. L'orientation de l'appareil photo est respectée. */
export async function compresser(fichier) {
  let image;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Image illisible.');
  }
  const k = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const l = Math.round(image.width * k);
  const h = Math.round(image.height * k);
  const canevas = document.createElement('canvas');
  canevas.width = l;
  canevas.height = h;
  const c2d = canevas.getContext('2d');
  c2d.imageSmoothingQuality = 'high';
  c2d.drawImage(image, 0, 0, l, h);
  image.close?.();
  const blob = await new Promise((resolve) => canevas.toBlob(resolve, 'image/jpeg', QUALITE));
  if (!blob) throw new Error('Compression impossible.');
  return blob;
}

/** Enregistre une nouvelle photo pour un champ ; l'ancienne (si elle était déjà sur Drive) sera mise à la corbeille. */
export async function enregistrerPhoto(date, champ, fichier, lienActuel) {
  const blob = await compresser(fichier);
  const cle = cleePhoto(date, champ);
  const ancienne = await TMDB.lire('photos', cle);
  const remplace = ancienne && ancienne.etat === 'attente'
    ? ancienne.remplace
    : idDepuisLien(lienActuel) || (ancienne && ancienne.driveId) || null;
  await TMDB.enregistrerPhotoLocale({ cle, date, champ, blob, etat: 'attente', remplace, version: Date.now() });
  liberer(cle);
}

/** Supprime la photo d'un champ (locale et, si besoin, sur Drive). */
export async function supprimerPhoto(date, champ, lienActuel) {
  const cle = cleePhoto(date, champ);
  const p = await TMDB.lire('photos', cle);
  const ids = new Set([idDepuisLien(lienActuel), p && p.driveId, p && p.remplace].filter(Boolean));
  await TMDB.supprimerPhotoLocale(cle, [...ids]);
  liberer(cle);
}

const urls = new Map(); // cle → { version, url }

function liberer(cle) {
  const u = urls.get(cle);
  if (u) URL.revokeObjectURL(u.url);
  urls.delete(cle);
}

function urlPour(p) {
  const u = urls.get(p.cle);
  if (u && u.version === (p.version || p.driveId)) return u.url;
  if (u) URL.revokeObjectURL(u.url);
  const url = URL.createObjectURL(p.blob);
  urls.set(p.cle, { version: p.version || p.driveId, url });
  return url;
}

function base64VersBlob(b64, type) {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: type || 'image/jpeg' });
}

/**
 * Adresse affichable de la photo d'un champ.
 * Renvoie { url, etat: 'attente' | 'envoyee' } ou null s'il n'y a pas de photo.
 * Si la photo n'est que sur Drive (autre appareil, copie locale effacée), elle est téléchargée via Apps Script.
 */
export async function photoAffichable(date, champ, lien) {
  const cle = cleePhoto(date, champ);
  const p = await TMDB.lire('photos', cle);
  const idLien = idDepuisLien(lien);
  if (p && (p.etat === 'attente' || !idLien || p.driveId === idLien)) {
    return { url: urlPour(p), etat: p.etat };
  }
  if (!idLien) return null;
  const rep = await appeler('lirePhoto', { id: idLien });
  const nouvelle = { cle, date, champ, blob: base64VersBlob(rep.donnees, rep.type), etat: 'envoyee', driveId: idLien };
  await TMDB.ecrire('photos', nouvelle);
  return { url: urlPour(nouvelle), etat: 'envoyee' };
}
