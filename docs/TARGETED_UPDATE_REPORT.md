# MCQ Campus — targeted update and inspection report

> Historical first-patch report. [The additional fixes report](ADDITIONAL_FIXES_REPORT.md) supersedes its statements about current learner metadata, personal demo dashboards, timestamps and test counts. Backend/production blockers still apply.

**Status: frontend fixes completed; the requested production backend work is blocked by missing server source.** The supplied `mcq-campus.rar` contains a dependency-free HTML/CSS/JavaScript demonstration. It has no backend application, database models, migrations, real authentication endpoints or database connection. This is established by the code and by the supplied README/API integration documentation. This update is not a production security release.

## Inspection before changes

| Area | Actual implementation |
| --- | --- |
| Data/relationships | `frontend/assets/data/seed.json`, `assets/js/seed.js` and `assets/js/service.js`; localStorage collections and arrays of related IDs |
| Authentication/roles | `service.js` uses a locally selected account/activeRole; `loginByEmail()` does not verify passwords |
| Admin dashboard | `assets/js/admin.js`; counters, questions and activity read the full browser dataset |
| MCQ detail | `assets/js/public.js`, `questionCard()`; explicit `[0]` selection of Paper/Job/Year caused lost relationships |
| Homepage | `public.js`, `home()` and `app.js` click handlers; first four approved questions, 550ms answer-triggered advance, no initial automatic advance |
| Guides/posts | Plain-text local guide editor, without a real publishing workflow |
| SEO/routing | Hash URLs; browser-updated title and shared description; static HTML entry redirects; no canonical/OG/schema/sitemap/robots implementation |
| Serving | `tools/serve.cjs` is a static development file server, not an API |

## 1. Files changed

- `frontend/assets/js/service.js`: ordered ID deduplication, validated/cached featured selection, distinct Trash counts, preserve unknown original creator ID on legacy pending edits.
- `frontend/assets/js/public.js`: complete relationship groups outside explanations; featured shortlist; remove accidental accessibility text embedded in Next-question URL parameters.
- `frontend/assets/js/carousel.js` (new): one cancellable 10-second countdown.
- `frontend/assets/js/app.js`: carousel lifecycle/interaction wiring; creator and created/updated timestamps in the existing inspection modal.
- `frontend/assets/js/admin.js`: creator/date/Paper/Job filters in Super Admin, clearer read action, Trash counters and 12-item Trash pagination.
- `frontend/assets/css/styles.css`: small wrapping styles for related links, preserving existing colors/layout.
- `frontend/index.html`: load the countdown module before app startup.
- `tools/verify-targeted.cjs` (new): regression tests for this patch.
- `package.json`: run original and targeted tests with `npm test`.
- `README.md`: current scope notice.
- `docs/TARGETED_UPDATE_REPORT.md` (new): findings, completed work and blockers.

## 2. Database changes/migrations

None. There is no database implementation to migrate. Existing dataset and localStorage key remain unchanged. Associations normalize arrays, JSON-encoded arrays and scalar IDs without duplicate IDs. No taxonomy or user records were reassigned. Original creator IDs missing from legacy records remain unknown.

## 3. Permissions/role logic

**Backend isolation is not implemented or verified.** No client-only filtering is presented as a security solution. Existing local demo permissions remain in place. Admin dashboards still read shared local data and must not be deployed as a private management system. Personal contribution counts and secure individual MCQ delete/restore await the actual backend and its permission rules.

The Super Admin's All MCQs section already existed, so it was extended rather than recreated. Existing local edit/review and cascading delete/recovery were preserved. New counters cover deleted MCQs, Papers, Jobs, Job Years and category records; there is no working post-deletion resource to count.

## 4. MCQ relationship fix

Removed the first-record-only Paper/Job/Year lookup and the template-generated metadata inside the explanation. Explanation text is preserved exactly, including legitimate occurrences of the words “Paper” and “Job”. A dedicated related-content area displays every available associated Category, Subcategory, Topic, Paper, Job and Job Year, with linked records deduplicated by ID. No truncation, index-zero selection or arbitrary relationship limit remains in this card.

This verifies rendering of the data available to this frontend. There is no API or junction table here whose completeness can be tested.

## 5. Homepage slider and selection

The first slide receives 10 seconds. Answer selection preserves the result and starts a fresh 10 seconds. With no interaction the next slide appears after 10 seconds. Four slides loop continuously. Rerendering replaces the pending timeout while retaining its deadline; navigation/page exit cancels it, and returning starts a new countdown. Browser timer execution can naturally be delayed by background throttling or a busy event loop.

Selection uses the existing editorial `important` flag among approved, valid MCQs, with stable ID ordering and valid fallback questions if fewer than four are marked. The label is “Featured MCQ”; it does not claim unsupported global popularity. A five-minute in-memory shortlist is invalidated on repository writes. No global view/attempt metrics or backend cache exist in this archive.

## 6. SEO work

Audit completed; a malformed Next-question URL parameter was fixed. Production SEO implementation is **not complete**. Hash navigation prevents reliable independent HTTP routing, status codes and route-specific server metadata. No fabricated domain, sitemap of hash URLs, blanket public noindex, or hundreds of thousands of static files were added.

Recommended implementation once server source is available:

- Reuse server routes/models for category/topic, paper, job/test, job-year and published articles. Render unique metadata, canonical URLs, OG/Twitter fields and visible breadcrumbs server-side.
- Use dynamic individual MCQ URLs, such as `/mcq/{id}/{slug}`. Keep thin questions accessible with noindex and exclude them from sitemaps. Make substantive, editorially approved questions indexable; do not use word count alone as a quality decision.
- Index only canonical, public, nondeleted, meaningful content. Handle retired/deleted URLs with the appropriate HTTP response; redirect changed slugs only when a real replacement exists. Use clean pagination URLs and avoid filter/sort crawl traps.
- Serve private/admin/login/search pages with appropriate noindex metadata or headers. Authentication remains the protection for private data. Do not treat robots.txt as authorization or as a replacement for noindex.
- Generate/cache a sitemap index and separate content-type chunks from database queries. Suggested operational chunk: 10,000 eligible URLs, with byte limits enforced as well. Omit drafts, deleted/private/duplicate/thin records; use meaningful lastmod values.
- Use accurate Article and BreadcrumbList structured data where it matches visible content. Measure public response performance and mobile Core Web Vitals on the actual deployment.

Google documents a maximum of 50,000 URLs or 50MB uncompressed per sitemap and recommends canonical URLs in sitemaps: [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). Crawlers must be able to fetch a page to see its noindex instruction: [Noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Clean route/history handling and metadata require attention for JavaScript applications: [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## 7. Posts system

Not implemented: publishing secure, durable posts cannot be completed in this browser-only guide editor. Existing guides were preserved. Inspect the real backend before extending its content model with draft/published state, unique slugs, publication timestamps, featured image/alt text, sanitized article content, internal/external links and SEO fields. Enforce Super Admin authorization on every management endpoint and exclude drafts from public reads/sitemaps.

## 8. Tests performed

`npm test`: **31 regression groups passed** (19 original, 12 new).

New checks cover normalization/deduplication; 10 and 20 Paper/Job/Year links before and after answering; unchanged explanation text; featured selection excluding invalid questions; Trash distinct counts; Super Admin filters; unknown owner preservation; 9,999ms/10,000ms boundaries; rerenders; correct-answer reset; repeated loops; route exit/pagehide cancellation and return.

Original checks cover templates, imports, hierarchy validation, existing local role gates, pending/approved review safety and cascading recovery. These are frontend behavior tests, not security tests.

Browser checks: desktop homepage and answer result rendered; existing 390px iframe review showed no homepage horizontal overflow (375px body and scroll width). No live production website or authenticated backend was available. Two-admin IDOR isolation, real database queries, persistent post publishing, SEO HTTP headers/status, schema validation and large-scale sitemap tests are **not performed**.

## 9. Required next input and remaining work

Provide the actual backend repository/archive with dependency manifests, models/schema, migrations, API routes/controllers, auth middleware/policies, server templates and an environment-variable example without secrets. A sanitized schema or fixture set will help verify legacy ownership and many-to-many links; live credentials and a production database dump are not needed.

Then enforce ownership in shared server query scopes before aggregation/pagination, and enforce object-level authorization on read/edit/delete/restore/review/import/export routes. Derive ownership/audit actor IDs from the authenticated session. Preserve unassigned legacy ownership until reviewed. Test two admins against each other's IDs and spoofed author/filter parameters, plus Super Admin visibility. Inspect existing indexes, query plans and pivot constraints before migrations, and use transactions/prefetching instead of N+1 relationship queries.
