/* Écran Réglages (minimal à l'étape 2) : Web App, jeton, heure de bascule. */
import { el, carte, segments, icone } from './ui.js';
import { LIEU_DEFAUT } from './meteo.js';
import { empreinteEnregistree, enregistrerEmpreinte, disponibilite } from './verrou.js';
import { ouvrirEcran } from './ecran.js';
import { reglage, definirReglage } from './reglages.js';
import { appeler, surEtat, planifier } from './sync.js';

const fmt = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeStyle: 'short' });

/** Carte de gestion des catégories d'événement : renommer, masquer, réordonner, ajouter. */
function carteCategories(categories) {
  const liste = el('ul', { class: 'liste-categories' });
  const message = el('p', { class: 'avertissement', role: 'status', hidden: true });
  const signaler = (texte) => { message.hidden = !texte; message.textContent = texte || ''; };

  function dessiner() {
    const items = categories.liste();
    liste.replaceChildren(...items.map((p, i) => {
      const champ = el('input', { class: 'champ', type: 'text', maxlength: '30', value: p.nom, 'aria-label': `Nom de la catégorie ${p.nom}` });
      champ.addEventListener('change', async () => {
        const r = await categories.renommer(p.nom, champ.value.trim());
        if (!r.ok) { signaler(r.message); champ.value = p.nom; return; }
        signaler(r.message || '');
        dessiner();
      });
      return el('li', { class: 'categorie' + (p.visible === false ? ' masquee' : '') },
        champ,
        el('div', { class: 'categorie-actions' },
          el('button', { type: 'button', class: 'bouton-rond petit', 'aria-label': `Monter ${p.nom}`, disabled: i === 0, onClick: async () => { await categories.deplacer(p.nom, -1); dessiner(); } }, icone('haut')),
          el('button', { type: 'button', class: 'bouton-rond petit', 'aria-label': `Descendre ${p.nom}`, disabled: i === items.length - 1, onClick: async () => { await categories.deplacer(p.nom, 1); dessiner(); } }, icone('bas')),
          el('button', {
            type: 'button', class: 'bouton petit discret bouton-visibilite', 'aria-pressed': String(p.visible !== false),
            onClick: async () => { await categories.basculerVisible(p.nom); dessiner(); },
          }, icone('oeil', 'petite'), p.visible === false ? ' Masquée' : ' Visible')));
    }));
  }

  const champNouveau = el('input', { class: 'champ', type: 'text', maxlength: '30', placeholder: 'Nouvelle catégorie', 'aria-label': 'Nouvelle catégorie' });
  const formulaire = el('form', { class: 'ligne-champ ajout-categorie' }, champNouveau, el('button', { type: 'submit', class: 'bouton' }, 'Ajouter'));
  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nom = champNouveau.value.trim();
    if (!nom) return;
    const r = await categories.ajouter(nom);
    if (!r.ok) { signaler(r.message); return; }
    signaler('');
    champNouveau.value = '';
    dessiner();
  });
  dessiner();
  return carte('Catégories d’événement',
    el('p', { class: 'discret' }, 'Renommer une catégorie met aussi à jour les fiches qui l’utilisent. Une catégorie masquée n’est plus proposée, mais reste dans l’historique.'),
    liste, message, formulaire);
}

export function ouvrirReglages({ synchroComplete, reglagesModifies, categories }) {
  let desabonner = null;
  let enregistrerMaintenant = null;
  const { corps } = ouvrirEcran({
    titre: 'Réglages',
    surFermeture: () => { desabonner?.(); enregistrerMaintenant?.(); },
  });

  /* --- Synchronisation --- */
  const champUrl = el('input', {
    id: 'reglage-url', class: 'champ', type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'https://script.google.com/macros/s/…/exec', value: reglage('url') || '',
  });
  const alerteUrl = el('p', { class: 'avertissement', hidden: true });
  const champJeton = el('input', {
    id: 'reglage-jeton', class: 'champ', type: 'password', autocomplete: 'off', spellcheck: 'false',
    value: reglage('jeton') || '',
  });
  const voir = el('button', { type: 'button', class: 'bouton petit discret' }, 'Afficher');
  voir.addEventListener('click', () => {
    const cache = champJeton.type === 'password';
    champJeton.type = cache ? 'text' : 'password';
    voir.textContent = cache ? 'Masquer' : 'Afficher';
  });

  function verifierUrl() {
    const v = champUrl.value.trim();
    const ok = v === '' || /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(v);
    alerteUrl.hidden = ok;
    alerteUrl.textContent = ok ? '' : 'L’adresse devrait ressembler à https://script.google.com/macros/s/…/exec';
  }
  let minuteur;
  let modifie = false;
  enregistrerMaintenant = async () => {
    clearTimeout(minuteur);
    if (!modifie) return;
    modifie = false;
    await definirReglage('url', champUrl.value.trim());
    await definirReglage('jeton', champJeton.value.trim());
    planifier(500);
  };
  function enregistrerChamps() {
    modifie = true;
    clearTimeout(minuteur);
    minuteur = setTimeout(enregistrerMaintenant, 400);
  }
  champUrl.addEventListener('input', () => { verifierUrl(); enregistrerChamps(); });
  champJeton.addEventListener('input', enregistrerChamps);
  verifierUrl();

  const resultatTest = el('p', { class: 'resultat-test', role: 'status' });
  const boutonTest = el('button', { type: 'button', class: 'bouton' }, 'Tester la connexion');
  boutonTest.addEventListener('click', async () => {
    boutonTest.disabled = true;
    resultatTest.className = 'resultat-test';
    resultatTest.textContent = 'Test en cours…';
    try {
      const rep = await appeler('ping', {}, { url: champUrl.value, jeton: champJeton.value });
      resultatTest.classList.add('succes');
      resultatTest.textContent = `Connexion réussie. Classeur : « ${rep.classeur} », ${rep.nbFiches} fiche(s) enregistrée(s).`;
    } catch (err) {
      resultatTest.classList.add('erreur');
      resultatTest.textContent = err.message;
    } finally {
      boutonTest.disabled = false;
    }
  });

  const boutonSync = el('button', { type: 'button', class: 'bouton discret' }, 'Synchroniser maintenant');
  boutonSync.addEventListener('click', async () => {
    boutonSync.disabled = true;
    modifie = true;
    await enregistrerMaintenant();
    await synchroComplete();
    boutonSync.disabled = false;
  });

  const etatTexte = el('p', { class: 'etat-synchro', role: 'status' });
  const majEtat = (s) => {
    const d = reglage('derniereSynchro');
    etatTexte.replaceChildren(
      el('span', {}, 'État : ', el('strong', {}, s.message || '…')), el('br'),
      el('span', {}, 'Modifications en attente d’envoi : ', el('strong', {}, String(s.attente ?? 0))), el('br'),
      el('span', {}, 'Dernière synchronisation réussie : ', el('strong', {}, d ? fmt.format(new Date(d)) : 'jamais')));
  };
  desabonner = surEtat(majEtat);

  /* --- Journée --- */
  const choixBascule = el('select', { id: 'reglage-bascule', class: 'champ' });
  for (let h = 0; h <= 8; h++) {
    choixBascule.append(el('option', { value: String(h) }, h === 0 ? 'Minuit (0 h)' : `${h} h`));
  }
  choixBascule.value = String(reglage('bascule'));
  choixBascule.addEventListener('change', async () => {
    await definirReglage('bascule', Number(choixBascule.value));
    reglagesModifies();
  });

  const choixEau = el('select', { id: 'reglage-eau', class: 'champ' });
  for (let ml = 1000; ml <= 4000; ml += 250) {
    choixEau.append(el('option', { value: String(ml) }, new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(ml / 1000) + ' L'));
  }
  choixEau.value = String(Number(reglage('objectifEau')) || 2000);
  choixEau.addEventListener('change', async () => {
    await definirReglage('objectifEau', Number(choixEau.value));
    reglagesModifies();
  });

  const choixDuree = el('select', { id: 'reglage-duree-pensee', class: 'champ' });
  for (const sec of [10, 15, 20, 30, 45, 60, 90, 120]) choixDuree.append(el('option', { value: String(sec) }, `${sec} s`));
  choixDuree.value = String(Number(reglage('dureePensee')) || 30);
  choixDuree.addEventListener('change', () => definirReglage('dureePensee', Number(choixDuree.value)));

  /* --- Météo --- */
  const modeGps = reglage('meteoMode') !== 'fixe';
  const champNom = el('input', { id: 'reglage-lieu-nom', class: 'champ', type: 'text', maxlength: '40', value: reglage('lieuNom') || LIEU_DEFAUT.nom });
  const champLat = el('input', { id: 'reglage-lieu-lat', class: 'champ', type: 'text', inputmode: 'decimal', value: String(reglage('lieuLat') ?? LIEU_DEFAUT.lat) });
  const champLon = el('input', { id: 'reglage-lieu-lon', class: 'champ', type: 'text', inputmode: 'decimal', value: String(reglage('lieuLon') ?? LIEU_DEFAUT.lon) });
  const alerteLieu = el('p', { class: 'avertissement', hidden: true });
  const explicationMode = el('p', { class: 'discret' });
  const expliquer = (gps) => {
    explicationMode.textContent = gps
      ? 'La météo utilise la position du téléphone. Si elle n’est pas disponible, le lieu ci-dessous sert de secours.'
      : 'La météo utilise toujours le lieu ci-dessous.';
  };
  expliquer(modeGps);
  const choixMode = segments({
    etiquette: 'Position pour la météo',
    options: [{ valeur: 'gps', libelle: 'GPS' }, { valeur: 'fixe', libelle: 'Lieu fixe' }],
    valeur: modeGps ? 'gps' : 'fixe',
    obligatoire: true,
    onChange: async (mode) => {
      await definirReglage('meteoMode', mode);
      expliquer(mode === 'gps');
    },
  });
  const lireNombre = (t) => Number(String(t).trim().replace(',', '.'));
  async function enregistrerLieu() {
    const lat = lireNombre(champLat.value);
    const lon = lireNombre(champLon.value);
    const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      && champLat.value.trim() !== '' && champLon.value.trim() !== '';
    alerteLieu.hidden = ok;
    alerteLieu.textContent = ok ? '' : 'Latitude entre −90 et 90, longitude entre −180 et 180 (ex. 46,49 et 6,73).';
    if (!ok) return;
    await definirReglage('lieuNom', champNom.value.trim() || 'Lieu fixe');
    await definirReglage('lieuLat', lat);
    await definirReglage('lieuLon', lon);
  }
  for (const c of [champNom, champLat, champLon]) c.addEventListener('change', enregistrerLieu);
  const boutonLavaux = el('button', {
    type: 'button', class: 'bouton petit discret', onClick: async () => {
      champNom.value = LIEU_DEFAUT.nom;
      champLat.value = String(LIEU_DEFAUT.lat);
      champLon.value = String(LIEU_DEFAUT.lon);
      await enregistrerLieu();
    },
  }, 'Revenir à Lavaux');

  /* --- Empreinte --- */
  const etatEmpreinte = el('p', { class: 'discret' });
  const resultatEmpreinte = el('p', { class: 'resultat-test', role: 'status' });
  const boutonEmpreinte = el('button', { type: 'button', class: 'bouton discret' });
  const majEmpreinte = async () => {
    const dispo = await disponibilite();
    if (dispo !== 'ok') {
      etatEmpreinte.textContent = 'Aucun capteur d’empreinte disponible sur cet appareil.';
      boutonEmpreinte.hidden = true;
      return;
    }
    etatEmpreinte.textContent = empreinteEnregistree()
      ? 'Une empreinte est enregistrée pour l’onglet Perso.'
      : 'Aucune empreinte enregistrée : elle sera demandée à la première ouverture de Perso.';
    boutonEmpreinte.textContent = empreinteEnregistree() ? 'Réenregistrer l’empreinte' : 'Enregistrer l’empreinte';
  };
  boutonEmpreinte.addEventListener('click', async () => {
    resultatEmpreinte.className = 'resultat-test';
    resultatEmpreinte.textContent = 'Pose ton doigt sur le capteur…';
    const r = await enregistrerEmpreinte();
    resultatEmpreinte.classList.add(r.ok ? 'succes' : 'erreur');
    resultatEmpreinte.textContent = r.ok ? 'Empreinte enregistrée.' : r.message;
    majEmpreinte();
  });
  majEmpreinte();

  corps.append(
    carte('Google Sheet',
      el('p', { class: 'discret' }, 'Ces deux informations restent sur ce téléphone.'),
      el('label', { class: 'sous-titre-champ', for: 'reglage-url' }, 'Adresse de la Web App'),
      champUrl, alerteUrl,
      el('label', { class: 'sous-titre-champ', for: 'reglage-jeton' }, 'Jeton secret'),
      el('div', { class: 'ligne-champ' }, champJeton, voir),
      el('div', { class: 'rangee-boutons' }, boutonTest, boutonSync),
      resultatTest,
      etatTexte),
    carte('Journée',
      el('label', { class: 'sous-titre-champ', for: 'reglage-bascule' }, 'Heure de bascule du jour'),
      choixBascule,
      el('p', { class: 'discret' }, 'Avant cette heure, une saisie compte encore pour la veille.'),
      el('label', { class: 'sous-titre-champ', for: 'reglage-eau' }, 'Objectif d’eau par jour'),
      choixEau),
    carteCategories(categories),
    carte('Pensée du jour',
      el('label', { class: 'sous-titre-champ', for: 'reglage-duree-pensee' }, 'Durée d’affichage à l’ouverture'),
      choixDuree,
      el('p', { class: 'discret' }, 'Tu peux toujours la refermer avant.')),
    carte('Empreinte (onglet Perso)',
      etatEmpreinte,
      el('div', { class: 'rangee-boutons' }, boutonEmpreinte),
      resultatEmpreinte),
    carte('Météo',
      el('p', { class: 'sous-titre-champ' }, 'Position'),
      choixMode,
      explicationMode,
      el('label', { class: 'sous-titre-champ', for: 'reglage-lieu-nom' }, 'Nom du lieu fixe'),
      champNom,
      el('div', { class: 'deux-colonnes' },
        el('div', {}, el('label', { class: 'sous-titre-champ', for: 'reglage-lieu-lat' }, 'Latitude'), champLat),
        el('div', {}, el('label', { class: 'sous-titre-champ', for: 'reglage-lieu-lon' }, 'Longitude'), champLon)),
      alerteLieu,
      el('div', { class: 'rangee-boutons' }, boutonLavaux)),
  );
}
