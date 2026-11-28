/* What's up : Who's the Boss ? — une envie d'acheter, qui a gagné ? Mister Me (l'argent part sur Revolut)
   ou Le plaisir (la dépense est suivie dans une autre app). Plusieurs tentations par jour.
   Tout est calculé à partir des tentations (magasin « tentations », onglet « Tentations » du Sheet). */
import { el, svg, icone, carte, clac } from './ui.js';
import { depuisTexte } from './jour.js';

const ENTIER = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** « 45 CHF » ou « 12.50 CHF ». */
export const chf = (v) => { const x = Number(v) || 0; return (Number.isInteger(Math.round(x * 100) / 100) ? ENTIER : DECIMAL).format(x); };
const fmtDate = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const montant = (t) => (t.gagnant === 'me' && Number.isFinite(Number(t.montant_chf)) ? Number(t.montant_chf) : 0);

export const NOMS_GAGNANTS = { me: 'Mister Me', plaisir: 'Le plaisir' };

/** « 12,5 » ou « 12.50 » → 12.5 ; vide → null ; invalide → NaN. */
function lireMontant(texte) {
  const t = String(texte ?? '').trim().replace(/[’'\s]/g, '').replace(',', '.');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : NaN;
}

/** Score et montants d'une liste de tentations. */
export function scoreTentations(liste) {
  return {
    me: liste.filter((t) => t.gagnant === 'me').length,
    plaisir: liste.filter((t) => t.gagnant === 'plaisir').length,
    revolut: Math.round(liste.reduce((s, t) => s + montant(t), 0) * 100) / 100,
  };
}

function drapeau() {
  const s = svg('svg', { viewBox: '0 0 48 12', class: 'damier', 'aria-hidden': 'true' });
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) if ((x + y) % 2 === 0) s.append(svg('rect', { x: x * 3, y: y * 3, width: 3, height: 3 }));
  return s;
}

/** Réservoir gradué laiton : se remplit de 0 à 100 % de l'objectif. */
export function reservoir(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  const H = 120;
  const s = svg('svg', { viewBox: '0 0 64 150', class: 'reservoir', 'aria-hidden': 'true' });
  s.append(
    svg('rect', { x: 14, y: 8, width: 36, height: 134, rx: 10, class: 'reservoir-corps' }),
    svg('rect', { x: 20, y: 15 + H * (1 - f), width: 24, height: H * f, rx: 3, class: 'reservoir-niveau' }),
  );
  for (let i = 0; i <= 4; i++) {
    const y = 15 + (H * i) / 4;
    s.append(svg('line', { x1: i % 2 ? 44 : 40, x2: 50, y1: y, y2: y, class: 'reservoir-trait' }));
  }
  s.append(svg('rect', { x: 14, y: 8, width: 36, height: 134, rx: 10, class: 'reservoir-bord' }));
  return s;
}

function blocCagnotte(ctx, tentations) {
  const c = ctx.cagnotte;
  if (!c) {
    return el('div', { class: 'cagnotte vide' },
      el('p', { class: 'discret' }, 'Pas encore d’objectif de cagnotte.'),
      el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ctx.ouvrirReglages() }, 'Fixer un objectif'));
  }
  const total = scoreTentations(tentations.filter((t) => t.date >= c.debut)).revolut;
  const fraction = total / c.montant;
  const atteint = total >= c.montant;
  return el('div', { class: 'cagnotte' + (atteint ? ' atteinte' : '') },
    reservoir(fraction),
    el('div', { class: 'cagnotte-texte' },
      el('p', { class: 'cagnotte-nom' }, c.nom || 'Cagnotte'),
      el('p', { class: 'cagnotte-montant' }, el('strong', {}, chf(total)), ` / ${chf(c.montant)}`),
      el('p', { class: 'discret' }, `${Math.min(100, Math.round(fraction * 100))} % · depuis le ${fmtDate.format(depuisTexte(c.debut))}`),
      atteint
        ? [el('p', { class: 'cagnotte-bravo' }, `Objectif atteint, bravo ! « ${c.nom || 'Cagnotte'} » est à toi.`),
          el('button', { type: 'button', class: 'bouton petit', onClick: () => ctx.ouvrirReglages() }, 'Fixer un nouvel objectif')]
        : el('p', { class: 'cagnotte-reste' }, `Encore ${chf(c.montant - total)}`)));
}

export function carteBoss(ctx) {
  const zoneJour = el('div', { class: 'tentations-jour' });
  const zoneBilan = el('div');
  const quoi = el('input', { type: 'text', id: 'boss-quoi', class: 'champ', maxlength: '80', autocomplete: 'off', placeholder: 'Facultatif', enterkeyhint: 'next' });
  const somme = el('input', { type: 'text', id: 'boss-montant', class: 'champ', inputmode: 'decimal', autocomplete: 'off', placeholder: '0.00', enterkeyhint: 'done' });
  const alerte = el('p', { class: 'avertissement', hidden: true }, 'Montant invalide (ex. 45 ou 12.50).');
  const formulaire = el('form', { class: 'formulaire-boss', hidden: true },
    el('label', { class: 'sous-titre-champ', for: 'boss-quoi' }, 'Quoi ?'), quoi,
    el('label', { class: 'sous-titre-champ', for: 'boss-montant' }, 'Go to Revolut (CHF)'), somme, alerte,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'submit', class: 'bouton' }, icone('plus'), 'Ajouter'),
      el('button', { type: 'button', class: 'bouton discret', onClick: () => fermerFormulaire() }, 'Annuler')));

  const boutonMe = el('button', { type: 'button', class: 'pastille-boss', 'aria-expanded': 'false', onClick: () => ouvrirFormulaire() }, 'Mister Me');
  const boutonPlaisir = el('button', {
    type: 'button', class: 'pastille-boss plaisir',
    onClick: async () => {
      clac();
      await ctx.tentations.ajouter({ gagnant: 'plaisir', quoi: null, montant_chf: null });
      maj();
    },
  }, 'Le plaisir');

  function ouvrirFormulaire() {
    formulaire.hidden = false;
    boutonMe.setAttribute('aria-expanded', 'true');
    boutonMe.classList.add('actif');
    quoi.focus();
  }
  function fermerFormulaire() {
    formulaire.hidden = true;
    alerte.hidden = true;
    quoi.value = '';
    somme.value = '';
    boutonMe.setAttribute('aria-expanded', 'false');
    boutonMe.classList.remove('actif');
  }
  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = lireMontant(somme.value);
    alerte.hidden = !Number.isNaN(m);
    if (Number.isNaN(m)) return;
    clac();
    await ctx.tentations.ajouter({ gagnant: 'me', quoi: quoi.value.trim() || null, montant_chf: m });
    fermerFormulaire();
    maj();
  });

  async function maj() {
    const toutes = await ctx.tentations.liste();
    const date = ctx.fiche.date;
    const duJour = toutes.filter((t) => t.date === date);
    zoneJour.replaceChildren(duJour.length
      ? el('ul', { class: 'liste-tentations' }, ...duJour.map((t) => el('li', { class: 'tentation ' + (t.gagnant === 'me' ? 'me' : 'plaisir') },
        el('span', { class: 'tentation-gagnant' }, NOMS_GAGNANTS[t.gagnant] || t.gagnant),
        el('span', { class: 'tentation-quoi' }, t.quoi || (t.gagnant === 'me' ? '' : 'dépense dans l’autre app')),
        t.gagnant === 'me' && t.montant_chf != null ? el('span', { class: 'tentation-montant' }, chf(t.montant_chf)) : null,
        el('button', {
          type: 'button', class: 'bouton-rond petit', 'aria-label': `Supprimer : ${NOMS_GAGNANTS[t.gagnant]}${t.quoi ? ', ' + t.quoi : ''}`,
          onClick: async () => {
            if (!confirm('Supprimer cette tentation ?')) return;
            await ctx.tentations.supprimer(t.id);
            maj();
          },
        }, icone('corbeille')))))
      : el('p', { class: 'etat-vide' }, 'Aucune tentation aujourd’hui.'));

    const mois = date.slice(0, 7);
    const sMois = scoreTentations(toutes.filter((t) => t.date.startsWith(mois)));
    const sTout = scoreTentations(toutes);
    const victoires = toutes.filter((t) => t.gagnant === 'me' && montant(t) > 0).sort((a, b) => montant(b) - montant(a) || (a.date < b.date ? -1 : 1));
    const belle = victoires[0];
    const nomMois = new Intl.DateTimeFormat('fr-CH', { month: 'long' }).format(depuisTexte(date));
    zoneBilan.replaceChildren(
      el('div', { class: 'panneau-course panneau-boss' },
        el('div', { class: 'panneau-tete' }, drapeau(), el('span', {}, `Score · ${nomMois}`), drapeau()),
        el('p', { class: 'score-boss', 'aria-label': `Mister Me ${sMois.me}, Le plaisir ${sMois.plaisir}` },
          el('span', { class: 'equipe' }, 'Mister Me'), el('strong', {}, `${sMois.me} – ${sMois.plaisir}`), el('span', { class: 'equipe' }, 'Le plaisir')),
        el('div', { class: 'panneau-pied' },
          el('span', {}, `Go to Revolut ce mois : ${chf(sMois.revolut)}`),
          el('span', {}, `Total : ${chf(sTout.revolut)}`))),
      el('div', { class: 'belle-victoire' },
        el('p', { class: 'sous-titre-champ' }, 'Plus belle victoire'),
        belle
          ? el('p', {}, el('strong', {}, chf(belle.montant_chf)), belle.quoi ? ` · ${belle.quoi}` : '', el('span', { class: 'discret' }, ` · ${fmtDate.format(depuisTexte(belle.date))}`))
          : el('p', { class: 'discret' }, 'Pas encore de victoire avec un montant.')),
      el('p', { class: 'sous-titre-champ' }, 'Cagnotte'),
      blocCagnotte(ctx, toutes));
  }
  maj();

  return carte('Who’s the Boss ?',
    el('p', { class: 'sous-titre-boss' }, 'Une envie d’acheter ? Qui a gagné ?'),
    el('div', { class: 'pastilles-boss' }, boutonMe, boutonPlaisir),
    formulaire,
    zoneJour,
    zoneBilan);
}
