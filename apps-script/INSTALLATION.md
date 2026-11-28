# Installer la partie Google (Sheet + Apps Script)

À faire **une seule fois**, sur un ordinateur (c'est plus confortable). Compte environ 15 minutes.

Tu vas :
1. créer le Google Sheet qui recevra les données ;
2. y coller le code Apps Script ;
3. lancer la préparation (création des onglets et du jeton secret) ;
4. publier le script comme « Application Web » ;
5. saisir l'adresse et le jeton dans l'app sur ton téléphone.

---

## 1. Créer le Google Sheet

1. Va sur <https://sheets.google.com> (connecté avec ton compte Google).
2. Clique sur **Vierge** (nouveau classeur).
3. En haut à gauche, clique sur « Feuille de calcul sans titre » et renomme-le exactement :
   **Today's Mood – données**

## 2. Coller le code Apps Script

1. Dans le classeur, menu **Extensions → Apps Script**. Un nouvel onglet s'ouvre (l'éditeur).
2. En haut à gauche, clique sur « Projet sans titre » et renomme-le **Today's Mood**.
3. À gauche, le fichier **Code.gs** est ouvert. Sélectionne tout son contenu (Ctrl+A) et supprime-le.
4. Dans un autre onglet, ouvre le code sur GitHub :
   <https://github.com/nkuffer-svg/todays-mood/blob/main/apps-script/Code.gs>
   Clique sur le bouton **Copy raw file** (icône de deux carrés, en haut à droite du code).
5. Reviens dans l'éditeur Apps Script, colle (Ctrl+V).
6. Clique sur l'icône **disquette** (Enregistrer) ou fais Ctrl+S.

## 3. Lancer la préparation

1. En haut de l'éditeur, à droite du bouton **Exécuter**, il y a un menu déroulant avec un nom de fonction.
   Choisis **initialiser**.
2. Clique sur **Exécuter**.
3. Google demande une autorisation (c'est normal, le script doit pouvoir écrire dans ton classeur) :
   - **Examiner les autorisations** → choisis ton compte ;
   - un écran « Google n'a pas validé cette application » apparaît : clique sur **Paramètres avancés**,
     puis sur **Accéder à Today's Mood (non sécurisé)** — c'est ton propre script, il n'y a pas de risque ;
   - clique sur **Autoriser**.
4. En bas, le **Journal d'exécution** s'affiche avec :
   `Classeur prêt. Copie ce jeton dans les Réglages de l'app :`
   suivi d'une longue suite de chiffres et de lettres : **c'est ton jeton secret**.
   (Si l'exécution s'est arrêtée à l'autorisation, clique une deuxième fois sur **Exécuter**.)
5. Dans le classeur, tu dois maintenant voir 5 onglets en bas : Fiches, Marches, Pensees, Pastilles, Reglages.

> Le jeton est comme un mot de passe : ne le mets jamais sur GitHub ni dans un message public.
> Pour le retrouver plus tard : choisis la fonction **afficherJeton** et clique sur **Exécuter**.

## 4. Publier le script comme « Application Web »

1. En haut à droite de l'éditeur : **Déployer → Nouveau déploiement**.
2. À côté de « Sélectionner le type », clique sur la **roue dentée** → **Application Web**.
3. Remplis :
   - Description : `Today's Mood`
   - **Exécuter en tant que : Moi** (ton adresse)
   - **Qui a accès : Tout le monde**
4. Clique sur **Déployer** (si Google redemande l'autorisation, refais comme à l'étape 3).
5. Copie l'**URL de l'application Web**. Elle ressemble à :
   `https://script.google.com/macros/s/AKfy…long…/exec`

« Tout le monde » est nécessaire pour que l'app du téléphone puisse joindre le script. Sans le jeton,
personne ne peut lire ni écrire tes données.

## 5. Saisir l'adresse et le jeton dans l'app

Le plus simple pour faire passer ces deux longues chaînes sur le téléphone : colle-les dans une note
Google Keep (ou un e-mail à toi-même), puis copie-les depuis le téléphone.

1. Ouvre **Today's Mood** sur le téléphone.
2. Touche l'icône **réglages** (en haut à droite, les deux curseurs).
3. Colle l'**adresse de la Web App** et le **jeton secret**.
4. Touche **Tester la connexion** : tu dois lire « Connexion réussie. Classeur : « Today's Mood – données » … ».
5. Ferme les réglages : le bouton en haut doit passer à **SYNCHRO OK** quelques secondes après une saisie.

Pense à supprimer la note Keep ou l'e-mail une fois le jeton saisi.

---

## Plus tard : quand le code Apps Script change

À certaines étapes, je te dirai que `Code.gs` a changé. Dans ce cas :

1. Recopie le nouveau code dans l'éditeur (comme à l'étape 2) et enregistre.
2. **Déployer → Gérer les déploiements**.
3. Clique sur l'icône **crayon** (Modifier).
4. Dans « Version », choisis **Nouvelle version**.
5. Clique sur **Déployer**.

Ainsi l'adresse reste la même : rien à changer sur le téléphone.
(Si tu fais « Nouveau déploiement » à la place, tu obtiens une nouvelle adresse qu'il faudrait ressaisir.)

## Mise à jour de l'étape 3 (photos sur Drive)

Le script doit maintenant pouvoir ranger les photos dans ton Google Drive. Il faut donc une nouvelle
autorisation, en plus de la mise à jour habituelle :

1. Recopie le nouveau `Code.gs` dans l'éditeur (comme à l'étape 2 ci-dessus) et enregistre.
2. Choisis la fonction **initialiser** et clique sur **Exécuter**.
   Google redemande une autorisation, cette fois pour **Google Drive** : accepte-la comme la première fois
   (Paramètres avancés → Accéder à Today's Mood → Autoriser).
   Le journal affiche « Dossier des photos : Today's Mood – photos » : le dossier est créé dans ton Drive.
   Ton jeton ne change pas.
3. **Déployer → Gérer les déploiements** → **crayon** → Version : **Nouvelle version** → **Déployer**.

## Mise à jour de l'étape 4 (marches)

Pas de nouvelle autorisation cette fois : recopie le nouveau `Code.gs`, enregistre, puis
**Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.

## Mise à jour de l'étape 6 (pensées)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs`, enregistre, puis
**Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
L'onglet `Pensees` du classeur se remplit tout seul (favoris et pensées déjà vues).

## Mise à jour de l'étape 7 (réglages dans le Sheet)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs`, enregistre, puis
**Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
L'onglet `Reglages` du classeur reçoit alors l'heure de bascule, l'objectif d'eau, la durée de la
pensée, la position météo et la date du dernier export. L'adresse de la Web App et le jeton n'y vont
jamais : ils restent uniquement sur le téléphone.

## Mise à jour de la version 2, partie A (What's up)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs`, enregistre, puis
**Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.

Les six nouvelles colonnes (`cuisine`, `repas_type`, `guitare`, `feux_poele`, `barbecues`, `deplacement`)
s'ajoutent toutes seules **à la fin** de l'onglet `Fiches` à la première synchronisation. Tu peux aussi
les créer tout de suite en lançant la fonction **initialiser** (sans danger : elle n'efface rien et ne
change pas le jeton). Ne déplace pas les colonnes existantes.

## Mise à jour après la partie A (reports de saison)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs`, enregistre, puis
**Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
Les reports de saison saisis dans l'app arrivent dans l'onglet `Reglages`, sur la ligne `reportsSaisons`.

## Mise à jour de la version 2, partie B

Pas de nouvelle autorisation : recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller),
enregistre, puis **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
Il permet d'enregistrer l'heure du soir dans l'onglet `Reglages`.

## Mise à jour de la version 3, partie A (météo du matin et du soir)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller),
enregistre, puis **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.

Les 20 nouvelles colonnes (`meteo8_temp` … `photo_ciel_soir`) s'ajoutent toutes seules **à la fin**
de l'onglet `Fiches` à la première synchronisation (ou tout de suite en lançant **initialiser**).
Le nouveau code accepte aussi la photo du ciel du soir (fichier `AAAA-MM-JJ_ciel_soir.jpg` dans le
dossier Drive) et les seuils de la bise dans l'onglet `Reglages`. Sans cette mise à jour, la photo du
soir resterait « Envoi vers Drive en attente » et les nouvelles valeurs ne seraient pas gardées dans le Sheet.

## Mise à jour de la version 3, partie B (mot du jour et sauvegarde automatique)

1. Recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller), enregistre, puis
   **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
   La colonne `mot_du_jour` s'ajoute toute seule à la fin de l'onglet `Fiches`.
2. Vérifie le fuseau horaire du projet : **Paramètres du projet** (roue dentée à gauche) →
   « Fuseau horaire » = **(GMT+01:00) Heure d'Europe centrale – Zurich** (ou Paris, Berlin…).
   C'est lui qui décide de « dimanche vers 23 h ».
3. **Une seule fois** : en haut de l'éditeur, choisis la fonction **installerSauvegarde** dans le menu
   déroulant, puis **Exécuter**. Google demande une nouvelle autorisation (le script veut créer un
   déclencheur) : **Examiner les autorisations** → ton compte → **Paramètres avancés** →
   **Accéder à … (non sécurisé)** → **Autoriser**. C'est ton propre script, c'est normal.
4. Le journal d'exécution affiche « Sauvegarde automatique installée… » puis « Sauvegarde faite… ».
   Dans Drive, un dossier **Today's Mood – sauvegardes** contient une première copie datée.
5. Pour vérifier le déclencheur : icône **réveil** (« Déclencheurs ») à gauche : une ligne
   `sauvegarder`, « Basé sur le temps », chaque semaine le dimanche, 23 h à minuit.

Ensuite tout se fait seul : chaque dimanche soir une copie, les 12 plus récentes sont gardées (les plus
anciennes vont à la corbeille de Drive). Tu peux aussi lancer **sauvegarder** à la main à tout moment.
Si tu relances **installerSauvegarde**, l'ancien déclencheur est remplacé (jamais de doublon).

Pour restaurer : ouvre la copie voulue dans le dossier des sauvegardes et recopie les onglets dans le
classeur principal (ou demande-moi de l'aide).

## Mise à jour de la version 4, partie A (sommeil, temps d'écran, chien)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller),
enregistre, puis **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
Les 7 nouvelles colonnes (`ecran_min` … `sommeil_qualite`) s'ajoutent toutes seules **à la fin** de
l'onglet `Fiches` à la première synchronisation. La sauvegarde du dimanche continue toute seule :
inutile de relancer `installerSauvegarde`.

## Mise à jour de la version 4, partie B (Who's the Boss ? et défi du mois)

Pas de nouvelle autorisation : recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller),
enregistre, puis **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.
Les deux nouveaux onglets **Tentations** et **Defis** se créent tout seuls à la première synchronisation
(ou tout de suite en lançant **initialiser**, sans danger). Ne renomme pas leurs colonnes.

## Mise à jour de la version 5, partie A (Netatmo, la maison, le poêle)

### 1. Créer l'app Netatmo et le refresh token (une seule fois)

1. Va sur **https://dev.netatmo.com** et connecte-toi avec ton compte Netatmo habituel.
2. En haut à droite, ouvre le menu de ton compte → **My apps** → **Create** (ou « Create an app »).
3. Remplis le formulaire :
   - **app name** : `Todays Mood` ; **description** : `Journal personnel` ;
   - **data protection officer name** et **email** : ton nom et ton adresse ;
   - coche l'acceptation des conditions, puis **Save**.
4. La page de l'app affiche maintenant un **client ID** et un **client secret**. Laisse-la ouverte.
5. Plus bas sur la même page, trouve la section **Token generator** :
   - dans **Choose scopes**, coche seulement **read_station** ;
   - clique sur **Generate Token**, puis accepte (« Yes, I accept ») sur la page Netatmo qui s'ouvre ;
   - deux valeurs apparaissent : *Access Token* et **Refresh Token**. Seul le **Refresh Token** nous sert.

Ces trois valeurs sont secrètes : ne les colle **nulle part ailleurs** que dans l'étape suivante (ni dans GitHub, ni dans l'app, ni dans un message).

### 2. Ranger les clés dans Apps Script

1. Ouvre le Sheet → **Extensions → Apps Script**.
2. À gauche, la **roue dentée** (« Paramètres du projet ») → tout en bas, **Propriétés du script** → **Modifier les propriétés du script**.
3. Ajoute trois propriétés (bouton « Ajouter une propriété du script ») — le nom exactement comme ci-dessous, la valeur copiée depuis dev.netatmo.com :
   - `NETATMO_CLIENT_ID` → le client ID ;
   - `NETATMO_CLIENT_SECRET` → le client secret ;
   - `NETATMO_REFRESH_TOKEN` → le refresh token.
4. **Enregistrer les propriétés du script**. (Le jeton `JETON` déjà présent ne bouge pas.)

Ensuite, le script renouvelle tout seul le jeton d'accès (valable environ 3 h) et remplace lui-même le refresh token
dans ces propriétés à chaque renouvellement : il est normal que sa valeur change.

### 3. Mettre à jour le code et autoriser l'accès à Netatmo

1. Recopie le nouveau `Code.gs` (Ctrl+A puis Suppr avant de coller), enregistre.
2. En haut, choisis la fonction **testerNetatmo** dans le menu déroulant, puis **Exécuter**.
   Google demande une nouvelle autorisation (« se connecter à un service externe ») :
   **Examiner les autorisations** → ton compte → **Paramètres avancés** → **Accéder à … (non sécurisé)** → **Autoriser**.
3. Le journal d'exécution affiche le nom de ta station et les modules trouvés (module intérieur, anémomètre),
   puis les relevés d'aujourd'hui.
4. **Déployer → Gérer les déploiements → crayon → Nouvelle version → Déployer**.

Les nouvelles colonnes de `Fiches` (`maison7_temp` … `nt_pluie_jour`) et l'onglet **Bois** se créent tout seuls
à la première synchronisation. Quand tu ajouteras le module extérieur ou le pluviomètre à ta station (dans l'app
Netatmo), rien à faire ici : ils sont détectés automatiquement.

### Si Netatmo refuse la connexion

Message « Netatmo refuse la connexion (invalid_client) » : c'est le **client ID** ou le **client secret** qui n'est pas
reconnu (pas le refresh token). Vérifie dans les Propriétés du script que `NETATMO_CLIENT_ID` contient bien le
*client ID* et `NETATMO_CLIENT_SECRET` le *client secret* (sans les inverser, sans guillemets, en entier), recopiés
depuis ta page d'app sur dev.netatmo.com. Si tu as cliqué sur « Regenerate » pour le secret, il faut le nouveau.


Message « Netatmo refuse la connexion (invalid_grant) » : le refresh token n'est plus valable (par exemple si tu as
régénéré un token sur dev.netatmo.com). Refais l'étape 1.5 (Generate Token) et remplace `NETATMO_REFRESH_TOKEN`
dans les Propriétés du script. Pas besoin de nouveau déploiement.

## En cas de problème

| Message dans l'app | Que faire |
|---|---|
| Jeton refusé | Recopie le jeton (fonction **afficherJeton**) dans les Réglages. |
| Jeton non configuré | Lance la fonction **initialiser** dans l'éditeur. |
| Réponse inattendue du serveur | Vérifie que l'adresse finit par `/exec` et que l'accès est « Tout le monde ». |
| Connexion impossible | Vérifie le réseau et l'adresse. |
| Le script Apps Script n'est pas à jour | Recopie `Code.gs` puis publie une **nouvelle version** du déploiement. |
| Une photo reste « Envoi vers Drive en attente » | Lance **initialiser** dans l'éditeur pour accorder l'accès à Drive, puis publie une nouvelle version. |

Si tu penses que ton jeton a été vu par quelqu'un : lance la fonction **nouveauJeton**, puis saisis le
nouveau jeton dans l'app.
