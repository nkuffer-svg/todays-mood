/* Synchronisation avec la Web App Apps Script.
   - Envoi : la file (magasin « file ») est envoyée dès que possible ; une fiche n'en sort
     que si elle n'a pas été modifiée pendant l'envoi.
   - Réception : au démarrage (et sur demande), toutes les fiches du Sheet sont relues ; une fiche
     distante remplace la locale si elle est plus récente et que la locale n'attend pas d'envoi. */
import { reglage, definirReglage, reglagesPartages, fusionnerReglages } from './reglages.js';

const ecouteurs = new Set();
const ecouteursDonnees = new Set();
let surPhotoEnvoyeeFn = null;

/** L'app reçoit ici le lien Drive d'une photo envoyée, pour l'inscrire dans la fiche. */
export function surPhotoEnvoyee(fn) {
  surPhotoEnvoyeeFn = fn;
}
let etat = { code: 'inconnu', attente: 0, message: '' };
let minuteur = null;
let enCours = null;
let aRefaire = null;

export function surEtat(fn) {
  ecouteurs.add(fn);
  fn(etat);
  return () => ecouteurs.delete(fn);
}

/** Appelé quand des données venues du Sheet ont modifié les fiches ou les pastilles locales. */
export function surDonnees(fn) {
  ecouteursDonnees.add(fn);
}

function publier(modif) {
  etat = { ...etat, ...modif };
  for (const fn of ecouteurs) fn(etat);
}

export function etatSynchro() {
  return etat;
}

async function compterAttente() {
  const n = (await TMDB.tout('file')).length;
  publier({ attente: n });
  return n;
}

/** Programme un envoi un peu plus tard (regroupe les saisies rapprochées). */
export function planifier(delai = 2500) {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => synchroniser(), delai);
  compterAttente();
}

/** Appelle la Web App. Lève une erreur en français en cas de problème. */
export async function appeler(action, donnees = {}, config = {}) {
  const url = (config.url ?? reglage('url') ?? '').trim();
  const jeton = (config.jeton ?? reglage('jeton') ?? '').trim();
  if (!url || !jeton) {
    const e = new Error('Adresse de la Web App ou jeton manquant (voir Réglages).');
    e.code = 'config';
    throw e;
  }
  const controle = new AbortController();
  const delai = setTimeout(() => controle.abort(), 30000);
  let reponse;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, jeton, ...donnees }),
      signal: controle.signal,
      redirect: 'follow',
    });
  } catch (err) {
    const e = new Error(err.name === 'AbortError'
      ? 'Pas de réponse du serveur (délai dépassé).'
      : 'Connexion impossible : vérifie le réseau, l’adresse de la Web App et que son accès est « Tout le monde ».');
    e.code = 'reseau';
    throw e;
  } finally {
    clearTimeout(delai);
  }
  const texte = await reponse.text();
  let json;
  try {
    json = JSON.parse(texte);
  } catch {
    const e = new Error('Réponse inattendue du serveur : vérifie l’adresse (elle finit par /exec) et que l’accès du déploiement est « Tout le monde ».');
    e.code = 'reponse';
    throw e;
  }
  if (!json.ok) {
    let message = json.erreur || 'Erreur inconnue côté Apps Script.';
    if (/DriveApp|auth\/drive/.test(message)) {
      message = 'Le script n’a pas encore l’autorisation Google Drive : dans l’éditeur Apps Script, lance « initialiser » et accepte l’accès à Drive.';
    } else if (/^Action inconnue/.test(message)) {
      message = 'Le script Apps Script n’est pas à jour : recolle Code.gs puis publie une nouvelle version du déploiement.';
    }
    const e = new Error(message);
    e.code = json.code || 'serveur';
    throw e;
  }
  return json;
}

/**
 * Envoie la file puis, si demandé, relit tout le Sheet.
 * Renvoie { datesModifiees: Set, pastillesModifiees: bool } (données venues du Sheet).
 */
export function synchroniser({ tirer = false } = {}) {
  clearTimeout(minuteur);
  if (enCours) {
    aRefaire = { tirer: tirer || (aRefaire && aRefaire.tirer) };
    return enCours;
  }
  enCours = executer(tirer).finally(() => {
    enCours = null;
    if (aRefaire) {
      const suite = aRefaire;
      aRefaire = null;
      synchroniser(suite);
    }
  });
  return enCours;
}

async function executer(tirer) {
  const resultat = {
    datesModifiees: new Set(), pastillesModifiees: false, marchesModifiees: false, penseesModifiees: false, reglagesModifies: false,
    tentationsModifiees: false, defisModifies: false,
  };
  const attente = await compterAttente();
  if (!reglage('url') || !reglage('jeton')) {
    publier({ code: 'config', message: 'Synchronisation à configurer' });
    return resultat;
  }
  if (!navigator.onLine) {
    publier({ code: 'horsligne', message: 'Hors ligne' });
    return resultat;
  }
  if (attente === 0 && !tirer) {
    publier({ code: 'ok', message: 'À jour' });
    return resultat;
  }
  publier({ code: 'encours', message: 'Synchronisation…' });
  try {
    const ignorees = await envoyer();
    // Le Sheet avait une version plus récente de certaines fiches : on la récupère.
    if (tirer || ignorees > 0) await recevoir(resultat);
    await definirReglage('derniereSynchro', new Date().toISOString());
    const reste = await compterAttente();
    publier({ code: reste ? 'attente' : 'ok', message: reste ? 'Envoi en attente' : 'À jour' });
  } catch (err) {
    publier({ code: err.code === 'jeton' ? 'jeton' : 'erreur', message: err.message });
  }
  if (resultat.datesModifiees.size || resultat.pastillesModifiees || resultat.marchesModifiees || resultat.penseesModifiees || resultat.reglagesModifies
    || resultat.tentationsModifiees || resultat.defisModifies) {
    for (const fn of ecouteursDonnees) await fn(resultat);
  }
  return resultat;
}

function blobVersBase64(blob) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result).split(',')[1]);
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

/** Envoie les photos en attente, puis met à la corbeille les photos remplacées ou supprimées. */
async function envoyerPhotos() {
  const entrees = await TMDB.tout('file');
  for (const e of entrees.filter((x) => x.type === 'photo')) {
    const p = await TMDB.lire('photos', e.photo);
    if (!p || p.etat !== 'attente') {
      await TMDB.supprimer('file', e.cle);
      continue;
    }
    publier({ code: 'encours', message: 'Envoi d’une photo…' });
    const rep = await appeler('envoyerPhoto', {
      date: p.date, champ: p.champ, donnees: await blobVersBase64(p.blob), remplace: p.remplace || null,
    });
    if (await TMDB.marquerPhotoEnvoyee(p.cle, p.version, rep.id)) {
      if (surPhotoEnvoyeeFn) await surPhotoEnvoyeeFn(p.date, p.champ, rep.lien);
    } else {
      // Photo remplacée ou supprimée pendant l'envoi : le fichier envoyé ne sert plus.
      await TMDB.mettreALaCorbeille(rep.id);
    }
  }
  for (const e of (await TMDB.tout('file')).filter((x) => x.type === 'corbeille')) {
    await appeler('supprimerPhoto', { id: e.id });
    await TMDB.supprimer('file', e.cle);
  }
}

async function envoyer() {
  await envoyerPhotos();
  const file = await TMDB.tout('file');
  if (file.filter((e) => ['fiche', 'pastilles', 'marche', 'pensee', 'reglages', 'enreg'].includes(e.type)).length === 0) return 0;
  // Chaque fiche part avec ses seuls champs modifiés : le Sheet garde les autres
  // (saisis par exemple sur un autre appareil).
  const fiches = [];
  for (const entree of file.filter((e) => e.type === 'fiche')) {
    const f = await TMDB.lire('fiches', entree.date);
    if (!f) {
      await TMDB.supprimer('file', entree.cle);
      continue;
    }
    const noms = Array.isArray(entree.champs)
      ? entree.champs
      : Object.keys(f).filter((k) => k !== 'date' && k !== 'modifie_le');
    const champs = {};
    for (const k of noms) champs[k] = f[k] ?? null;
    fiches.push({ date: f.date, modifie_le: f.modifie_le, champs });
  }
  const avecPastilles = file.some((e) => e.type === 'pastilles');
  const donnees = { fiches };

  // Marches : ajouts et suppressions.
  const entreesMarches = file.filter((e) => e.type === 'marche');
  const marches = [];
  const marchesSupprimees = [];
  for (const e of entreesMarches) {
    if (e.op === 'suppression') { marchesSupprimees.push(e.id); continue; }
    const m = await TMDB.lire('marches', e.id);
    if (m) marches.push(m);
    else marchesSupprimees.push(e.id);
  }
  if (entreesMarches.length) {
    donnees.marches = marches;
    donnees.marchesSupprimees = marchesSupprimees;
  }

  // Tentations et défis (version 4 B) : ajouts / modifications et suppressions.
  const entreesEnreg = file.filter((e) => e.type === 'enreg');
  for (const magasin of ['tentations', 'defis']) {
    const entrees = entreesEnreg.filter((e) => e.magasin === magasin);
    if (!entrees.length) continue;
    const ecrits = [];
    const supprimes = [];
    for (const e of entrees) {
      const objet = e.op === 'suppression' ? null : await TMDB.lire(magasin, e.id);
      if (objet) ecrits.push(objet); else supprimes.push(e.id);
    }
    donnees[magasin] = ecrits;
    donnees[magasin + 'Supprimes'] = supprimes;
  }

  // Pensées : favori et dernière apparition.
  const pensees = [];
  for (const e of file.filter((x) => x.type === 'pensee')) {
    const p = await TMDB.lire('pensees', e.id);
    if (p) pensees.push(p);
    else await TMDB.supprimer('file', e.cle);
  }
  if (pensees.length) donnees.pensees = pensees;

  // Réglages partagés (jamais l'adresse ni le jeton).
  const entreeReglages = file.find((e) => e.type === 'reglages');
  if (entreeReglages) donnees.reglages = reglagesPartages();
  if (avecPastilles) donnees.pastilles = await TMDB.tout('pastilles');

  const rep = await appeler('enregistrer', donnees);

  for (const f of fiches) await TMDB.retirerFicheDeLaFile(f.date, f.modifie_le);
  if (avecPastilles) await TMDB.supprimer('file', 'pastilles');
  for (const e of entreesMarches) await TMDB.retirerMarcheDeLaFile(e.id, e.op);
  for (const p of pensees) await TMDB.retirerPenseeDeLaFile(p);
  for (const e of entreesEnreg) await TMDB.retirerEnregistrementDeLaFile(e.cle, e.version);
  if (entreeReglages) await TMDB.retirerReglagesDeLaFile(entreeReglages.version);
  return (rep.ignorees || []).length;
}

async function recevoir(resultat) {
  const rep = await appeler('lire');
  for (const distante of rep.fiches || []) {
    if (!distante.date) continue;
    if (await TMDB.fusionnerFicheDistante(distante)) resultat.datesModifiees.add(distante.date);
  }
  if (Array.isArray(rep.marches) && await TMDB.fusionnerMarches(rep.marches)) {
    resultat.marchesModifiees = true;
  }
  if (Array.isArray(rep.tentations) && await TMDB.fusionnerEnregistrements('tentations', rep.tentations)) {
    resultat.tentationsModifiees = true;
  }
  if (Array.isArray(rep.defis) && await TMDB.fusionnerEnregistrements('defis', rep.defis)) {
    resultat.defisModifies = true;
  }
  if (Array.isArray(rep.pensees) && await TMDB.fusionnerPensees(rep.pensees)) {
    resultat.penseesModifiees = true;
  }
  // Date de la dernière sauvegarde automatique du classeur (gardée sur le téléphone, pour les Réglages).
  if ('sauvegarde' in rep && rep.sauvegarde !== reglage('derniereSauvegarde')) {
    await definirReglage('derniereSauvegarde', rep.sauvegarde || null);
  }
  if (rep.reglages && typeof rep.reglages === 'object') {
    resultat.reglagesModifies = (await fusionnerReglages(rep.reglages)).length > 0;
  }
  const fileActuelle = await TMDB.tout('file');
  const pastillesEnAttente = fileActuelle.some((e) => e.type === 'pastilles');
  if (!pastillesEnAttente && Array.isArray(rep.pastilles) && rep.pastilles.length) {
    const locales = await TMDB.tout('pastilles');
    const cle = (l) => JSON.stringify([...l].sort((a, b) => a.ordre - b.ordre).map((p) => [p.nom, p.ordre, p.visible]));
    if (cle(locales) !== cle(rep.pastilles)) {
      await TMDB.remplacerPastilles(rep.pastilles);
      resultat.pastillesModifiees = true;
    }
  }
}
