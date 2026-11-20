# Today's Mood — document de référence du projet

Ce fichier décrit tout le projet. Lis-le en entier au début de chaque session et respecte-le. En cas de doute ou de contradiction avec un prompt d'étape, demande avant de coder.

## 1. Contexte et façon de travailler

- **App personnelle** de journal quotidien, pour un seul utilisateur, non partagée.
- **Appareil cible** : Google Pixel 8 Pro (Android), navigateur Chrome. L'app est installée sur l'écran d'accueil (PWA). Aucun support iPhone ou ordinateur requis, mais l'app doit rester utilisable dans un navigateur de bureau pour les tests.
- **Gratuit** : aucun service payant, aucune clé d'API payante.
- **Langue** : toute l'interface est en français (Suisse romande). Les explications à l'utilisateur aussi, en le tutoyant.
- **L'utilisateur n'est pas développeur.** Il sait coller du code dans l'éditeur Apps Script et créer un déploiement. Explique chaque manipulation manuelle pas à pas, simplement.
- **On avance par étapes** (section 10). Une étape à la fois : à la fin de chaque étape, donne une liste de tests concrets à faire sur le téléphone, puis attends la validation avant de passer à la suivante.
- **Git** : le dépôt GitHub `todays-mood` est publié avec GitHub Pages depuis la branche `main` (racine). À la fin de chaque étape, le travail doit se retrouver sur `main` (fusionne toi-même si tu le peux, sinon explique à l'utilisateur comment fusionner la pull request sur github.com).
- L'utilisateur travaille depuis deux ordinateurs (Claude Code web et app de bureau) : tout doit être dans le dépôt, rien ne doit dépendre d'un fichier local.

## 2. Architecture

```
Pixel 8 Pro
 ├─ Enregistreur Google ──(Partager → Transcription)──► App Today's Mood (PWA)
 └─ App Today's Mood (PWA, hébergée sur GitHub Pages)
        ├─► Open-Meteo (météo du jour, gratuit, sans clé)
        └─► Apps Script (Web App) ──► Google Sheet (données)
                                   └─► Google Drive (photos)
```

### Front (dossier racine du dépôt)

- **HTML, CSS et JavaScript « vanilla »**, sans framework et **sans étape de build** : les fichiers du dépôt sont servis tels quels par GitHub Pages. Les modules ES natifs (`<script type="module">`) sont bienvenus.
- Une petite bibliothèque chargée depuis un CDN est acceptable si elle évite beaucoup de code (ex. génération .docx à l'étape 7), mais demande d'abord.
- **PWA** : `manifest.webmanifest` (nom « Today's Mood », thème sombre, icônes), service worker pour le fonctionnement hors ligne.
- **Share Target** : le manifest déclare l'app comme cible de partage Android. La transcription de l'Enregistreur peut arriver en **texte** ou en **fichier .txt** : gérer les deux (méthode POST, `multipart/form-data`, le service worker intercepte la requête, lit le contenu, le stocke, puis redirige vers l'écran de choix de destination).
- **Stockage local** : IndexedDB est la source de vérité sur le téléphone. Toute saisie y est écrite immédiatement (enregistrement automatique, pas de bouton Valider), puis placée dans une **file de synchronisation** envoyée à Apps Script dès que le réseau est disponible. Au démarrage, l'app récupère les données du Sheet pour reconstituer l'historique (totaux, recherche).
- **Verrou Perso** : WebAuthn avec l'authentificateur de la plateforme (empreinte du Pixel), `userVerification: "required"`. C'est un verrou d'interface, pas un chiffrement. L'onglet se reverrouille quand on le quitte ou quand l'app passe en arrière-plan.

### Back (dossier `apps-script/` du dépôt)

- **Google Apps Script** lié au Google Sheet « Today's Mood – données », déployé en **Application Web** (exécuter en tant que : moi ; accès : tout le monde).
- L'utilisateur **copie-colle** le code de `apps-script/` dans l'éditeur Apps Script. Garde peu de fichiers (`Code.gs`, éventuellement un ou deux autres), et rappelle-lui à chaque modification de faire « Gérer les déploiements → Modifier → Nouvelle version » pour garder la même URL.
- **Sécurité** : chaque requête contient un **jeton secret** (longue chaîne aléatoire). Le jeton est stocké côté Apps Script dans les Propriétés du script, et côté téléphone dans les Réglages de l'app (saisi une fois par l'utilisateur). **Le jeton ne doit jamais apparaître dans le dépôt** : le dépôt est public (GitHub Pages gratuit).
- **CORS** : appeler la Web App avec `fetch` en POST et `Content-Type: text/plain;charset=utf-8` (corps JSON en texte) pour éviter la requête préalable OPTIONS. Réponses en JSON via `ContentService`.
- **Photos** : compressées sur le téléphone avant l'envoi (JPEG, côté le plus long 1600 px, qualité ≈ 0,8), envoyées en base64, enregistrées dans un dossier Drive « Today's Mood – photos ». La fiche stocke l'identifiant ou le lien du fichier.

### Météo

- **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`), `timezone=Europe/Zurich`, données journalières : température min/max, précipitations (mm), durée d'ensoleillement (convertie en heures), couverture nuageuse moyenne (%), code météo WMO.
- Position : GPS du téléphone si autorisé, sinon lieu fixe réglable (par défaut Lavaux, environ 46,49 N / 6,73 E).
- Récupérée automatiquement à la première ouverture du jour et enregistrée dans la fiche.

## 3. Règles générales de fonctionnement

- **Une fiche par jour.** Le jour bascule à **4 h du matin** (réglable) : une saisie faite à 0 h 30 appartient à la fiche de la veille.
- **Fiches passées modifiables** via un sélecteur de date.
- **Totaux calculés, jamais stockés** : chaque fiche ne contient que les valeurs du jour. L'app calcule « Aujourd'hui / Ce mois / Total ».
- **Chaque compteur a un bouton −1** (ou « annuler le dernier ajout » pour l'eau).
- **Thème sombre permanent.**
- **Pas de notifications** : l'utilisateur utilise une alarme Android.

## 4. Écran d'ouverture : pensée du jour

- À la première ouverture de la journée : une pensée en plein écran pendant 30 s (réglable), refermable à tout moment.
- Base de citations dans `data/pensees.json` (300 à 400 entrées), 10 catégories : Antiquité · Renaissance et époque moderne · Lumières et XIXe siècle · Époque contemporaine · Afrique · Philosophie orientale · Confucianisme · Taoïsme · Bouddhisme et Zen · Culture japonaise.
- **Seulement des citations à l'attribution fiable**, en français. Pas de citations apocryphes ou douteuses (fréquentes pour Confucius, Bouddha, « proverbe africain ») : en cas de doute, écarter.
- Affichage : citation + auteur.
- Tirage aléatoire, même pensée toute la journée, pas de répétition avant d'avoir fait le tour de la base.
- La pensée affichée est enregistrée dans la fiche (identifiant de la citation).
- Bouton « Revoir la pensée » dans l'onglet Matin, étoile pour la mettre en favori, liste « Mes pensées favorites ».

## 5. Les 4 onglets de la fiche du jour

### Matin
| Rubrique | Saisie | Stockage |
|---|---|---|
| Météo (auto) | Open-Meteo | champs numériques |
| Météo ressentie | 4 icônes : Soleil, Nuageux, Pluie, Neige | code numérique 1–4 |
| Photo du ciel | appareil photo | lien Drive |
| Humeur du matin | jauge 9 crans | 1–9 |
| Énergie | jauge 9 crans | 1–9 |
| Inspiration | jauge 9 crans | 1–9 |

Libellés des jauges (le mot du cran sélectionné s'affiche en grand) :

| Cran | Humeur | Énergie | Inspiration |
|---|---|---|---|
| 1 | Désespéré | Panne sèche | Vide |
| 2 | Triste | Sur la réserve | Éteint |
| 3 | Morose | Au ralenti | Brumeux |
| 4 | Mélancolique | Petite allure | Hésitant |
| 5 | Neutre | Vitesse de croisière | Ordinaire |
| 6 | Serein | Bien lancé | Curieux |
| 7 | Content | Pleine route | Inspiré |
| 8 | Enjoué | Plein gaz | Fourmillant |
| 9 | Joyeux | À fond | Illuminé |

### Journée
- **Quoi dans le goulot ?** Eau : boutons +500 ml et +300 ml, bouton « annuler le dernier ajout », jauge de carburant vers l'objectif (2 L par défaut, réglable). Café, Déca, Bière, Verre de vin : compteurs +1 / −1. Chaque ligne affiche Aujourd'hui / Mois / Total.
- **Comment t'as bougé ton Q ?** Nombre de pas (saisie manuelle du total du jour). Marche : bouton « + Ajouter une marche » (km), **plusieurs marches par jour**, chacune supprimable ; affichage km jour / mois / total et nombre de marches mois / total. Natation : **une séance par jour** maximum, en mètres ; affichage m jour / mois / total et nombre de séances mois / total. Aucune liaison Garmin ou Strava.
- **Photo du jour** : appareil photo, distincte de la photo du ciel.

### Soir
- **Humeur du soir** : même jauge que le matin, avec un rappel de l'humeur du matin.
- **Événement marquant** (un par jour) : appréciation Cool / Pas cool (pastilles), une catégorie parmi Job · Maison · Famille élargie · Famille · Réflexion · Pensée · Scène de vie + catégories ajoutées depuis l'app (pastille « + Nouvelle »), description courte.
- **Récit du jour** : texte long reçu via le partage de l'Enregistreur (voir section 6), modifiable. Marques : Favori (étoile) et/ou Piment.
- **Bilan du jour** : 5 visages dessinés en SVG (pas d'emoji), de « Pas content » à « Très content ». Stockage 1–5.
- **Les 4 accords toltèques** : Parole impeccable · Ne pas en faire une affaire personnelle · Pas de supposition · Faire de son mieux. Pour chacun, un sélecteur Bon / Moyen / Pas bon (stockage 3 / 2 / 1) et un bouton « i » qui ouvre un court résumé de l'accord (un seul ouvert à la fois). Résumés :
  - Parole impeccable : « Parler avec intégrité et dire ce que l'on pense vraiment. Ne pas retourner ses mots contre soi ni contre les autres : pas de médisance, pas de jugement gratuit. »
  - Affaire personnelle : « Ce que les autres disent ou font reflète leur propre réalité, pas la tienne. Ne pas le prendre pour soi évite bien des souffrances inutiles. »
  - Pas de supposition : « Oser poser des questions et dire clairement ce que l'on veut, plutôt que d'imaginer les intentions des autres. Moins de malentendus, moins de conflits. »
  - Faire de son mieux : « Ton mieux varie d'un jour à l'autre, selon la fatigue ou l'humeur. Faire de son mieux, c'est agir pleinement sans se juger ni culpabiliser. »

### Perso (verrouillé par empreinte)
- **Énergie sexuelle** : compte-tours (voir section 8), 9 crans, sans libellés (chiffre seul). Stockage 1–9.
- **Biscotte** : deux gros boutons « 1 » et « 2 ». Chacun ajoute +1 au compteur du jour correspondant, avec un −1. Affichage pour chacun : aujourd'hui, mois, total ; plus une ligne « Somme 1 + 2 » (mois et total).
- **My Love** : comme le Récit du jour (partage depuis l'Enregistreur, texte modifiable, marques Favori / Piment). État vide : « Aucun mémo aujourd'hui » + rappel de la manipulation.
- Le contenu Perso n'apparaît dans l'historique et la recherche qu'une fois déverrouillé.

## 6. Partage depuis l'Enregistreur

1. L'utilisateur dicte dans l'Enregistreur du Pixel, puis Partager → Transcription → Today's Mood.
2. L'app reçoit le texte (ou le fichier .txt), affiche un aperçu et demande : **Récit du jour** ou **My Love** ? (My Love demande l'empreinte.)
3. Le texte est ajouté à la fiche du jour (selon l'heure de bascule). Si le champ contient déjà du texte, demander : remplacer ou ajouter à la suite.
4. Seul le texte est conservé, jamais l'audio.

## 7. Historique, recherche, export, réglages

- **Historique** : recherche par date (calendrier) et par événement (filtres combinables : appréciation × une ou plusieurs catégories). Résultats en liste (date, appréciation, catégorie, début du texte), un appui ouvre la fiche complète.
- **Mémos marqués** : vue de tous les Récits et My Love marqués Favori ou Piment, filtrable.
- **Export Word** : un fichier .docx des mémos marqués (date, type, marque, texte), à importer dans OneNote. Option « seulement depuis le dernier export ».
- **Pensées favorites** : liste avec auteur.
- **Réglages** : heure de bascule (4 h), objectif d'eau (2 L), pastilles de catégorie (ajout, renommage, masquage), durée de la pensée (30 s), position météo (GPS ou lieu fixe), URL de la Web App Apps Script, jeton secret, réenregistrement de l'empreinte.

## 8. Direction visuelle « Garage vintage »

Ambiance : tableau de bord de moto ancienne, adulte et chaleureux, **pas « jouet »**. Sombre en permanence.

**Couleurs**
| Rôle | Valeur |
|---|---|
| Fond de l'app | `#17130F` |
| Fond des cartes | `#221C16` |
| Fond des champs / zones creuses | `#1A1511` |
| Bordures | `#3A3026` (fortes : `#5A4A38`) |
| Accent laiton | `#C9A15B` (clair `#E0BC7A`, foncé `#8C6B34`, ombré `#7A5C2C`) |
| Fond d'élément sélectionné | `#2E2519` |
| Texte principal | `#EDE4D0` |
| Texte secondaire | `#CFC4AE` |
| Texte discret | `#ADA08A` |
| Cadran crème | `#EFE6D2`, encre `#2A2118` |
| Aiguille rouge | `#B23A2A` |
| Zone rouge (compte-tours) | `#C4402C`, chiffres rouges `#E0533F` |
| Zone verte (jauge d'eau) | `#3E7A55` |

**Typographie** (Google Fonts) : *Bebas Neue* pour le titre de l'app, les titres de cartes (lettres espacées, couleur laiton) et les grands chiffres ; *Archivo* pour le texte courant ; *Archivo Narrow* pour les libellés, boutons et petites mentions (souvent en capitales espacées).

**Composants**
- **Cartes** : coins arrondis 14 px, bordure `#3A3026` et double filet intérieur (`box-shadow: inset 0 0 0 5px #1D1813, inset 0 0 0 6px #3A3026`).
- **Onglets** : barre en pilule ; onglet actif plein laiton, texte foncé ; Perso avec un cadenas.
- **Boutons ronds** à bordure laiton pour + / −, icônes au trait (SVG inline), cibles tactiles ≥ 44 px.
- **Pastilles** arrondies ; sélection = bordure laiton + fond `#2E2519`.
- **Jauge 9 crans (humeur, énergie, inspiration)** : cadran crème cerclé de laiton (anneau foncé `#8C6B34`, anneau `#C9A15B`, face `#EFE6D2`), arc de 240° (de −120° à +120° par rapport à la verticale), 9 graduations principales numérotées 1 à 9 et graduations intermédiaires fines, aiguille rouge pivotant au centre (moyeu foncé cerclé de laiton), petite mention « TODAY'S MOOD » et nom de la jauge sur le cadran. L'aiguille se déplace au doigt (glisser sur le cadran) **et** avec des boutons − / +. Le libellé du cran s'affiche en grand sous le cadran.
- **Compte-tours (énergie sexuelle)** : même géométrie mais cadran noir `#14100C`, graduations et chiffres crème, **zone rouge sur 8–9**, mention « TR/MIN × 1000 », aiguille crème, chiffre courant au bas du cadran.
- **Jauge d'eau** : demi-cadran crème façon jauge de carburant, 0 → 1 L → 2 L, zone verte entre 1,5 et 2 L, aiguille rouge ; à côté, la quantité en grand (« 1,3 L ») et « Encore 0,7 L » ou « Objectif atteint ».
- **Bilan** : 5 visages SVG au trait dans des tuiles ; sélection = bordure laiton.
- **Accords** : sélecteur segmenté en pilule Bon / Moyen / Pas bon ; segment actif plein laiton.
- **Résumé d'accord** : encadré à fond `#2E2519` avec un filet laiton à gauche.
- **Écran de verrouillage Perso** : grand bouton rond d'empreinte cerclé de laiton, « Accès réservé ».
- Pas d'emoji dans l'interface, pas de dégradés décoratifs. Contrastes de texte ≥ 4,5:1.

## 9. Structure du Google Sheet

Classeur « Today's Mood – données », 5 onglets. Première ligne = en-têtes. Dates au format `AAAA-MM-JJ`.

| Onglet | Une ligne = | Colonnes |
|---|---|---|
| `Fiches` | un jour | voir ci-dessous |
| `Marches` | une marche | id, date, km |
| `Pensees` | une citation favorite ou vue | id, favori (oui/non), dernière apparition |
| `Pastilles` | une catégorie d'événement | nom, ordre, visible |
| `Reglages` | un réglage | clé, valeur |

Colonnes de `Fiches` : date, modifie_le, pensee_id, meteo_tmin, meteo_tmax, meteo_pluie_mm, meteo_soleil_h, meteo_nuages_pct, meteo_code, meteo_ressenti, photo_ciel, photo_jour, humeur_matin, humeur_soir, energie, inspiration, energie_sexuelle, bilan, evt_appreciation, evt_categorie, evt_texte, accord_parole, accord_personnel, accord_supposition, accord_mieux, pas, natation_m, eau_ml, cafe, deca, biere, vin, biscotte_1, biscotte_2, recit, recit_favori, recit_piment, mylove, mylove_favori, mylove_piment.

Les données numériques restent numériques (pour les futurs graphiques). Une valeur non saisie reste vide (pas de 0).

## 10. Plan de construction

1. **Test du partage** : mini-PWA installable qui reçoit une transcription de l'Enregistreur (texte et fichier) et l'affiche. Rien d'autre.
2. **Socle** : PWA complète, 4 onglets, jauges 9 crans, enregistrement automatique en IndexedDB, Apps Script + Sheet, synchronisation, sélecteur de date, heure de bascule, hors ligne, écran Réglages minimal (URL, jeton).
3. **Météo et photos** : Open-Meteo, météo ressentie, deux photos compressées vers Drive.
4. **Compteurs** : boissons + jauge d'eau, sport avec marches multiples, totaux jour / mois / total, boutons −1.
5. **Perso** : verrou par empreinte, compte-tours, Biscotte, My Love, routage du partage vers My Love.
6. **Pensées du jour** : base de citations, écran d'ouverture, favoris.
7. **Historique, export et réglages** : recherche, mémos marqués, export Word, écran Réglages complet.

Plus tard (hors périmètre pour l'instant) : graphiques de tendances (humeur × météo, matin × soir, accords dans le temps).
