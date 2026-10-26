# Backend For you

API NestJS + Prisma de la plateforme **For you** : paiements NabooPay (Wave /
Orange Money), webhook signé et API d'administration.

La plateforme est répartie en trois dépôts :

| Dépôt | Rôle |
| --- | --- |
| **Backend_ForYou** (ce dépôt) | API, webhook NabooPay, base de données |
| [Frontend_forYou](https://github.com/Joe-Wando/Frontend_forYou) | Page de paiement publique |
| [Dashboard_forYou](https://github.com/Joe-Wando/Dashboard_forYou) | Administration (transactions) |

La **source de vérité** du statut d'un paiement est le **webhook** NabooPay
(serveur-à-serveur, signé HMAC). La redirection du payeur ne fait pas foi : la page
`/success` du frontend confirme en interrogeant `GET /payments/status/:orderId`.

## Démarrage

Prérequis : Node.js >= 18, un compte NabooPay avec une clé API v2.

```bash
cp .env.example .env          # renseigner les valeurs (voir plus bas)
npm install
npm run prisma:migrate        # crée prisma/dev.db
npm run admin:create -- "identifiant" "mot de passe"   # compte du dashboard
npm run start:dev             # http://localhost:3000
```

## Variables d'environnement (`.env`)

| Variable                  | Rôle                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `NABOOPAY_API_KEY`        | Clé API NabooPay (dashboard NabooPay > Paramètres > Intégration)     |
| `NABOOPAY_WEBHOOK_SECRET` | Secret de vérification de la signature `X-Signature` des webhooks    |
| `NABOOPAY_BASE_URL`       | `https://api.naboopay.com/api/v2` (défaut)                           |
| `FRONTEND_URL`            | URL(s) du frontend, séparées par des virgules. Toutes sont autorisées en CORS ; la **première** sert à construire `success_url` / `error_url` |
| `DASHBOARD_URL`           | URL(s) du dashboard, séparées par des virgules (CORS)                |
| `ADMIN_SESSION_SECRET`    | Secret de signature des sessions admin (32 caractères min.)          |
| `ADMIN_SESSION_TTL_HOURS` | Durée d'une session admin, en heures (défaut `12`)                   |
| `PORT`                    | Port du backend (défaut `3000`)                                      |
| `MIN_AMOUNT`              | Montant minimum accepté, en F CFA (défaut `500`)                     |
| `MAX_AMOUNT`              | Plafond anti-abus, en F CFA (défaut `2000000`)                       |
| `CURRENCY`                | Devise stockée (défaut `XOF`)                                        |
| `SUGGESTED_AMOUNTS`       | Montants proposés au frontend, séparés par des virgules              |
| `DATABASE_URL`            | `file:./dev.db` en local                                             |

Exemple avec les frontends déployés sur Vercel :

```
FRONTEND_URL=https://foryou.vercel.app,http://localhost:5173
DASHBOARD_URL=https://foryou-admin.vercel.app,http://localhost:5174
```

## Routes

### Paiements (publiques)

| Méthode | Route                       | Rôle                                                       |
| ------- | --------------------------- | ---------------------------------------------------------- |
| `GET`   | `/payments/config`          | `{ minAmount, maxAmount, currency, suggestedAmounts }`     |
| `POST`  | `/payments/checkout`        | `{ amount, method }` → `{ checkout_url, order_id }`        |
| `GET`   | `/payments/status/:orderId` | Statut connu de la commande (polling frontend)             |
| `POST`  | `/payments/webhook`         | Réception + vérification des webhooks NabooPay (body brut) |

**`POST /payments/checkout`** — corps : `{ "amount": 5000, "method": "WAVE" | "ORANGE_MONEY" }`.
Le montant est **revalidé côté serveur** (`Number.isInteger`, `> 0`,
`>= MIN_AMOUNT`, `<= MAX_AMOUNT`) — le montant du frontend n'est jamais pris tel
quel. Si NabooPay renvoie une erreur, elle est remontée au frontend sans jamais
exposer la clé API (voir `src/payments/naboopay.client.ts`).

### Administration

| Méthode | Route               | Rôle                                                          |
| ------- | ------------------- | ------------------------------------------------------------- |
| `POST`  | `/admin/auth/login` | `{ username, password }` → `{ token, username, expiresAt }`   |
| `GET`   | `/admin/auth/me`    | Session courante                                              |
| `GET`   | `/admin/orders`     | `?status&method&search&page&pageSize` (session requise)       |

- Comptes dans la table `AdminUser`, mots de passe hachés avec **scrypt**.
- Jeton de session signé HMAC-SHA256 (`ADMIN_SESSION_SECRET`), envoyé en
  `Authorization: Bearer`.
- 5 échecs de connexion depuis une même IP → `429` pendant 15 minutes.
- `npm run admin:create` sur un identifiant existant réinitialise son mot de passe.

## Webhook NabooPay

1. Dashboard NabooPay → **Paramètres → Intégration** → créer un webhook
   « Statut de paiement ».
2. **URL** = l'URL publique de `POST /payments/webhook`. En local, exposer le
   backend avec un tunnel : `ngrok http 3000`, puis
   `https://<domaine-ngrok>/payments/webhook`.
3. Générer la **clé secrète**, la copier dans `NABOOPAY_WEBHOOK_SECRET` et
   redémarrer le backend.

À chaque changement de statut, NabooPay `POST` le payload avec l'en-tête
`X-Signature` = `HMAC_SHA256(secret, corps_brut)` en hexadécimal :

- signature absente ou invalide → `401` ;
- événement rejoué (même `order_id` + `transaction_status`) → ignoré, `200`
  (contrainte unique `(orderId, status)` sur `WebhookEvent`) ;
- la signature est vérifiée sur le corps **brut** (`rawBody: true`), jamais sur
  un objet re-sérialisé.

Le CORS autorise l'en-tête `ngrok-skip-browser-warning`, que les frontends
envoient quand l'API passe par ngrok gratuit.

### Tester le webhook manuellement

```bash
SECRET=changeme_webhook_secret
BODY='{"order_id":"order_123","amount":5000,"currency":"XOF","transaction_status":"completed"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
curl -i -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" -H "X-Signature: $SIG" -d "$BODY"
```

`order_123` doit exister (créer d'abord une commande via `/payments/checkout`),
sinon le webhook est accepté (`200`) mais ignoré.

## Migration vers PostgreSQL

1. `prisma/schema.prisma` → `provider = "postgresql"`.
2. `DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"`.
3. `npm run prisma:migrate`.

Tout l'accès base passe par `PrismaService` ; aucune requête spécifique SQLite.

## Vérifications

```bash
npm run typecheck && npm test && npm run build
```
