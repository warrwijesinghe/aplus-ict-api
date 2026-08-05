# Secure Resource Management

Resources have immutable local storage names, SHA-256 checksums, a controlled category, a visibility/access policy, status, audit trail, and optional normalized `ResourceLink` records. Physical storage keys and server paths are never serialized in API responses.

Private Resources must never be served directly from a public static directory. Access must be authorized by the API before streaming.

## Categories and limits

Images (`course_thumbnail`, `course_banner`, `lesson_image`, `video_thumbnail`, `profile_image`, `site_asset`) allow JPEG, PNG, WebP and GIF. Course/site thumbnails are capped at 5 MB, banners and lesson images at 8 MB, and profiles at 3 MB. PDFs are capped at 25 MB. Worksheets, practical files, general documents and assignment attachments/submissions allow PDF, TXT, CSV, DOCX, PPTX and XLSX and are capped at 25 MB. Payment slips permit images or PDF and are capped at 10 MB.

Public access is available only to the explicitly public image/site categories and only when both `visibility` and `accessPolicy` are `public`. Payment slips and submissions are always private. SVG and executable/script formats are not accepted.

## Delivery and lifecycle

`POST /api/v1/admin/resources` validates filename, declared MIME, extension, signature, category and size before a UUID-based key is written. Files are stored under `public|private/<purpose>/YYYY/MM/<uuid>.<ext>`. `GET /api/v1/resources/:id/view` and `/download` stream authorized files with `nosniff`, safe disposition and PDF range support. `/content` remains a compatible authorized-view alias.

Administrators can list/filter resources, inspect safe metadata, link a resource, replace it (a new record is created and the original is archived), and archive it. Replacement copies active links rather than destroying historical links. Archive/deleted/processing/quarantined resources are not delivered.

Access policies are `public`, `authenticated`, `course_enrolled`, `premium`, `admin_only`, and `owner_only`. Administrators can manage resources; owners can inspect their own private future-workflow files. Payment slips remain restricted to their owner and payment-review administrators. Teachers do not inherit payment-slip access.

## Operations

Run `npm run resources:audit` to report missing files, unsafe keys, unlinked active records and duplicate checksums. It never deletes. `npm run resources:cleanup -- --dry-run` is the default behavior; only `--confirm` marks archived records past `RESOURCE_ARCHIVE_RETENTION_DAYS` deleted after deleting their files. Payment slips and assignment submissions must not be included in ordinary cleanup without a retention-policy review.

Mount `/srv/aplus-ict/uploads:/app/storage/uploads` in deployment. Nginx must not map the private directory, must disable directory indexes, limit `client_max_body_size` to the configured upload ceiling, and add `X-Content-Type-Options: nosniff`. YouTube remains the video-hosting platform for LMS v1; the A Plus ICT server is not general video hosting.
