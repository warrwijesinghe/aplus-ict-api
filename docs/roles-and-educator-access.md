# Roles, permissions, and educator course access

The platform has five system roles: `student`, `teacher`, `content_editor`, `admin`, and `super_admin`. Roles and permissions are normalized through `roles`, `permissions`, `role_permissions`, and `user_roles`; `users.role` remains a compatibility primary-role cache for existing authentication.

`src/security/permissions.js` is the controlled catalogue and default mapping source. The `202608040002-rbac-catalogue` seeder is idempotent: it adds system defaults but never removes custom role permissions or assignments.

Educator assignments are stored in `educator_assignments`. An assignment may target a course or a specific course track. Teachers and content editors must have both the applicable global permission and an active assignment; capability flags then control content, questions, quizzes, grading, and student visibility. Admin and super-admin accounts may operate across tracks according to their permissions.

The API refreshes role and permission context from the database on each authenticated request, so role changes take effect without waiting for access-token expiry. Access tokens contain only user ID and primary role. Assignment changes are checked against the database when a scoped endpoint is called.

## Operational setup

Bootstrap the first owner with the normal administrative bootstrap process; it now creates a `super_admin`. Existing `admin` users are migrated to `super_admin` so at least one owner survives the migration. A super administrator assigns a teacher or content editor under **Users / Educators**, then creates a labelled course/track assignment under **Course assignments**. Deleting an assignment deactivates it, preserving history.

Example operational configuration (not production seed data): WARR Wijesinghe can be `teacher` or `super_admin` and assigned A/L and O/L tracks; the Grade 6–9 educator can be a `teacher` assigned only their relevant Grade 6–9 tracks.

## Security audit events

`role_changed`, `user_deactivated`, `educator_assigned`, `educator_assignment_updated`, and `educator_assignment_removed` are written to `audit_logs` with minimal target metadata, IP address, and user agent. Passwords, tokens, payment secrets, and private documents are never logged.

## API endpoints

Role and educator administration is available below `/api/v1/admin`: `roles`, `permissions`, `roles/:roleId/permissions`, `educators`, and `educator-assignments`. The educator workspace uses `/api/v1/educator/tracks` and `/api/v1/educator/tracks/:trackId`; these endpoints enforce track assignment. The course-content placeholder update endpoint is permission- and capability-protected.

Known limitation: question, quiz, assignment-grading, and course-builder domain entities are intentionally deferred to their dedicated follow-on tasks; this task supplies their permissions and scoped authorization foundation.
