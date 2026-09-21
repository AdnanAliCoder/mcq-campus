# Required same-origin API

The static site has no backend bindings or email service. `frontend/assets/js/auth.js` calls JSON endpoints under `/api`. Deploy an API on the same origin (or a same-origin server proxy); no credentials belong in frontend scripts. Return `Content-Type: application/json`, `Cache-Control: no-store`. Missing/non-JSON endpoints fail closed.

## Identity and authentication

`GET /api/auth/session` returns `{user:null, csrfToken}` when logged out, or `{user, csrfToken}`. A user includes `id`, `name`, `email`, `roles` (assigned by the server, including `user`, `admin`, `super-admin` as applicable), `activeRole`, `permissions` (explicit strings matching the existing permission catalog), and an ISO UTC `expiresAt`. Never trust those properties when echoed by a client. Use secure HttpOnly SameSite session cookies, server-side invalidation, idle/absolute expiry, and password hashing (e.g. Argon2id).

POST requests send JSON and `X-CSRF-Token`, with same-origin credentials. Enforce CSRF and Origin checks. Obtain the unauthenticated CSRF token from the session endpoint too.

| Endpoint | Request | Successful response |
| --- | --- | --- |
| POST /api/auth/login | email, password, remember | `{user,csrfToken}` only after password verification |
| POST /api/auth/register | name, email, password, terms | `{completed:true,message}` only when registration/email action actually succeeds; assign learner only |
| POST /api/auth/forgot | email | `{completed:true,message}` after a real reset request has been accepted; use non-enumerating messages |
| POST /api/auth/reset | token, password, confirm | `{completed:true,message}` after consuming a valid single-use expiring token and updating the password |
| POST /api/auth/verify | token | `{completed:true,message}` after successful token consumption |
| POST /api/auth/resend-verification | email | `{completed:true,message}` after the provider accepts the email request; rate-limit |
| POST /api/auth/logout | empty object | success only after invalidating the server session |

Return 401 for an expired authenticated session, 403 for denied access/CSRF, 422 for validation, 429 for rate limiting. Error JSON: `{message, fields?:{fieldName:message}}`. Do not log passwords or email tokens. Strip reset/verification tokens from logs and use a restrictive referrer policy.

## Authorized data loading

`GET /api/bootstrap` requires a valid session. Return a JSON snapshot using the existing field names: categories, subcategories, children, papers, jobs, years, mcqs, guides, posts, settings, content, seo, rolePermissions, users, reports, logs, contacts, trash, bookmarks, savedPapers, attempts, recent. Arrays absent from the user's authorization must be empty, never globally exposed. The client initializes safe defaults for optional collections. Approved questions alone go to learners; pending proposals and other users' records must not be sent to them. Ordinary admins receive only owned/permitted content and personal activity; no global account lists or owner analytics. Progress arrays contain the signed-in user's records only. Questions/record IDs and multi-association arrays retain their original meaning.

## Writes

`POST /api/commands` receives `{action,payload}`. Return `{result,snapshot,user?}` after an atomic successful write. A fresh snapshot must follow the same scoping rules as bootstrap. The frontend updates visible learning results only after confirmation. Enforce an allowlist of actions, field validation, ownership and granular permission checks on the server; do not accept arbitrary database replacement or infer identity/permissions from payload values.

- `attempt`: payload `{args:[questionId, exactAnswerText]}`. Verify approved question and matching option; insert one attempt. Add server idempotency for retries; latest-answer statistics count unique question IDs.
- `toggleBookmark`, `savePaper`: `{args:[id]}`; scope to the session account, return the resulting saved boolean.
- `report`: `{args:[questionId,reason]}`.
- `saveProfile`: `{args:[values]}`; allowlist profile fields. Handle avatar validation/storage and email-change verification.
- `changePassword`: validate current/new/confirmation values; revoke other sessions as appropriate.
- `form:mcq`, `form:entity`, `form:review`, `form:profile`, `form:password-change`, `form:contact`, `form:user`, `form:guide`, `form:post`, `form:config`: payload contains `values` (single values), `fields` (all FormData entries), `context` (form data attributes), and `draft` for the existing question editor. Validate all fields and parent-child links. Preserve values on errors and return field messages. Registration is separate and can never call staff account/role actions.
- `action:entity-delete-confirm`, `action:trash-restore`, `action:report-resolve`, `action:import-confirm`: payload contains the button's data attributes and import rows where applicable. Re-validate previews, duplicates, ownership and links on the server. Import returns counts `{imported,duplicates,invalid,failed}` plus row errors. Deletion must retain a recoverable transaction group and show impact before commit.

For MCQ edits, keep the approved row immutable to learners until the pending proposal is approved. Save created/updated/reviewed UTC timestamps in the database; never synthesize missing historical values. Staff taxonomy actions use the matching permission (`manage_categories`, `manage_papers`, etc.); role/account management is owner-only. Workspace switching does not grant a role.

## Migration and deployment

`private-data/seed.json`, `seed.js` and the category source preserve the uploaded data. Import them through a server migration, preserving IDs and associations; inspect demonstration associations before presenting them as verified exam appearances. Do not copy them back into `frontend/` or `dist/`. The old localStorage database is not trusted and is not imported automatically; migrate any valuable local edits through an owner-reviewed export.

Publish only `dist/`, prepared from `frontend/`. The source ZIP and private-data directory are for the owner, not downloadable site assets. The supplied live Site is private to its owner; that outer audience setting does not replace application account authentication.
