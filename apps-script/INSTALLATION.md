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
