/* Données de référence de l'app (libellés, colonnes, listes). */

/** Colonnes de l'onglet « Fiches » du Google Sheet, dans l'ordre (voir CLAUDE.md §9). */
export const COLONNES = [
  'date', 'modifie_le', 'pensee_id',
  'meteo_tmin', 'meteo_tmax', 'meteo_pluie_mm', 'meteo_soleil_h', 'meteo_nuages_pct', 'meteo_code', 'meteo_ressenti',
  'photo_ciel', 'photo_jour',
  'humeur_matin', 'humeur_soir', 'energie', 'inspiration', 'energie_sexuelle', 'bilan',
  'evt_appreciation', 'evt_categorie', 'evt_texte',
  'accord_parole', 'accord_personnel', 'accord_supposition', 'accord_mieux',
  'pas', 'natation_m', 'eau_ml', 'cafe', 'deca', 'biere', 'vin', 'biscotte_1', 'biscotte_2',
  'recit', 'recit_favori', 'recit_piment', 'mylove', 'mylove_favori', 'mylove_piment',
];

export const LIBELLES = {
  humeur: ['Désespéré', 'Triste', 'Morose', 'Mélancolique', 'Neutre', 'Serein', 'Content', 'Enjoué', 'Joyeux'],
  energie: ['Panne sèche', 'Sur la réserve', 'Au ralenti', 'Petite allure', 'Vitesse de croisière', 'Bien lancé', 'Pleine route', 'Plein gaz', 'À fond'],
  inspiration: ['Vide', 'Éteint', 'Brumeux', 'Hésitant', 'Ordinaire', 'Curieux', 'Inspiré', 'Fourmillant', 'Illuminé'],
};

export const PASTILLES_DEFAUT = ['Job', 'Maison', 'Famille élargie', 'Famille', 'Réflexion', 'Pensée', 'Scène de vie'];

export const APPRECIATIONS = ['Cool', 'Pas cool'];

export const BILAN = ['Pas content', 'Mitigé', 'Neutre', 'Content', 'Très content'];

export const NIVEAUX_ACCORD = [
  { valeur: 3, libelle: 'Bon' },
  { valeur: 2, libelle: 'Moyen' },
  { valeur: 1, libelle: 'Pas bon' },
];

export const ACCORDS = [
  {
    champ: 'accord_parole',
    nom: 'Parole impeccable',
    resume: "Parler avec intégrité et dire ce que l'on pense vraiment. Ne pas retourner ses mots contre soi ni contre les autres : pas de médisance, pas de jugement gratuit.",
  },
  {
    champ: 'accord_personnel',
    nom: 'Ne pas en faire une affaire personnelle',
    resume: "Ce que les autres disent ou font reflète leur propre réalité, pas la tienne. Ne pas le prendre pour soi évite bien des souffrances inutiles.",
  },
  {
    champ: 'accord_supposition',
    nom: 'Pas de supposition',
    resume: "Oser poser des questions et dire clairement ce que l'on veut, plutôt que d'imaginer les intentions des autres. Moins de malentendus, moins de conflits.",
  },
  {
    champ: 'accord_mieux',
    nom: 'Faire de son mieux',
    resume: "Ton mieux varie d'un jour à l'autre, selon la fatigue ou l'humeur. Faire de son mieux, c'est agir pleinement sans se juger ni culpabiliser.",
  },
];

export const ONGLETS = [
  { id: 'matin', nom: 'Matin' },
  { id: 'journee', nom: 'Journée' },
  { id: 'soir', nom: 'Soir' },
  { id: 'perso', nom: 'Perso' },
];
