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

## Google student sign-in

Student sign-in uses a Google OAuth **Web application** client. Before trying the
Google button, create the client in Google Cloud and add this exact authorised
redirect URI for local development:

~~~
http://localhost:4000/api/v1/auth/google/callback
~~~

Then set these values in your local .env file. Do not commit the secret or put
it in the Web application's .env file.

~~~dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
WEB_LOGIN_SUCCESS_URL=http://localhost:5173/login/success
~~~

Restart npm run dev in aplus-ict-api after changing .env. In production,
register the HTTPS API callback URL for that environment and update
GOOGLE_CALLBACK_URL, WEB_LOGIN_SUCCESS_URL, and CORS_ORIGINS to match it.
Google requires the callback URL to match the registered redirect URI exactly.

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

## Business identity and DirectPay foundation

Public legal identity is defined once in `src/config/business-identity.js` and exposed through the non-sensitive `/api/v1/site-profile` endpoint. Keep bank details, credentials, keys, and company documents out of that endpoint.

The internal DirectPay module is in `src/modules/integrations/directpay`. It is sandbox-only and disabled by default. Configure only in the API environment:

```dotenv
DIRECTPAY_ENABLED=false
DIRECTPAY_ENVIRONMENT=sandbox
DIRECTPAY_MERCHANT_ID=
DIRECTPAY_API_KEY=
DIRECTPAY_PRIVATE_KEY_PATH=
DIRECTPAY_PUBLIC_KEY_PATH=
DIRECTPAY_RETURN_URL=
DIRECTPAY_CANCEL_URL=
DIRECTPAY_RESPONSE_URL=
```

Never commit credentials or PEM keys. The callback foundation at `POST /api/v1/payments/directpay/response` validates a signed response but deliberately records no payment and grants no entitlement. A later commerce task will implement: student creates order → API loads and validates order, price and student → signed hosted-payment request → signed server callback → idempotent payment record → entitlement grant.

## Upload storage

Public uploads use `PUBLIC_UPLOAD_DIR` and can be served at `PUBLIC_UPLOAD_URL`
(normally `/uploads`). Private uploads are never static and are delivered only by
authorized API endpoints. Locally the directories default to `storage/uploads/public`
and `storage/uploads/private`. In deployment the VM should bind mount
`/srv/aplus-ict/uploads:/app/uploads`, providing `/app/uploads/public` and
`/app/uploads/private` inside the API container.
