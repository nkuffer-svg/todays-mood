/**
 * Today's Mood — Web App Apps Script (étape 2).
 *
 * À coller dans l'éditeur Apps Script du classeur « Today's Mood – données »
 * (Extensions → Apps Script). Voir apps-script/INSTALLATION.md.
 *
 * Le jeton secret n'est PAS dans ce fichier : il est créé par la fonction « initialiser »
 * et rangé dans les Propriétés du script.
 */

const VERSION = 'etape2-v1';

const COLONNES_FICHES = [
  'date', 'modifie_le', 'pensee_id',
  'meteo_tmin', 'meteo_tmax', 'meteo_pluie_mm', 'meteo_soleil_h', 'meteo_nuages_pct', 'meteo_code', 'meteo_ressenti',
  'photo_ciel', 'photo_jour',
  'humeur_matin', 'humeur_soir', 'energie', 'inspiration', 'energie_sexuelle', 'bilan',
  'evt_appreciation', 'evt_categorie', 'evt_texte',
  'accord_parole', 'accord_personnel', 'accord_supposition', 'accord_mieux',
  'pas', 'natation_m', 'eau_ml', 'cafe', 'deca', 'biere', 'vin', 'biscotte_1', 'biscotte_2',
  'recit', 'recit_favori', 'recit_piment', 'mylove', 'mylove_favori', 'mylove_piment',
];

/** Colonnes de texte (les autres sont numériques). */
const COLONNES_TEXTE = [
  'date', 'modifie_le', 'pensee_id', 'photo_ciel', 'photo_jour',
  'evt_appreciation', 'evt_categorie', 'evt_texte', 'recit', 'mylove',
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

const PASTILLES_DEFAUT = ['Job', 'Maison', 'Famille élargie', 'Famille', 'Réflexion', 'Pensée', 'Scène de vie'];

/* =====================================================================
   Fonctions à lancer à la main depuis l'éditeur (menu déroulant + Exécuter)
   ===================================================================== */

/** Crée les 5 onglets avec leurs en-têtes et le jeton secret. Sans danger si on la relance. */
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
      return { ok: true, version: VERSION, classeur: ss.getName(), nbFiches: Math.max(0, fiches.getLastRow() - 1) };
    }
    case 'enregistrer': {
      const resultat = enregistrerFiches_(ss, Array.isArray(requete.fiches) ? requete.fiches : []);
      if (Array.isArray(requete.pastilles)) enregistrerPastilles_(ss, requete.pastilles);
      return { ok: true, enregistrees: resultat.enregistrees, ignorees: resultat.ignorees };
    }
    case 'lire':
      return { ok: true, fiches: lireFiches_(ss), pastilles: lirePastilles_(ss) };
    default:
      throw erreur_('Action inconnue : ' + requete.action, 'requete');
  }
}

/* =====================================================================
   Fiches
   ===================================================================== */

function enregistrerFiches_(ss, fiches) {
  const feuille = onglet_(ss, 'Fiches');
  const entetes = entetes_(feuille);
  const iDate = entetes.indexOf('date');
  const iModif = entetes.indexOf('modifie_le');
  const tz = ss.getSpreadsheetTimeZone();

  const derniere = feuille.getLastRow();
  const existantes = {}; // date → { ligne, modif, valeurs }
  if (derniere >= 2) {
    const valeurs = feuille.getRange(2, 1, derniere - 1, entetes.length).getValues();
    valeurs.forEach(function (ligne, k) {
      const d = texteDate_(ligne[iDate], tz);
      if (d && !existantes[d]) existantes[d] = { ligne: k + 2, modif: texteHorodatage_(ligne[iModif]), valeurs: ligne };
    });
  }

  const nouvelles = [];
  const indexNouvelles = {};
  const enregistrees = [];
  const ignorees = [];

  fiches.forEach(function (fiche) {
    if (!fiche || !/^\d{4}-\d{2}-\d{2}$/.test(String(fiche.date))) return;
    const existante = existantes[fiche.date];
    // La version la plus récente gagne.
    if (existante && existante.modif && fiche.modifie_le && existante.modif > String(fiche.modifie_le)) {
      ignorees.push(fiche.date);
      return;
    }
    const ligne = entetes.map(function (h, i) {
      // Colonne ajoutée à la main dans le Sheet : on n'y touche pas.
      if (COLONNES_FICHES.indexOf(h) < 0) return existante ? existante.valeurs[i] : '';
      return versCellule_(h, fiche[h]);
    });
    if (existante) {
      feuille.getRange(existante.ligne, 1, 1, entetes.length).setValues([ligne]);
    } else if (indexNouvelles[fiche.date] !== undefined) {
      nouvelles[indexNouvelles[fiche.date]] = ligne;
    } else {
      indexNouvelles[fiche.date] = nouvelles.length;
      nouvelles.push(ligne);
    }
    enregistrees.push(fiche.date);
  });

  if (nouvelles.length) {
    feuille.getRange(Math.max(derniere, 1) + 1, 1, nouvelles.length, entetes.length).setValues(nouvelles);
    // Garde les fiches dans l'ordre chronologique.
    feuille.getRange(2, 1, feuille.getLastRow() - 1, feuille.getLastColumn()).sort(iDate + 1);
  }
  return { enregistrees: enregistrees, ignorees: ignorees };
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
