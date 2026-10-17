# Life Santos — site communauté

Le site se connecte à Discord pour reconnaître les membres du serveur. Les joueurs voient les suggestions communautaires, peuvent répondre et voter. Le staff dispose d’un calendrier interne et peut publier une affiche de planning sans éditeur graphique.

## Accès

- `STAFF_USER_IDS` contient l’ID Discord de l’administrateur principal (17 à 20 chiffres). Cet administrateur peut ajouter ou retirer d’autres IDs dans la page Administration.
- Les IDs ajoutés dans le site ont accès à l’espace staff. Ils ne peuvent pas modifier la liste d’accès.
- `STAFF_ROLE_IDS` reste facultatif : les membres ayant un de ces rôles Discord obtiennent aussi l’accès staff, mais ne gèrent pas la liste.
- Un membre doit rejoindre le serveur Discord Life Santos pour se connecter au site.

## Variables Render nécessaires

`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `STAFF_USER_IDS` et `SESSION_SECRET`. `DATABASE_URL` est fourni par la base PostgreSQL définie dans `render.yaml`. Les variables Cloudinary sont facultatives : sans elles, les images sont conservées directement dans PostgreSQL et jointes aux annonces Discord.

Dans Discord Developer Portal, garde l’URL OAuth de retour `https://life-santos.onrender.com/auth/discord/callback`. Active **Server Members Intent** dans Bot. Presence Intent et Message Content Intent ne sont pas utilisés. Invite le bot sur Life Santos et accorde-lui seulement la lecture des salons et rôles, ainsi que la permission d’envoyer des messages et pièces jointes dans le salon d’annonces.

## Déploiement

1. Remplace les fichiers du dépôt GitHub par le contenu de ce dossier (la racine du service doit contenir `package.json`, `server/`, `public/` et `render.yaml`).
2. Dans Render, ouvre le service `life-santos`, vérifie que le dépôt et la branche sont corrects, puis lance un déploiement après l’envoi des changements GitHub.
3. Dans **Environment**, saisis l’ID utilisateur Discord principal dans `STAFF_USER_IDS` (pas l’ID du serveur ni l’ID de l’application Discord), puis sauvegarde.
4. Connecte-toi au site avec ce compte. L’onglet Administration permettra d’ajouter les IDs du staff.
5. Dans **Administration Discord**, choisis le salon des annonces et le rôle à notifier si besoin. Le bot a besoin d’un accès à ce salon.

## Fonctions

- Les suggestions et leurs réponses sont partagées entre les membres connectés; chaque membre peut cliquer « D’accord ».
- Le calendrier hebdomadaire interne permet au staff d’ajouter des événements, heures, notes et couleurs.
- Dans « Planning joueurs », importe l’image finale et indique les dates. La publication essaie aussi d’envoyer l’image et l’annonce Discord.
- Les préférences de taille de texte, contraste et mode compact sont conservées sur l’appareil du membre.
- Les sauvegardes JSON incluent les plannings, suggestions, réponses et événements staff. Télécharge-les régulièrement depuis Administration.

## Limites

Render Free peut mettre le site en veille après une période sans activité et ses ressources gratuites peuvent changer. L’envoi de messages privés par un bot n’est pas activé : les annonces se publient dans un salon Discord choisi.
