/* Petits outils pour construire l'interface sans framework. */

function ajouter(parent, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false) continue;
    parent.append(e instanceof Node ? e : String(e));
  }
}

/** el('button', { class: 'x', onClick: fn, 'aria-pressed': 'true' }, 'Texte', autreNoeud) */
export function el(tag, props = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  ajouter(n, enfants);
  return n;
}

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...enfants) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  ajouter(n, enfants);
  return n;
}

/* Icônes au trait (24 × 24), couleur = currentColor. */
const TRACES = {
  reglages: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  etoile: '<path class="remplissable" d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  piment: '<path class="remplissable" d="M16.5 7.5c-1.7 0-2.8 1.6-3.6 3.5-1 2.3-2.6 4.4-6.2 5.4-1.6.5-1.4 2.6.3 2.6 6.1 0 11-4.2 11-9.4 0-1.1-.5-2.1-1.5-2.1z"/><path d="M16.5 7.5c.2-1.8 1.2-3 3-3.5"/>',
  cadenas: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  moins: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  gauche: '<path d="M14.5 6l-6 6 6 6"/>',
  droite: '<path d="M9.5 6l6 6-6 6"/>',
  fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
  calendrier: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  'peu-nuageux': '<path d="M8 3.5v1.2M3.6 5.6l.9.9M2.5 10h1.2M5 13a3.6 3.6 0 1 1 6.3-4.6"/><path d="M9.5 20h8a3.6 3.6 0 0 0 .5-7.15 4.9 4.9 0 0 0-9.3-.9A4 4 0 0 0 9.5 20z"/>',
  nuage: '<path d="M7 18.5h10a4.2 4.2 0 0 0 .6-8.35 5.6 5.6 0 0 0-10.6-1A4.7 4.7 0 0 0 7 18.5z"/>',
  pluie: '<path d="M7 14.5h10a4.2 4.2 0 0 0 .6-8.35 5.6 5.6 0 0 0-10.6-1A4.7 4.7 0 0 0 7 14.5z"/><path d="M8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3"/>',
  neige: '<path d="M7 14.5h10a4.2 4.2 0 0 0 .6-8.35 5.6 5.6 0 0 0-10.6-1A4.7 4.7 0 0 0 7 14.5z"/><path d="M8 18v.1M12 17.5v.1M16 18v.1M10 21v.1M14 21v.1" stroke-width="2.6"/>',
  brouillard: '<path d="M7 13h10a4 4 0 0 0 .6-7.95 5.4 5.4 0 0 0-10.2-1A4.5 4.5 0 0 0 7 13z"/><path d="M4 16.5h16M6 20h12"/>',
  orage: '<path d="M7 14.5h10a4.2 4.2 0 0 0 .6-8.35 5.6 5.6 0 0 0-10.6-1A4.7 4.7 0 0 0 7 14.5z"/><path d="M12.8 15.5l-2.6 3.6h3.2l-2.2 3.4"/>',
  appareil: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v11H4z"/><circle cx="12" cy="13.5" r="3.6"/>',
  galerie: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  corbeille: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  actualiser: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v3.8h-3.8"/>',
  historique: '<path d="M4.2 13.5A8 8 0 1 0 6 6.3"/><path d="M4 3.8v4.4h4.4"/><path d="M12 8v4.2l2.8 1.8"/>',
  haut: '<path d="M6 15l6-6 6 6"/>',
  bas: '<path d="M6 9l6 6 6-6"/>',
  telecharger: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  partager: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  oeil: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  empreinte: '<path d="M7.5 9.5a4.5 4.5 0 0 1 9 0c0 3-.5 5.5-1.5 7.5"/><path d="M12 9.5c0 3.5-.6 6.6-2.2 9"/><path d="M5 13c.3-1 .5-2.2.5-3.5a6.5 6.5 0 0 1 13 0c0 1.5-.1 3-.4 4.5"/><path d="M9.5 9.8c0 2.6-.5 5-1.6 7"/>',
};

export function icone(nom, classe = '') {
  const s = svg('svg', {
    viewBox: '0 0 24 24', width: '24', height: '24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true', class: ('icone ' + classe).trim(),
  });
  s.innerHTML = TRACES[nom];
  return s;
}

/** Rangée de pastilles à choix unique. Un nouvel appui sur la pastille active la désélectionne. */
export function choixPastilles({ options, valeur, onChange, etiquette, extra }) {
  const groupe = el('div', { class: 'pastilles', role: 'group', 'aria-label': etiquette });
  let actuelle = valeur ?? null;
  const boutons = options.map((opt) => {
    const b = el('button', {
      type: 'button', class: 'pastille', 'aria-pressed': String(opt === actuelle),
      onClick: () => {
        actuelle = actuelle === opt ? null : opt;
        for (const x of boutons) x.setAttribute('aria-pressed', String(x.dataset.valeur === actuelle));
        onChange(actuelle);
      },
    }, opt);
    b.dataset.valeur = opt;
    return b;
  });
  groupe.append(...boutons);
  if (extra) groupe.append(extra);
  return groupe;
}

/** Sélecteur segmenté en pilule (valeurs numériques). Un nouvel appui désélectionne. */
export function segments({ options, valeur, onChange, etiquette, obligatoire = false }) {
  const groupe = el('div', { class: 'segments', role: 'group', 'aria-label': etiquette });
  let actuelle = valeur ?? null;
  const boutons = options.map((opt) => el('button', {
    type: 'button', class: 'segment', 'aria-pressed': String(opt.valeur === actuelle),
    onClick: () => {
      if (obligatoire && actuelle === opt.valeur) return;
      actuelle = actuelle === opt.valeur ? null : opt.valeur;
      boutons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].valeur === actuelle)));
      onChange(actuelle);
    },
  }, opt.libelle));
  groupe.append(...boutons);
  return groupe;
}

/** Bouton bascule à icône (Favori, Piment). */
export function bascule({ nomIcone, libelle, actif, onChange }) {
  let etat = !!actif;
  const b = el('button', {
    type: 'button', class: 'bascule', 'aria-pressed': String(etat), 'aria-label': libelle, title: libelle,
    onClick: () => { etat = !etat; b.setAttribute('aria-pressed', String(etat)); onChange(etat); },
  }, icone(nomIcone), el('span', {}, libelle));
  return b;
}

/** Zone de texte qui s'agrandit avec son contenu. */
export function texteExtensible(props) {
  const t = el('textarea', props);
  const ajuster = () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; };
  t.addEventListener('input', ajuster);
  requestAnimationFrame(ajuster);
  return t;
}

export function carte(titre, ...contenu) {
  return el('section', { class: 'carte' }, titre ? el('h2', {}, titre) : null, ...contenu);
}
