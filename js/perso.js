/* Onglet Perso : écran de verrouillage, puis compte-tours, Happy Dicky et My Love.
   (Happy Dicky s'appelait « Biscotte » : les colonnes du Sheet restent biscotte_1 et biscotte_2.) */
import { el, icone, carte } from './ui.js';
import { creerJauge } from './jauge.js';
import { carteMemo } from './onglets.js';
import * as verrou from './verrou.js';

const fmt = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });

/* ---------- Écran de verrouillage ---------- */

function carteVerrou(ctx) {
  const message = el('p', { class: 'message-verrou', role: 'status' });
  const explication = el('p', { class: 'discret' });
  const actions = el('div', { class: 'actions-verrou' });
  const bouton = el('button', { type: 'button', class: 'empreinte bouton-empreinte', 'aria-label': 'Déverrouiller avec l’empreinte' }, icone('empreinte'));

  const afficherErreur = (r) => {
    message.className = 'message-verrou erreur';
    message.textContent = r.message;
  };

  async function lancer() {
    message.className = 'message-verrou';
    message.textContent = 'Pose ton doigt sur le capteur…';
    const r = verrou.empreinteEnregistree() ? await verrou.deverrouiller() : await verrou.enregistrerEmpreinte();
    if (!r.ok) afficherErreur(r);
    // En cas de succès, l'app redessine l'onglet (écoute de verrou.surChangement).
  }
  bouton.addEventListener('click', lancer);

  verrou.disponibilite().then((dispo) => {
    if (dispo !== 'ok') {
      bouton.disabled = true;
      explication.textContent = 'Aucun capteur d’empreinte n’est disponible sur cet appareil.';
      actions.replaceChildren(el('button', {
        type: 'button', class: 'bouton discret',
        onClick: async () => { const r = await verrou.deverrouillerSansCapteur(); if (!r.ok) afficherErreur(r); },
      }, 'Ouvrir sans empreinte (ordinateur de test)'));
      return;
    }
    if (!verrou.empreinteEnregistree()) {
      explication.textContent = 'Première utilisation : touche le bouton pour enregistrer ton empreinte pour Today’s Mood. Android te demandera de poser ton doigt sur le capteur.';
      actions.replaceChildren(el('button', { type: 'button', class: 'bouton', onClick: lancer }, 'Enregistrer mon empreinte'));
      return;
    }
    explication.textContent = 'Touche le bouton et pose ton doigt sur le capteur.';
    if (ctx.consommerDemandeEmpreinte()) lancer();
  });

  return [el('section', { class: 'carte verrou' },
    bouton,
    el('h2', {}, 'Accès réservé'),
    explication,
    message,
    actions)];
}

/* ---------- Happy Dicky ---------- */

/* Pistons dessinés au trait (couleur currentColor, sur les boutons laiton) :
   bouton 1 = un piston, bouton 2 = deux pistons en V (bicylindre). Dessins repris tels quels. */
const PISTONS = {
  1: '<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="1.8" width="10" height="8.4" rx="1.4"/><path d="M7 4.3h10M7 6.2h10"/><circle cx="12" cy="8.4" r="0.9"/><path d="M11.1 9.2L10.5 17.3M12.9 9.2l.6 8.1"/><circle cx="12" cy="19.6" r="2.5"/><circle cx="12" cy="19.6" r="0.6" fill="currentColor"/></svg>',
  2: '<svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-26 12 19.6)"><rect x="8.6" y="2.6" width="6.8" height="6.2" rx="1.1"/><path d="M8.6 4.4h6.8M8.6 5.9h6.8"/><circle cx="12" cy="7.3" r="0.7"/><path d="M11.4 8L11 17.4M12.6 8l.4 9.4"/></g><g transform="rotate(26 12 19.6)"><rect x="8.6" y="2.6" width="6.8" height="6.2" rx="1.1"/><path d="M8.6 4.4h6.8M8.6 5.9h6.8"/><circle cx="12" cy="7.3" r="0.7"/><path d="M11.4 8L11 17.4M12.6 8l.4 9.4"/></g><circle cx="12" cy="19.6" r="2.5"/><circle cx="12" cy="19.6" r="0.6" fill="currentColor"/></svg>',
};

function piston(n) {
  const gabarit = document.createElement('template');
  gabarit.innerHTML = PISTONS[n];
  const dessin = gabarit.content.firstElementChild;
  dessin.classList.add('piston');
  return dessin;
}

function carteBiscotte(ctx) {
  const colonnes = [];
  const somme = el('dl', { class: 'totaux totaux-somme' });

  async function actualiser() {
    const t = await ctx.totaux();
    for (const c of colonnes) c.maj(t);
    somme.replaceChildren(
      el('div', {}, el('dt', {}, 'Mois'), el('dd', {}, fmt.format(t.mois.biscotte_1 + t.mois.biscotte_2))),
      el('div', {}, el('dt', {}, 'Total'), el('dd', {}, fmt.format(t.total.biscotte_1 + t.total.biscotte_2))));
  }

  for (const n of [1, 2]) {
    const champ = 'biscotte_' + n;
    const aujourdhui = el('span', { class: 'biscotte-jour', 'aria-live': 'polite' });
    const mois = el('dd');
    const total = el('dd');
    const moins = el('button', { type: 'button', class: 'bouton-rond', 'aria-label': `Happy Dicky ${n} : moins un` }, icone('moins'));
    const changer = async (delta) => {
      const v = Math.max(0, (ctx.fiche[champ] || 0) + delta);
      await ctx.modifier(champ, v === 0 ? null : v);
      actualiser();
    };
    moins.addEventListener('click', () => changer(-1));
    const grand = el('button', { type: 'button', class: 'bouton-biscotte', 'aria-label': `Happy Dicky ${n} : plus un`, onClick: () => changer(1) },
      piston(n), el('span', { class: 'mention' }, '+1'));
    colonnes.push({
      maj(t) {
        const v = ctx.fiche[champ] || 0;
        aujourdhui.textContent = fmt.format(v);
        moins.disabled = v === 0;
        mois.textContent = fmt.format(t.mois[champ]);
        total.textContent = fmt.format(t.total[champ]);
      },
      noeud: el('div', { class: 'colonne-biscotte' },
        grand,
        el('div', { class: 'biscotte-ligne' }, moins, el('div', {}, el('span', { class: 'biscotte-etiquette' }, 'Aujourd’hui'), aujourdhui)),
        el('dl', { class: 'biscotte-totaux' },
          el('div', {}, el('dt', {}, 'Mois'), mois),
          el('div', {}, el('dt', {}, 'Total'), total))),
    });
  }
  actualiser();
  return carte('Happy Dicky',
    el('div', { class: 'biscottes' }, ...colonnes.map((c) => c.noeud)),
    el('p', { class: 'sous-titre-champ' }, 'Somme 1 + 2'),
    somme);
}

/* ---------- Onglet ---------- */

export function cartesPerso(ctx) {
  if (!verrou.estDeverrouille()) return carteVerrou(ctx);
  return [
    carte('Énergie sexuelle', creerJauge({
      titre: 'Énergie sexuelle', nomCadran: 'Énergie sexuelle', variante: 'comptetours',
      libelles: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      valeur: ctx.fiche.energie_sexuelle,
      onChange: (v) => ctx.modifier('energie_sexuelle', v),
    })),
    carteBiscotte(ctx),
    carteMemo(ctx, {
      champ: 'mylove', titre: 'My Love', id: 'carte-mylove',
      vide: ['Aucun mémo aujourd’hui. Dans l’Enregistreur : ', el('strong', {}, 'Partager → Transcription → Today’s Mood → My Love'), '.'],
    }),
  ];
}
