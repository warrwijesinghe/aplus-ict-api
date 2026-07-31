# A Plus ICT modular-monolith migration report

Migration review date: 2026-07-29.

## Repositories inspected

Active repositories: `aplus-ict-web`, `aplus-ict-admin`, `aplus-ict-api` and `aplus-ict-infra`.

Frozen migration sources: `aplus-ict-auth-service`, `aplus-ict-content-service`, `aplus-ict-learning-service`, `aplus-ict-commerce-service` and `aplus-ict-resource-service`.

## Architecture change

Before: five Express/Sequelize microservices with five databases, service-specific configuration, internal HTTP clients and gateway-oriented Web configuration.

After: one Express API with feature services and models, one MariaDB schema, one `VITE_API_URL`, and a simple Nginx reverse proxy. Web and Admin communicate only with the API. There are no service-to-service HTTP clients.

## Frozen-source inventory and decisions

| Source | Useful functionality found | Decision | Destination / reason |
| --- | --- | --- | --- |
| Auth | users, roles, permissions, refresh tokens, Google OAuth state/identity, admin authentication | MIGRATE / REFACTOR | `auth`, `users`, `students`; Google-only student flow and admin password flow retain the useful split |
| Content | subjects/categories, courses, media tracks, 13-lesson foundation, chapters/sections, publish ordering and public catalogue | MIGRATE / REFACTOR | `categories`, `courses`, `lessons`, `content`; simplified to A/L ICT first |
| Learning | enrolments, lesson/activity progress, completion calculations and access checks | MIGRATE / REFACTOR | `learning`, `enrolments`, `entitlements`; local database services replace internal HTTP clients |
| Commerce | products, orders, order items, payment status, manual confirmation and digital fulfilment | MIGRATE / REFACTOR | `commerce`, `orders`, `payments`, `entitlements`; one transaction grants lesson entitlements |
| Resources | metadata, upload limits, local provider, safe paths and private delivery | MIGRATE / REFACTOR | `resources` and shared storage provider; no free/paid folder split |
| Physical fulfilment, stock, direct-payment adapter, image derivatives, cloud providers | DISCARD / MISSING | Not required for individual digital lesson access. Cloud adapters remain an intentional extension point. |

## Database and API changes

`202607290001-create-modular-monolith.cjs` creates identity, catalogue, learning, commerce and resource tables. `202607290002-add-identity-students-and-content-progress.cjs` adds external Google identities, student profiles, many-to-many roles/permissions and section progress. Seeders establish A/L ICT with Sinhala and English tracks and 13 lessons each.

The API provides `/health`, `/ready`, and `/api/v1/*`. Core flows include Google sign-in, admin sign-in, published catalogue lookup, login-gated lesson retrieval, entitlement checks, progress writes, order creation, bank-transfer submission, manual confirmation, entitlement activation and protected resource content.

## Active-project changes

- Web now takes one `VITE_API_URL`; old direct-service and gateway URL variables were removed.
- Admin is a Vite/React foundation with protected sign-in and feature-ready management navigation.
- Infra Compose contains only MariaDB, API, Web, Admin and Nginx. Nginx proxies `/api/` to the API and `/admin/` to Admin.
- Obsolete Infra scripts and CI definitions were replaced or removed; remaining historical files must not be used as deployment instructions.

## Verification evidence

- API source, migration, seeder and configuration syntax validation: passed.
- API test suite: passed (1 test).
- Sequelize migration status: passed; both monolith migrations are applied.
- API live health/readiness checks: passed.
- Web production build: passed.
- Web test suite: passed (7 tests).
- Runtime dependency audit for API/Admin/Web source, Compose and `.env.example`: no old service URL, hostname or frozen repository reference found.
- API dependency installation: passed.
- Admin dependency installation and production build: passed.
- Docker Compose validation and Nginx runtime validation: pending because Docker/Nginx are unavailable on this machine.
- Admin source/package syntax validation: passed.

## Known limitations and next step

The migration source code is complete enough for local development, but production data has not been imported. Before retiring frozen repositories, install dependencies, run migrations and seeders against a safe MariaDB instance, migrate production data/resources, then smoke-test the documented access and payment flows. The deletion checklist is authoritative.
