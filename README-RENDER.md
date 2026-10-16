# Life Santos — site et annonces Discord

Site en ligne : https://life-santos.onrender.com

## Fonctionnement

Il n’y a pas de programme de bot séparé à garder ouvert ni de worker payant. Les membres se connectent au site avec Discord. Quand un membre du staff publie un planning, l’API du site utilise l’application Bot Discord pour poster l’affiche dans le salon choisi et mentionner le rôle des joueurs.

Il faut quand même autoriser l’application Bot une fois dans le serveur et enregistrer son token dans les variables privées de Render. Discord exige cette autorisation pour savoir quel bot envoie le message. Le token n’est jamais mis dans le navigateur ou dans GitHub.

## 1. Configurer les variables Render

Le service et la base sont déjà créés. Ne recrée pas de Blueprint.

1. Ouvre Render et sélectionne le service Web **life-santos**.
2. Dans le menu à gauche, clique **Environment**.
3. Ajoute les variables ci-dessous, puis clique **Save, rebuild, and deploy**.
4. Garde `SESSION_SECRET` et `DATABASE_URL` telles que Render les a générées/associées.

| Variable | Où trouver la valeur |
|---|---|
| `DISCORD_CLIENT_ID` | Discord Developer Portal → application Life Santos → OAuth2 → Identifiant du client |
| `DISCORD_CLIENT_SECRET` | Même page → Clé secrète du client |
| `DISCORD_BOT_TOKEN` | Developer Portal → Bot → Token |
| `DISCORD_GUILD_ID` | Mode développeur Discord → clic droit sur le serveur → Copier l’identifiant |
| `STAFF_ROLE_IDS` | Clic droit sur chaque rôle staff → Copier l’identifiant; sépare plusieurs ID par des virgules |
| `PLAYER_ROLE_ID` | Clic droit sur le rôle joueurs à mentionner dans l’annonce → Copier l’identifiant |
| `ANNOUNCEMENT_CHANNEL_ID` | Clic droit sur le salon des annonces → Copier l’identifiant |
| `CLOUDINARY_CLOUD_NAME` | Tableau de bord Cloudinary → Cloud name |
| `CLOUDINARY_API_KEY` | Tableau de bord Cloudinary → API Key |
| `CLOUDINARY_API_SECRET` | Tableau de bord Cloudinary → API Secret |

Ne colle pas les secrets dans GitHub ou dans une conversation. Saisis-les directement dans les champs Render.

## 2. Autoriser le Bot dans Discord

1. Dans [Discord Developer Portal](https://discord.com/developers/applications), ouvre l’application **Life santos event**.
2. Dans **Bot**, copie le token et active **Server Members Intent** pour que le site puisse vérifier l’appartenance au serveur et les rôles.
3. Ajoute le bot au serveur Life Santos. Donne-lui, dans le salon d’annonce, **View Channel**, **Send Messages** et **Embed Links**.
4. L’URI OAuth2 est déjà enregistré : `https://life-santos.onrender.com/auth/discord/callback`.

## 3. Utiliser le site

1. Ouvre https://life-santos.onrender.com et clique **Connexion Discord**.
2. Un membre avec un rôle dans `STAFF_ROLE_IDS` peut ouvrir la partie staff.
3. Dans **Créer un planning**, ajoute les dates et l’image, puis clique **Publier le planning**.
4. Le planning est enregistré sur le site. L’API poste l’annonce dans `ANNOUNCEMENT_CHANNEL_ID` avec l’image et mentionne `PLAYER_ROLE_ID`.

Cette version annonce dans le salon Discord et mentionne le rôle; elle n’envoie pas de messages privés aux joueurs.

## Limites de l’offre gratuite Render

- Le site peut se mettre en veille après 15 minutes sans trafic et prendre environ une minute à redémarrer.
- La base gratuite expire le **15 novembre 2026**. Il faudra exporter ou migrer les données avant cette date.
- Le site et la base utilisent le plan gratuit; aucun worker ni abonnement mensuel de bot n’est créé.
- Les images importées sont conservées sur Cloudinary, car le disque local Render est temporaire.

## Fichiers

- `public/` : site, studio et logo Life Santos.
- `public/api-bridge.js` : relie le site aux routes API.
- `server/api.js` : connexion Discord, accès staff, plannings et annonces Discord.
- `server/schema.sql` : tables PostgreSQL.
- `render.yaml` : services Render gratuits.
- `.env.example` : noms des variables; les vraies valeurs restent dans Render.
