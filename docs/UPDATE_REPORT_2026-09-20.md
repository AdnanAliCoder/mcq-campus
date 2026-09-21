# MCQ Campus update — 20 September 2026

## Delivery status

This is an updated frontend with a fail-closed authentication integration, **not a working production authentication backend**. The published site opens only the account screens. Login, registration, email verification/reset, account data, learning writes and administrative writes require the API below; no demo credentials unlock it. Existing content is preserved in `private-data/`, excluded from the hosted static output. Do not serve the project root or this private directory.

## Implemented

- Central pre-render login gate across all hash route families, legacy HTML entry points, refresh and browser navigation; safe internal destination/query retention; server session checks on route changes/visibility; expiry clearing; no localStorage identity or database loading.
- Dedicated branded authentication layout, no main header/footer/content links; shared before-paint light/dark preferences. Removed passwordless demo login and simulated email/password success.
- Preserved original green logo, search-left/featured-question-right home layout, ten-question feed, data IDs and relationships. Organizations derive from records; lower discovery is consolidated into Resources.
- Shared semantic theme colors, readable typography, touch controls, responsive auth/admin styling, dismissible staff drawer and constrained table/dialog containers.
- Four-question carousel retained; one ten-second timer, reset after answer/manual move, pause/resume and hover/focus pauses. Existing answer reset and answer-only explanations/dated-paper links retained.
- Added Saved MCQs, Review Mistakes and History tabs. Removed the misleading “Mastered” label. Account snapshots replace prior account data; learner writes wait for server confirmation.
- Preserved question editing, pending approval, exact entity matching, parent-child selectors, import preview, duplicate handling, recoverable deletion and stored Pakistan-time formatting. Added unsaved-form warnings and server field-error rendering.
- Removed public seed downloads and content-indexing metadata/sitemaps. Original data remains byte-for-byte in the private migration folder.

## Actually tested

`npm test`: 16 frontend/domain test groups passed, covering all protected route families, five auth screens, safe redirects, absence of demo authentication, original record validity, learner/admin template rendering, answer-only multiple dated-paper links, decimal CSV parsing, timestamps, account-state replacement, timer reset/pause/cleanup, seed exclusion, a mocked server-issued owner session and logout clearing.

All frontend JavaScript files passed syntax checks. Browser inspection confirmed the login layout in light and dark themes and direct `/admin/index.html` redirects to the login screen with no protected content. These tests use isolated fixtures/mocked responses for signed-in behavior; they do not certify live server authorization, delivery of email, database durability, end-to-end imports or all mobile learner/admin screens. Responsive CSS is implemented; comprehensive signed-in mobile QA remains a backend integration acceptance task.

## Required before production learning use

Implement the contract in `BACKEND_CONTRACT.md`; migrate the preserved records; configure real password hashing, session cookies, CSRF, permission/ownership checks, database transactions, rate limits and an email provider. Supply the operator's actual terms/privacy information. Run live integration tests for every role, account switch, expired session, failed write, edit approval, import and recovery. The static deployment alone must not be described as a secure multi-user learning platform.

Earlier reports in this archive describe the previous local demo and are historical. This report and the new backend contract supersede their authentication/storage claims.
