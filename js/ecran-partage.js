/* Écran affiché après un partage depuis l'Enregistreur :
   aperçu, choix de la destination, puis « remplacer » ou « ajouter à la suite » si le champ contient déjà du texte. */
import { el, icone } from './ui.js';
import { demanderAcces } from './verrou.js';
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

export async function traiterPartage({ id, erreur, jour, chargerFiche, enregistrer, ouvrirRecit, ouvrirMyLove }) {
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
  const boutonMyLove = el('button', { type: 'button', class: 'bouton grand discret' }, icone('cadenas', 'petite'), ' My Love');
  const messageVerrou = el('p', { class: 'erreur', role: 'status', hidden: true });
  zoneQuestion.append(
    el('h3', {}, 'Où ranger ce texte ?'),
    el('div', { class: 'rangee-boutons' }, boutonRecit, boutonMyLove),
    messageVerrou,
    el('p', { class: 'discret' }, 'My Love demande ton empreinte.'));

  const DESTINATIONS = {
    recit: { nom: 'Récit', ouvrir: ouvrirRecit },
    mylove: { nom: 'My Love', ouvrir: ouvrirMyLove },
  };

  async function ranger(champ, mode) {
    const fiche = await chargerFiche(date);
    const actuel = (fiche[champ] || '').trim();
    await enregistrer(date, { [champ]: mode === 'suite' && actuel ? `${actuel}\n\n${texte}` : texte });
    partage.utilise = { champ, le: new Date().toISOString() };
    await TMDB.ecrire('partages', partage);
    fermer();
    await DESTINATIONS[champ].ouvrir();
  }

  async function choisir(champ) {
    const fiche = await chargerFiche(date);
    if (!(fiche[champ] || '').trim()) return ranger(champ, 'remplacer');
    zoneQuestion.replaceChildren(
      el('h3', {}, `${DESTINATIONS[champ].nom} contient déjà du texte ce jour-là`),
      el('pre', { class: 'apercu petit' }, fiche[champ].trim()),
      el('div', { class: 'rangee-boutons' },
        el('button', { type: 'button', class: 'bouton grand', onClick: () => ranger(champ, 'suite') }, 'Ajouter à la suite'),
        el('button', { type: 'button', class: 'bouton grand discret', onClick: () => ranger(champ, 'remplacer') }, 'Remplacer')),
      el('button', { type: 'button', class: 'bouton petit discret annuler', onClick: fermer }, 'Annuler'));
  }

  boutonRecit.addEventListener('click', () => choisir('recit'));
  boutonMyLove.addEventListener('click', async () => {
    messageVerrou.hidden = true;
    const r = await demanderAcces();
    if (!r.ok) {
      messageVerrou.hidden = false;
      messageVerrou.textContent = r.message;
      return;
    }
    choisir('mylove');
  });
}
