# MCQ Campus refinement — 2026-09-19

Implemented the cleaner public information architecture, Resources consolidation, simplified auth UI, latest-answer learner accuracy, meaningful subject progress, Continue Practice, compact Saved Papers, production-safe canonical gating, BreadcrumbList generation when clean routing is enabled, and backend-ready split sitemap files.

## Production routing note
`cleanRoutesEnabled` remains false in the static demo. Turn it on only after the server can actually serve every path in `frontend/routing-manifest.json`. This avoids emitting canonicals to URLs the current static server cannot resolve.

## Backend-dependent
Real authentication, email verification delivery, password reset tokens, rate limiting, secure sessions, server redirects, and live sitemap generation still require the Django/DRF backend.
