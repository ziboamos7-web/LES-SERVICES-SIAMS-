# Système d'activation partenaire

## Pré-validation

`check_activation_key(p_code)` vérifie notamment :

- existence du code ;
- statut `used` ;
- plan ;
- durée en jours.

Cette étape ne doit pas marquer le code comme utilisé.

## Activation finale

`redeem_activation_key(...)` intervient après authentification et après disponibilité du `store` marchand. Il active l'abonnement et marque le code comme utilisé.

## Colonnes actuellement confirmées dans `activation_keys`

- `id` uuid
- `code` text
- `plan` text
- `duration_days` integer
- `used` boolean
- `used_by_store` uuid
- `created_at` timestamp without time zone
- `used_at` timestamp without time zone
- `created_by` text
- `redeemed_at` timestamp with time zone
- `redeemed_by_store` uuid
