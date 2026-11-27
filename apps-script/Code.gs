/**
 * Today's Mood — Web App Apps Script (version 3, partie B).
 *
 * À coller dans l'éditeur Apps Script du classeur « Today's Mood – données »
 * (Extensions → Apps Script). Voir apps-script/INSTALLATION.md.
 *
 * Le jeton secret n'est PAS dans ce fichier : il est créé par la fonction « initialiser »
 * et rangé dans les Propriétés du script.
 */

const VERSION = 'v3b-1';

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
];

/** Colonnes de texte (les autres sont numériques). */
const COLONNES_TEXTE = [
  'date', 'modifie_le', 'pensee_id', 'photo_ciel', 'photo_jour',
  'evt_appreciation', 'evt_categorie', 'evt_texte', 'recit', 'mylove',
  'cuisine', 'repas_type', 'deplacement',
  'coucher_soleil', 'photo_ciel_soir', 'mot_du_jour',
];

/** Colonnes oui / vide (marques Favori et Piment). */
const COLONNES_OUI = ['recit_favori', 'recit_piment', 'mylove_favori', 'mylove_piment'];

const ONGLETS = {
  Fiches: COLONNES_FICHES,
  Marches: ['id', 'date', 'km'],
  Pensees: ['id', 'favori', 'derniere_apparition'],
  Pastilles: ['nom', 'ordre', 'visible'],
  Reglages: ['cle', 'valeur'],
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
      return { ok: true, enregistrees: resultat.enregistrees, ignorees: resultat.ignorees };
    }
    case 'lire':
      return { ok: true, fiches: lireFiches_(ss), pastilles: lirePastilles_(ss), marches: lireMarches_(ss), pensees: lirePensees_(ss), reglages: lireReglages_(ss), sauvegarde: derniereSauvegarde_() };
    case 'envoyerPhoto':
      return envoyerPhoto_(requete);
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

function erreur_(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}
