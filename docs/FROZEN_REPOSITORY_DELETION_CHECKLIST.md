# Frozen repository deletion checklist

## Summary

| Frozen repository | Final status | Reason |
| --- | --- | --- |
| aplus-ict-auth-service | NOT SAFE TO DELETE | Google OAuth and identity replacement needs runtime verification and live-data migration. |
| aplus-ict-content-service | NOT SAFE TO DELETE | Catalogue/content data still needs export and import verification. |
| aplus-ict-learning-service | NOT SAFE TO DELETE | Enrolment/progress data and entitlement-aware access require migration smoke tests. |
| aplus-ict-commerce-service | NOT SAFE TO DELETE | Historical orders/payments and entitlement activation need data migration verification. |
| aplus-ict-resource-service | NOT SAFE TO DELETE | Private files and metadata require a verified storage copy and protected-download test. |

## aplus-ict-auth-service — NOT SAFE TO DELETE

- Useful functionality: Google identity, users, roles, refresh-token rotation, admin auth and authorization patterns.
- Destination: `auth`, `users`, `students`, identity models and shared middleware in `aplus-ict-api`.
- Completion: source replacement exists, including Google identity and student-profile creation.
- Active/Infra/CI reference check: runtime source, Compose and active CI references removed; historical migration documentation is permitted and clearly retired.
- Evidence: API syntax audit passed; live Google credentials, API install/tests and database migration have not been run.
- Blocker: run Google login and refresh-token tests against migrated data.

## aplus-ict-content-service — NOT SAFE TO DELETE

- Useful functionality: catalogue hierarchy, media tracks, lesson ordering, publication and content sections.
- Destination: `categories`, `courses`, `lessons`, `content` and monolith migrations/seeders.
- Completion: seed establishes two A/L ICT tracks with 13 lessons each; dynamic records and ordered sections are modeled.
- Active/Infra/CI reference check: no runtime source or Compose dependency remains.
- Evidence: Web build and 7 Web tests passed.
- Blocker: migrate real course/lesson/content records and verify public/locked lesson screens.

## aplus-ict-learning-service — NOT SAFE TO DELETE

- Useful functionality: enrolments, progress, completion and lesson-access rules.
- Destination: `learning`, `enrolments`, `entitlements`, `lesson_progresses` and `content_progresses`.
- Completion: progress and entitlement-aware access are local API services; no internal HTTP is used.
- Active/Infra/CI reference check: no runtime source or Compose dependency remains.
- Evidence: API syntax audit passed.
- Blocker: run API tests plus free/paid/student-progress smoke tests after migrations.

## aplus-ict-commerce-service — NOT SAFE TO DELETE

- Useful functionality: individual products, orders, payment records and transactional digital fulfilment.
- Destination: `commerce`, `orders`, `payments` and `entitlements`.
- Completion: an admin confirmation transaction marks payment/order paid and activates lesson entitlements.
- Active/Infra/CI reference check: no runtime source or Compose dependency remains.
- Evidence: static API review passed.
- Blocker: import historic orders/payments and test manual confirmation against MariaDB.

## aplus-ict-resource-service — NOT SAFE TO DELETE

- Useful functionality: private metadata records, controlled upload, safe local storage and protected delivery.
- Destination: `resources` and the `LocalStorageProvider` abstraction.
- Completion: API stores metadata only and resolves neutral local keys after lesson access checks.
- Active/Infra/CI reference check: no runtime source or Compose dependency remains.
- Evidence: source syntax audit passed.
- Blocker: copy existing storage, reconcile metadata keys, and test authorized/unauthorized download behavior.

## Required final gate

For every repository above, back up data/files; migrate data into the monolith; complete API, Web, Admin and Compose checks; complete the ten core smoke flows; and observe a successful cutover/rollback window. Only then may this checklist be updated to `SAFE TO DELETE`.
