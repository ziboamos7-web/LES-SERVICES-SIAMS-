# SIAMS

Application web SIAMS pour créer, gérer et développer une boutique en ligne.

## Fonctionnalités actuelles

- Parcours d'onboarding public
- Présentation de SIAMS et parcours partenaire
- Activation par code partenaire
- Création de compte marchand
- Vérification OTP e-mail
- ID marchand SIAMS
- Connexion marchand
- Récupération du mot de passe via le support
- Récupération de l'ID marchand SIAMS
- Gestion de boutique, commandes et livraison
- Support client

## Stack

- Frontend : HTML, CSS, JavaScript
- Backend / base de données : Supabase
- Déploiement : Vercel

## Structure

```text
SIAMS/
├── index.html
├── api/
├── assets/
├── css/
├── js/
├── docs/
├── supabase/
│   ├── migrations/
│   └── functions/
├── tests/
├── .env.example
├── .gitignore
├── CHANGELOG.md
└── README.md
```

## Variables d'environnement

Copier `.env.example` vers `.env.local` et renseigner les variables nécessaires à l'environnement local.

Ne jamais publier une clé Supabase `service_role` dans le frontend.

## Déploiement

Le projet est prévu pour Vercel. `vercel.json` doit rester à la racine du dépôt.
