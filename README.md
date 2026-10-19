# A Plus ICT API

The A Plus ICT API is the single Node.js/Express modular-monolith backend for the public Web site, Student LMS and Admin application. It uses Sequelize with one MariaDB database; it does not communicate with backend services over HTTP.

## Local startup

Lesson enrolments are stored in `lesson_enrolments`. Free membership never expires. Purchased full access uses the existing `entitlements.startsAt` and `endsAt`: two calendar years from the successful payment/order completion timestamp, repaired by migration `202610190003-correct-free-and-purchased-lesson-access.cjs`. Duplicate payment callbacks do not extend that period. Expired purchases lock premium content while retaining free access and all recorded progress. Lesson progress counts the full published required curriculum, including locked premium activities and required quizzes; lesson completion additionally requires full access. Legacy lesson membership is recovered only from lesson-specific learning/purchase evidence, not every lesson in a course.

```powershell
# Create the ignored .env file with the required local/server values.
npm install
npm run db:migrate
npm run db:seed
node scripts/bootstrap-admin.js admin@example.com "replace-with-a-strong-password"
npm run dev
```

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

Course tutorial image defaults require migration `202610190001-add-course-tutorial-image.cjs`. Run `npm run db:migrate` against the intended environment before deploying the updated API. Tutorial covers must reference active, publicly accessible images; lesson images override course defaults.

Public uploads use `PUBLIC_UPLOAD_DIR` and can be served at `PUBLIC_UPLOAD_URL`
(normally `/uploads`). Private uploads are never static and are delivered only by
authorized API endpoints. Locally the directories default to `storage/uploads/public`
and `storage/uploads/private`. In deployment the VM should bind mount
`/srv/aplus-ict/uploads:/app/uploads`, providing `/app/uploads/public` and
`/app/uploads/private` inside the API container.
