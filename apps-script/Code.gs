/**
 * Today's Mood — Web App Apps Script (version 5, partie A).
 *
 * À coller dans l'éditeur Apps Script du classeur « Today's Mood – données »
 * (Extensions → Apps Script). Voir apps-script/INSTALLATION.md.
 *
 * Le jeton secret n'est PAS dans ce fichier : il est créé par la fonction « initialiser »
 * et rangé dans les Propriétés du script.
 */

const VERSION = 'v5a-1';

const COLONNES_FICHES = [
  'date', 'modifie_le', 'pensee_id',
  'meteo_tmin', 'meteo_tmax', 'meteo_pluie_mm', 'meteo_soleil_h', 'meteo_nuages_pct', 'meteo_code', 'meteo_ressenti',
  'photo_ciel', 'photo_jour',
  'humeur_matin', 'humeur_soir', 'energie', 'inspiration', 'energie_sexuelle', 'bilan',
  'evt_appreciation', 'evt_categorie', 'evt_texte',
  'accord_parole', 'accord_personnel', 'accord_supposition', 'accord_mieux',
  'pas', 'natation_m', 'eau_ml', 'cafe', 'deca', 'biere', 'vin', 'biscotte_1', 'biscotte_2',
  'recit', 'recit_favori', 'recit_piment', 'mylove', 'mylove_favori', 'mylove_piment',
  // Version 2 : ajoutées à la fin. Si elles manquent dans le Sheet, elles sont créées automatiquement.
  'cuisine', 'repas_type', 'guitare', 'feux_poele', 'barbecues', 'deplacement',
  // Version 3 : relevés de 8 h et 16 h, météo du soir, coucher du soleil, lune (ajoutées à la fin, créées si besoin).
  'meteo8_temp', 'meteo8_nuages', 'meteo8_pluie', 'meteo8_code', 'meteo8_vent', 'meteo8_vent_dir', 'meteo8_pression',
  'meteo16_temp', 'meteo16_nuages', 'meteo16_pluie', 'meteo16_code', 'meteo16_vent', 'meteo16_vent_dir', 'meteo16_pression',
  'meteo_soir_ressenti', 'coucher_soleil', 'duree_jour_min', 'lune_phase', 'lune_pct', 'photo_ciel_soir',
  // Version 3, partie B
  'mot_du_jour',
  // Version 4, partie A : temps d'écran, chien, sommeil
  'ecran_min', 'chien_balades', 'chien_education',
  'sommeil_coucher', 'sommeil_lever', 'sommeil_duree_min', 'sommeil_qualite',
  // Version 5, partie A : la maison (Netatmo intérieur), vent Netatmo, futurs module extérieur et pluviomètre
  'maison7_temp', 'maison7_hum', 'maison7_co2', 'maison20_temp', 'maison20_hum', 'maison20_co2', 'maison_source',
  'nt8_vent', 'nt8_vent_dir', 'nt16_vent', 'nt16_vent_dir',
  'nt8_temp_ext', 'nt16_temp_ext', 'nt_pluie_jour',
];

/** Colonnes de texte (les autres sont numériques). */
const COLONNES_TEXTE = [
  'date', 'modifie_le', 'pensee_id', 'photo_ciel', 'photo_jour',
  'evt_appreciation', 'evt_categorie', 'evt_texte', 'recit', 'mylove',
  'cuisine', 'repas_type', 'deplacement',
  'coucher_soleil', 'photo_ciel_soir', 'mot_du_jour',
  'sommeil_coucher', 'sommeil_lever', 'maison_source',
];

/** Colonnes oui / vide (marques Favori et Piment). */
const COLONNES_OUI = ['recit_favori', 'recit_piment', 'mylove_favori', 'mylove_piment'];

const ONGLETS = {
  Fiches: COLONNES_FICHES,
  Marches: ['id', 'date', 'km'],
  Pensees: ['id', 'favori', 'derniere_apparition'],
  Pastilles: ['nom', 'ordre', 'visible'],
  Reglages: ['cle', 'valeur'],
  // Version 4, partie B
  Tentations: ['id', 'date', 'gagnant', 'quoi', 'montant_chf'],
  Defis: ['mois', 'type', 'compteur', 'cible', 'libelle', 'resultat'],
  // Version 5, partie A
  Bois: ['date', 'steres'],
};

/**
 * Onglets « une ligne = un enregistrement à clé » de la version 4 B.
 * cle : colonne identifiante ; texte : colonnes forcées en texte ; nombres : colonnes numériques.
 */
const ENREGISTREMENTS = {
  tentations: { onglet: 'Tentations', cle: 'id', texte: ['id', 'date', 'gagnant', 'quoi'], nombres: ['montant_chf'] },
  defis: { onglet: 'Defis', cle: 'mois', texte: ['mois', 'type', 'compteur', 'libelle', 'resultat'], nombres: ['cible'] },
  bois: { onglet: 'Bois', cle: 'date', texte: ['date'], nombres: ['steres'] },
};

const NOM_DOSSIER_PHOTOS = "Today's Mood – photos";
const NOM_DOSSIER_SAUVEGARDES = "Today's Mood – sauvegardes";
const NB_SAUVEGARDES = 12;
const CHAMPS_PHOTO = { photo_ciel: 'ciel', photo_jour: 'jour', photo_ciel_soir: 'ciel_soir' };

/** Réglages que l'app peut enregistrer dans l'onglet Reglages (jamais l'adresse ni le jeton). */
const REGLAGES_AUTORISES = [
  'bascule', 'objectifEau', 'dureePensee', 'meteoMode', 'lieuNom', 'lieuLat', 'lieuLon',
  'penseesDebutCycle', 'dernierExport',
  'cuisiniers', 'hiverDebut', 'hiverFin', 'reportsSaisons', 'heureSoir',
  'biseVitesse', 'biseDirMin', 'biseDirMax',
  'cagnotteNom', 'cagnotteMontant', 'cagnotteDebut',
  'co2Max', 'humMin', 'feuxParStere', 'boisVides',
];

const PASTILLES_DEFAUT = ['Job', 'Maison', 'Famille élargie', 'Famille', 'Réflexion', 'Pensée', 'Scène de vie'];

/* =====================================================================
   Fonctions à lancer à la main depuis l'éditeur (menu déroulant + Exécuter)
   ===================================================================== */

/** Crée les 5 onglets, le dossier Drive des photos et le jeton secret. Sans danger si on la relance. */
function initialiser() {
  const ss = classeur_();
  Object.keys(ONGLETS).forEach(function (nom) { preparerOnglet_(ss, nom, ONGLETS[nom]); });

  const pastilles = ss.getSheetByName('Pastilles');
  if (pastilles.getLastRow() < 2) {
    pastilles.getRange(2, 1, PASTILLES_DEFAUT.length, 3)
      .setValues(PASTILLES_DEFAUT.map(function (nom, i) { return ["'" + nom, i + 1, 'oui']; }));
  }

  // Supprime la feuille vide créée par défaut (« Feuille 1 »).
  ss.getSheets().forEach(function (f) {
    if (!ONGLETS[f.getName()] && f.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(f);
  });

  const dossier = dossierPhotos_();
  Logger.log('Dossier des photos : ' + dossier.getName());

  const props = PropertiesService.getScriptProperties();
  let jeton = props.getProperty('JETON');
  if (!jeton) {
    jeton = genererJeton_();
    props.setProperty('JETON', jeton);
  }
  Logger.log('Classeur prêt. Copie ce jeton dans les Réglages de l’app :');
  Logger.log(jeton);
}

/** Réaffiche le jeton actuel dans le journal d'exécution. */
function afficherJeton() {
  const jeton = PropertiesService.getScriptProperties().getProperty('JETON');
  Logger.log(jeton ? jeton : 'Aucun jeton : lance d’abord la fonction « initialiser ».');
}

/** Remplace le jeton (l'ancien ne fonctionnera plus). */
function nouveauJeton() {
  const jeton = genererJeton_();
  PropertiesService.getScriptProperties().setProperty('JETON', jeton);
  Logger.log('Nouveau jeton (à recopier dans les Réglages de l’app) :');
  Logger.log(jeton);
}

/**
 * À lancer UNE SEULE FOIS : installe la sauvegarde automatique chaque dimanche vers 23 h
 * (heure du fuseau du projet, voir Paramètres du projet), puis fait une première sauvegarde tout de suite.
 * Sans danger si on la relance : l'ancien déclencheur est remplacé, jamais doublé.
 */
function installerSauvegarde() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sauvegarder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sauvegarder').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).everyWeeks(1).create();
  Logger.log('Sauvegarde automatique installée : chaque dimanche vers 23 h (fuseau du projet : ' + Session.getScriptTimeZone() + ').');
  sauvegarder();
}

/**
 * Copie le classeur dans le dossier Drive « Today's Mood – sauvegardes », nommée avec la date,
 * et ne garde que les 12 copies les plus récentes (les plus anciennes vont à la corbeille de Drive).
 * Lancée chaque dimanche par le déclencheur ; on peut aussi la lancer à la main.
 */
function sauvegarder() {
  const ss = classeur_();
  const dossier = dossierSauvegardes_();
  const tz = ss.getSpreadsheetTimeZone();
  const nom = "Today's Mood – sauvegarde " + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  // Une seule copie par jour : celle du même jour est remplacée.
  const memeNom = dossier.getFilesByName(nom);
  while (memeNom.hasNext()) memeNom.next().setTrashed(true);
  DriveApp.getFileById(ss.getId()).makeCopy(nom, dossier);

  const copies = [];
  const fichiers = dossier.getFiles();
  while (fichiers.hasNext()) {
    const f = fichiers.next();
    if (!f.isTrashed()) copies.push(f);
  }
  copies.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  copies.slice(NB_SAUVEGARDES).forEach(function (f) { f.setTrashed(true); });

  PropertiesService.getScriptProperties().setProperty('DERNIERE_SAUVEGARDE', new Date().toISOString());
  Logger.log('Sauvegarde faite : « ' + nom + ' » (' + Math.min(copies.length, NB_SAUVEGARDES) + ' copie(s) gardée(s)).');
}

/** Le dossier des sauvegardes (créé au besoin ; son identifiant est gardé dans les Propriétés du script). */
function dossierSauvegardes_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DOSSIER_SAUVEGARDES');
  if (id) {
    try {
      const d = DriveApp.getFolderById(id);
      if (!d.isTrashed()) return d;
    } catch (err) { /* dossier supprimé : on en recrée un */ }
  }
  const trouves = DriveApp.getFoldersByName(NOM_DOSSIER_SAUVEGARDES);
  const dossier = trouves.hasNext() ? trouves.next() : DriveApp.createFolder(NOM_DOSSIER_SAUVEGARDES);
  props.setProperty('DOSSIER_SAUVEGARDES', dossier.getId());
  return dossier;
}

function derniereSauvegarde_() {
  return PropertiesService.getScriptProperties().getProperty('DERNIERE_SAUVEGARDE') || '';
}

/* =====================================================================
   Web App
   ===================================================================== */

function doGet() {
  return ContentService.createTextOutput("Today's Mood : la Web App fonctionne (version " + VERSION + ').');
}

function doPost(e) {
  let reponse;
  try {
    if (!e || !e.postData || !e.postData.contents) throw erreur_('Requête vide.', 'requete');
    let requete;
    try {
      requete = JSON.parse(e.postData.contents);
    } catch (err) {
      throw erreur_('Requête illisible.', 'requete');
    }
    const attendu = PropertiesService.getScriptProperties().getProperty('JETON');
    if (!attendu) throw erreur_('Jeton non configuré : lance la fonction « initialiser » dans l’éditeur Apps Script.', 'jeton');
    if (typeof requete.jeton !== 'string' || requete.jeton !== attendu) {
      throw erreur_('Jeton refusé : vérifie le jeton dans les Réglages de l’app.', 'jeton');
    }

    const verrou = LockService.getScriptLock();
    verrou.waitLock(25000);
    try {
      reponse = traiter_(requete);
    } finally {
      verrou.releaseLock();
    }
  } catch (err) {
    reponse = { ok: false, erreur: String((err && err.message) || err), code: (err && err.code) || 'serveur' };
  }
  return ContentService.createTextOutput(JSON.stringify(reponse)).setMimeType(ContentService.MimeType.JSON);
}

function traiter_(requete) {
  const ss = classeur_();
  switch (requete.action) {
    case 'ping': {
      const fiches = onglet_(ss, 'Fiches');
      return { ok: true, version: VERSION, classeur: ss.getName(), nbFiches: Math.max(0, fiches.getLastRow() - 1), sauvegarde: derniereSauvegarde_() };
    }
    case 'enregistrer': {
      const resultat = enregistrerFiches_(ss, Array.isArray(requete.fiches) ? requete.fiches : []);
      if (Array.isArray(requete.pastilles)) enregistrerPastilles_(ss, requete.pastilles);
      if (Array.isArray(requete.marches) || Array.isArray(requete.marchesSupprimees)) {
        enregistrerMarches_(ss, requete.marches || [], requete.marchesSupprimees || []);
      }
      if (Array.isArray(requete.pensees)) enregistrerPensees_(ss, requete.pensees);
      if (requete.reglages && typeof requete.reglages === 'object') enregistrerReglages_(ss, requete.reglages);
      Object.keys(ENREGISTREMENTS).forEach(function (nom) {
        if (Array.isArray(requete[nom]) || Array.isArray(requete[nom + 'Supprimes'])) {
          enregistrerLignes_(ss, nom, requete[nom] || [], requete[nom + 'Supprimes'] || []);
        }
      });
      return { ok: true, enregistrees: resultat.enregistrees, ignorees: resultat.ignorees };
    }
    case 'lire':
      return { ok: true, fiches: lireFiches_(ss), pastilles: lirePastilles_(ss), marches: lireMarches_(ss), pensees: lirePensees_(ss), reglages: lireReglages_(ss), sauvegarde: derniereSauvegarde_(),
        tentations: lireLignes_(ss, 'tentations'), defis: lireLignes_(ss, 'defis'), bois: lireLignes_(ss, 'bois') };
    case 'envoyerPhoto':
      return envoyerPhoto_(requete);
    case 'netatmo':
      return releverNetatmo_(requete);
    case 'lirePhoto':
      return lirePhoto_(requete);
    case 'supprimerPhoto':
      return supprimerPhoto_(requete);
    default:
      throw erreur_('Action inconnue : ' + requete.action, 'requete');
  }
}

/* =====================================================================
   Fiches
   ===================================================================== */

/**
 * Enregistre des fiches champ par champ : seules les colonnes reçues sont modifiées,
 * les autres gardent leur valeur (saisie par exemple sur un autre appareil).
 * Format reçu : { date, modifie_le, champs: { colonne: valeur, … } }.
 */
function enregistrerFiches_(ss, fiches) {
  const feuille = onglet_(ss, 'Fiches');
  const entetes = entetes_(feuille);
  const iDate = entetes.indexOf('date');
  const iModif = entetes.indexOf('modifie_le');
  const tz = ss.getSpreadsheetTimeZone();

  const derniere = feuille.getLastRow();
  const existantes = {}; // date → { ligne, valeurs }
  if (derniere >= 2) {
    const valeurs = feuille.getRange(2, 1, derniere - 1, entetes.length).getValues();
    valeurs.forEach(function (ligne, k) {
      const d = texteDate_(ligne[iDate], tz);
      if (d && !existantes[d]) existantes[d] = { ligne: k + 2, valeurs: ligne };
    });
  }

  const nouvelles = []; // { date, valeurs }
  const enregistrees = [];

  fiches.forEach(function (fiche) {
    if (!fiche || !/^\d{4}-\d{2}-\d{2}$/.test(String(fiche.date))) return;
    const champs = fiche.champs || fiche; // ancien format : fiche complète
    const aJour = function (h) {
      return h !== 'date' && h !== 'modifie_le' && Object.prototype.hasOwnProperty.call(champs, h);
    };

    let cible = existantes[fiche.date];
    if (!cible) {
      cible = { ligne: null, valeurs: entetes.map(function () { return ''; }) };
      nouvelles.push({ date: fiche.date, cible: cible });
      existantes[fiche.date] = cible;
    }
    const modifActuel = texteHorodatage_(cible.valeurs[iModif]);
    const modifRecu = String(fiche.modifie_le || '');

    const ligne = entetes.map(function (h, i) {
      const actuelle = cible.valeurs[i];
      if (COLONNES_FICHES.indexOf(h) < 0) return actuelle; // colonne ajoutée à la main : intacte
      if (h === 'date') return versCellule_(h, fiche.date);
      if (h === 'modifie_le') return versCellule_(h, modifRecu > modifActuel ? modifRecu : modifActuel);
      if (aJour(h)) return versCellule_(h, champs[h]);
      return versCellule_(h, depuisCellule_(h, actuelle, tz)); // réécrit à l'identique (texte protégé)
    });
    // Garde les valeurs telles qu'elles seront relues, pour une éventuelle 2e fiche du même jour.
    cible.valeurs = ligne.map(function (v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v; });
    cible.ecrire = ligne;
    enregistrees.push(fiche.date);
  });

  Object.keys(existantes).forEach(function (d) {
    const c = existantes[d];
    if (c.ligne && c.ecrire) feuille.getRange(c.ligne, 1, 1, entetes.length).setValues([c.ecrire]);
  });
  if (nouvelles.length) {
    feuille.getRange(Math.max(derniere, 1) + 1, 1, nouvelles.length, entetes.length)
      .setValues(nouvelles.map(function (n) { return n.cible.ecrire; }));
    // Garde les fiches dans l'ordre chronologique.
    feuille.getRange(2, 1, feuille.getLastRow() - 1, feuille.getLastColumn()).sort(iDate + 1);
  }
  return { enregistrees: enregistrees, ignorees: [] };
}

function lireFiches_(ss) {
  const feuille = onglet_(ss, 'Fiches');
  const entetes = entetes_(feuille);
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  const valeurs = feuille.getRange(2, 1, derniere - 1, entetes.length).getValues();
  const fiches = [];
  valeurs.forEach(function (ligne) {
    const fiche = {};
    entetes.forEach(function (h, i) {
      if (COLONNES_FICHES.indexOf(h) >= 0) fiche[h] = depuisCellule_(h, ligne[i], tz);
    });
    if (fiche.date) fiches.push(fiche);
  });
  return fiches;
}

/** Valeur de l'app → cellule. Le préfixe ' force le texte (pas de conversion en date ni de formule). */
function versCellule_(colonne, valeur) {
  if (valeur === null || valeur === undefined || valeur === '' || valeur === false) return '';
  if (COLONNES_OUI.indexOf(colonne) >= 0) return (valeur === true || valeur === 'oui') ? 'oui' : '';
  if (COLONNES_TEXTE.indexOf(colonne) >= 0) return "'" + String(valeur);
  const n = Number(valeur);
  return isFinite(n) ? n : "'" + String(valeur);
}

/** Cellule → valeur de l'app (vide → null). */
function depuisCellule_(colonne, valeur, tz) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  if (colonne === 'date') return texteDate_(valeur, tz) || null;
  if (colonne === 'modifie_le') return texteHorodatage_(valeur) || null;
  if (COLONNES_OUI.indexOf(colonne) >= 0) return (valeur === true || String(valeur).toLowerCase() === 'oui') ? true : null;
  if (COLONNES_TEXTE.indexOf(colonne) >= 0) return String(valeur);
  if (typeof valeur === 'number') return valeur;
  const n = Number(String(valeur).replace(',', '.'));
  return isFinite(n) ? n : null;
}

/* =====================================================================
   Marches (plusieurs par jour) : id, date, km
   ===================================================================== */

function enregistrerMarches_(ss, ajouts, suppressions) {
  const feuille = onglet_(ss, 'Marches');
  const entetes = entetes_(feuille);
  const iId = entetes.indexOf('id');
  const derniere = feuille.getLastRow();
  const valeurs = derniere >= 2 ? feuille.getRange(2, 1, derniere - 1, entetes.length).getValues() : [];
  const ligneParId = {};
  valeurs.forEach(function (l, k) {
    const id = String(l[iId]).trim();
    if (id) ligneParId[id] = k + 2;
  });

  const nouvelles = [];
  ajouts.forEach(function (m) {
    if (!m || !m.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.date))) return;
    const km = Number(m.km);
    if (!isFinite(km) || km <= 0) return;
    const ligne = entetes.map(function (h, i) {
      if (h === 'id') return "'" + String(m.id);
      if (h === 'date') return "'" + m.date;
      if (h === 'km') return km;
      return ligneParId[m.id] ? valeurs[ligneParId[m.id] - 2][i] : '';
    });
    if (ligneParId[m.id]) feuille.getRange(ligneParId[m.id], 1, 1, entetes.length).setValues([ligne]);
    else nouvelles.push(ligne);
  });

  // Suppressions : du bas vers le haut pour ne pas décaler les lignes restantes.
  suppressions
    .map(function (id) { return ligneParId[String(id)]; })
    .filter(function (n) { return n; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (n) { feuille.deleteRow(n); });

  if (nouvelles.length) {
    const debut = Math.max(feuille.getLastRow(), 1) + 1;
    feuille.getRange(debut, 1, nouvelles.length, entetes.length).setValues(nouvelles);
    feuille.getRange(2, 1, feuille.getLastRow() - 1, feuille.getLastColumn()).sort(entetes.indexOf('date') + 1);
  }
}

function lireMarches_(ss) {
  const feuille = onglet_(ss, 'Marches');
  const entetes = entetes_(feuille);
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  const iId = entetes.indexOf('id');
  const iDate = entetes.indexOf('date');
  const iKm = entetes.indexOf('km');
  return feuille.getRange(2, 1, derniere - 1, entetes.length).getValues()
    .map(function (l) {
      const km = typeof l[iKm] === 'number' ? l[iKm] : Number(String(l[iKm]).replace(',', '.'));
      return { id: String(l[iId]).trim(), date: texteDate_(l[iDate], tz), km: km };
    })
    .filter(function (m) { return m.id && m.date && isFinite(m.km) && m.km > 0; });
}

/* =====================================================================
   Tentations et défis (version 4 B) : une ligne par enregistrement, repéré par sa clé
   ===================================================================== */

function enregistrerLignes_(ss, nom, ecrits, supprimes) {
  const def = ENREGISTREMENTS[nom];
  const feuille = onglet_(ss, def.onglet);
  const entetes = entetes_(feuille);
  const iCle = entetes.indexOf(def.cle);
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  const valeurs = derniere >= 2 ? feuille.getRange(2, 1, derniere - 1, entetes.length).getValues() : [];
  const ligneParCle = {};
  valeurs.forEach(function (l, k) {
    const c = cleTexte_(l[iCle], tz);
    if (c) ligneParCle[c] = k + 2;
  });

  const nouvelles = [];
  ecrits.forEach(function (o) {
    const c = o && String(o[def.cle] || '').trim();
    if (!c) return;
    const ligne = entetes.map(function (h, i) {
      if (def.texte.indexOf(h) >= 0) return o[h] === null || o[h] === undefined || o[h] === '' ? '' : "'" + String(o[h]);
      if (def.nombres.indexOf(h) >= 0) {
        const n = Number(o[h]);
        return o[h] === null || o[h] === undefined || o[h] === '' || !isFinite(n) ? '' : n;
      }
      return ligneParCle[c] ? valeurs[ligneParCle[c] - 2][i] : ''; // colonne ajoutée à la main : intacte
    });
    if (ligneParCle[c]) feuille.getRange(ligneParCle[c], 1, 1, entetes.length).setValues([ligne]);
    else nouvelles.push(ligne);
  });

  supprimes
    .map(function (c) { return ligneParCle[String(c)]; })
    .filter(function (n) { return n; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (n) { feuille.deleteRow(n); });

  if (nouvelles.length) {
    feuille.getRange(Math.max(feuille.getLastRow(), 1) + 1, 1, nouvelles.length, entetes.length).setValues(nouvelles);
    feuille.getRange(2, 1, feuille.getLastRow() - 1, feuille.getLastColumn()).sort(iCle + 1);
  }
}

function lireLignes_(ss, nom) {
  const def = ENREGISTREMENTS[nom];
  const feuille = onglet_(ss, def.onglet);
  const entetes = entetes_(feuille);
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  return feuille.getRange(2, 1, derniere - 1, entetes.length).getValues()
    .map(function (l) {
      const o = {};
      entetes.forEach(function (h, i) {
        if (def.texte.indexOf(h) >= 0) o[h] = l[i] === '' ? null : cleTexte_(l[i], tz);
        else if (def.nombres.indexOf(h) >= 0) {
          const n = typeof l[i] === 'number' ? l[i] : Number(String(l[i]).replace(',', '.'));
          o[h] = l[i] === '' || !isFinite(n) ? null : n;
        }
      });
      return o;
    })
    .filter(function (o) { return o[def.cle]; });
}

/** Valeur de cellule → texte (une date reconnue par Sheets redevient AAAA-MM-JJ, un mois AAAA-MM). */
function cleTexte_(valeur, tz) {
  if (valeur instanceof Date) return Utilities.formatDate(valeur, tz, 'yyyy-MM-dd');
  return String(valeur === null || valeur === undefined ? '' : valeur).trim();
}

/* =====================================================================
   Pensées : id, favori (oui/non), dernière apparition
   ===================================================================== */

function enregistrerPensees_(ss, pensees) {
  const feuille = onglet_(ss, 'Pensees');
  const entetes = entetes_(feuille);
  const iId = entetes.indexOf('id');
  const derniere = feuille.getLastRow();
  const valeurs = derniere >= 2 ? feuille.getRange(2, 1, derniere - 1, entetes.length).getValues() : [];
  const ligneParId = {};
  valeurs.forEach(function (l, k) {
    const id = String(l[iId]).trim();
    if (id) ligneParId[id] = k + 2;
  });
  const nouvelles = [];
  pensees.forEach(function (p) {
    if (!p || !p.id) return;
    const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(String(p.derniere || ''));
    const ligne = entetes.map(function (h, i) {
      if (h === 'id') return "'" + String(p.id);
      if (h === 'favori') return p.favori ? 'oui' : 'non';
      if (h === 'derniere_apparition') return dateValide ? "'" + p.derniere : '';
      return ligneParId[p.id] ? valeurs[ligneParId[p.id] - 2][i] : '';
    });
    if (ligneParId[p.id]) feuille.getRange(ligneParId[p.id], 1, 1, entetes.length).setValues([ligne]);
    else nouvelles.push(ligne);
  });
  if (nouvelles.length) {
    feuille.getRange(Math.max(derniere, 1) + 1, 1, nouvelles.length, entetes.length).setValues(nouvelles);
  }
}

function lirePensees_(ss) {
  const feuille = onglet_(ss, 'Pensees');
  const entetes = entetes_(feuille);
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  const iId = entetes.indexOf('id');
  const iFav = entetes.indexOf('favori');
  const iDer = entetes.indexOf('derniere_apparition');
  return feuille.getRange(2, 1, derniere - 1, entetes.length).getValues()
    .filter(function (l) { return String(l[iId]).trim() !== ''; })
    .map(function (l) {
      return {
        id: String(l[iId]).trim(),
        favori: l[iFav] === true || String(l[iFav]).toLowerCase() === 'oui',
        derniere: texteDate_(l[iDer], tz) || null,
      };
    });
}

/* =====================================================================
   Réglages : clé, valeur
   ===================================================================== */

function enregistrerReglages_(ss, reglages) {
  const feuille = onglet_(ss, 'Reglages');
  const derniere = feuille.getLastRow();
  const valeurs = derniere >= 2 ? feuille.getRange(2, 1, derniere - 1, 2).getValues() : [];
  const ligneParCle = {};
  valeurs.forEach(function (l, k) { if (String(l[0]).trim()) ligneParCle[String(l[0]).trim()] = k + 2; });
  const nouvelles = [];
  Object.keys(reglages).forEach(function (cle) {
    if (REGLAGES_AUTORISES.indexOf(cle) < 0) return;
    const v = reglages[cle];
    const cellule = typeof v === 'number' ? v : (v === null || v === undefined ? '' : "'" + String(v));
    if (ligneParCle[cle]) feuille.getRange(ligneParCle[cle], 2).setValue(cellule);
    else nouvelles.push(["'" + cle, cellule]);
  });
  if (nouvelles.length) feuille.getRange(Math.max(derniere, 1) + 1, 1, nouvelles.length, 2).setValues(nouvelles);
}

function lireReglages_(ss) {
  const feuille = onglet_(ss, 'Reglages');
  const tz = ss.getSpreadsheetTimeZone();
  const derniere = feuille.getLastRow();
  const reglages = {};
  if (derniere < 2) return reglages;
  feuille.getRange(2, 1, derniere - 1, 2).getValues().forEach(function (l) {
    const cle = String(l[0]).trim();
    if (REGLAGES_AUTORISES.indexOf(cle) < 0 || l[1] === '') return;
    reglages[cle] = l[1] instanceof Date ? Utilities.formatDate(l[1], tz, 'yyyy-MM-dd') : l[1];
  });
  return reglages;
}

/* =====================================================================
   Pastilles (catégories d'événement)
   ===================================================================== */

function lirePastilles_(ss) {
  const feuille = onglet_(ss, 'Pastilles');
  const derniere = feuille.getLastRow();
  if (derniere < 2) return [];
  return feuille.getRange(2, 1, derniere - 1, 3).getValues()
    .filter(function (l) { return String(l[0]).trim() !== ''; })
    .map(function (l, i) {
      const visible = String(l[2]).toLowerCase();
      return {
        nom: String(l[0]).trim(),
        ordre: typeof l[1] === 'number' ? l[1] : i + 1,
        visible: !(l[2] === false || visible === 'non' || visible === 'false'),
      };
    });
}

function enregistrerPastilles_(ss, liste) {
  const feuille = onglet_(ss, 'Pastilles');
  const lignes = liste
    .filter(function (p) { return p && String(p.nom || '').trim(); })
    .map(function (p, i) {
      return ["'" + String(p.nom).trim(), Number(p.ordre) || i + 1, p.visible === false ? 'non' : 'oui'];
    });
  const derniere = feuille.getLastRow();
  if (derniere >= 2) feuille.getRange(2, 1, derniere - 1, 3).clearContent();
  if (lignes.length) feuille.getRange(2, 1, lignes.length, 3).setValues(lignes);
}

/* =====================================================================
   Photos (dossier Drive « Today's Mood – photos »)
   ===================================================================== */

/** Le dossier des photos (créé au besoin ; son identifiant est gardé dans les Propriétés du script). */
function dossierPhotos_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DOSSIER_PHOTOS');
  if (id) {
    try {
      const d = DriveApp.getFolderById(id);
      if (!d.isTrashed()) return d;
    } catch (err) { /* dossier supprimé : on en recrée un */ }
  }
  const trouves = DriveApp.getFoldersByName(NOM_DOSSIER_PHOTOS);
  const dossier = trouves.hasNext() ? trouves.next() : DriveApp.createFolder(NOM_DOSSIER_PHOTOS);
  props.setProperty('DOSSIER_PHOTOS', dossier.getId());
  return dossier;
}

/** Fichier du dossier des photos (refuse tout autre fichier du Drive). */
function fichierPhoto_(id) {
  let fichier;
  try {
    fichier = DriveApp.getFileById(String(id));
  } catch (err) {
    throw erreur_('Photo introuvable sur Drive.', 'photo');
  }
  const idDossier = dossierPhotos_().getId();
  const parents = fichier.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === idDossier) return fichier;
  }
  throw erreur_('Ce fichier n’est pas dans le dossier « ' + NOM_DOSSIER_PHOTOS + ' ».', 'photo');
}

function envoyerPhoto_(requete) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(requete.date))) throw erreur_('Date de photo invalide.', 'requete');
  const suffixe = CHAMPS_PHOTO[requete.champ];
  if (!suffixe) throw erreur_('Type de photo inconnu.', 'requete');
  if (typeof requete.donnees !== 'string' || !requete.donnees) throw erreur_('Photo vide.', 'requete');

  const octets = Utilities.base64Decode(requete.donnees);
  const blob = Utilities.newBlob(octets, 'image/jpeg', requete.date + '_' + suffixe + '.jpg');
  const fichier = dossierPhotos_().createFile(blob);
  if (requete.remplace) mettreALaCorbeille_(requete.remplace);
  return { ok: true, id: fichier.getId(), lien: fichier.getUrl() };
}

function lirePhoto_(requete) {
  const fichier = fichierPhoto_(requete.id);
  const blob = fichier.getBlob();
  return { ok: true, donnees: Utilities.base64Encode(blob.getBytes()), type: blob.getContentType() };
}

function supprimerPhoto_(requete) {
  mettreALaCorbeille_(requete.id);
  return { ok: true };
}

/** Met une photo à la corbeille de Drive (récupérable 30 jours). Ignore une photo déjà disparue. */
function mettreALaCorbeille_(id) {
  try {
    fichierPhoto_(id).setTrashed(true);
  } catch (err) {
    if (err.code !== 'photo') throw err;
  }
}

/* =====================================================================
   Outils
   ===================================================================== */

function classeur_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw erreur_('Ce script doit être créé depuis le Google Sheet (Extensions → Apps Script).', 'installation');
  return ss;
}

function onglet_(ss, nom) {
  return ss.getSheetByName(nom) || preparerOnglet_(ss, nom, ONGLETS[nom]);
}

/** Crée l'onglet s'il manque et ajoute les en-têtes manquants à droite, sans rien effacer. */
function preparerOnglet_(ss, nom, colonnes) {
  const feuille = ss.getSheetByName(nom) || ss.insertSheet(nom);
  const nbCol = feuille.getLastColumn();
  const existants = nbCol ? feuille.getRange(1, 1, 1, nbCol).getValues()[0].map(String) : [];
  const manquants = colonnes.filter(function (c) { return existants.indexOf(c) < 0; });
  if (manquants.length) feuille.getRange(1, existants.length + 1, 1, manquants.length).setValues([manquants]);
  feuille.setFrozenRows(1);
  feuille.getRange(1, 1, 1, feuille.getLastColumn()).setFontWeight('bold');
  return feuille;
}

/** En-têtes de l'onglet (complétés si une colonne attendue manque). */
function entetes_(feuille) {
  const attendues = ONGLETS[feuille.getName()];
  let entetes = feuille.getRange(1, 1, 1, Math.max(1, feuille.getLastColumn())).getValues()[0].map(String);
  if (attendues.some(function (c) { return entetes.indexOf(c) < 0; })) {
    preparerOnglet_(feuille.getParent(), feuille.getName(), attendues);
    entetes = feuille.getRange(1, 1, 1, feuille.getLastColumn()).getValues()[0].map(String);
  }
  return entetes;
}

function texteDate_(valeur, tz) {
  if (valeur instanceof Date) return Utilities.formatDate(valeur, tz, 'yyyy-MM-dd');
  const s = String(valeur || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function texteHorodatage_(valeur) {
  if (valeur instanceof Date) return valeur.toISOString();
  return String(valeur || '').trim();
}

function genererJeton_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/* =====================================================================
   Netatmo (version 5, partie A) : station météo de la maison
   Les clés sont dans les Propriétés du script (jamais dans le code) :
   NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET, NETATMO_REFRESH_TOKEN.
   Le jeton d'accès (≈ 3 h) est renouvelé tout seul ; le nouveau refresh token renvoyé
   par Netatmo remplace l'ancien à chaque fois.
   ===================================================================== */

const NETATMO_API = 'https://api.netatmo.com';
const FUSEAU = 'Europe/Zurich';
const ECART_MAX_S = 40 * 60; // valeur la plus proche de l'heure voulue, à 40 min près au plus

/** À lancer depuis l'éditeur pour vérifier la connexion : le journal liste les modules trouvés. */
function testerNetatmo() {
  const m = modulesNetatmo_();
  Logger.log('Station : ' + m.nom);
  Object.keys(m.modules).forEach(function (cle) {
    Logger.log('- ' + cle + ' : ' + m.modules[cle].nom + ' (installé le ' + m.modules[cle].installe + ')');
  });
  const r = releverNetatmo_({ dates: [Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd')] });
  Logger.log('Relevés d’aujourd’hui : ' + JSON.stringify(r.releves));
}

function jetonNetatmo_(forcer) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('NETATMO_CLIENT_ID');
  const secret = props.getProperty('NETATMO_CLIENT_SECRET');
  const refresh = props.getProperty('NETATMO_REFRESH_TOKEN');
  if (!id || !secret || !refresh) {
    throw erreur_('Netatmo n’est pas encore configuré : ajoute NETATMO_CLIENT_ID, NETATMO_CLIENT_SECRET et NETATMO_REFRESH_TOKEN dans les Propriétés du script.', 'netatmo_config');
  }
  const acces = props.getProperty('NETATMO_ACCESS_TOKEN');
  const expire = Number(props.getProperty('NETATMO_EXPIRE') || 0);
  if (!forcer && acces && Date.now() < expire - 5 * 60 * 1000) return acces;
  const rep = UrlFetchApp.fetch(NETATMO_API + '/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'refresh_token', refresh_token: refresh, client_id: id, client_secret: secret },
  });
  let json = {};
  try { json = JSON.parse(rep.getContentText() || '{}'); } catch (e) { /* réponse illisible */ }
  if (rep.getResponseCode() !== 200 || !json.access_token) {
    throw erreur_('Netatmo refuse la connexion (' + (json.error || rep.getResponseCode()) + '). Génère un nouveau refresh token sur dev.netatmo.com et recopie-le dans les Propriétés du script.', 'netatmo');
  }
  props.setProperties({
    NETATMO_ACCESS_TOKEN: json.access_token,
    NETATMO_EXPIRE: String(Date.now() + (Number(json.expires_in) || 10800) * 1000),
    NETATMO_REFRESH_TOKEN: json.refresh_token || refresh, // Netatmo renvoie un nouveau refresh token : on le garde
  });
  return json.access_token;
}

function appelNetatmo_(chemin, params, dejaRenouvele) {
  const q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  const rep = UrlFetchApp.fetch(NETATMO_API + '/api/' + chemin + '?' + q, {
    headers: { Authorization: 'Bearer ' + jetonNetatmo_(dejaRenouvele) }, muteHttpExceptions: true,
  });
  let json = {};
  try { json = JSON.parse(rep.getContentText() || '{}'); } catch (e) { /* réponse illisible */ }
  if ((rep.getResponseCode() === 403 || rep.getResponseCode() === 401) && !dejaRenouvele) return appelNetatmo_(chemin, params, true);
  if (rep.getResponseCode() !== 200 || json.error) {
    const msg = json.error && json.error.message ? json.error.message : 'erreur ' + rep.getResponseCode();
    throw erreur_('Netatmo ne répond pas (' + msg + ').', 'netatmo');
  }
  return json.body;
}

/** Station et modules (détectés à chaque fois : un nouveau module est pris en compte tout seul). */
function modulesNetatmo_() {
  const body = appelNetatmo_('getstationsdata', { get_favorites: 'false' });
  const st = body && body.devices && body.devices[0];
  if (!st) throw erreur_('Aucune station Netatmo trouvée sur ce compte.', 'netatmo');
  const jour = function (sec) { return sec ? Utilities.formatDate(new Date(sec * 1000), FUSEAU, 'yyyy-MM-dd') : '2000-01-01'; };
  const modules = {
    interieur: { device: st._id, module: null, nom: st.module_name || 'Intérieur', installe: jour(st.date_setup) },
  };
  const TYPES = { NAModule1: 'exterieur', NAModule2: 'vent', NAModule3: 'pluie' };
  (st.modules || []).forEach(function (m) {
    const cle = TYPES[m.type];
    if (cle && !modules[cle]) modules[cle] = { device: st._id, module: m._id, nom: m.module_name || cle, installe: jour(m.date_setup) };
  });
  return { nom: st.station_name || st.home_name || 'Station', modules: modules };
}

/** Mesures d'un module entre deux instants (secondes) : { horodatage: [valeurs] }. Par tranches de 20 jours. */
function mesures_(mod, types, echelle, debut, fin) {
  const tranche = echelle === '1day' ? 900 * 86400 : 20 * 86400;
  const resultat = {};
  for (let t = debut; t <= fin; t += tranche) {
    const params = {
      device_id: mod.device, scale: echelle, type: types.join(','), optimize: 'false', real_time: 'true',
      date_begin: String(t), date_end: String(Math.min(fin, t + tranche - 1)),
    };
    if (mod.module) params.module_id = mod.module;
    const body = appelNetatmo_('getmeasure', params) || {};
    Object.keys(body).forEach(function (ts) { resultat[ts] = body[ts]; });
  }
  return resultat;
}

/** Valeurs mesurées le plus près de `cible` (secondes), à 40 min près, ou null. */
function plusProche_(serie, cles, cible) {
  let meilleur = null;
  let ecart = ECART_MAX_S + 1;
  cles.forEach(function (ts) {
    const e = Math.abs(Number(ts) - cible);
    if (e < ecart) { ecart = e; meilleur = ts; }
  });
  return meilleur === null ? null : serie[meilleur];
}

const instant_ = function (date, heure) {
  return Math.floor(Utilities.parseDate(date + ' ' + (heure < 10 ? '0' : '') + heure + ':00', FUSEAU, 'yyyy-MM-dd HH:mm').getTime() / 1000);
};
const arrondi_ = function (v, d) {
  if (v === null || v === undefined || !isFinite(Number(v))) return null;
  const k = Math.pow(10, d || 0);
  return Math.round(Number(v) * k) / k;
};

/**
 * Relevés Netatmo pour une liste de dates (au plus 31 à la fois) :
 *   intérieur à 7 h et 20 h (maison7_*, maison20_*), vent à 8 h et 16 h (nt8_vent…, nt16_vent…),
 *   extérieur à 8 h et 16 h (nt8_temp_ext, nt16_temp_ext), pluie du jour (nt_pluie_jour).
 * Ne renvoie que ce que les modules installés mesurent, et seulement pour des heures déjà passées.
 */
function releverNetatmo_(requete) {
  const station = modulesNetatmo_();
  const m = station.modules;
  const maintenant = Math.floor(Date.now() / 1000);
  const dates = (Array.isArray(requete.dates) ? requete.dates : [])
    .filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d)); })
    .sort().slice(-31);
  const releves = {};
  const ajouter = function (date, champ, valeur) {
    if (valeur === null || valeur === undefined) return;
    (releves[date] = releves[date] || {})[champ] = valeur;
  };

  function parModule(cle, heures, types, ecrire) {
    const mod = m[cle];
    if (!mod) return;
    const utiles = dates.filter(function (d) { return d >= mod.installe; });
    if (!utiles.length) return;
    const debut = instant_(utiles[0], Math.min.apply(null, heures)) - 3600;
    const fin = Math.min(maintenant, instant_(utiles[utiles.length - 1], Math.max.apply(null, heures)) + 3600);
    if (fin <= debut) return;
    const serie = mesures_(mod, types, '30min', debut, fin);
    const cles = Object.keys(serie);
    utiles.forEach(function (d) {
      heures.forEach(function (h) {
        const cible = instant_(d, h);
        if (cible > maintenant) return;
        const v = plusProche_(serie, cles, cible);
        if (v) ecrire(d, h, v);
      });
    });
  }

  parModule('interieur', [7, 20], ['Temperature', 'Humidity', 'CO2'], function (d, h, v) {
    ajouter(d, 'maison' + h + '_temp', arrondi_(v[0], 1));
    ajouter(d, 'maison' + h + '_hum', arrondi_(v[1], 0));
    ajouter(d, 'maison' + h + '_co2', arrondi_(v[2], 0));
  });
  parModule('vent', [8, 16], ['WindStrength', 'WindAngle'], function (d, h, v) {
    ajouter(d, 'nt' + h + '_vent', arrondi_(v[0], 0));
    ajouter(d, 'nt' + h + '_vent_dir', arrondi_(v[1], 0));
  });
  parModule('exterieur', [8, 16], ['Temperature'], function (d, h, v) {
    ajouter(d, 'nt' + h + '_temp_ext', arrondi_(v[0], 1));
  });
  if (m.pluie) {
    const utiles = dates.filter(function (d) { return d >= m.pluie.installe; });
    if (utiles.length) {
      const serie = mesures_(m.pluie, ['sum_rain'], '1day', instant_(utiles[0], 0) - 43200, Math.min(maintenant, instant_(utiles[utiles.length - 1], 23)));
      Object.keys(serie).forEach(function (ts) {
        const d = Utilities.formatDate(new Date((Number(ts) + 7200) * 1000), FUSEAU, 'yyyy-MM-dd');
        if (utiles.indexOf(d) >= 0) ajouter(d, 'nt_pluie_jour', arrondi_(serie[ts][0], 1));
      });
    }
  }

  const modules = {};
  Object.keys(m).forEach(function (cle) { modules[cle] = { nom: m[cle].nom, installe: m[cle].installe }; });
  return { ok: true, station: station.nom, modules: modules, releves: releves };
}

function erreur_(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}
