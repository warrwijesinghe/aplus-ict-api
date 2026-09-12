# A Plus ICT API

The A Plus ICT API is the single Node.js/Express modular-monolith backend for the public Web site, Student LMS and Admin application. It uses Sequelize with one MariaDB database; it does not communicate with backend services over HTTP.

## Local startup

```powershell
copy .env.example .env
npm install
npm run db:migrate
npm run db:seed
node scripts/bootstrap-admin.js admin@example.com "replace-with-a-strong-password"
npm run dev
```

## Student phone sign-in

Students register with a Sri Lankan mobile number, verify an SMS OTP, then set a password. Sign-in uses phone/password; password reset uses a fresh SMS OTP. Configure the existing Mobitel SMS credentials and run the phone authentication migration before deploying this version.

See [docs/PHONE_AUTHENTICATION.md](docs/PHONE_AUTHENTICATION.md) for endpoints, security limits, deployment, and assigning verified login numbers to existing Google students while retaining their learning and purchases.

## Payment Provider Review Access

Normal students use phone/password sign-in. A temporary, restricted student account can be enabled for an authorized payment-provider review without creating an email/password registration flow.

```dotenv
REVIEW_LOGIN_ENABLED=true
REVIEW_LOGIN_EMAIL=payhere-review@aplusict.lk
REVIEW_LOGIN_PASSWORD_HASH=<bcrypt-hash>
```

Generate the hash on a secure machine and put only the output in the API environment:

```powershell
npm run generate-password-hash -- "TemporaryPasswordHere"
npm run reviewer:setup
```

`reviewer:setup` is idempotent: it creates/reconciles the restricted student, its complete review profile, manual enrolments for every published public active course track, and active premium-lesson entitlements for those tracks. It creates no order, payment, PayHere transaction, or payment report entry. Use `npm run reviewer:create` to create/reconcile only the account. Set `REVIEW_LOGIN_ENABLED=false` and restart the API to disable sign-in after approval; the account and its access records are retained.

## Public resource library

The Web site provides a public, filterable library at /resources. Free files download without
login; paid items remain visible but require a learner sign-in.

Administrators add new entries through the **Resources** page in the Admin application. Each entry
has a file, level (A/L or O/L), medium, resource type, access policy, publishing status, and sort
order. Resource types are stored as text, so new types can be added without changing the database.

The six supplied A/L ICT syllabus and teachers-guide PDFs can be imported again safely with:

```powershell
node scripts/import-initial-downloads.js "H:/MCS School/Courses/Advanced Level/Teachers Guide/New Sylabi"
```

The importer skips records that already exist.

The API listens on `http://localhost:4000`; health and readiness endpoints are `/health` and `/ready`. See [docs/MIGRATION_REPORT.md](docs/MIGRATION_REPORT.md) for the migration inventory and known verification limits.

## PayHere Sandbox payments

Public legal identity is defined once in `src/config/business-identity.js` and exposed through the non-sensitive `/api/v1/site-profile` endpoint. Keep bank details, credentials, keys, and company documents out of that endpoint.

The active student card checkout uses PayHere's onsite popup. Configure the API with:

```dotenv
PAYHERE_SANDBOX=true
PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=
PAYHERE_NOTIFY_URL=https://api.dev.aplusict.lk/api/v1/payments/payhere/notify
```

Never commit the Merchant Secret or put it in the Web application. The API derives the amount from the stored order, creates a payment-attempt reference, and verifies PayHere's signed form notification before completing an order and granting entitlements. Register `PAYHERE_NOTIFY_URL` as the PayHere notify URL; it must be publicly reachable over HTTPS.

## Upload storage

Public uploads use `PUBLIC_UPLOAD_DIR` and can be served at `PUBLIC_UPLOAD_URL`
(normally `/uploads`). Private uploads are never static and are delivered only by
authorized API endpoints. Locally the directories default to `storage/uploads/public`
and `storage/uploads/private`. In deployment the VM should bind mount
`/srv/aplus-ict/uploads:/app/uploads`, providing `/app/uploads/public` and
`/app/uploads/private` inside the API container.
