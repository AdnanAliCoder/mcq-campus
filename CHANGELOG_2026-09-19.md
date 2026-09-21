# MCQ Campus — Targeted Update (2026-09-19)

Implemented without replacing the existing frontend architecture.

- Latest supplied category taxonomy imported with data-driven icons.
- Unmatched old taxonomy nodes referenced by existing demo MCQs retained as `legacy` to prevent orphaned records.
- Paper/Job/Job Year and taxonomy entities support editable icon + enabled state in the management UI.
- Pending review table now exposes submission type and submitter.
- Review modal shows the complete MCQ record and Before → After changes for pending updates.
- Approved MCQs are no longer overwritten by edits before approval; proposed edits stay in a pending update snapshot.
- Review history stores actor, timestamps, approval result, and changed fields in local demo state.
- Homepage main content uses a larger MCQ column and smaller category navigation column; mobile stacks correctly.
- MCQ options are visible in list/home question cards.
- Selecting an option checks the answer immediately, shows correct/wrong state, explanation, Paper, Job, and Job Year.
- Admin/Super Admin sidebar scroll position is retained across dashboard navigation.
- Category/Paper/Job icons are read from entity data rather than permanently assigned by page position.
- API integration documentation expanded with backend models/permissions needed for durable Django implementation.
- Regression suite updated and passing: 17 validation groups.

Important: the uploaded project is a dependency-free frontend demonstration. It contains no Django/Python application, migrations, server database, or production authentication. Server-side permissions and durable database audit history therefore remain backend integration work, documented in `docs/API_INTEGRATION.md`.

## Compact UI & Super Admin Recovery Pass
- Removed public MCQ `Try Again` action and the metadata/source block that exposed demo breadcrumbs/source text after retry.
- Reduced overall visual scale, MCQ card padding, option padding, and spacing for a denser production-style layout.
- Redesigned homepage collection statistics into compact icon-based cards.
- Redesigned Explore Categories sidebar so every main category has a contained box, consistent icon holder, subcategory list, and View All action.
- Added consistent category icon fallback treatment for missing/icon-name records.
- Reserved Category/Subcategory/Child Category and Paper/Job/Job Year management for Super Admin; normal Admin routes are blocked as well as hidden from navigation.
- Added recoverable cascading delete for managed taxonomy/paper records. Related child records and affected MCQs move to Trash rather than being permanently destroyed.
- Added Super Admin Trash & recovery screen with one-click restore of the deleted hierarchy and affected MCQs.
- Extended verification suite with permission and delete/recovery regression tests (19 validation groups passing).


## Account / icon / MCQ display refinement
- Answered MCQ options keep full text opacity; disabled state no longer visually dims option labels.
- Explanation/result panel made more compact.
- Saved MCQs, recently viewed questions, and attempt history render full four-option question cards.
- Super Admin entity icon editor supports 1–4 characters/emoji or PNG upload.
- User profile supports local preview image upload and editable profile details.
- Password-change form added as a backend-ready UI; this frontend demo does not store passwords.
- Admin and Super Admin demo accounts also include Learner access, with workspace switching from the account menu. Learner-only accounts see only the learner workspace.
- Public/admin top header now uses a user avatar menu for dashboard/workspace, profile, and logout actions.


## Refinement pass 3
- Removed Correct!/Wrong text from the MCQ result block; result now starts with Correct answer only.
- Removed Saved MCQs, Attempt history and Recently viewed from the learner dashboard navigation and overview.
- Rebuilt learner dashboard into a compact progress summary + subject progress + saved papers view.
- Replaced the homepage warm-up card with four rotating quick-help FAQ cards.
- Added a denser sizing pass for Admin/Super Admin sidebars, cards, tables, forms and headers.

## Latest refinement
- Preserved the visible MCQ question number after answer/bookmark re-render instead of replacing it with the global dataset index.
- Home latest-practice section now shows four compact MCQs, all four options, and a small next-question arrow.
- Super Admin entity edit dialog now exposes the recoverable Delete action as well as the management-table action.
- Super Admin Job Years management now shows the total linked MCQ count for each job-year record.
- Registration now asks for WhatsApp number immediately after country.

## Home quick MCQs + Super Admin delete clarity
- Replaced the homepage hero-side FAQ panel with a four-question Quick MCQ carousel beside search.
- Each quick question exposes all four answer options immediately.
- Added a compact `>` control plus four position indicators to move through the quick questions.
- Kept answer option text at full opacity after selection.
- Made Super Admin Delete actions visually explicit for Categories, Subcategories, Child Categories, Papers, Jobs and Job Years.
- Delete continues to use the existing recoverable Trash & recovery workflow with affected MCQs.


## Frontend finalization pass
- Public MCQ collections/paper question pages now paginate at exactly 10 questions per page.
- Super Admin MCQ lists now include a compact page-size selector: 500, 1,000, 2,000, or 3,000 records at once.
- Selected page size is preserved while paging/filtering through the URL parameters.


## Final frontend patch
- Public MCQ paper/topic/search listings stay at 10 MCQs per page with explicit bottom Previous/Next page controls.
- Admin MCQ queues now have a per-page selector (10/20/50/100); Super Admin additionally supports 500/1000/2000/3000.
- Homepage Quick MCQ automatically advances to the next of the four questions shortly after an answer is selected.
- Browser tab favicon now uses the supplied MCQ Campus logo mark.

## Home pagination, job-year alignment, Important verification, Posts
- Kept the existing answer/description relationship logic unchanged.
- Improved Job year metadata alignment for one, two, or many linked job years, including long names.
- Home page now draws from every approved public MCQ in a randomized session order and shows 10 MCQs per page with Previous/Next pagination.
- Random home order remains stable while paging to prevent duplicate/ skipped questions during a browsing session; it reshuffles on reload or when the approved collection changes.
- Important MCQs remains filtered strictly to approved records marked `important`, with 10 MCQs per page.
- Added public Posts listing/detail pages and navigation.
- Added Super Admin Posts manager with title, summary, body, multiple links, and draft/published status.
