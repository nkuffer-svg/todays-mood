/* Écran affiché après un partage depuis l'Enregistreur :
   aperçu, choix de la destination, puis « remplacer » ou « ajouter à la suite » si le champ contient déjà du texte. */
import { el } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { formatLong } from './jour.js';

const fmtNombre = new Intl.NumberFormat('fr-CH');
const pluriel = (n, mot) => `${fmtNombre.format(n)} ${mot}${n > 1 ? 's' : ''}`;

/** Choisit le contenu à garder : texte et fichier peuvent arriver ensemble ; on garde le plus complet. */
function contenuPrincipal(partage) {
  const elements = (partage.elements || []).filter((e) => e.contenu && e.contenu.trim());
  if (!elements.length) return null;
  return elements.reduce((a, b) => (b.contenu.trim().length > a.contenu.trim().length ? b : a));
}

export async function traiterPartage({ id, erreur, jour, chargerFiche, enregistrer, ouvrirRecit }) {
  const { corps, fermer } = ouvrirEcran({ titre: 'Transcription reçue' });

  if (erreur) {
    corps.append(el('p', { class: 'erreur' }, 'Le partage n’a pas pu être lu : ' + erreur));
    return;
  }
  const partage = id ? await TMDB.lire('partages', id) : null;
  const element = partage && contenuPrincipal(partage);
  if (!element) {
    corps.append(el('p', { class: 'etat-vide' }, 'Ce partage ne contient pas de texte.'));
    return;
  }

  const texte = element.contenu.trim();
  const date = jour();
  const nbMots = (texte.match(/\S+/g) || []).length;

  const zoneQuestion = el('div', { class: 'question-partage' });
  corps.append(
    el('p', { class: 'meta-partage' },
      el('span', { class: 'pastille statique' }, element.forme === 'fichier' ? 'Fichier' : 'Texte'),
      el('span', { class: 'pastille statique' }, pluriel([...texte].length, 'caractère')),
      el('span', { class: 'pastille statique' }, pluriel(nbMots, 'mot'))),
    el('pre', { class: 'apercu' }, texte),
    el('p', { class: 'discret' }, 'Sera ajouté à la fiche du ', el('strong', {}, formatLong(date, date).toLowerCase()), '.'),
    zoneQuestion,
  );

  const boutonRecit = el('button', { type: 'button', class: 'bouton grand' }, 'Récit du jour');
  const boutonMyLove = el('button', { type: 'button', class: 'bouton grand discret', disabled: true }, 'My Love');
  zoneQuestion.append(
    el('h3', {}, 'Où ranger ce texte ?'),
    el('div', { class: 'rangee-boutons' }, boutonRecit, boutonMyLove),
    el('p', { class: 'discret' }, 'My Love sera disponible à l’étape 5.'));

  async function ranger(mode) {
    const fiche = await chargerFiche(date);
    const actuel = (fiche.recit || '').trim();
    await enregistrer(date, { recit: mode === 'suite' && actuel ? `${actuel}\n\n${texte}` : texte });
    partage.utilise = { champ: 'recit', le: new Date().toISOString() };
    await TMDB.ecrire('partages', partage);
    fermer();
    await ouvrirRecit();
  }

  boutonRecit.addEventListener('click', async () => {
    const fiche = await chargerFiche(date);
    if (!(fiche.recit || '').trim()) return ranger('remplacer');
    zoneQuestion.replaceChildren(
      el('h3', {}, 'Le Récit de ce jour contient déjà du texte'),
      el('pre', { class: 'apercu petit' }, fiche.recit.trim()),
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton grand', onClick: () => ranger('suite') }, 'Ajouter à la suite'),
        el('button', { type: 'button', class: 'bouton grand discret', onClick: () => ranger('remplacer') }, 'Remplacer')),
      el('button', { type: 'button', class: 'bouton petit discret annuler', onClick: fermer }, 'Annuler'));
  });
}
