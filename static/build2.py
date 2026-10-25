#!/usr/bin/env python3
"""Batch B + C: page-level templates (job/blog/pdf detail, legal, faq,
country landing, learner settings/subpage, test attempt) and dynamic routes."""
from build import (page, write, crumbs, question_card, stat_card, ICONS,
                   SAMPLE_MCQS, JOBS, PDFS, POSTS, PAPERS, CATEGORIES,
                   PROGRESS_ROWS, ACTIVITIES, QUICK_ACTIONS, LEARNER_NAV,
                   home_stat, TEST_QUESTIONS)

# ---- 23. job-detail.html ----
org, title, orgfull, desc, last, slug = JOBS[0]
body = f'''<div class="container page">
      {crumbs([('Jobs &amp; Exams', 'latest-jobs.html'), ('PPSC Lecturer Recruitment 2026', '')])}
      <header class="page-heading"><h1>{title}</h1><p>Full advertisement details for Punjab Public Service Commission recruitment.</p></header>
      <article class="card latest-job-card"><div class="latest-job-logo"><span class="entity-card-image">{ICONS['briefcase']}</span></div>
        <div class="latest-job-copy"><p class="eyebrow">{orgfull}</p><h2>{title}</h2>
          <p>{desc}</p>
          <p><strong>Last Date:</strong> {last}</p>
          <div class="actions"><a class="btn primary" href="#">Apply Online (PPSC Portal)</a><a class="btn ghost" href="latest-jobs.html">More Jobs</a></div>
        </div></article>
      <section class="card seo-related-block" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">ADVERTISEMENT SUMMARY</p><h2>Key details at a glance</h2></div></div>
        <table class="admin-table"><tbody>
          <tr><td><strong>Organization</strong></td><td>Punjab Public Service Commission (PPSC)</td></tr>
          <tr><td><strong>Posts</strong></td><td>Lecturer (Biology, Chemistry, English, Pakistan Affairs) — BS-17</td></tr>
          <tr><td><strong>Pay Scale</strong></td><td>Rs. 46,000 – 97,000 per month</td></tr>
          <tr><td><strong>Eligibility</strong></td><td>Master&#39;s degree with at least 55% marks in the relevant subject; age 21–40 years (relaxation as per government rules).</td></tr>
          <tr><td><strong>Fee</strong></td><td>Rs. 2,000 (general) / Rs. 1,000 (PwD) via PPSC online banking challan.</td></tr>
          <tr><td><strong>Last Date</strong></td><td>{last}</td></tr>
        </tbody></table>
        <p class="small muted">Always verify eligibility, dates and application instructions with the official PPSC website before applying.</p>
      </section>
    </div>'''
write('job-detail.html', page('PPSC Lecturer Recruitment 2026 (BS-17) — Job Details | MCQCampus',
                              'PPSC Lecturer recruitment 2026 on BS-17: eligibility, pay scale, application fee and last date 15 November 2026.',
                              body, 'latest-jobs', 'latest-job'))

# ---- 24. blog-detail.html ----
btitle, bex, bcat, bdate, bslug = POSTS[0]
body = f'''<div class="container page">
      {crumbs([('Blog &amp; Updates', 'blog.html'), (btitle, '')])}
      <article class="article public-article blog-detail-article"><p class="eyebrow">BLOG</p>
        <h1>{btitle}</h1>
        <p class="post-lead">{bex}</p>
        <p class="small muted">{ICONS['calendar']} Published {bdate} &middot; 4 min read</p>
        <div class="article-body">
          <p>The Punjab Public Service Commission has notified changes to its preliminary examination pattern starting 2026. The two most important adjustments are the removal of negative marking and an increased weightage for subject-specific MCQs in post-wise tests.</p>
          <h2>What changed</h2>
          <p>Earlier papers mixed general ability with subject questions in a fixed 1:1 ratio. The revised scheme allocates roughly 60% of marks to the post&#39;s core subject and 40% to general sections (Everyday Science, Current Affairs, English and Pakistan Studies). One mark is deducted for no answer; wrong answers no longer attract a penalty.</p>
          <h2>How to adjust your preparation</h2>
          <p>Shift revision time toward your subject syllabus, but do not abandon repeaters for general sections — they still decide tie-breakers. Solve at least three year-wise past papers under timed conditions, because pace remains the biggest cause of low scores.</p>
          <ul><li>Rebuild your study plan around the 60/40 split.</li><li>Practise with solved <a href="past-papers.html">PPSC past papers</a>.</li><li>Track weak areas using your <a href="dashboard.html">learning dashboard</a>.</li></ul>
        </div>
        <section class="post-links"><h2>Useful links</h2><div class="post-links-list">
          <a href="mcqs.html">Practice PPSC MCQs</a>
          <a href="past-papers.html">PPSC Past Papers 2024</a>
          <a href="pdfs.html">Download Preparation PDFs</a>
        </div></section>
        <div class="post-practice-cta"><a class="btn primary" href="tests.html">Take a Related Test</a><a class="btn ghost" href="blog.html">Back to Blog</a></div>
      </article>
    </div>'''
write('blog-detail.html', page('PPSC Past Papers Pattern Change 2026 — Blog | MCQCampus',
                               'PPSC revised its 2026 preliminary pattern: negative marking removed and subject weightage increased. Learn how to adjust your preparation.',
                               body, 'posts', 'blog-detail'))

# ---- 25. pdf-detail.html ----
ptitle, pdesc, pfile, psize = PDFS[0]
body = f'''<div class="container page">
      {crumbs([('PDF Resources', 'pdfs.html'), (ptitle, '')])}
      <header class="page-heading"><h1>PPSC CS Preliminary Solved Paper 2024</h1><p>Complete solved paper with answer keys and explanations.</p></header>
      <article class="card pdf-card pdf-direct-card">
        <div class="pdf-direct-copy"><p class="eyebrow">EXAM PREPARATION PDF</p><h2>{ptitle}</h2>
          <p>{pdesc}</p>
          <p class="small muted">File size: {psize} &middot; Format: PDF &middot; Language: English</p>
        </div>
        <div class="pdf-direct-action"><a class="btn primary" href="{pfile}" download>{ICONS['download']} Download PDF</a></div>
      </article>
      <section class="card seo-related-block" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">INSIDE THIS PDF</p><h2>Contents</h2></div></div>
        <ul><li>Full 120-MCQ question paper of PPSC Computer Scientist (BS-16) preliminary test, 2024.</li><li>Answer key with corrected options and short explanations for high-yield items.</li><li>Topic-wise breakdown: OOP, data structures, operating systems, networking, DBMS and general ability.</li></ul>
        <div class="chips"><a class="chip" href="mcqs.html">Practise related MCQs</a><a class="chip" href="past-papers.html">More past papers</a></div>
      </section>
    </div>'''
write('pdf-detail.html', page('PPSC CS Preliminary Solved Paper 2024 (PDF) | MCQCampus',
                              'Download the PPSC Computer Scientist preliminary solved paper 2024 PDF with 120 MCQs, answer keys and explanations.',
                              body, 'pdfs', 'pdf-detail'))

# ---- 26. legal.html ----
def legal_section(anchor, heading, paras):
    ps = ''.join(f'<p>{p}</p>' for p in paras)
    return f'<section id="{anchor}"><h2>{heading}</h2>{ps}</section>'

legal_body = ''.join([
    legal_section('terms', 'Terms &amp; Conditions', [
        'By accessing MCQCampus you agree to use the platform for personal educational purposes only. All practice questions, past-paper compilations and study materials are provided on an "as is" basis without warranties of any kind.',
        'You may not scrape, resell or republish our content in bulk without written permission. Accounts found violating these terms may be suspended at the administrator&#39;s discretion.',
        'Job advertisements, exam dates and fee details are compiled from public sources; MCQCampus does not act as a recruiting agency and takes no responsibility for changes announced by examining bodies.']),
    legal_section('privacy', 'Privacy Policy', [
        'We collect only the information needed to run your learner account: name, email, country and your practice activity (attempted questions, accuracy and bookmarks). We never sell personal data.',
        'Email addresses are used for account verification, password resets and optional digests. You can request deletion of your account and associated data through the Contact page at any time.',
        'Analytics cookies help us understand which sections learners use; they store aggregate data only. See the Cookie Policy below for details.']),
    legal_section('disclaimer', 'Disclaimer', [
        'MCQCampus is an independent preparation platform and is not affiliated with PPSC, FPSC, NTS, CSS or any government organization. Official names are referenced for identification only.',
        'While answers are reviewed by editors, errors are possible. Always cross-check critical information with official notifications before making application decisions.']),
    legal_section('cookies', 'Cookie Policy', [
        'Essential cookies keep you signed in and remember your chosen country library. Preference cookies store UI choices such as sidebar visibility.',
        'If analytics integration is enabled, first-party measurement cookies collect anonymised page-view statistics. You can clear cookies at any time through your browser settings.']),
    legal_section('advertising', 'Advertising Policy', [
        'Advertisements, if displayed, are clearly separated from editorial content and never influence which MCQs or articles appear in listings.',
        'Advertisers targeting learners must comply with applicable education-advertising rules. Report suspicious ads through the Contact page.'])])

body = f'''<div class="container page">
      {crumbs([('Legal &amp; Policies', '')])}
      <header class="page-heading"><h1>Legal &amp; Policies</h1><p>Terms, privacy, disclaimer, cookies and advertising policies.</p></header>
      <nav class="chips" style="margin-bottom:18px"><a class="chip" href="#terms">Terms</a><a class="chip" href="#privacy">Privacy</a><a class="chip" href="#disclaimer">Disclaimer</a><a class="chip" href="#cookies">Cookies</a><a class="chip" href="#advertising">Advertising</a></nav>
      <article class="article legal-article public-article"><p class="policy-updated">Last updated: 1 October 2026</p>{legal_body}</article>
    </div>'''
write('legal.html', page('Legal &amp; Policies — Terms, Privacy, Disclaimer | MCQCampus',
                         'MCQCampus legal pages: terms and conditions, privacy policy, disclaimer, cookie policy and advertising policy.',
                         body, '', 'legal'))

# ---- 27. faq.html ----
FAQS = [
    ('What is MCQCampus?', 'MCQCampus is an educational preparation platform where learners can practise MCQs, review past papers, take tests and explore exam-related resources.', True),
    ('Do I need an account?', 'Some public content is available without an account. Downloads and personalized learning features may require sign-in.', False),
    ('Can MCQ answers contain mistakes?', 'Errors can occur. Use the question report control or the <a href="contact.html">Contact Us</a> page to submit a correction.', False),
    ('Are jobs and exam dates official?', 'Always verify eligibility, dates and application instructions with the relevant official authority.', False),
    ('Does MCQCampus guarantee exam or job results?', 'No. The platform provides preparation resources but does not guarantee exam success, selection or employment.', False),
    ('How often are new MCQs added?', 'Editors publish new batches weekly; important-MCQ sets rotate automatically every 7 days.', False),
    ('Is MCQCampus free to use?', 'Yes — practising MCQs, reading updates and taking automatic tests is free. Some premium PDF packs may require sign-in.', False),
]
faq_html = '<div class="faq-list">' + ''.join(
    f'<details{" open" if open else ""}><summary>{q}</summary><p>{a}</p></details>'
    for q, a, open in FAQS) + '</div>'
body = f'''<div class="container page">
      {crumbs([('FAQ', '')])}
      <header class="page-heading"><h1>Frequently Asked Questions</h1><p>Answers about accounts, content accuracy and preparation features.</p></header>
      {faq_html}
      <p class="small muted" style="margin-top:16px">Still have a question? <a href="contact.html">Contact MCQCampus support</a>.</p>
    </div>'''
write('faq.html', page('FAQ — Frequently Asked Questions | MCQCampus',
                       'Frequently asked questions about MCQCampus: accounts, answer accuracy, official notices, pricing and content updates.',
                       body, '', 'faq'))

# ---- 28. country-landing.html ----
def landing_cat_card(name, count):
    return (f'<a class="card clickable entity-showcase-card" href="category-detail.html">'
            f'<div class="entity-card-media"><span class="entity-card-image">{ICONS["grid"]}</span></div>'
            f'<div class="entity-card-body"><span class="entity-card-badge">Pakistan</span><h3>{name}</h3>'
            f'<p>Solved MCQs with explanations.</p>'
            f'<div class="entity-card-meta"><span>{ICONS["book"]} {count} MCQs</span></div></div>'
            f'<span class="entity-card-arrow" aria-hidden="true">{ICONS["chevron"]}</span></a>')

cards = ''.join(landing_cat_card(n, c) for _, n, c in CATEGORIES[:6])
body = f'''<div class="container page country-landing-page">
      <section class="country-landing-content">
        <p class="eyebrow">WELCOME TO MCQCAMPUS</p>
        <h1>Pakistan Exam Preparation Library &#128252;</h1>
        <p class="muted">Practice MCQs, solve past papers and prepare for PPSC, FPSC, SPSC, NTS and CSS examinations from one country library.</p>
        <div class="country-choice-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:18px">{cards}</div>
        <div class="actions" style="margin-top:18px"><a class="btn primary" href="login.html">Sign in to this library</a><a class="btn" href="register.html">Create account</a></div>
        <p class="small muted country-landing-back"><a href="country-entry.html">Choose a different country</a></p>
      </section>
    </div>'''
write('country-landing.html', page('Pakistan Library — MCQCampus',
                                   'The MCQCampus Pakistan library: PPSC, FPSC, SPSC, NTS and CSS MCQs, past papers, tests and PDF resources.',
                                   body, '', 'country-landing'))

# ---- 29. learner-settings.html ----
body = f'''<div class="container page learner-dashboard-shell">
    <div class="learner-mobile-head"><button class="btn ghost" type="button">{ICONS['menu']} Learning menu</button></div>
    <div class="learner-shell">
      <aside class="learner-side card" id="learner-sidebar">
        <div class="learner-side-head"><strong>My Learning</strong><span class="small muted">Personal preparation center</span></div>
        {LEARNER_NAV}
      </aside>
      <main class="learner-content">
      <div class="learner-profile-page">
        <section class="card profile-header-card"><div class="profile-photo-row"><div><span class="profile-photo profile-photo-fallback">AK</span></div>
          <div class="profile-header-copy"><p class="eyebrow">LEARNER PROFILE</p><h2>Ayesha Khan</h2><p>ayesha.khan@example.com</p>
          <label class="btn sm" for="profile-image">Change photo</label><input class="visually-hidden" id="profile-image" type="file" accept="image/png,image/jpeg,image/webp"></div></div></section>
        <div class="profile-learning-snapshot" style="display:flex;gap:12px;margin:14px 0">
          {stat_card('Total Attempted', '1,248', 'All-time', 'primary', 'book')}
          {stat_card('Accuracy', '72%', 'Last 30 days', 'success', 'target')}
          {stat_card('Streak', '12 days', 'Current', 'danger', 'fire')}
        </div>
        <form action="#" data-form="profile" class="profile-sections"><!-- TODO: connect to backend -->
          <section class="card"><div class="section-head"><div><p class="eyebrow">PERSONAL INFORMATION</p><h2>About your preparation</h2></div></div>
            <div class="form-grid">
              <div class="field"><label for="profile-name">Full name *</label><input id="profile-name" name="name" type="text" required autocomplete="name" value="Ayesha Khan"></div>
              <div class="field"><label for="profile-email">Email *</label><input id="profile-email" name="email" type="email" required autocomplete="email" value="ayesha.khan@example.com"></div>
              <div class="field"><label for="profile-country">Country *</label><select id="profile-country" name="country" required><option value="Pakistan" selected>Pakistan</option><option value="India">India</option><option value="Other">Other</option></select></div>
              <div class="field"><label for="profile-exam-goal">Preferred Exam / Preparation Goal *</label><select id="profile-exam-goal" name="exam_goal" required><option value="PPSC" selected>PPSC</option><option value="FPSC">FPSC</option><option value="NTS">NTS</option><option value="CSS">CSS</option><option value="PMS">PMS</option><option value="Other">Other</option></select></div>
            </div>
            <div class="field full"><span>Preparation Interests</span><div class="profile-interest-grid">
              <label class="interest-choice"><input type="checkbox" name="interests" value="Pakistan Affairs" checked><span>Pakistan Affairs</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="Current Affairs" checked><span>Current Affairs</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="General Knowledge"><span>General Knowledge</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="Computer Science"><span>Computer Science</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="English"><span>English</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="Mathematics"><span>Mathematics</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="Everyday Science" checked><span>Everyday Science</span></label>
              <label class="interest-choice"><input type="checkbox" name="interests" value="Islamic Studies"><span>Islamic Studies</span></label>
            </div></div>
          </section>
          <section class="card"><div class="section-head"><div><p class="eyebrow">PREFERENCES</p><h2>Learning preferences</h2></div></div>
            <div class="form-grid profile-preferences-grid"><div class="field"><label for="profile-daily-goal">Daily MCQ Goal *</label><select id="profile-daily-goal" name="daily_goal" required><option value="10">10 MCQs</option><option value="25" selected>25 MCQs</option><option value="50">50 MCQs</option><option value="100">100 MCQs</option></select></div></div>
          </section>
          <p class="auth-error" role="alert"></p>
          <div class="profile-save-row"><button class="btn primary" type="submit">Save profile</button></div>
        </form>
        <section class="card profile-security-card"><div class="section-head"><div><p class="eyebrow">ACCOUNT &amp; SECURITY</p><h2>Password &amp; security</h2></div></div>
          <p class="small muted">For your security, password changes require your current password and a 6-digit email verification code.</p>
          <a class="btn primary" href="reset-password.html">Change password</a></section>
        <section class="card danger-zone"><div><p class="eyebrow">DANGER ZONE</p><h2>Delete account</h2><p class="small muted">Account deletion requests should be handled through support so server data is not removed accidentally.</p><a class="btn danger" href="contact.html">Contact support</a></div></section>
      </div>
      </main>
    </div>
</div>'''
write('learner-settings.html', page('Learner Settings — Profile &amp; Preferences | MCQCampus',
                                    'Manage your MCQCampus learner profile, preparation goals, interests, daily MCQ target and security settings.',
                                    body, 'dashboard', 'learner-settings'))

# ---- 30. learner-subpage.html (history / bookmarks / performance) ----
def activity_rows(items):
    return ''.join(
        f'<div class="learner-activity-row"><span class="status-dot {"ok" if s is True else ("bad" if s is False else "")}"></span>'
        f'<div><strong>{q}</strong><span>{meta}</span></div></div>' for q, meta, s in items)

progress_rows = ''.join(
    f'<div class="bar-row"><div class="row"><span>{label}</span><span>{summary}</span></div>'
    f'<div class="progress-track"><span style="width:{pct}%"></span></div></div>'
    for label, summary, pct in PROGRESS_ROWS)
bookmark_cards = ''.join(question_card(i + 1, q[0], q[1], q[2], q[3], q[4], q[5], bookmarked=True)
                         for i, q in enumerate(SAMPLE_MCQS[:3]))

def subview(anchor, eyebrow, title, desc, content):
    return f'''<section class="learner-subpage" id="{anchor}">
      <header class="learner-subpage-heading"><p class="eyebrow">{eyebrow}</p><h2>{title}</h2><p class="small muted">{desc}</p></header>
      <div class="learner-quick-actions">{QUICK_ACTIONS}</div>
      <div class="learner-subpage-content">{content}</div>
    </section>'''

body = f'''<div class="container page learner-dashboard-shell">
    <div class="learner-mobile-head"><button class="btn ghost" type="button">{ICONS['menu']} Learning menu</button></div>
    <div class="learner-shell">
      <aside class="learner-side card" id="learner-sidebar">
        <div class="learner-side-head"><strong>My Learning</strong><span class="small muted">Personal preparation center</span></div>
        {LEARNER_NAV}
      </aside>
      <main class="learner-content">
        {subview('history', 'MY LEARNING', 'Practice History', 'Every question you attempted, newest first.',
                 '<section class="card">' + activity_rows(ACTIVITIES) + '</section>')}
        {subview('bookmarks', 'MY LEARNING', 'Bookmarked MCQs', 'Questions you saved for revision.', bookmark_cards)}
        {subview('performance', 'MY LEARNING', 'Performance Analytics', 'Category accuracy and overall progress.',
                 f'<div class="learner-metrics">{stat_card("Accuracy", "72%", "Last 30 days", "success", "target")}{stat_card("Weekly Goal", "18/25", "MCQs this week", "primary", "book")}{stat_card("Best Category", "English", "90% accuracy", "warning", "star")}</div>'
                 f'<section class="card" style="margin-top:14px"><div class="section-head"><div><p class="eyebrow">CATEGORY PROGRESS</p><h2>Where you stand</h2></div></div>{progress_rows}</section>'
                 '<section class="card" style="margin-top:14px"><div class="section-head"><div><p class="eyebrow">WEAK AREAS</p><h2>Needs more practice</h2></div></div><div class="weak-row"><span>Everyday Science</span><strong>55%</strong></div><div class="weak-row"><span>Current Affairs</span><strong>65%</strong></div><div class="weak-row"><span>Mathematics</span><strong>68%</strong></div></section>')}
      </main>
    </div>
</div>'''
write('learner-subpage.html', page('My Learning — History, Bookmarks &amp; Performance | MCQCampus',
                                   'Review your MCQCampus practice history, bookmarked questions and category performance analytics.',
                                   body, 'dashboard', 'learner-subpage'))

# ---- 31. test-attempt.html ----
test_q_html = ''
letters = ['A', 'B', 'C', 'D']
for i, (q, opts, correct, expl, tag, qid) in enumerate(TEST_QUESTIONS):
    radios = ''.join(
        f'<label class="check-line test-option"><input type="radio" name="question_{qid}" value="{l}"><span class="letter">{l}</span>{o}</label>'
        for l, o in zip(letters, opts))
    test_q_html += (f'<article class="card test-question"><p class="eyebrow">MCQ {i + 1}</p><h3>{q}</h3>'
                    f'<div class="test-options">{radios}</div></article>')

body = f'''<div class="container page">
      {crumbs([('Online Tests', 'tests.html'), ('Smart 10-MCQ Test', '')])}
      <header class="page-heading"><h1>Smart 10-MCQ Test</h1><p>Select one answer per question. Your score and correct answers are shown after submission.</p></header>
      <form action="#" data-form="test-submit" data-test-key="auto-2026-10-25" data-started-at="2026-10-25T10:00:00Z" class="test-form"><!-- TODO: connect to backend -->
        {test_q_html}
        <button class="btn primary" type="submit">Submit Test</button>
      </form>
      <p class="small muted" style="margin-top:14px">Sample view: 5 of 10 questions shown. <a href="tests.html">Back to all tests</a>.</p>
    </div>'''
write('test-attempt.html', page('Smart 10-MCQ Test — Take Online Test | MCQCampus',
                                'Attempt the automatic 10-MCQ smart test covering Pakistan Affairs, GK, English, science and current affairs.',
                                body, 'tests', 'test-attempt'))

# ============================================================ BATCH C ======

# ---- 32. mcq-detail.html (/mcqs/:id sample) ----
q, opts, correct, expl, tag, qid = SAMPLE_MCQS[0]
detail = question_card(1, q, opts, correct, expl, tag, qid, bookmarked=True)
related = ''.join(question_card(i + 2, s[0], s[1], s[2], s[3], s[4], s[5]) for i, s in enumerate(SAMPLE_MCQS[1:4]))
body = f'''<div class="container page public-page">
      {crumbs([('MCQs', 'mcqs.html'), ('Important MCQs', 'mcqs.html'), ('Who is the founder of Pakistan?', '')])}
      <header class="page-heading"><h1>MCQ #101 — Pakistan Affairs</h1><p>Practice question with answer and explanation.</p></header>
      <div class="public-layout">
        <main class="public-main">
          {detail}
          <div class="actions"><a class="btn primary" href="mcq-detail.html">Next Question &rsaquo;</a><a class="btn ghost" href="mcqs.html">Browse All MCQs</a></div>
          <section class="card related-box" style="margin-top:18px"><div class="section-head"><div><p class="eyebrow">KEEP PRACTISING</p><h2>Related MCQs</h2></div></div>
            <div>{related}</div></section>
        </main>
        <aside class="public-sidebar" aria-label="Contextual sidebar">
          <div class="public-sidebar-head"><strong>Explore Categories</strong></div>
          <div class="public-sidebar-inner">
            {''.join(f'<a class="user-menu-item" href="category-detail.html">{ICONS["grid"]} {n}</a>' for _, n, _ in CATEGORIES)}
            <a class="user-menu-item" href="categories.html">View all categories</a>
          </div>
        </aside>
      </div>
    </div>'''
write('mcq-detail.html', page('Who is the founder of Pakistan? — Solved MCQ with Explanation | MCQCampus',
                              'Solved MCQ: Who is the founder of Pakistan? Correct answer B with explanation, plus related Pakistan Affairs practice questions.',
                              body, 'mcqs', 'mcq-detail'))

# ---- 33. category-detail.html (/categories/:slug sample) ----
cat_mcqs = ''.join(question_card(i + 1, s[0], s[1], s[2], s[3], '<span class="chip">Pakistan Affairs</span>', 201 + i)
                   for i, s in enumerate(SAMPLE_MCQS[:5]))
subcats = ''.join(f'<a class="chip" href="category-detail.html">{n}</a>' for n in [
    'History of Pakistan', 'Geography of Pakistan', 'Constitutional Amendments', 'National Institutions', 'Firsts in Pakistan'])
body = f'''<div class="container page public-page">
      {crumbs([('Categories', 'categories.html'), ('Pakistan Affairs', '')])}
      <header class="page-heading"><h1>Pakistan Affairs MCQs</h1><p>Solved Pakistan Affairs MCQs with answers and explanations for PPSC, FPSC, NTS and CSS.</p></header>
      <section class="card seo-related-block"><div class="section-head"><div><p class="eyebrow">SUBCATEGORIES</p><h2>Focus on a topic</h2></div></div>
        <div class="chips">{subcats}</div></section>
      <p class="small muted result-count" style="margin:16px 0 10px">248 MCQs in Pakistan Affairs &middot; 10 per page</p>
      <div>{cat_mcqs}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="category-detail.html">1</a><a class="btn sm" href="category-detail.html">2</a><a class="btn sm" href="category-detail.html">3</a></div><a class="btn sm" href="category-detail.html">Next &#8250;</a><span class="small muted pagination-count">248 total &middot; Page 1 of 25</span></nav>
    </div>'''
write('category-detail.html', page('Pakistan Affairs MCQs (248 Solved) — Category | MCQCampus',
                                   'Practice 248 solved Pakistan Affairs MCQs covering history, geography, constitutional amendments and national institutions.',
                                   body, 'categories', 'category-detail'))

# ---- 34. past-paper-detail.html (/past-papers/:org/:year sample) ----
paper_mcqs = ''.join(question_card(i + 1, s[0], s[1], s[2], s[3], '<span class="chip">PPSC 2024</span>', 301 + i)
                     for i, s in enumerate(SAMPLE_MCQS[:5]))
years = ''.join(f'<a class="chip" href="past-paper-detail.html">{y}</a>' for y in ['2024', '2023', '2022', '2021', '2020'])
body = f'''<div class="container page public-page">
      {crumbs([('Past Papers', 'past-papers.html'), ('PPSC', 'past-papers.html'), ('Assistant Director Revenue 2024', '')])}
      <header class="page-heading"><h1>PPSC Assistant Director Revenue — 2024 Solved Paper</h1><p>100 MCQs &middot; Solved with answers and explanations &middot; Punjab Public Service Commission.</p></header>
      <div class="chips" style="margin-bottom:16px">{years}</div>
      <p class="small muted mcq-count">Showing 5 of 100 paper MCQs &middot; only 10 load per page</p>
      <div>{paper_mcqs}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="past-paper-detail.html">1</a><a class="btn sm" href="past-paper-detail.html">2</a><a class="btn sm" href="past-paper-detail.html">3</a></div><a class="btn sm" href="past-paper-detail.html">Next &#8250;</a><span class="small muted pagination-count">100 total &middot; Page 1 of 10</span></nav>
      <section class="card seo-related-block" style="margin-top:18px"><div class="section-head"><div><p class="eyebrow">EXAM PREPARATION</p><h2>Continue with PPSC resources</h2></div></div>
        <p>Choose an exam year to practise linked MCQs, review answers and explanations, and continue with related preparation resources.</p>
        <div class="chips"><a class="chip" href="mcq-detail.html">Important MCQs</a><a class="chip" href="categories.html">Browse MCQ Categories</a><a class="chip" href="pdfs.html">Preparation PDFs</a></div></section>
    </div>'''
write('past-paper-detail.html', page('PPSC Assistant Director Revenue 2024 — Solved Past Paper | MCQCampus',
                                     'Solved PPSC 2024 Assistant Director Revenue past paper: 100 MCQs with answers, explanations and year-wise archive.',
                                     body, 'papers', 'past-paper-detail'))

print('Batch B + C complete.')
