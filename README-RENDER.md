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
| `STAFF_USER_IDS` | Identifiant Discord des personnes staff, séparés par des virgules; permet de donner l’accès sans attribuer un rôle dédié |
| `PLAYER_ROLE_ID` | Facultatif si tu choisis le rôle dans Administration → Détecter les salons et rôles |
| `ANNOUNCEMENT_CHANNEL_ID` | Facultatif si tu choisis le salon dans Administration → Détecter les salons et rôles |
| `CLOUDINARY_CLOUD_NAME` | Tableau de bord Cloudinary → Cloud name |
| `CLOUDINARY_API_KEY` | Tableau de bord Cloudinary → API Key |
| `CLOUDINARY_API_SECRET` | Tableau de bord Cloudinary → API Secret |

Ne colle pas les secrets dans GitHub ou dans une conversation. Saisis-les directement dans les champs Render.

## 2. Autoriser le Bot dans Discord

1. Dans [Discord Developer Portal](https://discord.com/developers/applications), ouvre l’application **Life santos event**.
2. Dans **Bot**, copie le token et active **Server Members Intent** pour que le site puisse vérifier l’appartenance au serveur et les rôles.
3. Ajoute le bot au serveur Life Santos. Donne-lui accès aux salons avec **View Channels**, **Send Messages** et **Embed Links**.
4. L’URI OAuth2 est déjà enregistré : `https://life-santos.onrender.com/auth/discord/callback`.
5. Après le déploiement et ta connexion staff, ouvre Administration → **Détecter les salons et rôles** pour choisir le salon d’annonce et le rôle des joueurs. Le bot lit les listes directement dans le serveur.
6. Mets ton identifiant Discord dans `STAFF_USER_IDS` (ou configure `STAFF_ROLE_IDS`) pour ouvrir l’espace staff. Plusieurs IDs sont séparés par des virgules.

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
- Render Free ne fournit pas de sauvegardes automatiques de PostgreSQL. Le bouton **Télécharger une sauvegarde** dans Administration exporte les plannings, suggestions, conversations et leurs liens d’images en JSON. Télécharge-le régulièrement et garde le fichier privé. Les créations du studio ne sont pas encore stockées dans cette base.
- UptimeRobot Free vérifie une URL toutes les 5 minutes; cela peut réveiller le service, mais ne garantit pas que Render le gardera actif en permanence. L’offre Render gratuite peut toujours se mettre en veille.

## Fichiers

- `public/` : site, studio et logo Life Santos.
- `public/api-bridge.js` : relie le site aux routes API.
- `server/api.js` : connexion Discord, accès staff, plannings et annonces Discord.
- `server/schema.sql` : tables PostgreSQL.
- `render.yaml` : services Render gratuits.
- `.env.example` : noms des variables; les vraies valeurs restent dans Render.
