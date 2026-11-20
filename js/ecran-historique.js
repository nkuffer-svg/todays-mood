/* Historique : calendrier des fiches, recherche par événement, mémos marqués et export Word. */
import { el, icone, segments } from './ui.js';
import { ouvrirEcran } from './ecran.js';
import { depuisTexte, versTexte } from './jour.js';
import { reglage, definirReglage } from './reglages.js';
import { creerDocx } from './docx.js';
import * as verrou from './verrou.js';

const fmtCourt = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMois = new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' });
const fmtHorodatage = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeStyle: 'short' });
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dateCourte = (d) => fmtCourt.format(depuisTexte(d));
const dateLongue = (d) => majuscule(fmtLong.format(depuisTexte(d)).replace(',', ''));
const debut = (texte, n = 110) => {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t;
};

/** Une fiche contient-elle autre chose que sa date ? */
const ficheRemplie = (f) => Object.entries(f).some(([k, v]) => k !== 'date' && k !== 'modifie_le' && v != null && v !== '');

/** Sélection multiple de pastilles (chaque pastille s'allume ou s'éteint). */
function pastillesMultiples({ options, choisies, onChange, etiquette }) {
  const groupe = el('div', { class: 'pastilles', role: 'group', 'aria-label': etiquette });
  for (const opt of options) {
    const b = el('button', { type: 'button', class: 'pastille', 'aria-pressed': String(choisies.has(opt.valeur)) }, opt.libelle);
    b.addEventListener('click', () => {
      if (choisies.has(opt.valeur)) choisies.delete(opt.valeur); else choisies.add(opt.valeur);
      b.setAttribute('aria-pressed', String(choisies.has(opt.valeur)));
      onChange();
    });
    groupe.append(b);
  }
  return groupe;
}

/* ---------- Calendrier ---------- */

function vueCalendrier({ fiches, aujourdhui, ouvrir, etatVue }) {
  const zone = el('div', { class: 'calendrier' });
  const parDate = new Map(fiches.filter(ficheRemplie).map((f) => [f.date, f]));

  function dessiner() {
    const [a, m] = etatVue.mois.split('-').map(Number);
    const premier = new Date(a, m - 1, 1);
    const nbJours = new Date(a, m, 0).getDate();
    const decalage = (premier.getDay() + 6) % 7; // lundi en premier
    const moisSuivant = versTexte(new Date(a, m, 1)).slice(0, 7);
    const grille = el('div', { class: 'cal-grille', role: 'grid' },
      ...['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => el('span', { class: 'cal-entete', 'aria-hidden': 'true' }, j)),
      ...Array.from({ length: decalage }, () => el('span')));
    let nbFiches = 0;
    for (let j = 1; j <= nbJours; j++) {
      const date = `${etatVue.mois}-${String(j).padStart(2, '0')}`;
      const f = parDate.get(date);
      if (f) nbFiches++;
      const marque = f && f.evt_appreciation ? (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') : '';
      grille.append(el('button', {
        type: 'button',
        class: ['cal-jour', f ? 'avec-fiche' : '', date === aujourdhui ? 'aujourdhui' : '', marque].filter(Boolean).join(' '),
        disabled: date > aujourdhui,
        'aria-label': dateLongue(date) + (f ? ', fiche remplie' : ''),
        onClick: () => ouvrir(date),
      }, String(j)));
    }
    zone.replaceChildren(
      el('div', { class: 'cal-tete' },
        el('button', { type: 'button', class: 'bouton-rond', 'aria-label': 'Mois précédent', onClick: () => { etatVue.mois = versTexte(new Date(a, m - 2, 1)).slice(0, 7); dessiner(); } }, icone('gauche')),
        el('p', { class: 'cal-titre' }, majuscule(fmtMois.format(premier))),
        el('button', {
          type: 'button', class: 'bouton-rond', 'aria-label': 'Mois suivant', disabled: moisSuivant > aujourdhui.slice(0, 7),
          onClick: () => { etatVue.mois = moisSuivant; dessiner(); },
        }, icone('droite'))),
      grille,
      el('p', { class: 'discret cal-resume' }, nbFiches ? `${nbFiches} fiche${nbFiches > 1 ? 's' : ''} remplie${nbFiches > 1 ? 's' : ''} ce mois-ci` : 'Aucune fiche ce mois-ci'),
      el('p', { class: 'cal-legende' },
        el('span', { class: 'puce avec-fiche' }), 'fiche remplie',
        el('span', { class: 'puce cool' }), 'événement cool',
        el('span', { class: 'puce pascool' }), 'pas cool'));
  }
  dessiner();
  return zone;
}

/* ---------- Événements ---------- */

function vueEvenements({ fiches, categories, ouvrir, etatVue }) {
  const resultats = el('div', { class: 'resultats' });
  const avecEvenement = fiches
    .filter((f) => f.evt_appreciation || f.evt_categorie || f.evt_texte)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const toutesCategories = [...new Set([...categories, ...avecEvenement.map((f) => f.evt_categorie).filter(Boolean)])];

  function filtrer() {
    const liste = avecEvenement.filter((f) => (!etatVue.appreciation || f.evt_appreciation === etatVue.appreciation)
      && (etatVue.categories.size === 0 || etatVue.categories.has(f.evt_categorie)));
    resultats.replaceChildren(
      el('p', { class: 'discret' }, liste.length ? `${liste.length} événement${liste.length > 1 ? 's' : ''}` : 'Aucun événement ne correspond.'),
      el('ul', { class: 'liste-resultats' }, ...liste.map((f) => el('li', {},
        el('button', { type: 'button', class: 'resultat', onClick: () => ouvrir(f.date, 'soir') },
          el('span', { class: 'resultat-date' }, dateCourte(f.date)),
          el('span', { class: 'resultat-marques' },
            f.evt_appreciation ? el('span', { class: 'pastille statique ' + (f.evt_appreciation === 'Cool' ? 'cool' : 'pascool') }, f.evt_appreciation) : null,
            f.evt_categorie ? el('span', { class: 'pastille statique' }, f.evt_categorie) : null),
          f.evt_texte ? el('span', { class: 'resultat-texte' }, debut(f.evt_texte)) : null)))));
  }

  const appreciation = segments({
    etiquette: 'Appréciation',
    options: [{ valeur: 'Cool', libelle: 'Cool' }, { valeur: 'Pas cool', libelle: 'Pas cool' }],
    valeur: etatVue.appreciation,
    onChange: (v) => { etatVue.appreciation = v; filtrer(); },
  });
  filtrer();
  return el('div', {},
    el('p', { class: 'sous-titre-champ' }, 'Appréciation'),
    appreciation,
    el('p', { class: 'discret aide-filtre' }, 'Sans choix : toutes. Touche à nouveau pour désélectionner.'),
    el('p', { class: 'sous-titre-champ' }, 'Catégories'),
    pastillesMultiples({ options: toutesCategories.map((c) => ({ valeur: c, libelle: c })), choisies: etatVue.categories, onChange: filtrer, etiquette: 'Catégories' }),
    el('p', { class: 'discret aide-filtre' }, 'Sans choix : toutes les catégories.'),
    resultats);
}

/* ---------- Mémos marqués + export ---------- */

const TYPES = { recit: 'Récit du jour', mylove: 'My Love' };

function memosMarques(fiches, deverrouille) {
  const memos = [];
  for (const f of fiches) {
    for (const champ of ['recit', 'mylove']) {
      if (champ === 'mylove' && !deverrouille) continue;
      const texte = (f[champ] || '').trim();
      const favori = !!f[champ + '_favori'];
      const piment = !!f[champ + '_piment'];
      if (texte && (favori || piment)) memos.push({ date: f.date, champ, texte, favori, piment, modifieLe: f.modifie_le || '' });
    }
  }
  return memos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.champ === 'recit' ? -1 : 1));
}

const libelleMarques = (m) => [m.favori ? 'Favori' : null, m.piment ? 'Piment' : null].filter(Boolean).join(' · ');

function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function vueMemos({ fiches, ouvrir, etatVue, redessiner }) {
  const deverrouille = verrou.estDeverrouille();
  const tous = memosMarques(fiches, deverrouille);
  const resultats = el('div', { class: 'resultats' });
  const zoneExport = el('div', { class: 'zone-export' });
  const message = el('p', { class: 'resultat-test', role: 'status' });

  const filtres = () => tous.filter((m) => etatVue.types.has(m.champ)
    && ((etatVue.marques.has('favori') && m.favori) || (etatVue.marques.has('piment') && m.piment)));

  function dessinerListe() {
    message.textContent = '';
    const liste = filtres();
    resultats.replaceChildren(
      el('p', { class: 'discret' }, liste.length ? `${liste.length} mémo${liste.length > 1 ? 's' : ''}` : 'Aucun mémo marqué ne correspond.'),
      el('ul', { class: 'liste-resultats' }, ...liste.map((m) => el('li', {},
        el('details', { class: 'memo' },
          el('summary', { class: 'resultat' },
            el('span', { class: 'resultat-date' }, dateCourte(m.date)),
            el('span', { class: 'resultat-marques' },
              el('span', { class: 'pastille statique' }, TYPES[m.champ]),
              m.favori ? el('span', { class: 'marque-icone', title: 'Favori' }, icone('etoile', 'pleine')) : null,
              m.piment ? el('span', { class: 'marque-icone piment', title: 'Piment' }, icone('piment', 'pleine')) : null),
            el('span', { class: 'resultat-texte' }, debut(m.texte))),
          el('div', { class: 'memo-corps' },
            el('p', { class: 'memo-texte' }, m.texte),
            el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrir(m.date, m.champ === 'recit' ? 'soir' : 'perso') }, 'Ouvrir la fiche')))))));
    dessinerExport();
  }

  function dessinerExport() {
    const dernier = reglage('dernierExport');
    const depuis = el('input', { type: 'checkbox', id: 'export-depuis', checked: !!dernier && etatVue.depuisDernier });
    depuis.disabled = !dernier;
    depuis.addEventListener('change', () => { etatVue.depuisDernier = depuis.checked; });
    const bouton = el('button', { type: 'button', class: 'bouton' }, icone('telecharger'), 'Exporter en Word');
    bouton.addEventListener('click', async () => {
      let liste = filtres();
      if (depuis.checked && dernier) liste = liste.filter((m) => m.modifieLe > dernier);
      if (!liste.length) {
        message.className = 'resultat-test erreur';
        message.textContent = 'Rien à exporter avec ces filtres.';
        return;
      }
      const maintenant = new Date();
      const blocs = [
        { type: 'titre', texte: 'Today’s Mood — mémos marqués' },
        { type: 'meta', texte: `Exporté le ${fmtHorodatage.format(maintenant)} · ${liste.length} mémo${liste.length > 1 ? 's' : ''}` + (depuis.checked && dernier ? ` · depuis l’export du ${fmtHorodatage.format(new Date(dernier))}` : '') },
      ];
      for (const m of [...liste].reverse()) { // ordre chronologique dans le document
        blocs.push(
          { type: 'titre1', texte: `${dateLongue(m.date)} — ${TYPES[m.champ]}` },
          { type: 'meta', texte: libelleMarques(m) },
          { type: 'texte', texte: m.texte });
      }
      const nom = `todays-mood-memos-${versTexte(maintenant)}.docx`;
      const blob = creerDocx(blocs);
      const fichier = new File([blob], nom, { type: blob.type });
      let partage = false;
      if (etatVue.viaPartage && navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try {
          await navigator.share({ files: [fichier], title: 'Today’s Mood — mémos marqués' });
          partage = true;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
      if (!partage) telecharger(blob, nom);
      await definirReglage('dernierExport', maintenant.toISOString());
      dessinerExport();
      message.className = 'resultat-test succes';
      message.textContent = partage
        ? `${liste.length} mémo(s) exporté(s).`
        : `${liste.length} mémo(s) exporté(s) : fichier « ${nom} » dans tes Téléchargements.`;
    });
    const peutPartager = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })] }));
    const viaPartage = el('input', { type: 'checkbox', id: 'export-partage', checked: etatVue.viaPartage });
    viaPartage.addEventListener('change', () => { etatVue.viaPartage = viaPartage.checked; });
    zoneExport.replaceChildren(...[
      el('h3', { class: 'sous-titre-champ' }, 'Export Word (pour OneNote)'),
      el('p', { class: 'discret' }, 'Exporte les mémos affichés ci-dessus (filtres compris)'
        + (deverrouille ? '.' : ', sans les My Love tant qu’ils sont verrouillés.')),
      el('label', { class: 'case' }, depuis, el('span', {}, 'Seulement depuis le dernier export',
        dernier ? el('small', {}, ` (${fmtHorodatage.format(new Date(dernier))})`) : el('small', {}, ' (aucun export pour l’instant)'))),
      peutPartager ? el('label', { class: 'case' }, viaPartage, el('span', {}, 'Envoyer directement vers une app (OneNote, Drive…)')) : null,
      el('div', { class: 'rangee-boutons' }, bouton),
      message,
    ].filter(Boolean));
  }

  const avertissement = deverrouille ? null : el('div', { class: 'encart' },
    el('p', {}, 'Les My Love sont masqués tant que Perso est verrouillé.'),
    el('button', {
      type: 'button', class: 'bouton petit', onClick: async () => {
        const r = await verrou.demanderAcces();
        if (r.ok) redessiner(); else alert(r.message);
      },
    }, icone('cadenas', 'petite'), ' Afficher les My Love'));

  dessinerListe();
  return el('div', {},
    avertissement,
    el('p', { class: 'sous-titre-champ' }, 'Type'),
    pastillesMultiples({ options: [{ valeur: 'recit', libelle: 'Récit du jour' }, { valeur: 'mylove', libelle: 'My Love' }], choisies: etatVue.types, onChange: dessinerListe, etiquette: 'Type' }),
    el('p', { class: 'sous-titre-champ' }, 'Marque'),
    pastillesMultiples({ options: [{ valeur: 'favori', libelle: 'Favori' }, { valeur: 'piment', libelle: 'Piment' }], choisies: etatVue.marques, onChange: dessinerListe, etiquette: 'Marque' }),
    resultats,
    zoneExport);
}

/* ---------- Écran ---------- */

/**
 * @param {object} o
 * @param {string} o.aujourdhui
 * @param {string[]} o.categories   toutes les catégories (y compris masquées)
 * @param {(date:string, onglet?:string)=>void} o.allerA
 * @param {()=>void} o.ouvrirFavoris
 */
export async function ouvrirHistorique({ aujourdhui, categories, allerA, ouvrirFavoris }) {
  let desabonner = null;
  const { corps, fermer } = ouvrirEcran({ titre: 'Historique', surFermeture: () => desabonner?.() });
  const etatVue = {
    vue: 'calendrier',
    mois: aujourdhui.slice(0, 7),
    appreciation: null,
    categories: new Set(),
    types: new Set(['recit', 'mylove']),
    marques: new Set(['favori', 'piment']),
    depuisDernier: true,
    viaPartage: false,
  };
  const zone = el('div', { class: 'historique-vue' });

  const ouvrir = (date, onglet) => {
    fermer();
    allerA(date, onglet);
  };

  async function redessiner() {
    const fiches = await TMDB.tout('fiches');
    const vues = {
      calendrier: () => vueCalendrier({ fiches, aujourdhui, ouvrir, etatVue }),
      evenements: () => vueEvenements({ fiches, categories, ouvrir, etatVue }),
      memos: () => vueMemos({ fiches, ouvrir, etatVue, redessiner }),
    };
    zone.replaceChildren(vues[etatVue.vue]());
  }

  // Si Perso se reverrouille (app en arrière-plan), les My Love disparaissent aussitôt de la liste.
  desabonner = verrou.surChangement(() => { if (etatVue.vue === 'memos') redessiner(); });

  corps.append(
    segments({
      etiquette: 'Vue', obligatoire: true, valeur: etatVue.vue,
      options: [{ valeur: 'calendrier', libelle: 'Calendrier' }, { valeur: 'evenements', libelle: 'Événements' }, { valeur: 'memos', libelle: 'Mémos' }],
      onChange: (v) => { etatVue.vue = v; redessiner(); },
    }),
    zone,
    el('div', { class: 'rangee-boutons' },
      el('button', { type: 'button', class: 'bouton petit discret', onClick: () => ouvrirFavoris() }, icone('etoile', 'petite'), ' Mes pensées favorites')));
  await redessiner();
}
