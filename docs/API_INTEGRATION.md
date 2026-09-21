# Backend integration contract

## Source of truth and normalization

The supplied `campusfin-public-schema.json` and `campusfin-schema-verification.json` are offline reference snapshots. No requests to that website are made by this frontend. Do not point a new backend at another website's management endpoints.

| Entity | Fields retained by frontend | Relationship |
| --- | --- | --- |
| Category | id, name | Root |
| Subcategory | id, name, category_id | Category |
| Child category | id, name, subcategory_id | Subcategory |
| Paper | id, name, country, paper_icon | Organization root |
| Job | id, name, paper_id | Paper |
| Job year | id, name, job_id | Job |
| MCQ | id, question, option1…option4, correct_answer, description, category_id | Primary category |
| MCQ multi-links | subcategory_ids, child_subcategory_ids, paper_id, job_ids, job_years_ids | Arrays of related IDs |

The legacy snapshot sometimes returns arrays as JSON-encoded strings, including the misleadingly singular `paper_id`. `MCQ.ids()` normalizes arrays, encoded arrays and scalar IDs. The new API should return real arrays. Names should be resolved from related tables rather than used as persistent identifiers.

The 2026 taxonomy is new. Category IDs start at 10000, subcategories at 20000 and child categories at 30000. These are local frontend identities, not IDs from the original system. Do not migrate legacy questions by numeric ID alone: provide an explicit, reviewed legacy-to-new taxonomy mapping. The bundled demo questions are assigned directly to the new hierarchy.

Reference `mcqs_count` values are deliberately omitted from the normalized job-year seed; those full question sets are not present. Visible MCQ counts are computed from actual Approved questions.

## Added frontend fields

Review metadata, `important`, `created_by`, `reviewed_by`, `approved_by`, `rejection_reason`, `created_at`, and `status` are proposed application fields, not assertions about undocumented source backend behavior. Current author/reviewer strings are demo display values; use authenticated user foreign keys on the server. `source` clearly marks demonstration content and illustrative paper relationships.

## Suggested API boundaries

These are proposed routes for your own Django service, not verified existing endpoints:

| Repository operation | Suggested request |
| --- | --- |
| Read taxonomy and paper hierarchy | GET /api/categories, /api/subcategories, /api/child-subcategories, /api/papers, /api/jobs, /api/job-years |
| Search/filter/page MCQs | GET /api/mcqs?q=&category_id=&status=&page=&page_size= |
| Create/edit MCQ | POST /api/mcqs ; PATCH /api/mcqs/{id} |
| Review | POST /api/mcqs/{id}/review with status and reason |
| Import validation/commit | POST /api/imports/preview ; POST /api/imports/{id}/commit |
| Current user | GET /api/session |
| Authentication | Own session/CSRF-protected login, logout, register, verify and reset flows |
| Bookmarks/history/saved papers | User-scoped API endpoints |
| Management/configuration | Server-authorized endpoints per capability |

Preserve the UI components and replace service calls through an asynchronous repository. `app.js` owns event handling; `public.js` and `admin.js` own templates. Currently templates read `MCQ.db`; a production adapter can hydrate this view model from API responses, with explicit loading, error and retry states.

## Validation and integrity

- Enforce four non-empty distinct options and an exact correct-answer match on both client and server.
- Confirm selected subcategories belong to the category, children to selected subcategories, jobs to selected papers and job years to selected jobs.
- Use parent-scoped uniqueness for taxonomy and organization children. Do not choose the first partial name match. Exact duplicate lookup is case/whitespace normalized in the demo.
- Repeat duplicate detection at commit time. Use database transactions, unique constraints and idempotency for concurrent imports; client-side preview is not a concurrency guarantee.
- Store options as text so `0.5` and measurement units are preserved.
- Use server-side role enforcement regardless of hidden buttons. Derive author/reviewer identities from the session, never from the form.
- Authentication screens currently ignore passwords after validation. Replace them with real server flows; remove demo role switching before production.
- Persist learner state per account. Current local state is intentionally shared across the demo on one browser.
- Keep review transitions in the API. New/admin-edited MCQs go Pending; rejected/correction transitions require a reason. Only Approved questions belong in public API results.
- Guide text and all user input are rendered as escaped text. If rich text is introduced later, sanitize it server-side.

## SEO integration

The document has a title, description, theme color, favicon, headings and breadcrumbs. `App.render()` updates browser title/description per view; the SEO settings form changes local defaults. Hash routes are for portable review, not full server-rendered SEO.

For Django, give each route a clean server URL. Supply unique title/description and canonical URL from the trusted deployed origin. Render breadcrumb structured data using actual visible hierarchy; add question/learning schema only where it correctly describes the published content. No canonical host or unverified structured-data claims are fabricated in this local demo.

## File and data policy

The import UI reads selected local files only. Its import action writes to browser storage, not a database. Contact forms and report submission remain local. Static development serving in `tools/serve.cjs` is not an application backend. No API keys, cloud services, packages or network resources are required to run the frontend.

## September 2026 review-management additions

The frontend now models these fields so a Django/Python backend can persist the same workflow without changing the UI contract.

### Taxonomy and paper entities

`Category`, `SubCategory`, `ChildCategory`, `Paper`, `Job`, and `JobYear` should expose:

- `name`
- `icon` (string; icon name/class or configured display token)
- `is_active` / `active`
- parent foreign key where applicable
- timestamps

Super Admin mutations must be protected server-side. Disabling is preferred over destructive deletion when a record is referenced by MCQs.

### MCQ submissions and approved-update safety

For a new question, persist `submitted_by_id`, `submitted_at`, and a submission type (`new`, `update`, or duplicate flag/status). For an edit to an already-approved MCQ, do **not** overwrite the published row before approval. Store a proposed snapshot/change request linked to the approved MCQ. The review payload must expose both the current approved values and proposed values.

Recommended backend models are either:

- `McqChangeRequest(mcq_id, submitted_by_id, submitted_at, status, proposed_payload, reason)` plus `McqChangeItem(field, old_value, new_value)`, or
- a normalized audit/change model with equivalent information.

Approval applies the proposed values in one transaction and writes audit history. Rejection leaves the approved MCQ unchanged.

### Review endpoint response

A review-detail endpoint should return the complete question record, all four options, correct answer, description, category/subcategory/child-category relations, Paper/Job/Job Year, submission type, submitted-by user, submitted timestamp, current review status, and changed fields with old/new values for updates.

Authorization must be enforced by Django/API permissions, not by hidden frontend controls. Super Admin has full review/change-comparison access; normal Admin capabilities should follow the existing role configuration.
