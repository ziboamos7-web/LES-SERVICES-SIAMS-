# Modularisation SIAMS — V1

La première étape de modularisation extrait le code sans modifier son comportement :

- `index.html` contient désormais la structure HTML et les références aux ressources.
- `css/base.css` contient la première feuille de style historique.
- `css/components.css` contient les styles additionnels (notamment les vues/impressions).
- `js/app.js` contient encore toute la logique applicative, conservée dans le même ordre que dans le fichier historique.

## Pourquoi cette étape

Elle réduit fortement la taille du HTML sans risquer de casser les dépendances entre fonctions, variables et vues.

## Étape suivante

Découper `js/app.js` par domaines (authentification, activation, commandes, produits, paiements, livraison, support, etc.) avec des exports/points d'entrée explicites. Cette étape devra être faite progressivement et testée après chaque extraction.
