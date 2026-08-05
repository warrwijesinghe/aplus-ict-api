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
