# Student phone authentication

Student Google OAuth endpoints have been removed. Staff email/password login and restricted payment-review login remain available. Historical Google identity records, students, enrolments, orders, entitlements and progress are retained.

## Configuration and deployment

1. Back up the database and coordinate the API/web release.
2. Apply `npm run db:migrate` using the deployment environment. The new migration is `202609120001-phone-authentication.cjs`. It adds unique nullable login phones, verification timestamps, session versions, and a persistent phone challenge table; user email becomes optional. The migration does not assign phones or remove existing accounts.
3. Configure `SMS_ENABLED=true`, `SMS_USERNAME`, `SMS_PASSWORD`, and `SMS_SENDER`. These existing Mobitel settings are used directly. No additional SMS API URL is necessary. The standard gateway URL is `https://msmsenterpriseapi.mobitel.lk/EnterpriseSMSV3/esmsproxyURL.php` in `src/modules/sms/sms.config.js`.
4. Start the updated API and deploy the updated Web build together. Google environment variables are no longer read by authentication and can be removed by the operator.
5. Verify a new registration, login, password reset, a rejected old session, profile completion, enrolment, and checkout on staging. A real phone and working gateway credit are needed for a delivery test. Local automated tests mock delivery and do not send paid SMS.

OTPs are sent synchronously through the Mobitel adapter, outside the general SMS outbox, so the SMS worker is not required for authentication. OTP text is never stored in the admin message history. Gateway acceptance is not a delivery receipt.

## Flow and API

All paths below have prefix `/api/v1/auth/phone` and use JSON request bodies.

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /otp` | `phoneNumber`, `purpose`: `register` or `reset` | Opaque `challengeId`, `expiresIn`, `resendAfter`, generic message |
| `POST /verify` | `challengeId`, six-digit string `code` | Single-use `verificationToken` and expiry |
| `POST /register` | `challengeId`, `verificationToken`, `name`, `password` | Student session plus HTTP-only refresh cookie |
| `POST /login` | `phoneNumber`, `password` | Student session plus HTTP-only refresh cookie |
| `POST /reset-password` | `challengeId`, `verificationToken`, `password` | `{ ok: true }`; sign in again |

Sri Lankan mobile numbers accept `0771234567`, `94771234567`, or `+94771234567`, with common spacing, and normalize to `94771234567`. Landlines and other country codes are rejected. Login phone is separate from editable contact numbers in the student profile. Changing those contact numbers does not change login or recovery credentials.

Codes expire in 5 minutes, have five verification attempts, and can be resent after 60 seconds, at most five times per hour per phone/purpose. Resending invalidates previous codes and password-setup proof. Verification produces a random, single-use token valid for 10 minutes. Passwords need at least eight characters including a letter and number, with a 72-byte maximum, and use bcrypt cost 12. Only keyed hashes of codes and verification tokens are persisted.

Database row locking protects verification, resend counters and password completion. IP limits cover authentication endpoints; a persisted phone counter also limits login attempts to 15 per 15 minutes. OTP responses do not expose whether an account exists. SMS failure gives a retryable service error. Reset increments the user's session version and revokes refresh tokens, invalidating prior bearer sessions as well.

## Existing Google students

Profile mobile numbers were not verified as authentication identifiers. They are deliberately not automatically promoted to login credentials. After staff independently confirms the student's identity and phone, an operator can assign it to the existing user ID:

```powershell
node scripts/assign-student-phone.js <student-user-id> <mobile-number>
```

This refuses existing phone assignments, duplicate numbers, disabled users, and staff accounts. The student then opens `/forgot-password`, verifies the assigned number by OTP and chooses a password. The original user ID and all associated learning and purchases remain intact. Do not create a replacement student account to migrate paid access.

New students can leave email empty. A contact email can be saved in the student profile and is required by the existing PayHere checkout. It is not a login or recovery method. Review accounts retain their existing restricted access mechanism.

## Verification limits

Automated service tests use an in-memory persistence adapter, and HTTP tests mock account storage. They cover flow and security behavior but do not prove MariaDB DDL, database isolation, live SMS delivery or the remote deployment. Test those on staging before rollout. The migration intentionally refuses destructive automatic rollback; plan a reviewed database backup restore if needed.
