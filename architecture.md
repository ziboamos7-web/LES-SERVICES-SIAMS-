# Architecture SIAMS

## Parcours marchand

```text
Visiteur
  ↓
Onboarding
  ↓
À propos de SIAMS
  ↓
Être partenaire
  ↓
WhatsApp service client
  ↓
Code d'activation
  ↓
check_activation_key()
  ↓
Création du compte
  ↓
OTP e-mail
  ↓
redeem_activation_key()
  ↓
Dashboard marchand
```

## Principes

- Le code est pré-validé avant l'inscription sans être consommé.
- Le code est consommé uniquement lors de l'activation définitive après authentification.
- Les secrets serveur ne doivent jamais être exposés dans le frontend.
- Les changements de schéma Supabase doivent être versionnés dans `supabase/migrations/`.
