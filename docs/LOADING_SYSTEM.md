# Shared loading system — draft, asset blocked

## Status
The loading logic has been implemented in the existing frontend and Django entry template. This draft is **not ready to deploy**: the supplied animation is an H.264 MP4, 1920×1080, 24 fps, 8 seconds, yuv420p with no alpha channel. Inspection of a decoded frame confirms that its gray/white checkerboard is baked into the image. Transcoding that MP4 to WebM does not recover transparency. Removing the checkerboard would require approximate reconstruction of the logo edges and glow, which would not meet the requirement to preserve its exact appearance.

Provide the original alpha export (WebM, lossless RGBA frames, or equivalent transparent animation). The shared component expects `frontend/assets/images/mcq-loader.webm`. Preserve its animation, timing, and colors, then verify transparent playback in real desktop and mobile browsers before merging. There is deliberately no opaque MP4 or redesigned animation fallback. Missing/unplayable media falls back to plain status text so users still have feedback. No new graphic was created and the supplied MP4 was not altered.

## Implementation
- `frontend/assets/js/loading.js` creates one reusable global surface outside `#app`.
- `frontend/assets/css/loading.css` centers it in the viewport, with responsive width, transparent background, no blur/dimming/shadow, and no click-blocking overlay. Manual popover support keeps it above an existing modal; fallback uses a high z-index.
- Reference-counted operation tokens prevent one request from hiding another request's loader. Each operation releases its token in `finally`.
- A 120 ms show threshold prevents flashes on immediate work; completion is never delayed to keep the loader visible.
- The existing request boundary aborts ordinary API requests at 15 seconds; bulk import commands allow 120 seconds. The component has last-resort cleanup at 150 seconds for startup/programming failures. Watchdog cleanup does not pretend to cancel a server write.
- Requests accept an optional abort signal. Failure, invalid JSON, cancellation and timeouts all release their loading tokens.
- Initial session verification, bootstrap data, login/signup, logout, role switching, major MCQ/review saves, and bulk import commands use the center state. Background session verification preserves the existing page.
- Smaller writes use button-level states and locks; duplicate submissions/clicks are ignored while their operation is pending. Prior text/markup and disabled state are restored afterward.
- Logout failures now surface rather than silently presenting a successful logout.
- Local file imports keep their preview visible during work and validate in batches, sharing duplicate detection across batches. They release controls on parse/validation errors.
- Categories, Papers, Jobs, Job Years, MCQs, dashboard views, search and filters use the existing bootstrap snapshot. Their current route rendering is synchronous; no fake asynchronous delay or large loader was added to instant navigation. Future asynchronous route/data work should use `Loading.run(() => work(), label)` or `Loading.begin()` with `try/finally`.
- A full document's initial server response cannot show a frontend loader until HTML arrives. An initial Django/database 500 before HTML is delivered remains a server error, not a frontend loading state.

## Serving
The source entry and Django template load the same CSS/JS. The asset URL is resolved relative to loading.js, matching local and Django `/assets/` serving. Django collects `frontend/assets` through its existing static setup; the static preview server now recognizes WebM MIME type. The tracked `dist` copy is synchronized with the changed source files, not a separate implementation.

## Verification completed
- `DEBUG=true python manage.py test core --verbosity 1`: 8 tests passed (temporary local SQLite test database).
- `node tools/verify-integration.cjs`: 6 integration groups passed, including all JavaScript syntax, entry scripts, auth and protected/public route behavior.
- `node tools/verify-loading.cjs`: 13 behavior groups passed. Controlled DOM/timer/API simulation covers initial/session loading, overlapping requests, immediate completion, media failure fallback, duplicate locks, HTTP/JSON/network/timeout/abort failure, login/signup, save/update, delete/import, logout failure, duplicate detection across import batches, dashboard/browse/search template rendering, and watchdog/pagehide cleanup.

## Remaining verification
This report does not claim all 18 requested end-to-end checks passed. Desktop/mobile positioning, playback, transparency, real click flows across the 18 requested cases, and deployed production behavior remain unverified. No installed browser was available; the Chromium download returned HTTP 502. The production database was not touched. Once the alpha asset is provided, run the complete browser matrix with local test accounts and confirm the background is unchanged while loading, including inside an open modal. Include slow responses, real cancellation, route rendering failure, malformed API responses, database unavailability, duplicate clicks, and concurrent operations. Check transparent video playback on target mobile browsers as well as desktop.
