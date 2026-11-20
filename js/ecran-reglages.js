/* Écran Réglages (minimal à l'étape 2) : Web App, jeton, heure de bascule. */
import { el, carte } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { reglage, definirReglage } from './reglages.js';
import { appeler, surEtat, planifier } from './sync.js';

const fmt = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeStyle: 'short' });

export function ouvrirReglages({ synchroComplete, reglagesModifies }) {
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
      el('p', { class: 'discret' }, 'Avant cette heure, une saisie compte encore pour la veille.')),
  );
}
