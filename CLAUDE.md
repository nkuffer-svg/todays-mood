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
                                   ├─► Google Drive (photos)
                                   └─► API Netatmo (station de la maison, version 5)
```

### Front (dossier racine du dépôt)

- **HTML, CSS et JavaScript « vanilla »**, sans framework et **sans étape de build** : les fichiers du dépôt sont servis tels quels par GitHub Pages. Les modules ES natifs (`<script type="module">`) sont bienvenus.
- Une petite bibliothèque chargée depuis un CDN est acceptable si elle évite beaucoup de code (ex. génération .docx à l'étape 7), mais demande d'abord.
- **PWA** : `manifest.webmanifest` (nom « Today's Mood », thème sombre, icônes), service worker pour le fonctionnement hors ligne.
- **Share Target** : le manifest déclare l'app comme cible de partage Android. La transcription de l'Enregistreur peut arriver en **texte** ou en **fichier .txt** : gérer les deux (méthode POST, `multipart/form-data`, le service worker intercepte la requête, lit le contenu, le stocke, puis redirige vers l'écran de choix de destination).
- **Stockage local** : IndexedDB est la source de vérité sur le téléphone. Toute saisie y est écrite immédiatement (enregistrement automatique, pas de bouton Valider), puis placée dans une **file de synchronisation** envoyée à Apps Script dès que le réseau est disponible. Au démarrage, l'app récupère les données du Sheet pour reconstituer l'historique (totaux, recherche).
- **Raccourcis de l'icône** (version 3, partie B) : le manifest déclare des `shortcuts` Android (appui long sur l'icône) : « + 500 ml d'eau », « + 1 café », « Tu grattes ? + 1 », chacun avec une petite icône laiton (`icons/raccourci-*.png`). Ils ouvrent `./?raccourci=eau|cafe|guitare` : l'app enregistre l'action dans la fiche du jour (selon l'heure de bascule), vibre si Chrome le permet (il refuse la vibration tant qu'on n'a pas touché l'écran, donc en pratique pas à l'ouverture par un raccourci), affiche un bref message de confirmation en bas de l'écran puis l'onglet concerné (Journée ou What's up). Pas de pensée en plein écran à cette ouverture (elle viendra à la suivante).
- **Icône de l'app** : petit cadran crème cerclé de laiton, graduations foncées, aiguille rouge, moyeu cerclé de laiton, sur fond `#17130F` (`icons/icon.svg`, version « maskable » plus petite pour la zone sûre ; PNG régénérés par `node outils/generer-icones.js`).
- **Verrou Perso** : WebAuthn avec l'authentificateur de la plateforme (empreinte du Pixel), `userVerification: "required"`. C'est un verrou d'interface, pas un chiffrement. L'onglet se reverrouille quand on le quitte ou quand l'app passe en arrière-plan.

### Back (dossier `apps-script/` du dépôt)

- **Google Apps Script** lié au Google Sheet « Today's Mood – données », déployé en **Application Web** (exécuter en tant que : moi ; accès : tout le monde).
- L'utilisateur **copie-colle** le code de `apps-script/` dans l'éditeur Apps Script. Garde peu de fichiers (`Code.gs`, éventuellement un ou deux autres), et rappelle-lui à chaque modification de faire « Gérer les déploiements → Modifier → Nouvelle version » pour garder la même URL.
- **Sécurité** : chaque requête contient un **jeton secret** (longue chaîne aléatoire). Le jeton est stocké côté Apps Script dans les Propriétés du script, et côté téléphone dans les Réglages de l'app (saisi une fois par l'utilisateur). **Le jeton ne doit jamais apparaître dans le dépôt** : le dépôt est public (GitHub Pages gratuit).
- **CORS** : appeler la Web App avec `fetch` en POST et `Content-Type: text/plain;charset=utf-8` (corps JSON en texte) pour éviter la requête préalable OPTIONS. Réponses en JSON via `ContentService`.
- **Sauvegarde automatique** (version 3, partie B) : la fonction `sauvegarder` copie le classeur dans un dossier Drive « Today's Mood – sauvegardes », nommé « Today's Mood – sauvegarde AAAA-MM-JJ », et ne garde que les **12 copies** les plus récentes (les autres vont à la corbeille de Drive). Un déclencheur hebdomadaire (dimanche vers 23 h, fuseau du projet) est installé en lançant **une seule fois** `installerSauvegarde` depuis l'éditeur (relançable sans doublon ; fait aussi une première sauvegarde). La date de la dernière sauvegarde est gardée dans les Propriétés du script (`DERNIERE_SAUVEGARDE`), renvoyée par `lire` et `ping`, et affichée dans les Réglages de l'app (avec un avertissement au-delà de 8 jours).
- **Photos** : compressées sur le téléphone avant l'envoi (JPEG, côté le plus long 1600 px, qualité ≈ 0,8), envoyées en base64, enregistrées dans un dossier Drive « Today's Mood – photos ». La fiche stocke l'identifiant ou le lien du fichier.

### Météo

- **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`, archives `https://archive-api.open-meteo.com/v1/archive`), `timezone=Europe/Zurich`, sans clé.
- **Résumé de la journée** (données journalières) : température min/max, précipitations (mm), durée d'ensoleillement (convertie en heures), couverture nuageuse moyenne (%), code météo WMO. Plus `sunset` (heure du coucher, stockée « HH:MM ») et `daylight_duration` (durée du jour, stockée en minutes). Récupérés automatiquement à la première ouverture du jour.
- **Deux relevés horaires** (version 3) : **8 h** (onglet Matin) et **16 h** (onglet Soir). Pour chacun : température, couverture nuageuse (%), précipitations (mm), code météo, vent (vitesse km/h et direction en degrés), pression au niveau de la mer (hPa). Le relevé est enregistré à la **première ouverture de l'onglet après l'heure concernée** (ou quand l'heure passe pendant que l'onglet est ouvert) ; avant, l'onglet affiche « Relevé à 8 h » / « Relevé à 16 h ». Une récupération automatique ne remplit que les champs vides ; le bouton « Actualiser » met tout à jour.
- **Tendance de la pression sur 3 h** (↗, ↘ ou →, seuil 1 hPa) : pression à l'heure du relevé moins pression 3 h avant. Pas de colonne dans le Sheet : gardée sur le téléphone (réglage local `meteoExtra`, avec les durées du jour et de la veille en secondes pour l'écart « depuis hier »).
- **Rattrapage rétroactif** (une fois par jour, après la première synchro) : pour les fiches **déjà existantes** (jamais de nouvelle fiche), complète les relevés de 8 h et 16 h, le coucher du soleil, la durée du jour et la lune. Les 92 derniers jours en une requête (`past_days=92`), les fiches plus anciennes via l'API d'archives.
- Position : GPS du téléphone si autorisé, sinon lieu fixe réglable (par défaut Lavaux, environ 46,49 N / 6,73 E).

### Netatmo (version 5, partie A)

- Station Netatmo de l'utilisateur : **module intérieur** et **anémomètre** pour l'instant ; bientôt **module extérieur** et **pluviomètre**. L'app passe **toujours par Apps Script** (le téléphone ne parle jamais directement à Netatmo).
- **Clés** : `NETATMO_CLIENT_ID`, `NETATMO_CLIENT_SECRET`, `NETATMO_REFRESH_TOKEN` (app créée sur dev.netatmo.com, refresh token généré avec le *Token generator*, scope `read_station`). **Uniquement dans les Propriétés du script**, collées par l'utilisateur lui-même : jamais dans le dépôt, ni dans l'app, ni dans la conversation.
- Apps Script renouvelle seul le jeton d'accès (≈ 3 h, gardé dans `NETATMO_ACCESS_TOKEN` / `NETATMO_EXPIRE`) et **enregistre à chaque fois le nouveau refresh token** renvoyé par Netatmo. Un 401/403 provoque un renouvellement puis un nouvel essai. Pannes passagères de Netatmo (5xx, « Service temporarily unavailable ») : jusqu'à 4 essais (attentes de 2 s, 5 s, 10 s). Les espaces collés autour des clés sont retirés ; messages d'erreur distincts pour `invalid_client` (client ID / secret) et `invalid_grant` (refresh token).
- `getstationsdata` à chaque appel pour **découvrir les modules** (types `NAMain` intérieur, `NAModule1` extérieur, `NAModule2` anémomètre, `NAModule3` pluviomètre ; première station du compte) et leur date d'installation : un nouveau module est pris en compte sans modification. `getmeasure` (pas de 30 min, `optimize=false`, tranches de 20 jours) pour lire une valeur à une heure précise : la **valeur la plus proche**, à 40 min près au plus. Pluie du jour : `sum_rain` au pas de 1 jour.
- Action `netatmo` de la Web App : `{ dates: [...] }` (31 au plus) → `{ station, modules: { interieur, vent, exterieur?, pluie? : { nom, installe } }, releves: { date: { champ: valeur } } }`, seulement pour les modules présents, les dates après leur installation et les heures passées. Fonction `testerNetatmo` à lancer depuis l'éditeur (journal : modules et relevés du jour). Erreurs : code `netatmo_config` (clés manquantes), `netatmo` (refus ou panne).
- Côté app : relevés de la fiche du jour à l'ouverture de l'onglet Matin ou Soir dès qu'une heure de relevé est passée (7 h, 8 h, 16 h, 20 h) ; une récupération automatique ne remplit que les champs vides. Si Netatmo ne répond pas : message, bouton « Réessayer », saisie manuelle possible, et l'app réessaie au plus tôt 10 minutes plus tard (au retour dans l'app, au retour du réseau, chaque minute si l'onglet est ouvert) ; si les clés manquent, pas de nouvel essai automatique avant 6 h. Modules détectés gardés sur le téléphone (réglage local `netatmoModules`).
- **Rattrapage rétroactif** (une fois par jour, après la météo) : les fiches **déjà existantes** reçoivent l'historique Netatmo (intérieur 7 h / 20 h, vent 8 h / 16 h, et plus tard extérieur et pluie), à partir de la date d'installation de chaque module, par lots de 31 dates. Jamais de nouvelle fiche.

### Bise, lune, solstices (calculés, version 3)

- **Bise** : vent du nord-est (direction entre 20° et 100°) à 15 km/h ou plus (seuils réglables : `biseVitesse`, `biseDirMin`, `biseDirMax`). Pas stockée : calculée à partir du vent du relevé — celui de l'**anémomètre Netatmo en priorité** (`nt8_vent`, `nt16_vent`, avec la petite mention « Vent mesuré par ton anémomètre »), Open-Meteo en secours (version 5). Pastille allumée en laiton « Bise · 22 km/h NE » ; sinon pastille discrète « Vent 12 km/h SO ». À côté : pastille de pression « 1 021 hPa ↗ ». Points cardinaux en français (N, NE, E, SE, S, SO, O, NO).
- **Phase de lune** : calculée par l'app (formules de Meeus, à 21 h), sans service externe. Pastille dans l'en-tête, à côté du bouton Réglages : petit dessin (disque sombre, part éclairée crème, à droite quand elle croît) et pourcentage d'illumination. Enregistrée dans la fiche du jour (`lune_phase` : fraction du cycle, 0 = nouvelle, 0,5 = pleine ; `lune_pct` : 0–100).
- **Solstices** : calculés (Meeus) pour la mention « Solstice dans 24 jours, ensuite les jours rallongent » (ou « raccourcissent » avant le solstice de juin).

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
- **Barre de progression** du décompte de fermeture automatique, en haut de l'écran (toujours visible).
- **« Il y a un an »** : sous la pensée, si une fiche existe pour la même date l'année précédente, une carte montre l'humeur (moyenne matin et soir, en mot), le mot du jour, la météo (température max et ressenti), l'appréciation, la catégorie et le texte de l'événement. Sinon, rien. (Pas de carte un 29 février.)

## 5. Les 5 onglets de la fiche du jour

Ordre des onglets : **Matin · Journée · Soir · What's up · Perso**.

### Matin
| Rubrique | Saisie | Stockage |
|---|---|---|
| Météo du matin (auto) | relevé de 8 h (Open-Meteo) + pastilles bise et pression, puis petit encadré « La journée » (min/max, pluie, soleil, nuages) | champs numériques `meteo8_*` et `meteo_*` |
| La maison (version 5) | relevé Netatmo intérieur de 7 h (voir ci-dessous) | `maison7_temp`, `maison7_hum`, `maison7_co2`, `maison_source` |
| Météo ressentie | 4 icônes : Soleil, Nuageux, Pluie, Neige | code numérique 1–4 |
| Le sommeil (version 4) | « Couché » et « Levé » (heures), durée calculée, jauge 9 crans « Qualité » | `sommeil_coucher`, `sommeil_lever` (« HH:MM »), `sommeil_duree_min`, `sommeil_qualite` 1–9 |
| Photo du ciel | appareil photo | lien Drive |
| Humeur du matin | jauge 9 crans | 1–9 |
| Énergie | jauge 9 crans | 1–9 |
| Inspiration | jauge 9 crans | 1–9 |

**La maison** (carte après la météo du matin, version 5, partie A ; même carte dans le Soir, après la météo du soir, pour le relevé de 20 h) : icône maison au trait laiton dans un rond (comme la météo), « Relevé de 7 h », **température intérieure en grand**, humidité (%) et CO2 (ppm). Écart : le matin avec le relevé de **la veille à 20 h** (« −1,4° depuis hier à 20 h »), le soir avec **le matin même** (« +2,4° depuis ce matin »). Pastilles : « Aère ! CO2 élevé » (petit voyant orange `#E8862E`) au-dessus de **1200 ppm**, « Air sec » (laiton) sous **35 %** d'humidité ; seuils réglables (`co2Max`, `humMin`). **Un appui sur la température** ouvre un petit champ pour la corriger ou l'effacer ; sans relevé, boutons « Réessayer » et « Saisir à la main ». Une saisie ou correction met `maison_source` à `manuel` (sinon `netatmo`), avec la mention « Saisie ou corrigée à la main » / « Mesuré par ta station Netatmo ». Avant l'heure : « Relevé à 7 h » / « Relevé à 20 h ».

**Le sommeil** (carte après la météo ressentie, version 4, partie A) : deux champs heure « Couché » et « Levé ». L'heure de coucher appartient à la nuit précédente : durée = (levé − couché + 24 h) modulo 24 h (couché 23:10, levé 06:45 → 7 h 35 ; couché 00:40 → 6 h 05), avec la précision « La veille au soir » (coucher à partir de 12 h) ou « Après minuit ». Affichage « 7 h 35 de nuit », écart avec la veille et moyenne de la semaine (du lundi jusqu'au jour affiché, nuits saisies seulement). La durée est enregistrée dans `sommeil_duree_min` à chaque changement. Jauge « Qualité » : cadran crème, mention SOMMEIL, même fonctionnement que les autres jauges.

Libellés des jauges (le mot du cran sélectionné s'affiche en grand) :

| Cran | Humeur | Énergie | Inspiration | Sommeil (qualité) |
|---|---|---|---|---|
| 1 | Désespéré | Panne sèche | Vide | Nuit blanche |
| 2 | Triste | Sur la réserve | Éteint | Très agitée |
| 3 | Morose | Au ralenti | Brumeux | Agitée |
| 4 | Mélancolique | Petite allure | Hésitant | Moyenne |
| 5 | Neutre | Vitesse de croisière | Ordinaire | Correcte |
| 6 | Serein | Bien lancé | Curieux | Bonne |
| 7 | Content | Pleine route | Inspiré | Réparatrice |
| 8 | Enjoué | Plein gaz | Fourmillant | Profonde |
| 9 | Joyeux | À fond | Illuminé | Abyssale |

### Journée
- **Quoi dans le goulot ?** Eau : boutons +500 ml et +300 ml, bouton « annuler le dernier ajout », jauge de carburant vers l'objectif (2 L par défaut, réglable). Café, Déca, Bière, Verre de vin : compteurs +1 / −1. Chaque ligne affiche Aujourd'hui / Mois / Total.
- **Comment t'as bougé ton Q ?** Nombre de pas (saisie manuelle du total du jour). Marche : bouton « + Ajouter une marche » (km), **plusieurs marches par jour**, chacune supprimable ; affichage km jour / mois / total et nombre de marches mois / total. Natation : **une séance par jour** maximum, en mètres ; affichage m jour / mois / total et nombre de séances mois / total. Aucune liaison Garmin ou Strava.
- **Photo du jour** : appareil photo, distincte de la photo du ciel.

### Soir
- **Météo du soir** (carte en haut, version 3) : relevé de 16 h, pastilles bise et pression, puis « Ressenti du soir » avec les 4 mêmes icônes que le matin (`meteo_soir_ressenti`, 1–4).
- **La maison** (version 5, après la météo du soir) : relevé intérieur de 20 h (`maison20_*`), écart avec le matin. Voir l'onglet Matin.
- **Module extérieur et pluviomètre Netatmo** (dès qu'ils seront installés, sans modification) : dans les relevés de 8 h et 16 h, ligne « Ta station dehors : 4,2° » sous les valeurs Open-Meteo (`nt8_temp_ext`, `nt16_temp_ext`) ; dans l'encadré « La journée », « Ton pluviomètre : 3,2 mm » (`nt_pluie_jour`, rempli une fois la journée finie). Ces mesures sont privilégiées par la recherche par météo.
- **Coucher de soleil** (carte, version 3) : heure du coucher, durée du jour, écart avec la veille (« −2 min depuis hier », en secondes près du solstice) et mention vers le prochain solstice. Dans la même carte : **Photo du ciel du soir** (`photo_ciel_soir`, même fonctionnement que la photo du ciel du matin).
- **Humeur du soir** : même jauge que le matin, avec un rappel de l'humeur du matin.
- **Événement marquant** (un par jour) : appréciation Cool / Pas cool (pastilles), une catégorie parmi Job · Maison · Famille élargie · Famille · Réflexion · Pensée · Scène de vie + catégories ajoutées depuis l'app (pastille « + Nouvelle »), description courte.
- **Récit du jour** : texte long reçu via le partage de l'Enregistreur (voir section 6), modifiable. Marques : Favori (étoile) et/ou Piment.
- **Mot du jour** (version 3, partie B) : un seul mot pour résumer la journée (pas d'espace : les espaces sont retirés pendant la saisie ; 25 caractères au plus). Pendant la saisie, les mots déjà utilisés sont proposés en pastilles (commençant par ce qui est tapé, les plus fréquents d'abord, majuscules et accents ignorés). Stockage `mot_du_jour` (texte). Affiché aussi dans le bilan du dimanche (les 7 mots de la semaine) et dans la carte « Il y a un an ».
- **Bilan du jour** : 5 visages dessinés en SVG (pas d'emoji), de « Pas content » à « Très content ». Stockage 1–5.
- **Les 4 accords toltèques** : Parole impeccable · Ne pas en faire une affaire personnelle · Pas de supposition · Faire de son mieux. Pour chacun, un sélecteur Bon / Moyen / Pas bon (stockage 3 / 2 / 1) et un bouton « i » qui ouvre un court résumé de l'accord (un seul ouvert à la fois). Résumés :
  - Parole impeccable : « Parler avec intégrité et dire ce que l'on pense vraiment. Ne pas retourner ses mots contre soi ni contre les autres : pas de médisance, pas de jugement gratuit. »
  - Affaire personnelle : « Ce que les autres disent ou font reflète leur propre réalité, pas la tienne. Ne pas le prendre pour soi évite bien des souffrances inutiles. »
  - Pas de supposition : « Oser poser des questions et dire clairement ce que l'on veut, plutôt que d'imaginer les intentions des autres. Moins de malentendus, moins de conflits. »
  - Faire de son mieux : « Ton mieux varie d'un jour à l'autre, selon la fatigue ou l'humeur. Faire de son mieux, c'est agir pleinement sans se juger ni culpabiliser. »

### Perso (verrouillé par empreinte)
- **Énergie sexuelle** : compte-tours (voir section 8), 9 crans, sans libellés (chiffre seul). Stockage 1–9.
- **Happy Dicky** (anciennement « Biscotte » ; seul le nom affiché a changé, les colonnes restent `biscotte_1` et `biscotte_2`) : deux gros boutons ronds laiton (100 px) avec des pistons dessinés au trait foncé (couleur `currentColor`), sans emoji, dans l'esprit moteur de l'app — bouton 1 = un piston, bouton 2 = deux pistons en V façon moteur bicylindre (SVG au §8, à reprendre tel quel). Chacun ajoute +1 au compteur du jour correspondant, avec un −1. Affichage pour chacun : aujourd'hui, mois, total ; plus une ligne « Somme 1 + 2 » (mois et total).
- **My Love** : comme le Récit du jour (partage depuis l'Enregistreur, texte modifiable, marques Favori / Piment). État vide : « Aucun mémo aujourd'hui » + rappel de la manipulation.
- Le contenu Perso n'apparaît dans l'historique et la recherche qu'une fois déverrouillé.

### What's up
Titre de l'écran : « What's up Today ? » (Bebas Neue).
- **Who's the cook ?** (repas du soir) : pastilles à choix multiple parmi une liste modifiable dans les Réglages (par défaut Nico · Danis · Commande). Stockage `cuisine` = noms séparés par des virgules (ex. « Nico,Danis »). Puis un choix unique Carnivore / Végétarien (icônes pilon et feuille), stockage `repas_type` = `carnivore` / `vegetarien`. Dessous, un « tableau des chefs » du mois façon panneau de course : nombre de repas par personne (classement P1, P2…), et le nombre de repas Carnivore / Végétarien.
- **Tu grattes ou quoi ?** : gros bouton laiton avec un médiator, +1 par session de guitare (`guitare`), avec −1. Affichage aujourd'hui / mois / total.
- **Burn on the fire** : sélecteur Hiver / Été, choisi automatiquement selon la date (hiver du 1er octobre au 30 avril, dates réglables) mais modifiable à la main (le choix manuel ne vaut que pour la session). En hiver : bouton flamme, +1 feu de poêle (`feux_poele`). En été : bouton gril, +1 barbecue (`barbecues`). Les deux ont un −1. Affichage aujourd'hui / cette saison / total. En hiver, afficher aussi la date du premier feu de la saison et celle de la saison précédente (calculées depuis les données, rien à stocker).
  - **L'effet poêle** (version 5, carte sous Burn on the fire, en mode Hiver) : différence moyenne de température intérieure **à 20 h** (`maison20_temp`) entre les soirs d'hiver **avec feu** et **sans feu**. De préférence à température extérieure comparable : chaque soir avec feu est comparé aux soirs sans feu dont le temps dehors (ta station à 16 h, sinon Open-Meteo à 16 h, sinon moyenne min/max) est à **±3 °C** ; s'il y a au moins 3 soirs comparables, on fait la moyenne de ces écarts, sinon la simple différence des moyennes (avec une mention). Affichage « +3,4° par feu, à 20 h » en grand et deux barres : avec feu (laiton) et sans feu (sombre), avec leurs températures. Moins de **5 soirs de chaque sorte** : « Encore quelques soirs pour calculer » et les compteurs.
  - **La réserve de bois** (version 5, carte sous L'effet poêle, en mode Hiver) : bouton « + Livraison de bois » (date, stères ; deux livraisons le même jour s'additionnent), liste des livraisons de la période (supprimables). **Feux par stère** : 20 par défaut, réglable (`feuxParStere`). Feux restants = stères livrés depuis le dernier « stock vide » × feux par stère − feux faits depuis (fiches **et report de saison** d'hiver, s'il date de cette période). Affichage « ≈ 35 feux », réservoir gradué laiton (comme la cagnotte), et date d'épuisement au rythme des **14 derniers jours** (« Jusqu'à mi-janvier au rythme actuel » ; début = jours 1–10, mi = 11–20, fin = 21–31). Petit bouton discret **« Stock vide »** : l'app recalcule les feux par stère (feux faits depuis la période / stères de la période), ajoute la date à `boisVides` (liste JSON, onglet `Reglages`) et repart de zéro. Données : onglet `Bois` (date, steres), magasin local `bois` (clé : date), synchronisé comme les tentations.
  - **Report de saison** (Réglages, carte « Feux et barbecues d'avant l'app ») : pour une saison donnée (ex. hiver 2026-2027, été 2026), un nombre de feux — ou de barbecues — faits avant l'app, et en option la date du premier feu (ou barbecue). Le report s'ajoute aux totaux « cette saison » et « total » ; une date de premier feu saisie remplace celle calculée depuis les fiches. Les reports sont stockés dans l'onglet `Reglages` (clé `reportsSaisons`, liste JSON `[{type: "hiver"|"ete", saison: "2026-2027"|"2026", nombre, premier?}]`). **Pas de fausses fiches.** Nom d'une saison : « AAAA-AAAA » si elle chevauche deux années (hiver), sinon « AAAA ».
- **Fangio ou Rossi ?** : deux grandes tuiles. Sur chaque tuile, seulement l'icône (casque, volant) et, en dessous, le nom « Rossi » ou « Fangio » en Bebas Neue 20 px, lettres espacées (pas de texte « Moto » / « Voiture » affiché ; les boutons gardent `aria-label="Moto (Rossi)"` et `aria-label="Voiture (Fangio)"`). Un seul choix par jour (`deplacement` = `moto` / `voiture`). Compteurs mois / total pour chacun.

- **Le chien** (version 4, partie A, carte après Who's the Boss) : deux compteurs +1 / −1 en ligne (comme les boissons) : « Balade » (icône patte, `chien_balades`) et « Séance d'éducation » (`chien_education`). Affichage aujourd'hui / mois / total.
- **Temps d'écran** (version 4, partie A, carte après Le chien) : l'app ne peut pas lire Bien-être numérique, saisie manuelle par **deux molettes** (heures 0–16, avec une position « – » = non saisi ; minutes 0–59), mention « À reporter depuis Bien-être numérique ». Choisir des minutes sans heures compte 0 h. Affichage en **compteur horaire à rouleaux** « 03 H 12 » (heures sur cases sombres, minutes sur cases crème, même style que les compteurs kilométriques). Écart avec la veille et moyenne de la semaine (du lundi au jour affiché). Stockage `ecran_min` (minutes).
- **Who's the Boss ?** (version 4, partie B ; carte après Fangio ou Rossi) : sous-titre « Une envie d'acheter ? Qui a gagné ? ». Deux grandes pastilles « Mister Me » et « Le plaisir » (Bebas Neue). Plusieurs tentations par jour : chaque appui crée une nouvelle entrée.
  - Mister Me : un petit formulaire apparaît avec « Quoi ? » (texte facultatif), « Go to Revolut » (montant en CHF, clavier décimal) et un bouton « Ajouter ».
  - Le plaisir : l'entrée est ajoutée directement, sans montant ni autre champ (la dépense est suivie dans une autre app).
  - Liste des entrées du jour, chacune supprimable.
  - Dessous : score du mois façon panneau de course (« Mister Me 7 – Le plaisir 3 »), Go to Revolut du mois et total général, « Plus belle victoire » (plus gros montant de tous les temps, avec son « quoi »), et une **cagnotte** : nom et montant de l'objectif dans les Réglages, avec une **date de début** fixée à sa création ; réservoir gradué laiton qui se remplit avec le total Go to Revolut depuis cette date. Objectif atteint : petit message de félicitations et proposition d'en fixer un nouveau (qui repart de zéro à sa date de début).
  - Montants affichés au format suisse (« 149.90 CHF », « 320 CHF »). Un montant vide est accepté (victoire sans montant). Le réservoir est un tube vertical gradué (0, ¼, ½, ¾, plein) à bord laiton, niveau laiton.
  - Données : nouvel onglet du Sheet `Tentations` (id, date, gagnant = `me` ou `plaisir`, quoi, montant_chf), magasin local `tentations`, synchronisé comme les marches (ajouts et suppressions par la file). Objectif de cagnotte dans l'onglet `Reglages` : clés `cagnotteNom`, `cagnotteMontant`, `cagnotteDebut` (AAAA-MM-JJ). En simulation, rien n'est ajouté.
- **Le défi du mois** (version 4, partie B) : choisi dans les Réglages (carte « Défi du mois ») pour le mois en cours **ou le mois suivant**, parmi trois types, plus un libellé libre (proposé automatiquement, modifiable) :
  - « Faire X fois » : un compteur de l'app atteint X sur le mois (ex. guitare 20 fois) ;
  - « Chaque jour » : une condition remplie tous les jours (ex. objectif d'eau atteint) ;
  - « Jamais en semaine » : un compteur reste à 0 du lundi au vendredi (ex. bière + vin).
  - Catalogue (`js/defis.js`) — Faire X fois : sessions de guitare, balades du chien, séances d'éducation, marches, kilomètres de marche, séances de natation, jours à moto, feux de poêle, barbecues, victoires de Mister Me, CHF Go to Revolut. Chaque jour : objectif d'eau atteint, au moins une marche, au moins une session de guitare, au moins une balade du chien, journal rempli (humeur matin et soir), mot du jour noté. Jamais en semaine : bière + vin, bière, vin, café, victoire du plaisir, voiture (Fangio).
  - Règles : le défi compte pour tout le mois, du 1er au dernier jour. « Faire X fois » est réussi dès que la cible est atteinte. « Chaque jour » est raté dès qu'un jour passé (avant aujourd'hui) ne remplit pas la condition ; progression = jours réussis / jours du mois. « Jamais en semaine » est raté dès qu'un jour du lundi au vendredi a le compteur au-dessus de 0 ; progression = jours de semaine tenus / jours de semaine du mois.
  - Plaque laiton en tête de l'onglet What's up : libellé, barre de progression, « 14 / 20 », jours restants. Sans défi choisi pour le mois : ni plaque ni résultat.
  - À la fin du mois : le résultat (`reussi` / `rate`) est calculé et enregistré dans le défi à la première ouverture du mois suivant (après la pensée et le bilan), puis annoncé une fois sur un écran « Défi du mois » (réglage local `defiAnnonce`). Le bilan du dimanche montre la plaque du défi du mois de ce dimanche.
  - Données : nouvel onglet du Sheet `Defis` (mois, type, compteur, cible, libelle, resultat ; types `fois` / `chaque_jour` / `jamais_semaine`), magasin local `defis` (clé : mois), synchronisé comme les tentations. En simulation, rien n'est enregistré.

### Habillage et petits plaisirs (version 2, partie B)
- **Voyants du tableau de bord** : dans la barre d'onglets, un petit voyant (6 px, orange `#E8862E`, légère lueur) en haut à droite de chaque onglet où il reste quelque chose à remplir **aujourd'hui** ; éteint (`#3A3026`) sinon.
  - Matin : humeur du matin, énergie, inspiration, météo ressentie, sommeil (couché, levé, qualité).
  - Journée (à partir de l'heure du soir, 18 h par défaut, réglable) : nombre de pas.
  - Soir (à partir de 18 h) : ressenti du soir, humeur du soir, bilan, mot du jour, appréciation de l'événement, 4 accords.
  - What's up (à partir de 18 h) : cuisinier, déplacement ; à partir de 21 h, aussi le temps d'écran.
  - Perso : jamais de voyant.
  - Après minuit, tant que la fiche n'a pas basculé, on reste « le soir ».
- **Vibration** : petit « clac » (`navigator.vibrate`, environ 10 ms) sur chaque compteur (+1, −1, eau, marche) et chaque changement de cran d'une jauge. Désactivable dans les Réglages (réglage propre au téléphone).
- **Séries** : plaque laiton « N jours d'affilée » (petites vis aux extrémités, Bebas Neue), affichée dès 2 jours consécutifs pour : guitare, objectif d'eau atteint, au moins une marche, journal rempli (humeur du matin ET du soir saisies). Calculées depuis les données ; si le jour même n'est pas encore réussi, la série compte jusqu'à la veille (« en cours »). Chaque plaque apparaît dans sa rubrique (eau, marche, guitare, humeur du soir pour le journal), et toutes ensemble dans le bilan du dimanche.
- **Compteurs kilométriques** : les grands totaux de marche (km, une décimale), d'eau (litres, une décimale) et de pas s'affichent avec des chiffres à rouleaux : cases sombres à chiffres crème (Bebas Neue), décimale sur case crème à chiffre foncé, ombre intérieure en haut et en bas, petite animation de déroulement quand la valeur change. Utilisés pour les totaux de l'onglet Journée et dans le bilan du dimanche.
- **Clin d'œil Fangio** : si Déplacement = Voiture alors que la météo du jour donne au moins 15 °C (max) et au moins 4 h de soleil, un encadré en pointillés laiton avec une icône soleil et une phrase taquine en italique s'affiche sous les tuiles. 5 phrases qui tournent selon la date, avec la vraie température (ex. « 18° et grand soleil… et t'as pris la voiture ? »).
- **Bilan du dimanche** : le dimanche, à la première ouverture après l'heure du soir (une fois), un écran « Bilan du dimanche » s'affiche (refermable). Aussi accessible depuis l'Historique, pour n'importe quelle semaine passée (flèches semaine précédente / suivante). Contenu : humeur de la semaine (barres matin crème et soir laiton, lundi → dimanche, moyennes et libellé de la moyenne), mots de la semaine (le mot du jour de chaque jour, lundi → dimanche), sommeil et écran (durée moyenne de sommeil, qualité moyenne en chiffre et en mot, temps d'écran moyen par jour), événements Cool / Pas cool, compteurs kilométriques avec le gain de la semaine, séries en cours, résumé What's up (cuisine, repas, guitare, feux ou barbecues, balades du chien et séances d'éducation, moto / voiture), Who's the Boss (score de la semaine et Go to Revolut de la semaine), état du défi du mois, médailles (nombre dans la vitrine, gagnées cette semaine, bouton « Voir la vitrine »).
- **Outils de test** (Réglages) : simulation d'une date et d'une heure pour tester ce qui dépend de la date (voyants, bilan du dimanche, « il y a un an », séries, livre de bord du 31 décembre), et « Forcer une médaille » (version 5 B). Pendant la simulation, un bandeau orange l'indique et **rien n'est enregistré ni envoyé au Sheet** ; elle s'arrête avec « Arrêter » ou en fermant l'app (stockée dans `sessionStorage`).

### Médailles du garage (version 5, partie B)
- Médailles **calculées depuis les données, y compris rétroactivement** (`js/medailles.js` : progression valeur / cible et date à laquelle le seuil a été franchi). Une médaille obtenue est enregistrée avec sa date (magasin local `medailles`, onglet `Medailles` du Sheet : id, date) et ne se perd plus, même si les données changent ensuite.
- Liste : **Cent feux** (100 feux de poêle, report de saison compris) · **1 000 km à pied** · **Mister Me × 10** (dix tentations d'affilée gagnées par Mister Me, dans l'ordre où elles ont été notées) · **Rossi sous la bise** (moto un jour de bise à 8 h ou 16 h) · **Guitar hero** (100 sessions) · **Lève-tôt** (couché entre 12 h et 22 h sept soirs de suite) · **Chef de la maison** (20 repas cuisinés par Nico) · **Abyssal** (5 nuits de qualité « Abyssale ») · **Hydraté** (objectif d'eau 30 jours d'affilée) · **Journal fidèle** (100 jours avec humeur du matin et du soir) · **Défi tenu × 3** (3 défis réussis) · **Cagnotte remplie** (objectif de la cagnotte en cours atteint).
- **3 médailles secrètes**, définies dans `js/medailles.js` (`secrete: true`) et volontairement **non décrites ici** : l'utilisateur veut la surprise. Ne jamais les lui dévoiler. Affichées « ? Secrète » / « À découvrir » jusqu'à leur obtention ; elles ne peuvent pas être forcées dans les outils de test.
- **Vérification** : au démarrage (après la pensée, le bilan et les défis), au retour dans l'app, et 2,5 s après chaque saisie (fiche, tentation, marche, réglages). La toute première fois sur un téléphone (réglage local `medaillesInit`), les médailles déjà gagnées sont enregistrées **sans fête**, avec un bref message « N médailles déjà gagnées : va voir la vitrine ». Ensuite, chaque nouvelle médaille est fêtée. Rien en simulation.
- **Quand une médaille tombe** : plein écran « Médaille obtenue ! », la médaille géante (180 px) tourne sur elle-même (3 tours, 2,4 s), vibration de fête (si la vibration est activée), nom, description, date ; fermeture automatique après 6 s ou bouton « Dans la vitrine ! ».
- **Vitrine** (Réglages → carte « Médailles du garage » → « Ouvrir la vitrine », et bilan du dimanche → « Voir la vitrine ») : compteur « 3 / 15 médailles obtenues », grille de 3 colonnes de médailles rondes (76 px). Débloquées : laiton en relief, icône foncée, nom en laiton clair, date d'obtention. À débloquer : sombres, progression (« 874 / 1 000 km ») et petite barre, description.
- **Outils de test** (Réglages) : « Forcer une médaille » (liste des médailles non secrètes) → animation, et la médaille apparaît dans la vitrine marquée « forcée (test) » ; **jamais enregistrée** (`sessionStorage`, disparaît en fermant l'app).

### Livre de bord annuel (version 5, partie B)
- Document Word (`js/livre.js`, même méthode que l'export OneNote : `js/docx.js`, qui sait maintenant faire sous-titres, tableaux, texte centré, couverture et sauts de page). Nom : `todays-mood-livre-de-bord-AAAA.docx`, téléchargé ou envoyé vers une app.
- **Le 31 décembre**, à la première ouverture (après la pensée, le bilan, les défis et les médailles) : écran « Ton livre de bord de l'année est prêt » avec « Télécharger (.docx) », « Envoyer vers une app » et « Plus tard » (une fois par année : réglage local `livreProposeLe` ; en simulation, proposé sans rien enregistrer). **Historique** → bouton « Livre de bord » : n'importe quelle année passée ou en cours.
- Contenu, esprit Garage vintage (titres laiton, tableaux à en-tête sombre et filets laiton) : couverture (« Livre de bord », l'année en grand rouge, nombre de jours notés) ; humeur mois par mois (moyennes matin et soir, en chiffre et en mot) ; les 5 plus beaux jours (meilleure humeur moyenne, avec mot du jour et événement) ; les 10 mots du jour les plus fréquents ; grands totaux (marche km et nombre, pas, eau, feux, barbecues, guitare, balades, Go to Revolut) ; tableau des chefs de l'année (et carnivore / végétarien) ; score Who's the Boss et plus belle victoire de Mister Me ; défis réussis ; médailles obtenues dans l'année ; premier et dernier feu des saisons d'hiver qui touchent l'année ; météo marquante (jour le plus chaud, le plus froid, le plus pluvieux, jours de bise).
- **Jamais de contenu de l'onglet Perso** : `energie_sexuelle`, `biscotte_*`, `mylove*` ne sont jamais lus par le livre.

## 6. Partage depuis l'Enregistreur

1. L'utilisateur dicte dans l'Enregistreur du Pixel, puis Partager → Transcription → Today's Mood.
2. L'app reçoit le texte (ou le fichier .txt), affiche un aperçu et demande : **Récit du jour** ou **My Love** ? (My Love demande l'empreinte.)
3. Le texte est ajouté à la fiche du jour (selon l'heure de bascule). Si le champ contient déjà du texte, demander : remplacer ou ajouter à la suite.
4. Seul le texte est conservé, jamais l'audio.

## 7. Historique, recherche, export, réglages

- **Historique** : sélecteur de vue **Date · Événement · Météo · Mot · Mémos** ; en bas, boutons « Bilan du dimanche », « Livre de bord » (version 5 B) et « Mes pensées favorites ». Recherche par date (calendrier) et par événement (filtres combinables : appréciation × une ou plusieurs catégories). Résultats en liste (date, appréciation, catégorie, début du texte), un appui ouvre la fiche complète.
- **Recherche par météo** (version 3, partie B) : filtres combinables (tous doivent être vrais) : Grand soleil, Pluie, Neige, Bise, Gel (< 0°), Chaud (> 25°), Pression basse (< 1005 hPa), Pleine lune ; choix du moment : relevé de 8 h, de 16 h ou journée. Règles :
  - Grand soleil : code météo 0 ou 1 ; sinon, pour un relevé, nuages ≤ 20 % ; pour la journée, soleil ≥ 70 % de la durée du jour.
  - Pluie : code de pluie ou d'orage, ou précipitations (≥ 0,1 mm pour un relevé, ≥ 1 mm pour la journée) sans code de neige. Neige : code de neige.
  - Bise : vent du relevé (seuils des Réglages) ; journée = bise à 8 h ou à 16 h.
  - Gel / Chaud : température du relevé ; journée = min < 0° / max > 25°.
  - Pression basse : pression du relevé ; journée = la plus basse des deux relevés.
  - Pleine lune : phase « Pleine lune » (indépendante du moment).
  - Avec un filtre météo, seuls les jours qui ont la météo du moment choisi comptent.
  - En tête des résultats : nombre de jours trouvés, humeur moyenne de ces jours (moyenne matin et soir de chaque jour, en chiffre et en mot) et celle des autres jours, avec l'écart. Liste : date, icône météo, températures, humeur matin → soir (vert si elle monte, rouge si elle baisse), appréciation de l'événement ; un appui ouvre la fiche (Matin, ou Soir pour le relevé de 16 h).
- **Recherche par mot du jour** : champ de recherche (contient, sans tenir compte des majuscules et accents) et nuage des 30 mots les plus utilisés (un appui = ce mot exactement). Même en-tête (nombre de jours, humeur moyenne comparée aux autres jours) et liste (date, mot, humeur matin → soir, appréciation).
- **Mémos marqués** : vue de tous les Récits et My Love marqués Favori ou Piment, filtrable.
- **Export Word** : un fichier .docx des mémos marqués (date, type, marque, texte), à importer dans OneNote. Option « seulement depuis le dernier export ».
- **Pensées favorites** : liste avec auteur.
- **Réglages** : heure de bascule (4 h), objectif d'eau (2 L), pastilles de catégorie (ajout, renommage, masquage), durée de la pensée (30 s), position météo (GPS ou lieu fixe), noms proposés pour « Who's the cook ? », seuils de la bise (15 km/h, de 20° à 100°), seuils de la maison (CO2 élevé dès 1200 ppm, air sec sous 35 %), feux par stère (20), bouton « Tester Netatmo » (station et modules détectés), dates de début et de fin de l'hiver (1er octobre et 30 avril), reports de saison (feux et barbecues faits avant l'app), date de la dernière sauvegarde du classeur (affichage), objectif de cagnotte (nom, montant, date de début, bouton « Nouvel objectif »), défi du mois (mois en cours ou suivant, type, compteur ou condition, cible, libellé), heure du soir (18 h, pour les voyants et le bilan du dimanche), vibration (oui / non), médailles du garage (ouvrir la vitrine), outils de test (simulation de date, forcer une médaille), URL de la Web App Apps Script, jeton secret, réenregistrement de l'empreinte.

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
- **Onglets** : barre en pilule, 5 onglets, libellés en Archivo Narrow 13 px ; onglet actif plein laiton, texte foncé ; Perso avec un cadenas.
- **Boutons ronds** à bordure laiton pour + / −, icônes au trait (SVG inline), cibles tactiles ≥ 44 px.
- **Pastilles** arrondies ; sélection = bordure laiton + fond `#2E2519`.
- **Jauge 9 crans (humeur, énergie, inspiration)** : cadran crème cerclé de laiton (anneau foncé `#8C6B34`, anneau `#C9A15B`, face `#EFE6D2`), arc de 240° (de −120° à +120° par rapport à la verticale), 9 graduations principales numérotées 1 à 9 et graduations intermédiaires fines, aiguille rouge pivotant au centre (moyeu foncé cerclé de laiton), petite mention « TODAY'S MOOD » et nom de la jauge sur le cadran. Le libellé du cran s'affiche en grand sous le cadran.
- **Réglage des jauges à aiguille (toutes, compte-tours compris)** : **pas de déplacement de l'aiguille au doigt** (il se déclenchait en faisant défiler l'écran). Réglage par **appui sur un chiffre du cadran** : une zone d'appui ronde autour de chaque chiffre (rayon ≈ 18 dans un cadran de 300) ; un cercle laiton translucide marque le chiffre actif ; un appui n'est jamais confondu avec un défilement (seul un vrai appui, sans glisser, compte). Les boutons − et + restent. Petite mention sous le cadran : « Touche un chiffre du cadran, ou utilise − et + ».
- **Compte-tours (énergie sexuelle)** : même géométrie mais cadran noir `#14100C`, graduations et chiffres crème, **zone rouge sur 8–9**, mention « TR/MIN × 1000 », aiguille crème, chiffre courant au bas du cadran.
- **Gros boutons +1** (Happy Dicky, guitare, feu, barbecue) : ronds laiton de 100 px, icône au trait foncé.
- **Pistons Happy Dicky** (couleur `currentColor`, sur les boutons laiton ; à reprendre tels quels) :
  - bouton 1 (un piston) : `<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="1.8" width="10" height="8.4" rx="1.4"/><path d="M7 4.3h10M7 6.2h10"/><circle cx="12" cy="8.4" r="0.9"/><path d="M11.1 9.2L10.5 17.3M12.9 9.2l.6 8.1"/><circle cx="12" cy="19.6" r="2.5"/><circle cx="12" cy="19.6" r="0.6" fill="currentColor"/></svg>`
  - bouton 2 (deux pistons en V) : `<svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(-26 12 19.6)"><rect x="8.6" y="2.6" width="6.8" height="6.2" rx="1.1"/><path d="M8.6 4.4h6.8M8.6 5.9h6.8"/><circle cx="12" cy="7.3" r="0.7"/><path d="M11.4 8L11 17.4M12.6 8l.4 9.4"/></g><g transform="rotate(26 12 19.6)"><rect x="8.6" y="2.6" width="6.8" height="6.2" rx="1.1"/><path d="M8.6 4.4h6.8M8.6 5.9h6.8"/><circle cx="12" cy="7.3" r="0.7"/><path d="M11.4 8L11 17.4M12.6 8l.4 9.4"/></g><circle cx="12" cy="19.6" r="2.5"/><circle cx="12" cy="19.6" r="0.6" fill="currentColor"/></svg>`
- **Tableau des chefs** : panneau sombre façon tableau de course (damier, positions P1, P2… en Bebas Neue).
- **Voyant d'onglet** : pastille de 6 px en haut à droite, orange `#E8862E` avec une légère lueur quand il reste à remplir, `#3A3026` sinon.
- **Plaque de série** : plaque laiton avec deux petites vis, texte en Bebas Neue capitales.
- **Compteur kilométrique** : rouleaux sombres `#1C1612` à chiffres crème, décimale sur case crème `#EFE6D2` à chiffre `#2A2118`, ombre intérieure en haut et en bas, déroulement animé.
- **Clin d'œil** : encadré en pointillés laiton, icône soleil, phrase en italique.
- **Pastilles météo** : petites pastilles arrondies ; vent discret (bordure `#3A3026`, texte discret) ; bise allumée (bordure laiton, fond `#2E2519`, texte laiton clair) ; pression avec flèche de tendance.
- **Relevé en attente** : encadré en tirets, « RELEVÉ À 8 H » en Archivo Narrow capitales.
- **Encadré « La journée »** : zone creuse sous le relevé de 8 h, titre Bebas Neue laiton, détails compacts.
- **Mot du jour** : champ en Bebas Neue, suggestions en pastilles ; dans le bilan et les résultats, le mot en Bebas Neue laiton clair.
- **Message de confirmation** (raccourcis) : pilule en bas de l'écran, fond `#2E2519`, bordure laiton, texte laiton clair, disparaît après 3 s.
- **Résumé de recherche** : encadré creux, nombre de jours en grand (Bebas Neue laiton), humeurs moyennes, écart en vert (mieux) ou rouge (moins bien).
- **Molette** (temps d'écran) : colonne creuse arrondie de 3 lignes de 44 px qui se cale sur une valeur (défilement aimanté), valeur centrale en Bebas Neue laiton clair entre deux filets laiton, valeurs voisines discrètes ; un appui sur une valeur la centre.
- **Compteur horaire** : comme le compteur kilométrique, « 03 H 12 » (heures sur rouleaux sombres, minutes sur rouleaux crème), éteint (estompé) si rien n'est saisi.
- **Champs heure** (sommeil) : sélecteur d'heure natif, chiffres en Bebas Neue centrés.
- **Who's the Boss ?** : deux grandes pastilles ovales en Bebas Neue (Mister Me cerclée de laiton, Le plaisir plus discrète) ; formulaire dans une zone creuse à filet laiton ; tableau de score façon panneau de course (damiers, « 2 – 2 » en grand) ; montants Go to Revolut en vert.
- **Plaque du défi** : plaque laiton à vis (comme les séries), titre « Défi du mois », libellé en Bebas Neue, barre de progression crème dans une gouttière foncée (verte si réussi), « 14 / 20 » et l'état (« Encore 3 jours », « Dernier jour », « Réussi ! », « Raté »).
- **La maison** : comme les cartes météo (icône dans un rond cerclé de laiton) ; température en Bebas Neue 44 px soulignée de tirets (on peut la toucher pour la corriger) ; pastille « Aère ! CO2 élevé » à bord orange `#E8862E` avec un petit voyant lumineux ; « Air sec » en pastille laiton.
- **L'effet poêle** : chiffre en grand (Bebas Neue laiton clair), deux barres horizontales dans des gouttières creuses (avec feu laiton, sans feu `#5A4A38`).
- **Réserve de bois** : même réservoir gradué que la cagnotte, « ≈ 35 feux » en Bebas Neue, livraisons en lignes creuses avec une icône bûche.
- **Médailles** : rondes ; obtenues = laiton `#C9A15B` en relief (filets clair `#E0BC7A`, laiton et foncé `#8C6B34`, ombre claire en haut à gauche et sombre en bas à droite, sans dégradé), icône au trait foncé `#2A2118` ; à gagner = creuses sombres à filet `#3A3026`, icône `#5A4A38` ; secrètes = icône « ? ». Animation : rotation 3D (3 tours), désactivée si l'appareil demande moins d'animations.
- **Livre de bord (Word)** : titres laiton foncé `#8C6B34`, couverture « LIVRE DE BORD » en capitales espacées (police Bebas Neue si installée, sinon remplacée par Word) et année en rouge aiguille `#B23A2A`, tableaux à en-tête `#221C16` / texte crème `#EFE6D2` et filets laiton.
- **Pastille de lune** (en-tête) : dessin de 22 px (disque `#2A2219`, part éclairée crème, filet laiton foncé) et pourcentage en dessous, sans bordure (non cliquable).
- **Jauge d'eau** : demi-cadran crème façon jauge de carburant, 0 → 1 L → 2 L, zone verte entre 1,5 et 2 L, aiguille rouge ; à côté, la quantité en grand (« 1,3 L ») et « Encore 0,7 L » ou « Objectif atteint ».
- **Bilan** : 5 visages SVG au trait dans des tuiles ; sélection = bordure laiton.
- **Accords** : sélecteur segmenté en pilule Bon / Moyen / Pas bon ; segment actif plein laiton.
- **Résumé d'accord** : encadré à fond `#2E2519` avec un filet laiton à gauche.
- **Écran de verrouillage Perso** : grand bouton rond d'empreinte cerclé de laiton, « Accès réservé ».
- Pas d'emoji dans l'interface, pas de dégradés décoratifs. Contrastes de texte ≥ 4,5:1.

## 9. Structure du Google Sheet

Classeur « Today's Mood – données », 9 onglets. Première ligne = en-têtes. Dates au format `AAAA-MM-JJ`.

| Onglet | Une ligne = | Colonnes |
|---|---|---|
| `Fiches` | un jour | voir ci-dessous |
| `Marches` | une marche | id, date, km |
| `Pensees` | une citation favorite ou vue | id, favori (oui/non), dernière apparition |
| `Pastilles` | une catégorie d'événement | nom, ordre, visible |
| `Reglages` | un réglage | clé, valeur |
| `Tentations` (v4 B) | une tentation | id, date, gagnant, quoi, montant_chf |
| `Defis` (v4 B) | un défi du mois | mois, type, compteur, cible, libelle, resultat |
| `Bois` (v5 A) | une livraison de bois | date, steres |
| `Medailles` (v5 B) | une médaille obtenue | id, date (d'obtention) |

Colonnes de `Fiches` : date, modifie_le, pensee_id, meteo_tmin, meteo_tmax, meteo_pluie_mm, meteo_soleil_h, meteo_nuages_pct, meteo_code, meteo_ressenti, photo_ciel, photo_jour, humeur_matin, humeur_soir, energie, inspiration, energie_sexuelle, bilan, evt_appreciation, evt_categorie, evt_texte, accord_parole, accord_personnel, accord_supposition, accord_mieux, pas, natation_m, eau_ml, cafe, deca, biere, vin, biscotte_1, biscotte_2, recit, recit_favori, recit_piment, mylove, mylove_favori, mylove_piment, puis (version 2, **toujours ajoutées à la fin**, sans déplacer les colonnes existantes) : cuisine, repas_type, guitare, feux_poele, barbecues, deplacement, puis (version 3, à la fin) : meteo8_temp, meteo8_nuages, meteo8_pluie, meteo8_code, meteo8_vent, meteo8_vent_dir, meteo8_pression, meteo16_temp, meteo16_nuages, meteo16_pluie, meteo16_code, meteo16_vent, meteo16_vent_dir, meteo16_pression, meteo_soir_ressenti, coucher_soleil, duree_jour_min, lune_phase, lune_pct, photo_ciel_soir, puis (version 3, partie B, à la fin) : mot_du_jour, puis (version 4, partie A, à la fin) : ecran_min, chien_balades, chien_education, sommeil_coucher, sommeil_lever, sommeil_duree_min, sommeil_qualite, puis (version 5, partie A, à la fin) : maison7_temp, maison7_hum, maison7_co2, maison20_temp, maison20_hum, maison20_co2, maison_source (`netatmo` ou `manuel`), nt8_vent, nt8_vent_dir, nt16_vent, nt16_vent_dir, nt8_temp_ext, nt16_temp_ext, nt_pluie_jour (les trois dernières pour le futur module extérieur et le pluviomètre).

Colonnes de texte : `coucher_soleil` (« HH:MM »), `photo_ciel_soir` (lien Drive, fichier `AAAA-MM-JJ_ciel_soir.jpg`), `mot_du_jour`, `sommeil_coucher` et `sommeil_lever` (« HH:MM »), `maison_source` ; les autres colonnes versions 3 à 5 sont numériques.

Version 4, partie B : deux nouveaux onglets créés automatiquement par l'Apps Script, `Tentations` (une tentation : id, date, gagnant `me`/`plaisir`, quoi, montant_chf numérique) et `Defis` (un défi par mois : mois « AAAA-MM », type, compteur, cible numérique, libelle, resultat). Ils sont envoyés et relus comme les marches (`tentations` / `tentationsSupprimes`, `defis` / `defisSupprimes` dans `enregistrer`, et dans la réponse de `lire`).

L'Apps Script ajoute automatiquement à droite toute colonne attendue qui manque. Tous les totaux restent calculés, jamais stockés. L'onglet `Reglages` reçoit les réglages partagés (bascule, objectif d'eau, durée de la pensée, position météo, dernier export, cuisiniers, dates de l'hiver, reports de saison, heure du soir, seuils de la bise, objectif de cagnotte, seuils CO2 et humidité, feux par stère, dates de stock vide), jamais l'URL ni le jeton (ni la vibration, propre au téléphone).

Les données numériques restent numériques (pour les futurs graphiques). Une valeur non saisie reste vide (pas de 0).

## 10. Plan de construction

1. **Test du partage** : mini-PWA installable qui reçoit une transcription de l'Enregistreur (texte et fichier) et l'affiche. Rien d'autre.
2. **Socle** : PWA complète, 4 onglets, jauges 9 crans, enregistrement automatique en IndexedDB, Apps Script + Sheet, synchronisation, sélecteur de date, heure de bascule, hors ligne, écran Réglages minimal (URL, jeton).
3. **Météo et photos** : Open-Meteo, météo ressentie, deux photos compressées vers Drive.
4. **Compteurs** : boissons + jauge d'eau, sport avec marches multiples, totaux jour / mois / total, boutons −1.
5. **Perso** : verrou par empreinte, compte-tours, Biscotte, My Love, routage du partage vers My Love.
6. **Pensées du jour** : base de citations, écran d'ouverture, favoris.
7. **Historique, export et réglages** : recherche, mémos marqués, export Word, écran Réglages complet.

Les étapes 1 à 7 sont terminées.

### Version 2
- **Partie A — nouvelles rubriques et jauges** : jauges réglées par appui sur un chiffre (plus de glisser), Biscotte renommé Happy Dicky avec boutons à gestes, nouvel onglet What's up (Who's the cook ?, Tu grattes ou quoi ?, Burn on the fire, Fangio ou Rossi ?), nouvelles colonnes à la fin de `Fiches`.
- **Corrections après la partie A** : report de saison pour les feux et barbecues faits avant l'app (Réglages, stocké dans `Reglages`), tuiles Fangio / Rossi sans les mots Moto / Voiture, Happy Dicky avec des pistons à la place des gestes.
- **Partie B — habillage et petits plaisirs** : voyants du tableau de bord, vibration, séries (plaques laiton), compteurs kilométriques à rouleaux, clin d'œil Fangio, bilan du dimanche, « Il y a un an » et barre de décompte sur l'écran d'ouverture, outils de test (simulation de date).

### Version 3
- **Partie A — météo du matin et du soir** : relevés horaires de 8 h (Matin) et 16 h (Soir) avec vent, pression et tendance, encadré « La journée », pastilles bise et pression, carte Météo du soir avec ressenti du soir, carte Coucher de soleil (durée du jour, écart avec la veille, solstices, photo du ciel du soir), phase de lune dans l'en-tête, voyant du Soir avec le ressenti du soir, rattrapage rétroactif des fiches existantes (`past_days`), nouvelles colonnes à la fin de `Fiches`.
- **Partie B — mot du jour, raccourcis, recherche météo, sauvegarde** : mot du jour (onglet Soir, suggestions, voyant, bilan du dimanche, « Il y a un an », colonne `mot_du_jour`), raccourcis Android sur l'icône (+ 500 ml d'eau, + 1 café, Tu grattes ? + 1) et nouvelle icône cadran, recherches Météo et Mot dans l'Historique avec humeur moyenne comparée, sauvegarde hebdomadaire automatique du classeur (12 copies) et sa date dans les Réglages.

### Version 4
- **Partie A — sommeil, temps d'écran, chien** : carte Le sommeil (Matin : couché / levé avec passage de minuit, durée, écart, moyenne de la semaine, jauge Qualité), Temps d'écran (What's up : molettes, compteur horaire à rouleaux, écart, moyenne), Le chien (balades et séances d'éducation), voyants (Matin : sommeil ; What's up : écran dès 21 h), bilan du dimanche (sommeil, écran, balades), 7 nouvelles colonnes à la fin de `Fiches`.
- **Partie B — Who's the Boss ? et défi du mois** : tentations (onglet `Tentations`, score du mois, Go to Revolut, plus belle victoire, cagnotte), défi du mois (Réglages, plaque en tête de What's up, résultat le mois suivant, onglet `Defis`), bilan du dimanche (score et Go to Revolut de la semaine, état du défi).

### Version 5
- **Partie A — Netatmo, la maison et le poêle** : connexion Netatmo côté Apps Script (refresh token dans les Propriétés du script, renouvellement automatique, découverte des modules, `getmeasure`), carte La maison (Matin 7 h, Soir 20 h : température, humidité, CO2, écarts, pastilles CO2 et air sec, saisie à la main), vent de l'anémomètre en priorité pour la bise, place prévue pour le module extérieur et le pluviomètre, L'effet poêle, La réserve de bois (onglet `Bois`), rattrapage rétroactif, nouvelles colonnes à la fin de `Fiches`.
- **Partie B — médailles et livre de bord** : médailles du garage (12 + 3 secrètes, calculées rétroactivement, onglet `Medailles`, vitrine, animation, médaille forcée pour les tests), livre de bord annuel en Word (proposé le 31 décembre, disponible dans l'Historique pour toute année, sans contenu Perso).

Plus tard (hors périmètre pour l'instant) : graphiques de tendances (humeur × météo, matin × soir, accords dans le temps).
