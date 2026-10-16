# Life Santos — hébergement Render gratuit

## Ce que contient le dépôt

- `public/` : site et logo Life Santos.
- `server/api.js` : connexion Discord, sessions, contrôle des rôles, plannings et suggestions.
- `server/bot.js` : bot Discord qui traite les annonces et envoie les MP lorsqu’il tourne.
- `server/schema.sql` : tables PostgreSQL.
- `render.yaml` : site/API et base PostgreSQL gratuits uniquement. Aucun worker payant.
- `.env.example` : modèle des variables. Ne publie jamais ton vrai fichier `.env`.

## 1. Créer les identifiants Discord

1. Ouvre https://discord.com/developers/applications et sélectionne ton application.
2. Dans **General Information**, copie **Application ID** : ce sera `DISCORD_CLIENT_ID`.
3. Dans **OAuth2**, crée/copie **Client Secret** : ce sera `DISCORD_CLIENT_SECRET`.
4. Dans **Bot**, crée le bot si nécessaire, puis copie son token : `DISCORD_BOT_TOKEN`. Garde-le privé.
5. Dans **Bot → Privileged Gateway Intents**, active **Server Members Intent**. Il faut cet accès pour vérifier les rôles des membres et cibler le rôle joueurs. N’active pas Message Content.
6. Dans Discord, ouvre **Paramètres utilisateur → Avancé → Mode développeur**. Clic droit sur le serveur Life Santos, les rôles staff/joueurs et le salon d’annonce, puis **Copier l’identifiant**.
7. Ajoute le bot au serveur avec les permissions nécessaires : voir le salon, envoyer des messages, intégrer des liens et joindre des fichiers.

## 2. Lancer le site gratuitement sur Render

Le dépôt GitHub `tazeserveur-bot/Life-Santos-` contient déjà les fichiers.

1. Ouvre le tableau de bord Render.
2. Clique **New + → Blueprint**.
3. Choisis le dépôt `tazeserveur-bot/Life-Santos-`, branche `main`.
4. Render lit `render.yaml`. Vérifie que le site `life-santos` et la base `life-santos-db` sont sur **Free**. Il n’y a pas de worker dans cette version.
5. Clique **Apply** seulement si l’écran indique bien les plans gratuits.
6. Si Render demande les variables `sync:false`, saisis les valeurs ci-dessous dans Render. Génére automatiquement `SESSION_SECRET`; `DATABASE_URL` sera reliée à la base.
7. Attends le déploiement, puis ouvre le service Web `life-santos` et copie son URL `https://…onrender.com`.

### Variables à saisir dans les réglages du service Web Render

| Variable | Valeur |
|---|---|
| `DISCORD_CLIENT_ID` | Application ID du portail Discord |
| `DISCORD_CLIENT_SECRET` | Client Secret de **OAuth2** |
| `DISCORD_BOT_TOKEN` | Token de l’application Bot (secret) |
| `DISCORD_GUILD_ID` | Identifiant du serveur Life Santos |
| `STAFF_ROLE_IDS` | Identifiants des rôles staff, séparés par des virgules |
| `PLAYER_ROLE_ID` | Identifiant du rôle des joueurs destinataires |
| `ANNOUNCEMENT_CHANNEL_ID` | Identifiant du salon d’annonces |
| `CLOUDINARY_CLOUD_NAME` | Cloud name du compte Cloudinary |
| `CLOUDINARY_API_KEY` | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret Cloudinary (secret) |

Les vraies valeurs restent dans les champs secrets de Render ou dans ton fichier `.env` local. Ne les colle pas dans GitHub ni dans une conversation.

## 3. Autoriser la connexion Discord

1. Dans Discord Developer Portal, ouvre **OAuth2 → Redirects**.
2. Ajoute `https://TON-URL-RENDER.onrender.com/auth/discord/callback` en remplaçant par l’adresse réelle du service Web.
3. Clique **Save Changes**.
4. Ouvre le site et essaie **Connexion Discord**. L’utilisateur doit être membre de Life Santos; l’accès staff dépend des identifiants de rôle `STAFF_ROLE_IDS`.

## 4. Faire tourner le bot gratuitement sur ton PC

Le bot doit rester lancé sur un ordinateur allumé et connecté à Internet. Quand l’ordinateur s’éteint, le bot se déconnecte et ne peut pas envoyer de messages. La base Render gratuite et le site gratuit ont aussi des limites indiquées plus bas.

1. Installe Node.js version 20 ou supérieure depuis https://nodejs.org/.
2. Télécharge le dépôt GitHub (bouton **Code → Download ZIP**) et décompresse-le.
3. Ouvre PowerShell dans le dossier décompressé, celui qui contient `package.json`.
4. Copie `.env.example` vers `.env`.
5. Dans Render, ouvre `life-santos-db → Connect` et copie l’**External Database URL**. Mets-la en `DATABASE_URL` dans `.env`. Garde cette URL secrète.
6. Remplis dans `.env` `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `PLAYER_ROLE_ID`, `ANNOUNCEMENT_CHANNEL_ID` et `FRONTEND_URL` (l’URL onrender.com de ton site). Mets aussi les variables Cloudinary si tu veux gérer les images depuis le bot plus tard.
7. Dans PowerShell, lance `npm install`, puis `npm run bot`.
8. Garde cette fenêtre ouverte. Le message `Bot Life Santos connecté` confirme que le bot est en ligne. Pour l’arrêter, fais `Ctrl+C`.

Le bot doit utiliser la même base Render que le site pour récupérer la file des annonces. Il publie l’annonce dans le salon et tente les MP au rôle joueurs après qu’un planning est publié. Les MP fermés par un joueur peuvent échouer.

## Limites du mode gratuit Render

- Le site gratuit se met en veille après 15 minutes sans trafic et peut mettre environ une minute à repartir.
- La base PostgreSQL gratuite Render expire 30 jours après sa création. Render conserve ensuite une période de grâce de 14 jours avant la suppression des données. Prévois d’exporter les données ou de migrer la base avant cette date.
- Le bot n’est pas hébergé en continu sur Render dans cette configuration : il tourne sur ton PC.
- Le disque local Render est temporaire. Les images sont envoyées vers Cloudinary, pas enregistrées sur le disque.
- Aucun abonnement mensuel de worker n’est créé avec ce fichier Render.

## Images et Canva

Importe dans le planning l’image finale exportée depuis Canva. Pour la modifier sur Canva, exporte le visuel du studio, importe-le dans Canva, puis réimporte l’image finale sur Life Santos.
