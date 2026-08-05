# LMS content architecture

`CourseTrack` is the internal model representing a course Medium. Admin and student interfaces should display the label “Medium”. It is not renamed at database level, so existing clients and enrolment data remain compatible.

## Hierarchy

`AcademicLevel -> Course -> CourseTrack (Medium) -> Lesson -> Topic -> LessonSection (Learning Activity)`.

An academic level has a unique code, bilingual names, ordering, and an active flag. A Course belongs to one academic level. A CourseTrack belongs to exactly one Course and Medium, and its `(courseId, mediumId)` combination is unique where legacy data permits the constraint. Lessons, Topics, and Learning Activities are ordered with `sortOrder` and use parent-scoped slugs.

Examples:

```json
[
  { "academicLevel": "AL", "course": "ICT", "medium": "sinhala", "trackSlug": "al-ict-sinhala" },
  { "academicLevel": "GRADE_6", "course": "ICT", "medium": "sinhala", "trackSlug": "grade-6-ict-sinhala" },
  { "academicLevel": "GRADE_6", "course": "ICT", "medium": "english", "trackSlug": "grade-6-ict-english" }
]
```

## Learning activities

The central registry permits: `label`, `page`, `rich_text`, `video`, `image`, `pdf`, `file`, `download`, `external_link`, `embed`, `practical_activity`, `assignment`, and `quiz`. `assignment` and `quiz` are relationship placeholders only; no submission or quiz engine is implemented here.

Activities have `free` or `premium` access, and completion modes `none`, `view`, `manual`, `submit`, or `pass`. Type-specific options belong only in `config`; parents, resources, scores, and URLs are relational fields. External URLs require HTTP/S and video URLs must be approved YouTube formats.

## Publishing and protection

Lessons, Topics, and Activities support `draft`, `published`, and `archived`, visibility, and optional availability windows. Public learning responses include only published, visible, currently available descendants of public active tracks. A `coming_soon` Medium exposes catalogue metadata but no curriculum or lesson content. Paused and archived tracks are not public.

Unauthorised requests receive premium activity metadata with `isLocked: true`, but never the content body, video/external URL, Resource ID, configuration, instructions, scores, or storage details. Entitlement is checked by the API. Resources are not deleted when an activity is removed.

## APIs

Public compatibility routes remain:

- `GET /api/v1/public/courses`
- `GET /api/v1/public/courses/:courseSlug`
- `GET /api/v1/public/courses/:courseSlug/curriculum`
- `GET /api/v1/public/courses/:courseSlug/lessons/:lessonSlug`

`academicLevel`, `grade`, `medium`, `availability`, and `featured` catalogue filters are validated. `paidContentCount` / `paidActivityCount` remain compatibility aliases; new activity access values return `premium`.

Management routes are available under `/api/v1/admin` for academic levels, courses, tracks, lessons, topics, and activities. `/admin/sections` remains for existing clients and refers to the same internal `LessonSection` model. Batch ordering routes are:

- `PATCH /admin/tracks/:trackId/lessons/reorder`
- `PATCH /admin/lessons/:lessonId/topics/reorder`
- `PATCH /admin/topics/:topicId/activities/reorder`

They require complete unique child ID lists, verify parent ownership, and update sort orders within a transaction.

## Permission and migration notes

Management endpoints require the Task 02 permission system. Teachers and content editors also require an active, content-capable assignment for the matching course/Medium; administrators follow their configured permission grants. Content changes and ordering create safe audit events without copying bodies or private storage fields.

Migration `202608050001-add-lms-content-architecture.cjs` backfills legacy `paid`/`preview` section policy to `premium`, adds availability/completion/schema fields and indexes, and adds foreign keys only when existing data is valid. It never deletes published content. Lesson duplication is available as a service foundation and produces hidden draft copies while retaining shared Resource references.

## Learning Activity type system

`src/modules/content/activities/activity-types.js` is the central server-side catalogue for Learning Activity types. It defines each type's purpose, supported completion modes, safe configuration keys and defaults, resource categories, publication requirements, score capability, and whether it is active or future-ready. Do not add type strings directly to controllers or clients.

| Type | Purpose | Completion modes | Publication requirement |
| --- | --- | --- | --- |
| `label` | Short heading or separator | `none` | Title; short text only |
| `page`, `rich_text` | Full page or inline formatted notes | `none`, `view`, `manual` | Title and sanitized non-empty content |
| `video` | Approved YouTube video | `none`, `view`, `manual` | Title and valid YouTube URL |
| `image` | Diagram or illustration | `none`, `view`, `manual` | Image resource and alt text unless decorative |
| `pdf` | PDF viewer/download | `none`, `view`, `manual` | PDF resource |
| `file`, `download` | General file or explicit download | `none`, `view`, `manual` | Safe resource |
| `external_link` | External educational site | `none`, `view`, `manual` | Valid HTTP/S URL |
| `embed` | Controlled provider embed | `none`, `view`, `manual` | An enabled approved provider (none are enabled initially) |
| `practical_activity` | Non-submitted practical exercise | `none`, `view`, `manual` | Title and instructions |
| `assignment`, `quiz` | Future normalized engines | `submit`, `pass` | Cannot publish in this release |

Every activity has the existing common fields plus `configVersion` (default `1`) and `publishedAt`. Access is only `free` or `premium`; lifecycle state is `draft`, `published`, or `archived`. A draft permits incomplete publish fields but always validates its parent hierarchy, type, access policy, completion mode, availability dates, safe content, resource type (where supplied), and configuration shape. Publishing runs the additional type-specific requirements and records `publishedAt`.

Configuration is an allow-list, not a free-form payload. Video permits `provider`, `displayMode`, and `allowExternalOpen`; PDF permits `displayMode` and `allowDownload`; Image permits `altText`, `caption`, and `decorative`; External Link permits `openInNewTab`; Practical Activity permits `requiredSoftware` and `expectedOutput`. Unknown keys and sensitive values such as scripts, tokens, payment data, correct answers, and submissions are rejected.

Rich content is sanitized by the API on write and public serialization using an educational HTML allow-list. Scripts, styles, forms, iframe/object/embed tags, event attributes, JavaScript URLs, and unsafe image sources are removed or rejected. Safe headings, paragraphs, lists, tables, quotations, code, links, and HTTPS images remain. Video stores a canonical YouTube watch URL only; accepted inputs are `youtube.com/watch?v=`, `youtu.be/`, and `youtube.com/embed/`. Embed accepts no provider by default, so arbitrary iframe HTML cannot be stored or published.

## Activity management API

The Admin metadata endpoint is `GET /api/v1/admin/activity-types`. It returns only form-safe type metadata and never validator source, implementation paths, credentials, storage keys, or private configuration.

In addition to the existing CRUD endpoints, the following activity lifecycle endpoints are available:

- `POST /api/v1/admin/activities/:id/publish`
- `POST /api/v1/admin/activities/:id/unpublish`
- `POST /api/v1/admin/activities/:id/archive`
- `POST /api/v1/admin/activities/:id/duplicate` (optional `destinationTopicId`)
- `GET /api/v1/admin/activities/:id/preview`

Duplication creates a hidden draft in the destination Topic with a new ID, next Topic sort order, no `publishedAt`, and retained reusable Resource link. It does not copy progress, attempts, submissions, grades, or entitlements. Preview returns a safe Admin serialization, access and availability badges, safe Resource metadata, and publication-readiness warnings. `GET/POST/PATCH /api/v1/admin/sections` remains a compatibility alias for the internal `LessonSection` model.

Public and unauthorized premium responses receive only lock-safe metadata (identity, title, description, type, access policy, completion mode, estimate, and sort order). They never receive content, URLs, Resource IDs, configuration, instructions, scores, storage paths, or embed details. Authorized students receive content only through the existing published, visible, date-available hierarchy and entitlement checks. Admin and assigned educators receive the editable safe serialization. Lifecycle changes create minimal `activity_created`, `activity_updated`, `activity_published`, `activity_unpublished`, `activity_archived`, and `activity_duplicated` audit events without lesson bodies or private resource data.

### Known limitation

Quiz and Assignment activities are recognized in Task 04, but they cannot be published as operational activities until their normalized engines are implemented in later tasks.
