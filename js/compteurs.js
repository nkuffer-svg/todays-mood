/* Onglet Journée : boissons (eau + jauge de carburant), sport (pas, marches, natation), totaux.
   ctx (en plus de l'habituel) : totaux(), eau { ajouts(), ajouter(ml), annuler() },
   marches { ajouter(km), supprimer(id) }, objectifEau */
import { el, svg, icone, carte } from './ui.js';

const fmt1 = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKm = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 });
const fmtEntier = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });

const litres = (ml) => fmt1.format((ml || 0) / 1000) + ' L';
const km = (v) => fmtKm.format(v || 0) + ' km';
const metres = (v) => fmtEntier.format(v || 0) + ' m';
const pluriel = (n, mot) => `${fmtEntier.format(n)} ${mot}${n > 1 ? 's' : ''}`;

/** Lit un nombre saisi à la main (« 4,2 », « 12'000 »). Renvoie null si vide ou invalide. */
function lireNombre(texte, { entier = false } = {}) {
  const t = String(texte).replace(/['’\s]/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return entier ? Math.round(n) : Math.round(n * 100) / 100;
}

/** Ligne « Aujourd'hui / Mois / Total ». Chaque case : [libellé, valeur, précision facultative]. */
function blocTotaux() {
  const dl = el('dl', { class: 'totaux' });
  const remplir = (cases) => dl.replaceChildren(...cases.map(([libelle, valeur, detail], i) => el('div', { class: i === 0 ? 'jour' : '' },
    el('dt', {}, libelle), el('dd', {}, valeur), detail ? el('dd', { class: 'detail' }, detail) : null)));
  remplir([["Aujourd'hui", '…'], ['Mois', '…'], ['Total', '…']]);
  return { dl, remplir };
}

/* ---------- Jauge d'eau (demi-cadran façon jauge de carburant) ---------- */

const CX = 120;
const CY = 124;
const point = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
};
const ARC = 65; // demi-ouverture de la graduation, en degrés de part et d'autre de la verticale
const angleDe = (fraction) => -ARC + 2 * ARC * fraction;

function arc(r1, r2, a1, a2) {
  const [x1, y1] = point(r2, a1);
  const [x2, y2] = point(r2, a2);
  const [x3, y3] = point(r1, a2);
  const [x4, y4] = point(r1, a1);
  const grand = a2 - a1 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r2} ${r2} 0 ${grand} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${grand} 0 ${x4} ${y4} Z`;
}

function demiDisque(r) {
  return `M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY} Z`;
}

function jaugeEau(objectifMl) {
  const s = svg('svg', { viewBox: '0 0 240 140', class: 'jauge-eau-svg', role: 'img' });
  s.append(
    svg('path', { d: demiDisque(114), fill: '#8C6B34' }),
    svg('path', { d: demiDisque(108), fill: '#C9A15B' }),
    svg('path', { d: demiDisque(101), fill: '#EFE6D2' }),
    svg('rect', { x: CX - 114, y: CY, width: 228, height: 8, rx: 3, fill: '#8C6B34' }),
    // Zone verte entre 75 % et 100 % de l'objectif (1,5 → 2 L pour 2 L)
    svg('path', { d: arc(78, 92, angleDe(0.75), angleDe(1)), fill: '#3E7A55' }),
  );
  for (let i = 0; i <= 8; i++) {
    const deg = angleDe(i / 8);
    const principale = i % 4 === 0;
    const [x1, y1] = point(94, deg);
    const [x2, y2] = point(principale ? 76 : 84, deg);
    s.append(svg('line', { x1, y1, x2, y2, stroke: '#2A2118', 'stroke-width': principale ? 3 : 1.4, 'stroke-linecap': 'round' }));
  }
  const etiquettes = [[0, '0'], [0.5, fmtKm.format(objectifMl / 2000) + ' L'], [1, fmtKm.format(objectifMl / 1000) + ' L']];
  for (const [f, texte] of etiquettes) {
    const [x, y] = point(62, angleDe(f));
    s.append(svg('text', { x, y: y + 4, class: 'eau-etiquette' }, texte));
  }
  s.append(svg('text', { x: CX, y: CY - 26, class: 'eau-marque' }, 'EAU'));
  const aiguille = svg('g', { class: 'aiguille aiguille-eau' },
    svg('path', { d: `M ${CX - 4} ${CY + 10} L ${CX - 1} ${CY - 90} L ${CX + 1} ${CY - 90} L ${CX + 4} ${CY + 10} Z`, fill: '#B23A2A' }));
  s.append(aiguille, svg('circle', { cx: CX, cy: CY, r: 10, fill: '#2A2118', stroke: '#C9A15B', 'stroke-width': 3 }));

  return {
    s,
    regler(ml) {
      const fraction = Math.min(Math.max((ml || 0) / objectifMl, 0), 1.04);
      aiguille.style.transform = `rotate(${angleDe(fraction)}deg)`;
      s.setAttribute('aria-label', `Eau : ${litres(ml)} sur ${litres(objectifMl)}`);
    },
  };
}

/* ---------- Carte « Quoi dans le goulot ? » ---------- */

const BOISSONS = [
  { champ: 'cafe', nom: 'Café' },
  { champ: 'deca', nom: 'Déca' },
  { champ: 'biere', nom: 'Bière' },
  { champ: 'vin', nom: 'Verre de vin' },
];

function carteGoulot(ctx, actualisateurs) {
  const objectif = ctx.objectifEau;
  const jauge = jaugeEau(objectif);
  const quantite = el('p', { class: 'eau-quantite' });
  const reste = el('p', { class: 'eau-reste' });
  const annuler = el('button', { type: 'button', class: 'bouton petit discret' }, 'Annuler le dernier ajout');
  const totauxEau = blocTotaux();

  function majEau() {
    const ml = ctx.fiche.eau_ml || 0;
    jauge.regler(ml);
    quantite.textContent = litres(ml);
    const manque = objectif - ml;
    reste.textContent = manque > 0 ? `Encore ${litres(manque)}` : 'Objectif atteint';
    reste.classList.toggle('atteint', manque <= 0);
    annuler.disabled = ctx.eau.ajouts().length === 0;
  }

  const ajout = (ml) => el('button', {
    type: 'button', class: 'bouton bouton-eau',
    onClick: async () => { await ctx.eau.ajouter(ml); majEau(); actualisateurs.rafraichir(); },
  }, icone('plus'), `${ml} ml`);
  annuler.addEventListener('click', async () => { await ctx.eau.annuler(); majEau(); actualisateurs.rafraichir(); });

  actualisateurs.push((t) => totauxEau.remplir([
    ["Aujourd'hui", litres(ctx.fiche.eau_ml)], ['Mois', litres(t.mois.eau_ml)], ['Total', litres(t.total.eau_ml)],
  ]));
  majEau();

  const blocEau = el('div', { class: 'compteur compteur-eau' },
    el('h3', { class: 'compteur-nom' }, 'Eau'),
    el('div', { class: 'eau-affichage' },
      el('div', { class: 'eau-jauge' }, jauge.s),
      el('div', { class: 'eau-texte' }, quantite, reste)),
    el('div', { class: 'rangee-boutons' }, ajout(500), ajout(300), annuler),
    totauxEau.dl);

  const lignes = BOISSONS.map((b) => {
    const valeur = el('span', { class: 'compteur-valeur', 'aria-live': 'polite' });
    const moins = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': `${b.nom} : moins un` }, icone('moins'));
    const plus = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': `${b.nom} : plus un` }, icone('plus'));
    const totaux = blocTotaux();
    const maj = () => {
      const n = ctx.fiche[b.champ] || 0;
      valeur.textContent = String(n);
      moins.disabled = n === 0;
    };
    const changer = async (delta) => {
      const n = Math.max(0, (ctx.fiche[b.champ] || 0) + delta);
      await ctx.modifier(b.champ, n === 0 ? null : n);
      maj();
      actualisateurs.rafraichir();
    };
    moins.addEventListener('click', () => changer(-1));
    plus.addEventListener('click', () => changer(1));
    actualisateurs.push((t) => totaux.remplir([
      ["Aujourd'hui", fmtEntier.format(ctx.fiche[b.champ] || 0)], ['Mois', fmtEntier.format(t.mois[b.champ])], ['Total', fmtEntier.format(t.total[b.champ])],
    ]));
    maj();
    return el('div', { class: 'compteur' },
      el('div', { class: 'compteur-tete' },
        el('h3', { class: 'compteur-nom' }, b.nom),
        el('div', { class: 'compteur-commandes' }, moins, valeur, plus)),
      totaux.dl);
  });

  return carte('Quoi dans le goulot ?', blocEau, ...lignes);
}

/* ---------- Carte « Comment t'as bougé ton Q ? » ---------- */

function champNombre({ id, valeur, entier, unite, placeholder, onSaisie, onFin }) {
  const input = el('input', {
    id, class: 'champ champ-nombre', type: 'text', inputmode: entier ? 'numeric' : 'decimal',
    autocomplete: 'off', placeholder, value: valeur == null ? '' : String(valeur),
  });
  const alerte = el('p', { class: 'avertissement', hidden: true }, 'Nombre invalide');
  input.addEventListener('input', () => {
    const n = lireNombre(input.value, { entier });
    alerte.hidden = input.value.trim() === '' || n !== null;
    if (alerte.hidden) onSaisie(n);
  });
  input.addEventListener('change', () => {
    const n = lireNombre(input.value, { entier });
    if (input.value.trim() !== '' && n === null) return;
    onFin(n);
  });
  return el('div', {}, el('div', { class: 'ligne-champ' }, input, el('span', { class: 'unite-champ' }, unite)), alerte);
}

function carteSport(ctx, actualisateurs) {
  /* Pas */
  const pas = champNombre({
    id: 'champ-pas', valeur: ctx.fiche.pas, entier: true, unite: 'pas', placeholder: 'Total du jour',
    onSaisie: (n) => ctx.modifierTexte('pas', n),
    onFin: (n) => ctx.modifier('pas', n),
  });

  /* Marches */
  const listeMarches = el('ul', { class: 'liste-marches' });
  const totauxMarche = blocTotaux();
  const formulaire = el('form', { class: 'ajout-marche', hidden: true });
  const champKm = el('input', {
    class: 'champ champ-nombre', type: 'text', inputmode: 'decimal', placeholder: 'Distance', 'aria-label': 'Distance en km', autocomplete: 'off',
  });
  const alerteKm = el('p', { class: 'avertissement', hidden: true }, 'Indique une distance en km, par exemple 4,5.');
  const boutonAjout = el('button', { type: 'button', class: 'bouton discret bouton-ajout' }, icone('plus'), 'Ajouter une marche');
  formulaire.append(
    el('div', { class: 'ligne-champ' }, champKm, el('span', { class: 'unite-champ' }, 'km')),
    alerteKm,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'submit', class: 'bouton' }, 'Ajouter'),
      el('button', { type: 'button', class: 'bouton discret', onClick: () => { formulaire.hidden = true; boutonAjout.hidden = false; } }, 'Annuler')));
  boutonAjout.addEventListener('click', () => {
    boutonAjout.hidden = true;
    formulaire.hidden = false;
    champKm.value = '';
    alerteKm.hidden = true;
    champKm.focus();
  });
  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = lireNombre(champKm.value);
    if (!n || n <= 0 || n > 200) { alerteKm.hidden = false; return; }
    await ctx.marches.ajouter(n);
    formulaire.hidden = true;
    boutonAjout.hidden = false;
    actualisateurs.rafraichir();
  });

  actualisateurs.push((t) => {
    listeMarches.replaceChildren(...t.marchesDuJour.map((m, i) => el('li', {},
      el('span', {}, `Marche ${i + 1}`),
      el('strong', {}, km(m.km)),
      el('button', {
        type: 'button', class: 'bouton-info', 'aria-label': `Supprimer la marche ${i + 1} (${km(m.km)})`,
        onClick: async () => {
          if (!confirm(`Supprimer la marche de ${km(m.km)} ?`)) return;
          await ctx.marches.supprimer(m.id);
          actualisateurs.rafraichir();
        },
      }, icone('corbeille')))));
    if (!t.marchesDuJour.length) listeMarches.append(el('li', { class: 'vide' }, 'Aucune marche aujourd’hui'));
    totauxMarche.remplir([
      ["Aujourd'hui", km(t.jour.marche_km)],
      ['Mois', km(t.mois.marche_km), pluriel(t.mois.marche_nb, 'marche')],
      ['Total', km(t.total.marche_km), pluriel(t.total.marche_nb, 'marche')],
    ]);
  });

  /* Natation */
  const totauxNage = blocTotaux();
  const natation = champNombre({
    id: 'champ-natation', valeur: ctx.fiche.natation_m, entier: true, unite: 'm', placeholder: 'Séance du jour',
    onSaisie: (n) => ctx.modifierTexte('natation_m', n),
    onFin: async (n) => { await ctx.modifier('natation_m', n); actualisateurs.rafraichir(); },
  });
  actualisateurs.push((t) => totauxNage.remplir([
    ["Aujourd'hui", metres(ctx.fiche.natation_m)],
    ['Mois', metres(t.mois.natation_m), pluriel(t.mois.natation_nb, 'séance')],
    ['Total', metres(t.total.natation_m), pluriel(t.total.natation_nb, 'séance')],
  ]));

  return carte('Comment t’as bougé ton Q ?',
    el('label', { class: 'sous-titre-champ', for: 'champ-pas' }, 'Nombre de pas'),
    pas,
    el('h3', { class: 'sous-titre-champ' }, 'Marche'),
    listeMarches,
    boutonAjout,
    formulaire,
    totauxMarche.dl,
    el('label', { class: 'sous-titre-champ', for: 'champ-natation' }, 'Natation'),
    natation,
    totauxNage.dl);
}

/** Cartes de l'onglet Journée (la carte photo est fournie par onglets.js). */
export function cartesCompteurs(ctx) {
  const actualisateurs = [];
  let enCours = null;
  actualisateurs.rafraichir = () => {
    enCours = (enCours || Promise.resolve()).then(async () => {
      const t = await ctx.totaux();
      for (const fn of actualisateurs) fn(t);
    }).catch((err) => console.error(err));
    return enCours;
  };
  const cartes = [carteGoulot(ctx, actualisateurs), carteSport(ctx, actualisateurs)];
  actualisateurs.rafraichir();
  return cartes;
}
