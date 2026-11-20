/* Jauge 9 crans « Garage vintage » : cadran crème cerclé de laiton, arc de 240°, aiguille rouge.
   L'aiguille se déplace au doigt (glisser sur le cadran), au clavier, ou avec les boutons − / +. */
import { el, svg, icone } from './ui.js';

const C = 150; // centre du cadran (viewBox 300 × 300)
const ANGLE_MIN = -120;
const PAS_ANGLE = 30; // 9 crans sur 240°
const ANGLE_REPOS = -138; // position de l'aiguille quand rien n'est saisi

const angleDe = (v) => ANGLE_MIN + (v - 1) * PAS_ANGLE;

function point(r, deg) {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function bandeArc(r1, r2, a1, a2) {
  const [x1, y1] = point(r2, a1);
  const [x2, y2] = point(r2, a2);
  const [x3, y3] = point(r1, a2);
  const [x4, y4] = point(r1, a1);
  return `M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
}

/* Deux habillages : cadran crème (humeur, énergie, inspiration) et compte-tours noir (énergie sexuelle). */
const THEMES = {
  creme: { face: '#EFE6D2', encre: '#2A2118', aiguille: '#B23A2A', zoneRouge: false },
  comptetours: { face: '#14100C', encre: '#EFE6D2', aiguille: '#EFE6D2', zoneRouge: true },
};

function dessinerCadran(nomCadran, variante) {
  const t = THEMES[variante] || THEMES.creme;
  const s = svg('svg', { viewBox: '0 0 300 300', class: 'cadran-svg cadran-' + variante, 'aria-hidden': 'true' });
  s.append(
    svg('circle', { cx: C, cy: C, r: 149, fill: '#8C6B34' }),
    svg('circle', { cx: C, cy: C, r: 142, fill: '#C9A15B' }),
    svg('circle', { cx: C, cy: C, r: 134, fill: t.face }),
  );
  // Zone rouge du compte-tours : crans 8 et 9.
  if (t.zoneRouge) s.append(svg('path', { d: bandeArc(117, 128, angleDe(7.5), angleDe(9) + 4), fill: '#C4402C' }));
  // Graduations : une principale par cran, trois fines entre deux crans.
  for (let i = 0; i <= 32; i++) {
    const deg = ANGLE_MIN + i * (PAS_ANGLE / 4);
    const principale = i % 4 === 0;
    const [x1, y1] = point(127, deg);
    const [x2, y2] = point(principale ? 107 : 117, deg);
    s.append(svg('line', {
      x1, y1, x2, y2, stroke: t.encre, 'stroke-width': principale ? 3.4 : 1.3, 'stroke-linecap': 'round',
    }));
  }
  for (let v = 1; v <= 9; v++) {
    const [x, y] = point(89, angleDe(v));
    const rouge = t.zoneRouge && v >= 8;
    s.append(svg('text', { x, y: y + 1, class: 'cadran-chiffre', style: `fill:${rouge ? '#E0533F' : t.encre}` }, String(v)));
  }
  let valeurBas = null;
  if (variante === 'comptetours') {
    valeurBas = svg('text', { x: C, y: 232, class: 'cadran-valeur' }, '–');
    s.append(svg('text', { x: C, y: 198, class: 'cadran-marque', style: 'fill:#ADA08A' }, 'TR/MIN × 1000'), valeurBas);
  } else {
    s.append(
      svg('text', { x: C, y: 202, class: 'cadran-marque' }, "TODAY'S MOOD"),
      svg('text', { x: C, y: 226, class: 'cadran-nom' }, nomCadran.toUpperCase()),
    );
  }
  const aiguille = svg('g', { class: 'aiguille' },
    svg('path', { d: `M ${C - 4.5} ${C + 24} L ${C - 1.2} ${C - 118} L ${C + 1.2} ${C - 118} L ${C + 4.5} ${C + 24} Z`, fill: t.aiguille }));
  s.append(
    aiguille,
    svg('circle', { cx: C, cy: C, r: 12, fill: '#2A2118', stroke: '#C9A15B', 'stroke-width': 3 }),
  );
  return { s, aiguille, valeurBas };
}

/**
 * @param {object} o
 * @param {string} o.titre        Titre de la carte (« Humeur du matin »)
 * @param {string} o.nomCadran    Nom inscrit sur le cadran (« Humeur »)
 * @param {string[]} o.libelles   9 libellés
 * @param {number|null} o.valeur  1–9 ou null
 * @param {(v:number)=>void} o.onChange
 * @param {'creme'|'comptetours'} [o.variante]
 */
export function creerJauge({ titre, nomCadran, libelles, valeur, onChange, variante = 'creme' }) {
  let v = valeur ?? null;
  let glisse = false;

  const { s, aiguille, valeurBas } = dessinerCadran(nomCadran, variante);
  const zone = el('div', {
    class: 'cadran', role: 'slider', tabindex: '0', 'aria-label': titre,
    'aria-valuemin': '1', 'aria-valuemax': '9',
  }, s);
  const libelle = el('p', { class: 'jauge-libelle' });
  const detail = el('p', { class: 'jauge-detail' });
  const moins = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Baisser d’un cran' }, icone('moins'));
  const plus = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Monter d’un cran' }, icone('plus'));

  function dessiner() {
    aiguille.style.transform = `rotate(${v == null ? ANGLE_REPOS : angleDe(v)}deg)`;
    zone.classList.toggle('vide', v == null);
    if (valeurBas) valeurBas.textContent = v == null ? '–' : String(v);
    libelle.textContent = v == null ? '—' : libelles[v - 1];
    detail.textContent = v == null ? 'Glisse l’aiguille ou touche le cadran' : `Cran ${v} sur 9`;
    if (v == null) {
      zone.removeAttribute('aria-valuenow');
      zone.setAttribute('aria-valuetext', 'Non saisi');
    } else {
      zone.setAttribute('aria-valuenow', String(v));
      zone.setAttribute('aria-valuetext', `${v} – ${libelles[v - 1]}`);
    }
    moins.disabled = v === 1;
    plus.disabled = v === 9;
  }

  function changer(n) {
    if (n === v) return;
    v = n;
    dessiner();
    onChange(v);
  }

  function valeurDepuis(evt) {
    const r = s.getBoundingClientRect();
    const x = ((evt.clientX - r.left) / r.width) * 300 - C;
    const y = ((evt.clientY - r.top) / r.height) * 300 - C;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI; // 0° en haut, sens horaire
    deg = Math.max(ANGLE_MIN, Math.min(-ANGLE_MIN, deg));
    return Math.round((deg - ANGLE_MIN) / PAS_ANGLE) + 1;
  }

  zone.addEventListener('pointerdown', (e) => {
    glisse = true;
    zone.setPointerCapture(e.pointerId);
    zone.classList.add('glisse');
    changer(valeurDepuis(e));
  });
  zone.addEventListener('pointermove', (e) => { if (glisse) changer(valeurDepuis(e)); });
  const finGlisse = () => { glisse = false; zone.classList.remove('glisse'); };
  zone.addEventListener('pointerup', finGlisse);
  zone.addEventListener('pointercancel', finGlisse);
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); changer(v == null ? 5 : Math.max(1, v - 1)); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); changer(v == null ? 5 : Math.min(9, v + 1)); }
  });
  moins.addEventListener('click', () => changer(v == null ? 5 : Math.max(1, v - 1)));
  plus.addEventListener('click', () => changer(v == null ? 5 : Math.min(9, v + 1)));

  dessiner();

  return el('div', { class: 'jauge' },
    zone,
    el('div', { class: 'jauge-commandes' }, moins, el('div', { class: 'jauge-texte' }, libelle, detail), plus));
}
