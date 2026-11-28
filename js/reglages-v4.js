/* Réglages de la version 4 B : objectif de cagnotte (Who's the Boss ?) et défi du mois. */
import { el, carte, segments } from './ui.js';
import { reglage, definirReglage } from './reglages.js';
import { planifier } from './sync.js';
import { decaler, simulationActive } from './jour.js';
import { CATALOGUE, TYPES, libelleParDefaut } from './defis.js';
import { nomMois } from './carte-defi.js';
import { chf } from './boss.js';

const lireNombre = (t) => {
  const s = String(t ?? '').trim().replace(/[’'\s]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
};

/* ---------- Cagnotte ---------- */

export function carteCagnotte({ reglagesModifies, aujourdhui }) {
  const nom = el('input', { id: 'cagnotte-nom', class: 'champ', type: 'text', maxlength: '40', placeholder: 'Ex. Nouvelle selle', value: reglage('cagnotteNom') || '' });
  const montant = el('input', {
    id: 'cagnotte-montant', class: 'champ', type: 'text', inputmode: 'decimal', placeholder: 'Ex. 1200',
    value: reglage('cagnotteMontant') != null && reglage('cagnotteMontant') !== '' ? String(reglage('cagnotteMontant')) : '',
  });
  const debut = el('input', { id: 'cagnotte-debut', class: 'champ', type: 'date', max: aujourdhui, value: reglage('cagnotteDebut') || '' });
  const alerte = el('p', { class: 'avertissement', hidden: true }, 'Montant invalide (ex. 1200 ou 850.50).');
  const etat = el('p', { class: 'discret' });

  const majEtat = () => {
    const m = Number(reglage('cagnotteMontant'));
    etat.textContent = m > 0
      ? `Objectif : ${chf(m)}${reglage('cagnotteNom') ? ` pour « ${reglage('cagnotteNom')} »` : ''}. Le réservoir compte les Go to Revolut depuis la date de début.`
      : 'Aucun objectif pour l’instant.';
  };

  async function enregistrer() {
    const m = lireNombre(montant.value);
    const ok = m === null || (Number.isFinite(m) && m > 0);
    alerte.hidden = ok;
    if (!ok) return;
    await definirReglage('cagnotteNom', nom.value.trim() || null);
    await definirReglage('cagnotteMontant', m === null ? null : Math.round(m * 100) / 100);
    // Un nouvel objectif commence aujourd'hui (modifiable).
    if (m !== null && !debut.value) debut.value = aujourdhui;
    await definirReglage('cagnotteDebut', debut.value || null);
    majEtat();
    reglagesModifies();
  }
  for (const c of [nom, montant, debut]) c.addEventListener('change', enregistrer);

  const nouveau = el('button', {
    type: 'button', class: 'bouton petit discret', onClick: async () => {
      if (reglage('cagnotteMontant') && !confirm('Remplacer l’objectif actuel par un nouveau, qui repart de zéro aujourd’hui ?')) return;
      nom.value = '';
      montant.value = '';
      debut.value = aujourdhui;
      await enregistrer();
      nom.focus();
    },
  }, 'Nouvel objectif');
  majEtat();
  return carte('Cagnotte (Who’s the Boss ?)',
    etat,
    el('label', { class: 'sous-titre-champ', for: 'cagnotte-nom' }, 'Nom de l’objectif'), nom,
    el('div', { class: 'deux-colonnes' },
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'cagnotte-montant' }, 'Montant (CHF)'), montant),
      el('div', {}, el('label', { class: 'sous-titre-champ', for: 'cagnotte-debut' }, 'Depuis le'), debut)),
    alerte,
    el('div', { class: 'rangee-boutons' }, nouveau));
}

/* ---------- Défi du mois ---------- */

export function carteDefi({ reglagesModifies, aujourdhui }) {
  const moisActuel = aujourdhui.slice(0, 7);
  const moisSuivant = decaler(`${moisActuel}-28`, 7).slice(0, 7);
  let mois = moisActuel;
  const zone = el('div');
  const message = el('p', { class: 'resultat-test', role: 'status' });

  async function dessiner() {
    const existant = await TMDB.lire('defis', mois);
    let type = existant?.type || 'fois';
    let libelleTouche = !!existant;

    const choixCompteur = el('select', { id: 'defi-compteur', class: 'champ' });
    const cible = el('input', { id: 'defi-cible', class: 'champ', type: 'text', inputmode: 'decimal', value: existant?.cible != null ? String(existant.cible) : '20' });
    const zoneCible = el('div', {}, el('label', { class: 'sous-titre-champ', for: 'defi-cible' }, 'Combien de fois ?'), cible);
    const libelle = el('input', { id: 'defi-libelle', class: 'champ', type: 'text', maxlength: '60', value: existant?.libelle || '' });
    libelle.addEventListener('input', () => { libelleTouche = libelle.value.trim() !== ''; });

    const proposer = () => {
      if (!libelleTouche) libelle.value = libelleParDefaut({ type, compteur: choixCompteur.value, cible: lireNombre(cible.value) || 0 });
    };
    const remplirCompteurs = (garder) => {
      choixCompteur.replaceChildren(...Object.entries(CATALOGUE[type]).map(([cle, c]) => el('option', { value: cle }, c.nom)));
      if (garder && CATALOGUE[type][garder]) choixCompteur.value = garder;
      zoneCible.hidden = type !== 'fois';
      zoneCible.querySelector('label').textContent = choixCompteur.value === 'revolut' ? 'Montant à atteindre (CHF)' : choixCompteur.value === 'km' ? 'Combien de kilomètres ?' : 'Combien de fois ?';
      proposer();
    };
    choixCompteur.addEventListener('change', () => remplirCompteurs(choixCompteur.value));
    cible.addEventListener('input', proposer);

    const choixType = segments({
      etiquette: 'Type de défi', obligatoire: true, valeur: type, options: TYPES,
      onChange: (v) => { type = v; remplirCompteurs(); },
    });
    remplirCompteurs(existant?.compteur);

    const enregistrer = el('button', {
      type: 'button', class: 'bouton', onClick: async () => {
        const c = type === 'fois' ? lireNombre(cible.value) : null;
        if (type === 'fois' && !(c > 0)) { message.className = 'resultat-test erreur'; message.textContent = 'Indique un nombre plus grand que 0.'; return; }
        if (simulationActive()) { message.className = 'resultat-test erreur'; message.textContent = 'Simulation en cours : rien n’est enregistré.'; return; }
        proposer();
        await TMDB.ecrireEnregistrement('defis', {
          mois, type, compteur: choixCompteur.value, cible: c, libelle: libelle.value.trim() || libelleParDefaut({ type, compteur: choixCompteur.value, cible: c }), resultat: null,
        });
        planifier();
        message.className = 'resultat-test succes';
        message.textContent = `Défi de ${nomMois(mois)} enregistré.`;
        reglagesModifies();
        dessiner();
      },
    }, existant ? 'Modifier le défi' : 'Enregistrer le défi');
    const supprimer = existant ? el('button', {
      type: 'button', class: 'bouton discret', onClick: async () => {
        if (!confirm(`Supprimer le défi de ${nomMois(mois)} ?`)) return;
        if (simulationActive()) return;
        await TMDB.supprimerEnregistrement('defis', mois);
        planifier();
        message.className = 'resultat-test';
        message.textContent = 'Défi supprimé.';
        reglagesModifies();
        dessiner();
      },
    }, 'Supprimer') : null;

    zone.replaceChildren(
      el('p', { class: 'discret' }, existant
        ? `Défi de ${nomMois(mois)} : « ${existant.libelle} ».`
        : `Pas encore de défi pour ${nomMois(mois)}.`),
      el('p', { class: 'sous-titre-champ' }, 'Type'), choixType,
      el('label', { class: 'sous-titre-champ', for: 'defi-compteur' }, type === 'chaque_jour' ? 'Condition' : 'Compteur'), choixCompteur,
      zoneCible,
      el('label', { class: 'sous-titre-champ', for: 'defi-libelle' }, 'Libellé'), libelle,
      el('p', { class: 'discret' }, 'Le défi compte pour tout le mois, du 1er au dernier jour. « Jamais en semaine » : du lundi au vendredi.'),
      el('div', { class: 'rangee-boutons' }, enregistrer, supprimer));
  }

  const choixMois = segments({
    etiquette: 'Mois du défi', obligatoire: true, valeur: mois,
    options: [{ valeur: moisActuel, libelle: nomMois(moisActuel).split(' ')[0] }, { valeur: moisSuivant, libelle: nomMois(moisSuivant).split(' ')[0] }],
    onChange: (v) => { mois = v; message.textContent = ''; dessiner(); },
  });
  dessiner();
  return carte('Défi du mois', el('p', { class: 'sous-titre-champ' }, 'Mois'), choixMois, zone, message);
}
