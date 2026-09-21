# Validation

## Automated

`node tools/verify.cjs` passes 16 groups covering:

1. All hierarchy counts and parent references.
2. Every seeded MCQ's links and answer validity.
3. Approved-only public visibility.
4. All public/authentication/learner view templates.
5. Admin permission restrictions.
6. All Super admin section templates.
7. Parent-scoped exact duplicate reuse and partial-name non-matching.
8. Entity create/update without duplicate insertion.
9. JSON arrays and decimal/unit preservation.
10. CSV quoted commas, multiline fields, escaped quotes and malformed quoting.
11. TXT parsing and hierarchical name resolution.
12. Existing and in-file duplicate skipping, invalid rows and repeat commit behavior.
13. Approval, rejection and correction visibility changes.
14. Admin edit returns an approved record to Pending.
15. Saved questions, attempt recording, papers and local persistence.
16. HTML and attribute escaping.

All JavaScript files were syntax-checked with Node. Test changes occur in an isolated VM and do not modify the delivered seed.

## Browser review

Reviewed the actual application in Chrome:

- Desktop homepage and Super admin dashboard visual layout.
- Answer selection/checking and correct answer explanation.
- Bookmark toggle and pressed state.
- Super admin role entry without credentials.
- Cascading paper/job selection, including the exact `PPSC - ASSISTANT` result.
- Pending-question approval confirmation and reduced pending result count.
- Homepage and admin table/card layout within 390px-wide frames, including mobile navigation. Found and corrected header overflow and a numeric-pagination-label rendering error.

The optional WebMCP search registration is feature-detected. This browser did not expose modelContext, so live WebMCP invocation could not be validated. Unsupported browsers skip it without affecting the website.

This is not a full cross-browser, device, screen-reader or security audit. Authentication, email, backend integration, production deployment and full past-paper data are outside the local frontend demonstration.
