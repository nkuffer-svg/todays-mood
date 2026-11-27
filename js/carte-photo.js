/* Photos (ciel du matin, jour, ciel du soir) : prise de vue ou galerie, compression, envoi vers Drive. */
import { el, icone } from './ui.js';

/** Zone photo (sans la carte) : aperçu, statut et boutons. Classe `bloc-photo` sur le conteneur. */
export function blocPhoto(ctx, champ, titre) {
  const zone = el('div', { class: 'photo-zone' });
  const statut = el('p', { class: 'photo-statut', role: 'status' });
  const camera = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const galerie = el('input', { type: 'file', accept: 'image/*', hidden: true });
  const boutons = el('div', { class: 'rangee-boutons' });

  const boutonCamera = (texte) => el('button', { type: 'button', class: 'bouton', onClick: () => camera.click() }, icone('appareil'), texte);
  const boutonGalerie = el('button', { type: 'button', class: 'bouton discret', onClick: () => galerie.click() }, icone('galerie'), 'Galerie');
  const boutonSupprimer = el('button', {
    type: 'button', class: 'bouton discret', onClick: async () => {
      if (!confirm('Supprimer cette photo ?')) return;
      await ctx.photo.supprimer(champ);
      afficher();
    },
  }, icone('corbeille'), 'Supprimer');

  async function recevoir(e) {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    statut.className = 'photo-statut';
    statut.textContent = 'Compression de la photo…';
    try {
      await ctx.photo.ajouter(champ, fichier);
      afficher();
    } catch (err) {
      statut.className = 'photo-statut erreur';
      statut.textContent = 'Photo non enregistrée : ' + err.message;
    }
  }
  camera.addEventListener('change', recevoir);
  galerie.addEventListener('change', recevoir);

  async function afficher() {
    statut.className = 'photo-statut';
    statut.textContent = '';
    let r = null;
    try {
      if (ctx.fiche[champ]) statut.textContent = 'Chargement de la photo…';
      r = await ctx.photo.affichable(champ);
      statut.textContent = '';
    } catch (err) {
      zone.replaceChildren(el('div', { class: 'photo-vide' }, icone('galerie'), 'Photo enregistrée sur Drive'));
      statut.className = 'photo-statut erreur';
      statut.textContent = 'Impossible de l’afficher pour l’instant : ' + err.message;
      boutons.replaceChildren(boutonCamera('Reprendre'), boutonGalerie, boutonSupprimer);
      return;
    }
    if (!r) {
      zone.replaceChildren(el('div', { class: 'photo-vide' }, icone('appareil'), 'Pas encore de photo'));
      boutons.replaceChildren(boutonCamera('Prendre une photo'), boutonGalerie);
      return;
    }
    zone.replaceChildren(el('img', { src: r.url, alt: titre, class: 'photo' }));
    statut.textContent = r.etat === 'attente' ? 'Envoi vers Drive en attente' : 'Enregistrée sur Drive';
    statut.classList.toggle('attente', r.etat === 'attente');
    boutons.replaceChildren(boutonCamera('Reprendre'), boutonGalerie, boutonSupprimer);
  }
  afficher();

  return el('div', { class: 'bloc-photo', 'data-champ': champ }, zone, statut, boutons, camera, galerie);
}

/** Carte photo complète (titre + zone photo). */
export function cartePhoto(ctx, champ, titre) {
  return el('section', { class: 'carte carte-photo' }, el('h2', {}, titre), blocPhoto(ctx, champ, titre));
}
