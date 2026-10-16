# Life Santos — kit Render

## Fichiers

- `public/` : site et logo du serveur.
- `server/api.js` : connexion Discord, sessions, accès staff, planning, suggestions et conversations.
- `server/bot.js` : bot connecté, envoi d’annonce et MP au rôle joueur après publication d’un planning.
- `server/schema.sql` : tables PostgreSQL.
- `package.json` : dépendances et commandes de démarrage.
- `render.yaml` : services Render (API/site, worker bot, base PostgreSQL).
- `.env.example` : liste indicative des variables. Les vrais secrets se saisissent dans Render.

## À faire avant Render

1. Crée une application sur https://discord.com/developers/applications.
2. Dans **General Information**, copie l’Application ID (`DISCORD_CLIENT_ID`). Dans **OAuth2**, crée le Client Secret (`DISCORD_CLIENT_SECRET`).
3. Dans **Bot**, crée le bot si besoin et copie son token (`DISCORD_BOT_TOKEN`). Ne le partage pas et ne le mets jamais dans GitHub.
4. Dans **Bot → Privileged Gateway Intents**, active **Server Members Intent**. Le bot en a besoin pour trouver les membres portant le rôle joueurs. N’active pas Message Content pour ce fonctionnement.
5. Dans **OAuth2 → URL Generator**, coche les scopes `bot` et `applications.commands`. Donne au bot uniquement les permissions nécessaires dans le salon d’annonces : View Channel, Send Messages, Embed Links et Attach Files. Ouvre l’URL générée pour l’ajouter au serveur.
6. Dans Discord, active **Paramètres utilisateur → Avancé → Mode développeur**. Clic droit sur le serveur, les rôles et le salon concernés puis **Copier l’identifiant**. Ils serviront à `DISCORD_GUILD_ID`, `STAFF_ROLE_IDS`, `PLAYER_ROLE_ID` et `ANNOUNCEMENT_CHANNEL_ID`.
7. Crée un compte sur https://cloudinary.com/ et relève **Cloud name**, **API Key** et **API Secret**. Ces clés permettent de conserver les images importées.

## Envoyer le projet dans le dépôt GitHub vide

1. Décompresse le paquet `Life-Santos-Render.zip` sur ton ordinateur.
2. Dans `github.com/tazeserveur-bot/Life-Santos-`, clique **uploading an existing file**.
3. Ouvre le dossier décompressé. Glisse ses éléments à la racine du dépôt : `public`, `server`, `package.json`, `render.yaml`, `.gitignore`, `.env.example` et ce README. Ne téléverse jamais un fichier `.env` contenant de vrais secrets.
4. En bas, écris `Ajoute le site Life Santos et son bot`, puis clique **Commit changes**.

## Créer les services Render

1. Dans Render, clique **New + → Blueprint** (pas Web Service seul).
2. Connecte GitHub si Render le demande, puis choisis `tazeserveur-bot/Life-Santos-` et la branche `main`.
3. Render lit `render.yaml`. Il te montre les ressources : site/API, bot en Background Worker et PostgreSQL. Le worker est un service payant ; le PostgreSQL gratuit de Render expire après 30 jours. Vérifie l’écran de coût avant de cliquer sur **Apply**. Pour garder la base durablement, choisis un plan PostgreSQL payant.
4. Quand Render demande les secrets, saisis les valeurs Discord et Cloudinary ci-dessous. `SESSION_SECRET` est généré automatiquement. `DATABASE_URL` est relié automatiquement à PostgreSQL.
5. Attends la fin des déploiements. Ouvre le service Web `life-santos` et copie son URL `https://…onrender.com`.

### Variables à saisir dans Render

| Variable | Valeur à récupérer |
|---|---|
| `DISCORD_CLIENT_ID` | Application ID dans Discord Developer Portal → General Information |
| `DISCORD_CLIENT_SECRET` | Client Secret dans Discord Developer Portal → OAuth2 |
| `DISCORD_BOT_TOKEN` | Token dans Discord Developer Portal → Bot |
| `DISCORD_GUILD_ID` | ID du serveur Life Santos |
| `STAFF_ROLE_IDS` | ID(s) des rôles staff, séparés par des virgules |
| `PLAYER_ROLE_ID` | ID du rôle dont les membres reçoivent les MP de planning |
| `ANNOUNCEMENT_CHANNEL_ID` | ID du salon où le bot poste l’annonce |
| `CLOUDINARY_CLOUD_NAME` | Cloud name dans le tableau de bord Cloudinary |
| `CLOUDINARY_API_KEY` | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret Cloudinary — secret, uniquement dans Render |

`SESSION_SECRET` et `DATABASE_URL` sont créés/référencés par `render.yaml`. Le site et l’API partagent la même URL. Le bot utilise l’URL du site fournie automatiquement par Render.

## Autoriser le retour Discord

1. Dans Discord Developer Portal, ouvre **OAuth2 → Redirects**.
2. Ajoute l’URL du service Web copiée à l’étape Render, suivie de `/auth/discord/callback`. Exemple : `https://life-santos.onrender.com/auth/discord/callback`.
3. Clique **Save Changes**.
4. Retourne sur le site et clique **Connexion Discord**. La connexion fonctionne si la personne est dans Life Santos. Pour ouvrir le staff, elle doit avoir un des rôles listés dans `STAFF_ROLE_IDS`.

## Publier un planning

1. Connecte-toi au site avec Discord et ouvre **Créer un planning**.
2. Choisis les dates et clique **Importer depuis Canva** pour sélectionner l’image finale, ou ouvre le studio et exporte le visuel.
3. Clique **Publier le planning**. L’affiche et les dates sont enregistrées dans PostgreSQL, puis le bot annonce le planning dans le salon et tente de l’envoyer en MP aux membres de `PLAYER_ROLE_ID`.
4. Les MP peuvent échouer si un joueur les bloque. Le salon reste le canal d’annonce principal.

Les images sont envoyées dans Cloudinary, pas conservées sur le disque temporaire de Render. La connexion Canva reste un échange de fichier : export SVG/PNG depuis le studio, modification sur Canva, puis import de l’image finale sur le site.

