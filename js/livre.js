/* Livre de bord annuel (version 5 B) : un document Word « Garage vintage » qui résume une année.
   Même méthode que l'export OneNote (js/docx.js, fichier .docx créé sur le téléphone).
   Jamais de contenu de l'onglet Perso (énergie sexuelle, Happy Dicky, My Love) : ces champs ne sont pas lus ici. */
import { el } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte, decaler } from './jour.js';
import { creerDocx } from './docx.js';
import { LIBELLES } from './donnees.js';
import { motsUtilises } from './mots.js';
import { nomsCuisine } from './whatsup.js';
import { ventDe, estBise } from './meteo.js';
import { calculerMedailles } from './medailles.js';
import { nomMois } from './carte-defi.js';

const n = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const z = (v) => n(v) ?? 0;
const un = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ent = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });
const chf = new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const fmtLong = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCourt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long' });
const fmtMoisSeul = new Intl.DateTimeFormat('fr-CH', { month: 'long' });
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const jourLong = (d) => majuscule(fmtLong.format(depuisTexte(d)));
const jourCourt = (d) => fmtCourt.format(depuisTexte(d));
const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const texteHumeur = (m) => (m == null ? '—' : `${un.format(m)} · ${LIBELLES.humeur[Math.min(9, Math.max(1, Math.round(m))) - 1]}`);

function humeurDuJour(f) {
  const v = [f.humeur_matin, f.humeur_soir].map(n).filter((x) => x != null);
  return v.length ? moyenne(v) : null;
}
const biseDuJour = (f) => [8, 16].some((h) => { const v = ventDe(f, h); return estBise(v.vent, v.dir); });

/** Les blocs du document pour l'année `annee` (« 2026 »). */
export function blocsLivre(annee, d) {
  const fiches = d.fiches.filter((f) => f.date.startsWith(annee)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const marches = d.marches.filter((m) => m.date.startsWith(annee));
  const tentations = d.tentations.filter((t) => t.date.startsWith(annee));
  const b = [];

  /* Couverture */
  b.push(
    { type: 'couverture', texte: 'Livre de bord' },
    { type: 'annee', texte: annee },
    { type: 'texte', texte: 'Today’s Mood — carnet de route de l’année', centre: true },
    { type: 'meta', centre: true, texte: fiches.length
      ? `${fiches.length} jour${fiches.length > 1 ? 's' : ''} noté${fiches.length > 1 ? 's' : ''}, du ${jourCourt(fiches[0].date)} au ${jourCourt(fiches[fiches.length - 1].date)} ${annee}`
      : 'Aucun jour noté cette année' },
    { type: 'saut' });
  if (!fiches.length) return b;

  /* Humeur mois par mois */
  const lignesMois = [];
  for (let m = 1; m <= 12; m++) {
    const mois = `${annee}-${String(m).padStart(2, '0')}`;
    const fs = fiches.filter((f) => f.date.startsWith(mois));
    if (!fs.length) continue;
    const matin = moyenne(fs.map((f) => n(f.humeur_matin)).filter((x) => x != null));
    const soir = moyenne(fs.map((f) => n(f.humeur_soir)).filter((x) => x != null));
    lignesMois.push([majuscule(fmtMoisSeul.format(depuisTexte(mois + '-01'))), texteHumeur(matin), texteHumeur(soir), ent.format(fs.length)]);
  }
  b.push({ type: 'titre1', texte: 'L’humeur, mois par mois' }, { type: 'tableau', entete: ['Mois', 'Matin', 'Soir', 'Jours notés'], lignes: lignesMois });

  /* Les plus beaux jours */
  const beaux = fiches.filter((f) => humeurDuJour(f) != null)
    .sort((a, c) => humeurDuJour(c) - humeurDuJour(a) || (c.evt_appreciation === 'Cool') - (a.evt_appreciation === 'Cool') || (a.date < c.date ? -1 : 1))
    .slice(0, 5);
  b.push({ type: 'titre1', texte: 'Les plus beaux jours' });
  for (const f of beaux) {
    b.push({ type: 'titre2', texte: `${jourLong(f.date)} — ${texteHumeur(humeurDuJour(f))}` });
    const lignes = [`Humeur : matin ${f.humeur_matin ?? '–'} → soir ${f.humeur_soir ?? '–'}`];
    if (f.mot_du_jour) lignes.push(`Mot du jour : ${f.mot_du_jour}`);
    if (f.evt_appreciation || f.evt_categorie || f.evt_texte) {
      lignes.push(`Événement : ${[f.evt_appreciation, f.evt_categorie].filter(Boolean).join(' · ')}${f.evt_texte ? ` — « ${f.evt_texte} »` : ''}`);
    }
    b.push({ type: 'texte', texte: lignes.join('\n') });
  }

  /* Mots du jour */
  const mots = motsUtilises(fiches).slice(0, 10);
  b.push({ type: 'titre1', texte: 'Les mots du jour les plus fréquents' });
  b.push(mots.length
    ? { type: 'tableau', entete: ['Mot', 'Fois'], lignes: mots.map((m) => [m.mot, ent.format(m.nombre)]) }
    : { type: 'meta', texte: 'Aucun mot du jour cette année.' });

  /* Grands totaux */
  const somme = (champ) => fiches.reduce((s, f) => s + z(f[champ]), 0);
  const km = marches.reduce((s, m) => s + z(m.km), 0);
  const revolut = tentations.reduce((s, t) => s + (t.gagnant === 'me' ? z(t.montant_chf) : 0), 0);
  b.push({ type: 'titre1', texte: 'Les grands totaux' }, {
    type: 'tableau', entete: ['Compteur', 'Total de l’année'], lignes: [
      ['Marche', `${un.format(km)} km (${ent.format(marches.length)} marches)`],
      ['Pas', ent.format(somme('pas'))],
      ['Eau', `${un.format(somme('eau_ml') / 1000)} L`],
      ['Feux de poêle', ent.format(somme('feux_poele'))],
      ['Barbecues', ent.format(somme('barbecues'))],
      ['Sessions de guitare', ent.format(somme('guitare'))],
      ['Balades du chien', ent.format(somme('chien_balades'))],
      ['Go to Revolut', chf.format(revolut)],
    ],
  });

  /* Tableau des chefs */
  const chefs = new Map();
  for (const f of fiches) for (const nom of nomsCuisine(f.cuisine)) chefs.set(nom, (chefs.get(nom) || 0) + 1);
  const classement = [...chefs.entries()].sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0]));
  b.push({ type: 'titre1', texte: 'Le tableau des chefs de l’année' });
  b.push(classement.length
    ? { type: 'tableau', entete: ['Position', 'Chef', 'Repas'], lignes: classement.map(([nom, k], i) => [`P${i + 1}`, nom, ent.format(k)]) }
    : { type: 'meta', texte: 'Aucun repas noté.' });
  const carni = fiches.filter((f) => f.repas_type === 'carnivore').length;
  const vege = fiches.filter((f) => f.repas_type === 'vegetarien').length;
  if (carni || vege) b.push({ type: 'texte', texte: `Carnivore ${ent.format(carni)} · Végétarien ${ent.format(vege)}` });

  /* Who's the Boss ? */
  const me = tentations.filter((t) => t.gagnant === 'me');
  const plaisir = tentations.filter((t) => t.gagnant === 'plaisir');
  const belle = [...me].filter((t) => z(t.montant_chf) > 0).sort((a, c) => z(c.montant_chf) - z(a.montant_chf))[0];
  b.push({ type: 'titre1', texte: 'Who’s the Boss ?' },
    { type: 'texte', texte: `Mister Me ${me.length} – Le plaisir ${plaisir.length}` },
    { type: 'texte', texte: belle
      ? `Plus belle victoire de Mister Me : ${chf.format(z(belle.montant_chf))}${belle.quoi ? ` — ${belle.quoi}` : ''} (${jourCourt(belle.date)})`
      : 'Pas de victoire avec un montant cette année.' });

  /* Défis */
  const defis = d.defis.filter((x) => x.mois.startsWith(annee)).sort((a, c) => (a.mois < c.mois ? -1 : 1));
  const reussis = defis.filter((x) => x.resultat === 'reussi');
  b.push({ type: 'titre1', texte: 'Les défis réussis' });
  b.push(reussis.length
    ? { type: 'tableau', entete: ['Mois', 'Défi'], lignes: reussis.map((x) => [majuscule(nomMois(x.mois)), x.libelle]) }
    : { type: 'meta', texte: defis.length ? 'Aucun défi réussi cette année — l’an prochain !' : 'Pas de défi cette année.' });

  /* Médailles */
  const toutes = new Map(calculerMedailles(d).map((m) => [m.id, m]));
  const obtenues = d.medaillesObtenues.filter((m) => String(m.date).startsWith(annee) && toutes.has(m.id)).sort((a, c) => (a.date < c.date ? -1 : 1));
  b.push({ type: 'titre1', texte: 'Les médailles du garage' });
  b.push(obtenues.length
    ? { type: 'tableau', entete: ['Médaille', 'Obtenue le'], lignes: obtenues.map((m) => [toutes.get(m.id).nom, jourCourt(m.date)]) }
    : { type: 'meta', texte: 'Pas de médaille cette année.' });

  /* Le feu */
  const lignesFeu = [];
  for (const a of [Number(annee) - 1, Number(annee)]) {
    const debut = `${a}-${d.hiver.debut}`;
    const fin = `${a + 1}-${d.hiver.fin}`;
    const feux = d.fiches.filter((f) => z(f.feux_poele) > 0 && f.date >= debut && f.date <= fin).map((f) => f.date).sort();
    const report = d.reports.find((r) => r.type === 'hiver' && r.saison === `${a}-${a + 1}`);
    const premier = report?.premier || feux[0];
    if (!premier || (premier.slice(0, 4) !== annee && (feux[feux.length - 1] || '').slice(0, 4) !== annee)) continue;
    lignesFeu.push([`Hiver ${a}-${a + 1}`, premier ? jourCourt(premier) + ' ' + premier.slice(0, 4) : '—', feux.length ? jourCourt(feux[feux.length - 1]) + ' ' + feux[feux.length - 1].slice(0, 4) : '—']);
  }
  b.push({ type: 'titre1', texte: 'Le feu' });
  b.push(lignesFeu.length
    ? { type: 'tableau', entete: ['Saison', 'Premier feu', 'Dernier feu'], lignes: lignesFeu }
    : { type: 'meta', texte: 'Pas de feu de poêle noté.' });

  /* Météo marquante */
  const avec = (champ) => fiches.filter((f) => n(f[champ]) != null);
  const chaud = avec('meteo_tmax').sort((a, c) => n(c.meteo_tmax) - n(a.meteo_tmax))[0];
  const froid = avec('meteo_tmin').sort((a, c) => n(a.meteo_tmin) - n(c.meteo_tmin))[0];
  const pluie = fiches.filter((f) => n(f.nt_pluie_jour) != null || n(f.meteo_pluie_mm) != null)
    .sort((a, c) => (n(c.nt_pluie_jour) ?? n(c.meteo_pluie_mm)) - (n(a.nt_pluie_jour) ?? n(a.meteo_pluie_mm)))[0];
  const bise = fiches.filter(biseDuJour);
  const lignesMeteo = [];
  if (chaud) lignesMeteo.push(['Le jour le plus chaud', `${jourLong(chaud.date)} — ${un.format(n(chaud.meteo_tmax))}°`]);
  if (froid) lignesMeteo.push(['Le jour le plus froid', `${jourLong(froid.date)} — ${un.format(n(froid.meteo_tmin))}°`]);
  if (pluie && (n(pluie.nt_pluie_jour) ?? n(pluie.meteo_pluie_mm)) > 0) lignesMeteo.push(['Le jour le plus pluvieux', `${jourLong(pluie.date)} — ${un.format(n(pluie.nt_pluie_jour) ?? n(pluie.meteo_pluie_mm))} mm`]);
  lignesMeteo.push(['Jours de bise', bise.length ? `${bise.length} (dont le ${jourCourt(bise[0].date)})` : 'aucun']);
  b.push({ type: 'titre1', texte: 'La météo marquante' }, { type: 'tableau', lignes: lignesMeteo });

  b.push({ type: 'meta', centre: true, texte: `— Fin du livre de bord ${annee} · Today’s Mood —` });
  return b;
}

function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Crée le fichier et le télécharge (ou l'envoie vers une app). Renvoie un message. */
async function exporter(annee, donnees, viaPartage) {
  const d = await donnees();
  const blob = creerDocx(blocsLivre(annee, d));
  const nom = `todays-mood-livre-de-bord-${annee}.docx`;
  const fichier = new File([blob], nom, { type: blob.type });
  if (viaPartage && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: `Livre de bord ${annee}` });
      return 'Livre de bord envoyé.';
    } catch (err) {
      if (err.name === 'AbortError') return '';
    }
  }
  telecharger(blob, nom);
  return `Fichier « ${nom} » dans tes Téléchargements.`;
}

function boutons(annee, donnees, message) {
  const faire = (viaPartage) => async () => {
    message.className = 'resultat-test';
    message.textContent = 'Préparation du livre…';
    try {
      const texte = await exporter(annee(), donnees, viaPartage);
      message.className = 'resultat-test succes';
      message.textContent = texte;
    } catch (err) {
      message.className = 'resultat-test erreur';
      message.textContent = 'Impossible de créer le livre : ' + err.message;
    }
  };
  const peutPartager = !!navigator.canShare?.({ files: [new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })] });
  return el('div', { class: 'rangee-boutons' },
    el('button', { type: 'button', class: 'bouton', onClick: faire(false) }, 'Télécharger (.docx)'),
    peutPartager ? el('button', { type: 'button', class: 'bouton discret', onClick: faire(true) }, 'Envoyer vers une app') : null);
}

/** Depuis l'Historique : n'importe quelle année passée ou en cours. */
export async function ouvrirLivre({ annee, donnees }) {
  const { corps } = ouvrirEcran({ titre: 'Livre de bord', classe: 'ecran-livre' });
  const d = await donnees();
  const annees = [...new Set([annee, ...d.fiches.map((f) => f.date.slice(0, 4))])].sort().reverse();
  const choix = el('select', { id: 'livre-annee', class: 'champ' }, ...annees.map((a) => el('option', { value: a }, a)));
  choix.value = annee;
  const message = el('p', { class: 'resultat-test', role: 'status' });
  corps.append(
    el('p', { class: 'discret' }, 'Un document Word qui résume l’année : humeur mois par mois, plus beaux jours, mots du jour, grands totaux, chefs, Mister Me, défis, médailles, feux et météo marquante. Rien de l’onglet Perso.'),
    el('label', { class: 'sous-titre-champ', for: 'livre-annee' }, 'Année'),
    choix,
    boutons(() => choix.value, donnees, message),
    message);
}

/** Le 31 décembre : « Ton livre de bord de l'année est prêt ». */
export function proposerLivre({ annee, donnees }) {
  const { corps, fermer } = ouvrirEcran({ titre: 'Livre de bord', classe: 'ecran-livre ecran-defi' });
  const message = el('p', { class: 'resultat-test', role: 'status' });
  corps.append(
    el('p', { class: 'annonce-defi-mois' }, `31 décembre ${annee}`),
    el('p', { class: 'annonce-defi-resultat reussi' }, 'Ton livre de bord de l’année est prêt'),
    el('p', { class: 'annonce-defi-phrase' }, 'Une année de route, de feux, de bise et de mots du jour, dans un document à garder.'),
    boutons(() => annee, donnees, message),
    message,
    el('div', { class: 'rangee-boutons' }, el('button', { type: 'button', class: 'bouton discret', onClick: () => fermer() }, 'Plus tard (il reste dans l’Historique)')));
}
