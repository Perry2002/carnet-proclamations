# Carnet des proclamations

Application pour remplacer le comptage manuel des proclamations par WhatsApp.

- Le responsable crée un **événement** (un culte ou une semaine de croisade) depuis son
  tableau de bord et obtient un **lien unique** à partager.
- Chacun ouvre le lien et envoie son nom + son nombre de proclamations.
- Le responsable peut **clôturer** le lien à la fin de l'événement (plus aucun envoi
  n'est accepté ensuite), voir le détail de chaque événement, et **télécharger un PDF**
  du compte rendu (liste + total).

## Stack technique

- Frontend : React + TypeScript + Vite
- Backend : Node.js / Express (une seule app, API + fichiers statiques)
- Base de données : MongoDB Atlas, palier **M0 (gratuit à vie, 512 Mo, sans carte
  bancaire)** — largement suffisant pour ce volume d'usage pendant des années
- Hébergement : Vercel, plan **Hobby (gratuit, sans limite de temps)**
- PDF : générés à la volée avec `pdfkit`, aucun service payant

Ce duo Vercel + MongoDB Atlas M0 a été choisi spécifiquement parce que les deux
paliers gratuits sont permanents (pas des essais de 30 jours) : contrairement à
Railway, qui facture désormais dès la fin de l'essai gratuit.

## Mise en route en local

```bash
npm install
cp .env.example .env   # puis renseigne les valeurs (voir ci-dessous)

# Terminal 1 : l'API
npm run dev:server

# Terminal 2 : le frontend (avec rechargement à chaud)
npm run dev:client
```

Le frontend de dev tourne sur `http://localhost:5173` et redirige les appels
`/api/*` vers le serveur Express sur le port 3000.

## Créer la base de données (gratuit)

1. Va sur [cloud.mongodb.com](https://cloud.mongodb.com) et crée un compte.
2. Crée un cluster **M0 (Free)**.
3. Crée un utilisateur de base de données (nom + mot de passe).
4. Dans "Network Access", autorise `0.0.0.0/0` (accès depuis n'importe où — nécessaire
   car Vercel n'a pas d'IP fixe).
5. Récupère la chaîne de connexion (`mongodb+srv://...`) et mets-la dans
   `MONGODB_URI`.

## Déployer sur Vercel (gratuit)

1. Pousse ce projet sur un dépôt GitHub.
2. Sur [vercel.com/new](https://vercel.com/new), importe le dépôt.
3. Dans les paramètres du projet, ajoute les variables d'environnement :
   - `MONGODB_URI`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` (une longue chaîne aléatoire, ex. générée avec
     `openssl rand -hex 32`)
4. Déploie. Vercel détecte automatiquement l'app Express et exécute `npm run build`
   pour générer le frontend.
5. Une fois en ligne, va sur `https://ton-app.vercel.app/login` pour accéder au
   tableau de bord.

## Modèle de données

- **Session** (un événement) : titre, type (`culte` ou `croisade`), `slug` unique
  (utilisé dans le lien `/c/:slug`), statut (`open` / `closed`), dates.
- **Entry** (une entrée envoyée par une personne) : rattachée à une session, nom,
  nombre, horodatage.

Une semaine de croisade est structurellement la même chose qu'un culte : un
événement qui reste ouvert plus longtemps avant d'être clôturé.

## Limites connues (simplifications volontaires)

- Un seul mot de passe responsable partagé (pas de comptes individuels) — adapté à
  une petite équipe de confiance.
- Pas de modification d'une entrée après envoi, seulement suppression par le
  responsable (en cas de doublon ou d'erreur).
