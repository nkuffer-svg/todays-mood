/* Contenu des 4 onglets de la fiche du jour. Chaque fonction renvoie une liste de cartes.
   ctx = { fiche, modifier(champ, valeur), modifierTexte(champ, valeur), pastilles, ajouterPastille(nom) } */
import { el, svg, icone, carte, choixPastilles, segments, bascule, texteExtensible } from './ui.js';
import { creerJauge } from './jauge.js';
import { LIBELLES, APPRECIATIONS, BILAN, ACCORDS, NIVEAUX_ACCORD } from './donnees.js';

function aVenir(titre, texte, etape) {
  return el('section', { class: 'carte a-venir' },
    el('h2', {}, titre),
    el('p', {}, texte),
    el('p', { class: 'etiquette-etape' }, `Arrive à l’étape ${etape}`));
}

function carteJauge(ctx, titre, nomCadran, champ, libelles, ...avant) {
  return carte(titre, ...avant, creerJauge({
    titre, nomCadran, libelles, valeur: ctx.fiche[champ],
    onChange: (v) => ctx.modifier(champ, v),
  }));
}

/* ---------- Matin ---------- */

function matin(ctx) {
  return [
    aVenir('Météo', 'Météo du jour automatique, météo ressentie et photo du ciel.', 3),
    carteJauge(ctx, 'Humeur du matin', 'Humeur', 'humeur_matin', LIBELLES.humeur),
    carteJauge(ctx, 'Énergie', 'Énergie', 'energie', LIBELLES.energie),
    carteJauge(ctx, 'Inspiration', 'Inspiration', 'inspiration', LIBELLES.inspiration),
  ];
}

/* ---------- Journée ---------- */

function journee() {
  return [
    aVenir('Quoi dans le goulot ?', 'Eau avec jauge de carburant, café, déca, bière, verre de vin.', 4),
    aVenir('Comment t’as bougé ton Q ?', 'Nombre de pas, marches et natation.', 4),
    aVenir('Photo du jour', 'Une photo prise avec l’appareil photo.', 3),
  ];
}

/* ---------- Soir ---------- */

function visage(niveau) {
  // niveau 1 à 5 : courbure de la bouche de -7 (triste) à +7 (très content)
  const k = (niveau - 3) * 3.5;
  const s = svg('svg', { viewBox: '0 0 48 48', class: 'visage', 'aria-hidden': 'true' });
  s.append(
    svg('circle', { cx: 24, cy: 24, r: 19 }),
    svg('circle', { cx: 17.5, cy: 20, r: 1.6, class: 'oeil' }),
    svg('circle', { cx: 30.5, cy: 20, r: 1.6, class: 'oeil' }),
    svg('path', { d: `M 16 ${31 - k / 2} Q 24 ${31 + k * 1.2} 32 ${31 - k / 2}` }),
  );
  if (niveau === 5) s.append(svg('path', { d: 'M 13.5 17 Q 17.5 14.5 21.5 17', class: 'sourcil' }), svg('path', { d: 'M 26.5 17 Q 30.5 14.5 34.5 17', class: 'sourcil' }));
  if (niveau === 1) s.append(svg('path', { d: 'M 13.5 15.5 L 21 17.5', class: 'sourcil' }), svg('path', { d: 'M 34.5 15.5 L 27 17.5', class: 'sourcil' }));
  return s;
}

function carteBilan(ctx) {
  let actuel = ctx.fiche.bilan ?? null;
  const tuiles = BILAN.map((nom, i) => el('button', {
    type: 'button', class: 'tuile-visage', 'aria-pressed': String(actuel === i + 1), 'aria-label': nom,
    onClick: () => {
      actuel = actuel === i + 1 ? null : i + 1;
      tuiles.forEach((t, j) => t.setAttribute('aria-pressed', String(actuel === j + 1)));
      ctx.modifier('bilan', actuel);
    },
  }, visage(i + 1), el('span', {}, nom)));
  return carte('Bilan du jour', el('div', { class: 'visages' }, ...tuiles));
}

function carteAccords(ctx) {
  let ouvert = null;
  const lignes = ACCORDS.map((a) => {
    const resume = el('p', { class: 'resume-accord', hidden: true, id: 'resume-' + a.champ }, a.resume);
    const info = el('button', {
      type: 'button', class: 'bouton-info', 'aria-label': 'À propos : ' + a.nom,
      'aria-expanded': 'false', 'aria-controls': 'resume-' + a.champ,
    }, icone('info'));
    info.addEventListener('click', () => {
      const ouvrir = ouvert !== a.champ;
      for (const l of lignes) { l.resume.hidden = true; l.info.setAttribute('aria-expanded', 'false'); }
      if (ouvrir) { resume.hidden = false; info.setAttribute('aria-expanded', 'true'); }
      ouvert = ouvrir ? a.champ : null;
    });
    const noeud = el('div', { class: 'accord' },
      el('div', { class: 'accord-tete' }, el('h3', {}, a.nom), info),
      resume,
      segments({
        options: NIVEAUX_ACCORD, valeur: ctx.fiche[a.champ], etiquette: a.nom,
        onChange: (v) => ctx.modifier(a.champ, v),
      }));
    return { noeud, resume, info };
  });
  return carte('Les 4 accords toltèques', ...lignes.map((l) => l.noeud));
}

function carteEvenement(ctx) {
  const zoneCategories = el('div');

  function dessinerCategories() {
    const formulaire = el('form', { class: 'nouvelle-pastille', hidden: true },
      el('input', { type: 'text', maxlength: '30', placeholder: 'Nom de la catégorie', 'aria-label': 'Nom de la nouvelle catégorie', enterkeyhint: 'done' }),
      el('button', { type: 'submit', class: 'bouton petit' }, 'Ajouter'),
      el('button', { type: 'button', class: 'bouton petit discret', onClick: () => { formulaire.hidden = true; ajout.hidden = false; } }, 'Annuler'));
    const ajout = el('button', {
      type: 'button', class: 'pastille pastille-ajout',
      onClick: () => { ajout.hidden = true; formulaire.hidden = false; formulaire.querySelector('input').focus(); },
    }, icone('plus'), 'Nouvelle');
    formulaire.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nom = formulaire.querySelector('input').value.trim();
      if (!nom) return;
      await ctx.ajouterPastille(nom);
      const existante = ctx.pastilles.find((p) => p.toLowerCase() === nom.toLowerCase());
      ctx.modifier('evt_categorie', existante || nom);
      dessinerCategories();
    });
    zoneCategories.replaceChildren(
      choixPastilles({
        options: ctx.pastilles, valeur: ctx.fiche.evt_categorie, etiquette: 'Catégorie',
        onChange: (v) => ctx.modifier('evt_categorie', v), extra: ajout,
      }),
      formulaire);
    // Catégorie enregistrée mais masquée ou supprimée : on l'affiche quand même.
    const cat = ctx.fiche.evt_categorie;
    if (cat && !ctx.pastilles.includes(cat)) {
      zoneCategories.prepend(el('p', { class: 'discret' }, `Catégorie enregistrée : ${cat}`));
    }
  }
  dessinerCategories();

  return carte('Événement marquant',
    el('p', { class: 'sous-titre-champ' }, 'Appréciation'),
    choixPastilles({
      options: APPRECIATIONS, valeur: ctx.fiche.evt_appreciation, etiquette: 'Appréciation',
      onChange: (v) => ctx.modifier('evt_appreciation', v),
    }),
    el('p', { class: 'sous-titre-champ' }, 'Catégorie'),
    zoneCategories,
    el('label', { class: 'sous-titre-champ', for: 'evt-texte' }, 'Description courte'),
    texteExtensible({
      id: 'evt-texte', class: 'champ', rows: '2', maxlength: '500', placeholder: 'En quelques mots…',
      value: ctx.fiche.evt_texte ?? '',
      onInput: (e) => ctx.modifierTexte('evt_texte', e.target.value),
    }));
}

function carteRecit(ctx) {
  const vide = el('p', { class: 'etat-vide' },
    'Aucun récit aujourd’hui. Dans l’Enregistreur : ',
    el('strong', {}, 'Partager → Transcription → Today’s Mood'), '. Tu peux aussi écrire directement ici.');
  const zone = texteExtensible({
    id: 'recit', class: 'champ champ-long', rows: '4', 'aria-label': 'Récit du jour',
    value: ctx.fiche.recit ?? '',
    onInput: (e) => { vide.hidden = e.target.value.trim() !== ''; ctx.modifierTexte('recit', e.target.value); },
  });
  vide.hidden = (ctx.fiche.recit ?? '').trim() !== '';
  return el('section', { class: 'carte', id: 'carte-recit' },
    el('div', { class: 'carte-tete' },
      el('h2', {}, 'Récit du jour'),
      el('div', { class: 'marques' },
        bascule({ nomIcone: 'etoile', libelle: 'Favori', actif: ctx.fiche.recit_favori, onChange: (v) => ctx.modifier('recit_favori', v || null) }),
        bascule({ nomIcone: 'piment', libelle: 'Piment', actif: ctx.fiche.recit_piment, onChange: (v) => ctx.modifier('recit_piment', v || null) }))),
    vide,
    zone);
}

function soir(ctx) {
  const m = ctx.fiche.humeur_matin;
  const rappel = el('p', { class: 'rappel' },
    'Ce matin : ', m ? el('strong', {}, `${LIBELLES.humeur[m - 1]} (${m})`) : el('span', { class: 'discret' }, 'non saisie'));
  return [
    carteJauge(ctx, 'Humeur du soir', 'Humeur', 'humeur_soir', LIBELLES.humeur, rappel),
    carteEvenement(ctx),
    carteRecit(ctx),
    carteBilan(ctx),
    carteAccords(ctx),
  ];
}

/* ---------- Perso ---------- */

function perso() {
  return [
    el('section', { class: 'carte verrou' },
      el('div', { class: 'empreinte' }, icone('empreinte')),
      el('h2', {}, 'Accès réservé'),
      el('p', { class: 'discret' }, 'Le verrou par empreinte, le compte-tours, Biscotte et My Love arrivent à l’étape 5.')),
  ];
}

export function rendreOnglet(id, ctx) {
  switch (id) {
    case 'matin': return matin(ctx);
    case 'journee': return journee(ctx);
    case 'soir': return soir(ctx);
    case 'perso': return perso(ctx);
    default: return [];
  }
}
