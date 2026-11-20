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
export function segments({ options, valeur, onChange, etiquette }) {
  const groupe = el('div', { class: 'segments', role: 'group', 'aria-label': etiquette });
  let actuelle = valeur ?? null;
  const boutons = options.map((opt) => el('button', {
    type: 'button', class: 'segment', 'aria-pressed': String(opt.valeur === actuelle),
    onClick: () => {
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
