# Routes

All routes follow `frontend/index.html#/...`. The entry HTML files in public/, auth/, user-dashboard/, admin/ and super-admin/ are convenience redirects into the shared frontend.

| View | Route |
| --- | --- |
| Home | home |
| All categories | categories |
| Category detail | category/{category_id} |
| Subcategory detail | subcategory/{subcategory_id} |
| Child/topic questions | topic/{child_id} |
| Organizations | papers |
| Paper/organization jobs | paper/{paper_id} |
| Job dated papers | job/{job_id} |
| Dated-paper questions | year/{job_year_id} |
| MCQ listing | mcqs |
| Practice question | practice/{mcq_id} |
| Important questions | important |
| Search | search?q=Python |
| Guides and guide | guides ; guide/{guide_id} |
| Information pages | about ; contact ; privacy ; terms ; disclaimer |
| Authentication layouts | login ; register ; forgot ; reset ; verify |
| User profile | profile |
| Learner dashboard | dashboard/overview |
| Saved questions | dashboard/bookmarks |
| History | dashboard/history?result=wrong or correct |
| Saved papers | dashboard/papers |
| Recently viewed | dashboard/recent |
| Profile settings | dashboard/settings |

Admin paths use `admin/`, Super admin paths use `super-admin/`:

- overview
- mcqs, pending, approved, rejected
- add, edit/{mcq_id}
- categories, subcategories, children
- papers, jobs, years
- import, available to Super admin and optionally Admin

Super admin-only paths:

- duplicates
- users, admins, roles
- reports, guides, content
- seo, settings, activity, backup, analytics

List filters use URL query parameters after the hash route: q, category, parent, status, sort, available and page as appropriate. Direct hash links are reloadable without server rewrite configuration. Unavailable records show an explicit empty/error page with a return action; empty reference papers do not invent MCQs.
