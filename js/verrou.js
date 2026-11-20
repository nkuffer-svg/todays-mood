/* Verrou de l'onglet Perso par empreinte (WebAuthn, authentificateur intégré du téléphone).
   C'est un verrou d'interface, pas un chiffrement : il évite d'afficher le contenu Perso sans l'empreinte.
   L'identifiant de la clé créée reste sur ce téléphone (réglage local « verrouCle »). */
import { reglage, definirReglage } from './reglages.js';

let deverrouille = false;
let authentificationEnCours = false;
const ecouteurs = new Set();

export const estDeverrouille = () => deverrouille;
export const authentificationActive = () => authentificationEnCours;
export function surChangement(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); }
function publier() { for (const fn of ecouteurs) fn(deverrouille); }

export function verrouiller() {
  if (!deverrouille) return;
  deverrouille = false;
  publier();
}

const versBase64 = (tampon) => btoa(String.fromCharCode(...new Uint8Array(tampon)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const depuisBase64 = (texte) => {
  const b = atob(texte.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const aleatoire = (n) => crypto.getRandomValues(new Uint8Array(n));

/** 'ok' (capteur disponible), 'absent' (aucun authentificateur intégré) ou 'incompatible' (pas de WebAuthn). */
export async function disponibilite() {
  if (!window.PublicKeyCredential || !navigator.credentials) return 'incompatible';
  try {
    return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) ? 'ok' : 'absent';
  } catch {
    return 'absent';
  }
}

export const empreinteEnregistree = () => !!reglage('verrouCle');

function messageErreur(err) {
  if (!err) return 'Erreur inconnue.';
  if (err.name === 'NotAllowedError') return 'Empreinte non reconnue ou demande annulée.';
  if (err.name === 'InvalidStateError') return 'Une empreinte est déjà enregistrée pour cette app sur ce téléphone.';
  if (err.name === 'SecurityError') return 'Le verrou ne fonctionne que sur l’adresse officielle de l’app (https).';
  return err.message || String(err);
}

/** Vérifie que l'utilisateur a bien été vérifié (empreinte ou code), bit « UV » des données de l'authentificateur. */
function utilisateurVerifie(authData) {
  const octets = new Uint8Array(authData);
  return octets.length > 32 && (octets[32] & 0x04) !== 0;
}

/** Crée la clé liée à l'empreinte (première utilisation, ou réenregistrement). */
export async function enregistrerEmpreinte() {
  authentificationEnCours = true;
  try {
    const cle = await navigator.credentials.create({
      publicKey: {
        challenge: aleatoire(32),
        rp: { name: "Today's Mood" },
        user: { id: aleatoire(16), name: 'todays-mood', displayName: "Today's Mood" },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    });
    if (!cle) throw new Error('Aucune clé créée.');
    await definirReglage('verrouCle', versBase64(cle.rawId));
    deverrouille = true;
    publier();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: messageErreur(err) };
  } finally {
    authentificationEnCours = false;
  }
}

/** Demande l'empreinte et déverrouille si elle est reconnue. */
export async function deverrouiller() {
  if (deverrouille) return { ok: true };
  const id = reglage('verrouCle');
  if (!id) return { ok: false, message: 'Aucune empreinte enregistrée.', code: 'aucune' };
  authentificationEnCours = true;
  try {
    const reponse = await navigator.credentials.get({
      publicKey: {
        challenge: aleatoire(32),
        allowCredentials: [{ type: 'public-key', id: depuisBase64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (!reponse || !utilisateurVerifie(reponse.response.authenticatorData)) {
      return { ok: false, message: 'Empreinte non vérifiée.' };
    }
    deverrouille = true;
    publier();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: messageErreur(err) };
  } finally {
    authentificationEnCours = false;
  }
}

/** Ordinateur de test sans capteur : déverrouillage sans empreinte (jamais proposé sur un téléphone équipé). */
export async function deverrouillerSansCapteur() {
  if ((await disponibilite()) === 'ok') return { ok: false, message: 'Ce téléphone a un capteur : utilise l’empreinte.' };
  deverrouille = true;
  publier();
  return { ok: true };
}

/** Déverrouille par le moyen disponible : empreinte (ou son enregistrement à la première utilisation),
    ou sans empreinte sur un ordinateur de test sans capteur. */
export async function demanderAcces() {
  if (deverrouille) return { ok: true };
  if ((await disponibilite()) !== 'ok') return deverrouillerSansCapteur();
  return empreinteEnregistree() ? deverrouiller() : enregistrerEmpreinte();
}
