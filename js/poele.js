/* Burn on the fire, en hiver (version 5 A) : l'effet poêle (température intérieure à 20 h avec ou sans feu)
   et la réserve de bois (livraisons, feux restants, date d'épuisement). Tout est calculé, rien n'est stocké
   en dehors des livraisons (onglet « Bois »), des dates de stock vide et du nombre de feux par stère (Réglages). */
import { el, carte, icone, clac } from './ui.js';
import { depuisTexte, decaler } from './jour.js';
import { reglage, definirReglage } from './reglages.js';
import { estHiver } from './whatsup.js';
import { reservoir } from './boss.js';

const nf = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ent = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 });
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const MIN_JOURS = 5;

/* ---------- L'effet poêle ---------- */

/** Température extérieure de référence d'un jour : ta station à 16 h, sinon Open-Meteo à 16 h, sinon la moyenne min/max. */
function tempDehors(f) {
  const t = num(f.nt16_temp_ext) ?? num(f.meteo16_temp);
  if (t != null) return t;
  const a = num(f.meteo_tmin);
  const b = num(f.meteo_tmax);
  return a != null && b != null ? (a + b) / 2 : null;
}

/**
 * Différence moyenne de température intérieure à 20 h entre les soirs avec feu et sans feu (en hiver).
 * De préférence à température extérieure comparable (±3 °C) : chaque soir avec feu est comparé aux soirs
 * sans feu dont le temps dehors était proche. Sinon, simple différence des moyennes.
 */
export function effetPoele(fiches, hiver) {
  const soirs = fiches.filter((f) => num(f.maison20_temp) != null && estHiver(f.date, hiver));
  const avec = soirs.filter((f) => num(f.feux_poele) > 0);
  const sans = soirs.filter((f) => !(num(f.feux_poele) > 0));
  if (avec.length < MIN_JOURS || sans.length < MIN_JOURS) return { assez: false, nbAvec: avec.length, nbSans: sans.length };
  const t = (f) => num(f.maison20_temp);
  const paires = [];
  for (const a of avec) {
    const ta = tempDehors(a);
    if (ta == null) continue;
    const proches = sans.filter((s) => tempDehors(s) != null && Math.abs(tempDehors(s) - ta) <= 3);
    if (proches.length) paires.push({ avec: t(a), sans: moyenne(proches.map(t)) });
  }
  if (paires.length >= 3) {
    const mAvec = moyenne(paires.map((p) => p.avec));
    const mSans = moyenne(paires.map((p) => p.sans));
    return { assez: true, comparable: true, effet: mAvec - mSans, avec: mAvec, sans: mSans, nbAvec: avec.length, nbSans: sans.length, nbPaires: paires.length };
  }
  const mAvec = moyenne(avec.map(t));
  const mSans = moyenne(sans.map(t));
  return { assez: true, comparable: false, effet: mAvec - mSans, avec: mAvec, sans: mSans, nbAvec: avec.length, nbSans: sans.length };
}

export function carteEffetPoele(ctx) {
  const zone = el('div', {}, el('p', { class: 'discret' }, '…'));
  ctx.fiches().then((fiches) => {
    const r = effetPoele(fiches, ctx.hiver);
    if (!r.assez) {
      zone.replaceChildren(
        el('p', { class: 'effet-attente' }, 'Encore quelques soirs pour calculer'),
        el('p', { class: 'discret' }, `Il faut au moins ${MIN_JOURS} soirs avec feu et ${MIN_JOURS} sans feu, avec la température de la maison à 20 h. Pour l’instant : ${r.nbAvec} avec, ${r.nbSans} sans.`));
      return;
    }
    const base = Math.min(r.avec, r.sans) - 3;
    const haut = Math.max(r.avec, r.sans);
    const largeur = (v) => `${Math.max(8, Math.round(((v - base) / (haut - base)) * 100))}%`;
    const barre = (classe, libelle, v) => el('div', { class: 'barre-poele ' + classe },
      el('span', { class: 'barre-poele-nom' }, libelle),
      el('span', { class: 'barre-poele-piste' }, el('span', { style: `width:${largeur(v)}` })),
      el('span', { class: 'barre-poele-valeur' }, `${nf.format(v)}°`));
    zone.replaceChildren(
      el('p', { class: 'effet-titre' }, el('strong', {}, `${r.effet >= 0 ? '+' : '−'}${nf.format(Math.abs(r.effet))}°`), ' par feu, à 20 h'),
      barre('avec', 'Avec feu', r.avec),
      barre('sans', 'Sans feu', r.sans),
      el('p', { class: 'discret' }, r.comparable
        ? `À température extérieure comparable (±3 °C), sur ${r.nbPaires} soirs avec feu.`
        : `Moyenne de ${r.nbAvec} soirs avec feu et ${r.nbSans} sans (pas assez de soirs au temps comparable).`));
  });
  return carte('L’effet poêle', zone);
}

/* ---------- La réserve de bois ---------- */

const feuxParStere = () => num(reglage('feuxParStere')) || 20;
export function datesStockVide() {
  try {
    const l = JSON.parse(reglage('boisVides') || '[]');
    return Array.isArray(l) ? l.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  } catch {
    return [];
  }
}

/**
 * Stock depuis le dernier « stock vide » (ou depuis le début) : livraisons de cette période, feux faits depuis
 * (report de saison compris), feux restants estimés.
 */
export function etatBois({ livraisons, fiches, reports, hiver, aujourdhui }) {
  const vides = datesStockVide();
  const depuis = vides.length ? vides[vides.length - 1] : null;
  const fenetre = livraisons.filter((l) => !depuis || l.date >= depuis).sort((a, b) => (a.date < b.date ? -1 : 1));
  const steres = fenetre.reduce((s, l) => s + (num(l.steres) || 0), 0);
  let feux = fiches.filter((f) => (!depuis || f.date > depuis) && f.date <= aujourdhui).reduce((s, f) => s + (num(f.feux_poele) || 0), 0);
  // Report de saison (feux d'avant l'app) : compte s'il date de cette période de stock.
  if (fenetre.length) {
    for (const r of reports.filter((x) => x.type === 'hiver')) {
      const [a1, a2] = String(r.saison).split('-');
      const debut = `${a1}-${hiver.debut}`;
      const fin = `${a2 || a1}-${hiver.fin}`;
      if ((!depuis || depuis <= debut) && fin >= fenetre[0].date) feux += num(r.nombre) || 0;
    }
  }
  const fps = feuxParStere();
  const total = steres * fps;
  const reste = Math.max(0, total - feux);
  const recents = fiches.filter((f) => f.date > decaler(aujourdhui, -14) && f.date <= aujourdhui).reduce((s, f) => s + (num(f.feux_poele) || 0), 0);
  const rythme = recents / 14; // feux par jour
  return { depuis, fenetre, steres, feux, fps, total, reste, rythme };
}

const fmtMois = new Intl.DateTimeFormat('fr-CH', { month: 'long' });
/** « mi-janvier », « début février », « fin mars ». */
function epoque(date) {
  const d = depuisTexte(date);
  const j = d.getDate();
  const moment = j <= 10 ? 'début' : j <= 20 ? 'mi-' : 'fin';
  const mois = fmtMois.format(d);
  return moment === 'mi-' ? `mi-${mois}` : `${moment} ${mois}`;
}

const fmtDate = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });

export function carteBois(ctx) {
  const zone = el('div');
  const message = el('p', { class: 'resultat-test', role: 'status' });
  const aujourdhui = ctx.aujourdhui;

  const dateLivraison = el('input', { type: 'date', id: 'bois-date', class: 'champ', max: aujourdhui, value: aujourdhui });
  const steres = el('input', { type: 'text', id: 'bois-steres', class: 'champ', inputmode: 'decimal', placeholder: 'ex. 4' });
  const alerte = el('p', { class: 'avertissement', hidden: true }, 'Indique un nombre de stères (ex. 4 ou 2,5).');
  const formulaire = el('form', { class: 'formulaire-boss', hidden: true },
    el('div', { class: 'deux-colonnes' },
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'bois-date' }, 'Date'), dateLivraison),
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'bois-steres' }, 'Stères'), steres)),
    alerte,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'submit', class: 'bouton' }, 'Ajouter'),
      el('button', { type: 'button', class: 'bouton discret', onClick: () => { formulaire.hidden = true; } }, 'Annuler')));
  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Number(steres.value.trim().replace(',', '.'));
    const ok = Number.isFinite(v) && v > 0 && v <= 100 && /^\d{4}-\d{2}-\d{2}$/.test(dateLivraison.value);
    alerte.hidden = ok;
    if (!ok) return;
    clac();
    await ctx.bois.ajouter(dateLivraison.value, Math.round(v * 10) / 10);
    formulaire.hidden = true;
    steres.value = '';
    dessiner();
  });

  async function dessiner() {
    const [livraisons, fiches] = await Promise.all([ctx.bois.liste(), ctx.fiches()]);
    const e = etatBois({ livraisons, fiches, reports: ctx.reportsSaisons, hiver: ctx.hiver, aujourdhui });
    const corps = [];
    if (!e.fenetre.length) {
      corps.push(el('p', { class: 'etat-vide' }, e.depuis
        ? `Stock vide depuis le ${fmtDate.format(depuisTexte(e.depuis))}. Note la prochaine livraison.`
        : 'Aucune livraison notée. Ajoute ta dernière livraison de bois pour suivre la réserve.'));
    } else {
      let epuisement = 'Pas de feu ces 14 derniers jours : la réserve ne baisse pas.';
      if (e.reste <= 0) epuisement = 'Selon le calcul, la réserve est épuisée. Si ce n’est pas le cas, l’estimation s’affinera quand tu signaleras le stock vide.';
      else if (e.rythme > 0) {
        const jours = Math.ceil(e.reste / e.rythme);
        epuisement = jours > 365 ? 'Pour plus d’un an au rythme actuel.' : `Jusqu’à ${epoque(decaler(aujourdhui, jours))} au rythme actuel.`;
      }
      corps.push(el('div', { class: 'cagnotte' },
        reservoir(e.total ? e.reste / e.total : 0),
        el('div', { class: 'cagnotte-texte' },
          el('p', { class: 'cagnotte-montant' }, el('strong', {}, `≈ ${Math.round(e.reste)} feux`)),
          el('p', { class: 'discret' }, `${ent.format(e.steres)} stère${e.steres > 1 ? 's' : ''} × ${ent.format(e.fps)} feux · ${Math.round(e.feux)} feux faits depuis`),
          el('p', { class: 'cagnotte-reste' }, epuisement))));
      corps.push(el('ul', { class: 'liste-tentations liste-bois' }, ...e.fenetre.map((l) => el('li', { class: 'tentation' },
        icone('buche', 'petite'),
        el('span', { class: 'tentation-quoi' }, `Livraison du ${fmtDate.format(depuisTexte(l.date))}`),
        el('span', { class: 'tentation-montant' }, `${ent.format(l.steres)} st.`),
        el('button', {
          type: 'button', class: 'bouton-rond petit', 'aria-label': `Supprimer la livraison du ${fmtDate.format(depuisTexte(l.date))}`,
          onClick: async () => { if (!confirm('Supprimer cette livraison ?')) return; await ctx.bois.supprimer(l.date); dessiner(); },
        }, icone('corbeille'))))));
    }
    const boutonVide = e.fenetre.length ? el('button', {
      type: 'button', class: 'bouton petit discret bouton-stock-vide', onClick: async () => {
        if (!confirm('Le stock de bois est vide ? L’app recalcule le nombre de feux par stère avec les feux faits depuis la livraison.')) return;
        const r = await ctx.bois.stockVide(e);
        message.className = 'resultat-test succes';
        message.textContent = r;
        dessiner();
      },
    }, 'Stock vide') : null;
    zone.replaceChildren(...corps,
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton', onClick: () => { formulaire.hidden = false; steres.focus(); } }, icone('plus'), 'Livraison de bois'),
        boutonVide),
      formulaire,
      message);
  }
  dessiner();
  return carte('La réserve de bois', zone);
}

/** « Stock vide » : affine le nombre de feux par stère et repart de zéro. Renvoie un message. */
export async function signalerStockVide(e, aujourdhui) {
  let texte = 'Noté : stock vide.';
  if (e.steres > 0 && e.feux > 0) {
    const fps = Math.round((e.feux / e.steres) * 10) / 10;
    await definirReglage('feuxParStere', fps);
    texte = `Noté. Nouvelle estimation : ${ent.format(fps)} feux par stère.`;
  }
  const vides = [...new Set([...datesStockVide(), aujourdhui])].sort();
  await definirReglage('boisVides', JSON.stringify(vides));
  return texte;
}
