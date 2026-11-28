/* Bilan du dimanche : la semaine du lundi au dimanche, en un écran.
   S'ouvre tout seul le dimanche à la première ouverture après l'heure du soir (une fois),
   et depuis l'Historique pour n'importe quelle semaine passée. */
import { el, svg, icone } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte, decaler, lundiDe, estLeSoir } from './jour.js';
import { reglage, definirReglage } from './reglages.js';
import { LIBELLES } from './donnees.js';
import { calculerSeries, plaque, SERIES } from './series.js';
import { odometre } from './odometre.js';
import { nomsCuisine } from './whatsup.js';
import { formatDuree, moyenneChamp } from './durees.js';
import { scoreTentations, chf } from './boss.js';
import { evaluerDefi } from './defis.js';
import { plaqueDefi, nomMois } from './carte-defi.js';

const fmt = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 1 });
const fmtJour = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long' });
const fmtJourAn = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtCourt = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric' });
const nombre = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0);
const pluriel = (n, mot) => `${fmt.format(n)} ${mot}${n > 1 ? 's' : ''}`;
const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Ouverture automatique : le dimanche, à partir de l'heure du soir, une seule fois. */
export async function bilanAutomatique({ aujourdhui, heureSoir, ...options }) {
  if (depuisTexte(aujourdhui).getDay() !== 0) return;
  if (!estLeSoir(aujourdhui, heureSoir)) return;
  if (reglage('bilanAfficheLe') === aujourdhui) return;
  await definirReglage('bilanAfficheLe', aujourdhui);
  await ouvrirBilan({ semaine: aujourdhui, aujourdhui, ...options });
}

function section(titre, ...contenu) {
  return el('section', { class: 'carte bilan-section' }, el('h2', {}, titre), ...contenu);
}

/* ---------- Humeur de la semaine ---------- */

function graphiqueHumeur(jours, parDate) {
  const L = 300;
  const H = 150;
  const haut = 120;
  const s = svg('svg', { viewBox: `0 0 ${L} ${H}`, class: 'graphique-humeur', role: 'img', 'aria-label': 'Humeur du matin et du soir, du lundi au dimanche' });
  for (const n of [3, 6, 9]) {
    const y = haut - (n / 9) * (haut - 10);
    s.append(svg('line', { x1: 0, x2: L, y1: y, y2: y, class: 'grille' }));
  }
  jours.forEach((d, i) => {
    const f = parDate.get(d) || {};
    const x = i * (L / 7) + 8;
    const barre = (v, dx, classe) => {
      if (v == null) return svg('line', { x1: x + dx, x2: x + dx + 14, y1: haut - 1, y2: haut - 1, class: 'barre-vide' });
      const h = (Number(v) / 9) * (haut - 10);
      return svg('rect', { x: x + dx, y: haut - h, width: 14, height: h, rx: 2, class: classe });
    };
    s.append(barre(f.humeur_matin, 0, 'barre-matin'), barre(f.humeur_soir, 16, 'barre-soir'));
    s.append(svg('text', { x: x + 15, y: H - 10, class: 'jour-lettre' }, JOURS[i]));
  });
  return s;
}

function moyenne(valeurs) {
  const v = valeurs.filter((x) => x != null).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function blocHumeur(jours, parDate) {
  const m = moyenne(jours.map((d) => parDate.get(d)?.humeur_matin));
  const s = moyenne(jours.map((d) => parDate.get(d)?.humeur_soir));
  const ligne = (libelle, classe, v) => el('div', { class: 'moyenne' },
    el('span', { class: 'pastille-couleur ' + classe }),
    el('span', {}, libelle),
    v == null ? el('strong', {}, '—') : el('strong', {}, `${fmt.format(Math.round(v * 10) / 10)} · ${LIBELLES.humeur[Math.round(v) - 1]}`));
  return section('Humeur de la semaine',
    graphiqueHumeur(jours, parDate),
    el('div', { class: 'moyennes' }, ligne('Matin', 'matin', m), ligne('Soir', 'soir', s)));
}

/* ---------- Mots du jour ---------- */

function blocMots(jours, parDate) {
  const fmtJourSemaine = new Intl.DateTimeFormat('fr-CH', { weekday: 'long' });
  const nb = jours.filter((d) => parDate.get(d)?.mot_du_jour).length;
  return section('Mots de la semaine',
    el('ul', { class: 'bilan-mots' }, ...jours.map((d) => {
      const mot = parDate.get(d)?.mot_du_jour;
      return el('li', {},
        el('span', { class: 'mot-jour' }, fmtJourSemaine.format(depuisTexte(d))),
        mot ? el('strong', { class: 'mot' }, mot) : el('span', { class: 'mot vide' }, '—'));
    })),
    nb ? null : el('p', { class: 'etat-vide' }, 'Aucun mot du jour cette semaine.'));
}

/* ---------- Sommeil et écran ---------- */

function blocSommeilEcran(jours, parDate) {
  const fs = jours.map((d) => parDate.get(d)).filter(Boolean);
  const duree = moyenneChamp(fs, 'sommeil_duree_min');
  const qualite = moyenneChamp(fs, 'sommeil_qualite');
  const ecran = moyenneChamp(fs, 'ecran_min');
  const nb = (champ) => fs.filter((f) => f[champ] != null && f[champ] !== '').length;
  const ligne = (libelle, valeur, detail) => el('li', {}, el('span', {}, libelle), el('strong', {}, valeur), detail ? el('small', {}, detail) : null);
  const sur = (n) => (n ? `sur ${n} nuit${n > 1 ? 's' : ''}` : null);
  return section('Sommeil et écran',
    el('ul', { class: 'bilan-moyennes' },
      ligne('Sommeil moyen', duree == null ? '—' : formatDuree(duree), sur(nb('sommeil_duree_min'))),
      ligne('Qualité moyenne', qualite == null ? '—' : `${fmt.format(Math.round(qualite * 10) / 10)} · ${LIBELLES.sommeil[Math.round(qualite) - 1]}`),
      ligne('Écran par jour', ecran == null ? '—' : formatDuree(ecran), nb('ecran_min') ? `sur ${nb('ecran_min')} jour${nb('ecran_min') > 1 ? 's' : ''}` : null)));
}

/* ---------- Événements ---------- */

function blocEvenements(jours, parDate) {
  const evts = jours.map((d) => ({ d, f: parDate.get(d) })).filter(({ f }) => f && (f.evt_appreciation || f.evt_texte));
  const cool = evts.filter(({ f }) => f.evt_appreciation === 'Cool').length;
  const pasCool = evts.filter(({ f }) => f.evt_appreciation === 'Pas cool').length;
  return section('Événements',
    el('p', { class: 'bilan-compte' },
      el('span', { class: 'pastille statique cool' }, `Cool ${cool}`),
      el('span', { class: 'pastille statique pascool' }, `Pas cool ${pasCool}`)),
    evts.length
      ? el('ul', { class: 'bilan-evenements' }, ...evts.map(({ d, f }) => el('li', {},
        el('span', { class: 'resultat-date' }, fmtCourt.format(depuisTexte(d))),
        f.evt_appreciation ? el('span', { class: 'pastille statique ' + (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') }, f.evt_appreciation) : null,
        f.evt_categorie ? el('span', { class: 'pastille statique' }, f.evt_categorie) : null,
        f.evt_texte ? el('span', { class: 'resultat-texte' }, f.evt_texte) : null)))
      : el('p', { class: 'etat-vide' }, 'Aucun événement noté cette semaine.'));
}

/* ---------- Compteurs kilométriques ---------- */

function blocCompteurs(fiches, marches, lundi, dimanche) {
  const jusqua = fiches.filter((f) => f.date <= dimanche);
  const semaine = fiches.filter((f) => f.date >= lundi && f.date <= dimanche);
  const somme = (liste, champ) => liste.reduce((s, f) => s + nombre(f[champ]), 0);
  const km = (liste) => Math.round(liste.reduce((s, m) => s + nombre(m.km), 0) * 10) / 10;
  const marchesJusqua = marches.filter((m) => m.date <= dimanche);
  const marchesSemaine = marches.filter((m) => m.date >= lundi && m.date <= dimanche);
  const ligne = (nom, valeur, options, gain) => el('div', { class: 'bilan-compteur' },
    el('span', { class: 'odometre-libelle' }, nom),
    odometre(valeur, options),
    el('span', { class: 'gain' }, gain));
  return section('Compteurs',
    ligne('Eau', somme(jusqua, 'eau_ml') / 1000, { decimales: 1, unite: 'L', cle: 'bilan-eau', minEntiers: 4 },
      `+ ${fmt.format(Math.round(somme(semaine, 'eau_ml') / 100) / 10)} L cette semaine`),
    ligne('Marche', km(marchesJusqua), { decimales: 1, unite: 'km', cle: 'bilan-marche', minEntiers: 4 },
      `+ ${fmt.format(km(marchesSemaine))} km cette semaine (${pluriel(marchesSemaine.length, 'marche')})`),
    ligne('Pas', somme(jusqua, 'pas'), { cle: 'bilan-pas', minEntiers: 6 },
      `+ ${new Intl.NumberFormat('fr-CH').format(somme(semaine, 'pas'))} pas cette semaine`));
}

/* ---------- Séries ---------- */

function blocSeries(fiches, marches, jour, objectifEau) {
  const s = calculerSeries(fiches, marches, jour, objectifEau);
  const plaques = SERIES.map((x) => plaque(s[x.id], x.nom)).filter(Boolean);
  return section('Séries en cours', ...(plaques.length ? plaques : [el('p', { class: 'etat-vide' }, 'Aucune série de 2 jours ou plus.')]));
}

/* ---------- What's up ---------- */

function blocWhatsUp(jours, parDate) {
  const fs = jours.map((d) => parDate.get(d)).filter(Boolean);
  const chefs = new Map();
  for (const f of fs) for (const n of nomsCuisine(f.cuisine)) chefs.set(n, (chefs.get(n) || 0) + 1);
  const somme = (champ) => fs.reduce((s, f) => s + nombre(f[champ]), 0);
  const compte = (champ, valeur) => fs.filter((f) => f[champ] === valeur).length;
  const ligne = (nomIcone, libelle, valeur) => el('li', {}, icone(nomIcone, 'petite'), el('span', {}, libelle), el('strong', {}, valeur));
  const feux = somme('feux_poele');
  const barbecues = somme('barbecues');
  return section('What’s up',
    el('ul', { class: 'bilan-whatsup' },
      ligne('pilon', 'Aux fourneaux', chefs.size ? [...chefs.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(' · ') : '—'),
      ligne('feuille', 'Repas', `Carnivore ${compte('repas_type', 'carnivore')} · Végétarien ${compte('repas_type', 'vegetarien')}`),
      ligne('mediator', 'Guitare', pluriel(somme('guitare'), 'session')),
      feux || !barbecues ? ligne('flamme', 'Feux de poêle', fmt.format(feux)) : null,
      barbecues ? ligne('gril', 'Barbecues', fmt.format(barbecues)) : null,
      ligne('patte', 'Balades du chien', `${fmt.format(somme('chien_balades'))}${somme('chien_education') ? ` · éducation ${fmt.format(somme('chien_education'))}` : ''}`),
      ligne('casque', 'Rossi (moto)', `${compte('deplacement', 'moto')} jour${compte('deplacement', 'moto') > 1 ? 's' : ''}`),
      ligne('volant', 'Fangio (voiture)', `${compte('deplacement', 'voiture')} jour${compte('deplacement', 'voiture') > 1 ? 's' : ''}`)));
}

/* ---------- Who's the Boss ? et défi du mois ---------- */

function blocBoss(tentations, lundi, dimanche) {
  const s = scoreTentations(tentations.filter((t) => t.date >= lundi && t.date <= dimanche));
  return section('Who’s the Boss ?',
    el('p', { class: 'score-boss bilan' },
      el('span', { class: 'equipe' }, 'Mister Me'), el('strong', {}, `${s.me} – ${s.plaisir}`), el('span', { class: 'equipe' }, 'Le plaisir')),
    el('p', { class: 'bilan-revolut' }, `Go to Revolut cette semaine : `, el('strong', {}, chf(s.revolut))));
}

function blocDefi(defi, donnees, jusqua) {
  if (!defi) return null;
  return section(`Défi de ${nomMois(defi.mois).split(' ')[0]}`, plaqueDefi(defi, evaluerDefi(defi, donnees, jusqua)));
}

/* ---------- Écran ---------- */

/**
 * @param {object} o
 * @param {string} o.semaine      une date de la semaine voulue (AAAA-MM-JJ)
 * @param {string} o.aujourdhui
 * @param {number} o.objectifEau
 */
export async function ouvrirBilan({ semaine, aujourdhui, objectifEau }) {
  const { corps } = ouvrirEcran({ titre: 'Bilan du dimanche', classe: 'ecran-bilan' });
  const titreSemaine = el('p', { class: 'bilan-semaine' });
  const precedente = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Semaine précédente' }, icone('gauche'));
  const suivante = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Semaine suivante' }, icone('droite'));
  const zone = el('div', { class: 'bilan-contenu' });
  let lundi = lundiDe(semaine);

  async function dessiner() {
    const dimanche = decaler(lundi, 6);
    const jours = Array.from({ length: 7 }, (_, i) => decaler(lundi, i));
    titreSemaine.textContent = `Semaine du ${fmtJour.format(depuisTexte(lundi))} au ${fmtJourAn.format(depuisTexte(dimanche))}`;
    suivante.disabled = decaler(lundi, 7) > aujourdhui;
    const [fiches, marches, tentations] = await Promise.all([TMDB.tout('fiches'), TMDB.tout('marches'), TMDB.tout('tentations')]);
    const jusqua = dimanche < aujourdhui ? dimanche : aujourdhui;
    const defi = await TMDB.lire('defis', jusqua.slice(0, 7));
    const parDate = new Map(fiches.map((f) => [f.date, f]));
    const finSeries = dimanche < aujourdhui ? dimanche : aujourdhui;
    zone.replaceChildren(
      blocHumeur(jours, parDate),
      blocMots(jours, parDate),
      blocSommeilEcran(jours, parDate),
      blocEvenements(jours, parDate),
      blocCompteurs(fiches, marches, lundi, dimanche),
      blocSeries(fiches, marches, finSeries, objectifEau),
      blocWhatsUp(jours, parDate),
      blocBoss(tentations, lundi, dimanche),
      blocDefi(defi, { fiches, marches, tentations, objectifEau }, jusqua) || '');
  }
  precedente.addEventListener('click', () => { lundi = decaler(lundi, -7); dessiner(); });
  suivante.addEventListener('click', () => { lundi = decaler(lundi, 7); dessiner(); });

  corps.append(el('div', { class: 'bilan-navigation' }, precedente, titreSemaine, suivante), zone);
  await dessiner();
}
