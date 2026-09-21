# SEO / Backend handoff

The static frontend now computes clean canonical route targets and page metadata in `frontend/assets/js/seo.js`. Hash routing remains for the demo, but the canonical path helper defines the production URL contract.

## Backend requirements
- Serve clean Django/DRF-compatible public routes and 301 redirect legacy/hash entry points where possible.
- Render title, description, canonical, Open Graph/Twitter metadata server-side for indexable pages.
- Generate `/sitemap.xml` (or a sitemap index) from approved public records only.
- Serve `robots.txt` with the final absolute sitemap URL.
- Enforce authentication, ownership and every permission server-side. Frontend permission helpers are UX only.
- Keep search/filter URLs out of the sitemap and use `noindex` for internal/account/admin pages.
- Store redirects when slugs change.
