#!/usr/bin/env python3
"""Build fully static, hardcoded HTML pages from the MCQCampus SPA shell.

Reads nothing at runtime — all content is baked into the generated files.
Output: /workspace/static/*.html (open any file directly in a browser).
"""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- icons ----
def svg(path):
    return (f'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>')

ICONS = {
    'search':   svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>'),
    'user':     svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
    'book':     svg('<path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2z"/><line x1="8" y1="7" x2="18" y2="7"/><line x1="8" y1="11" x2="18" y2="11"/>'),
    'paper':    svg('<path d="M6 2h9l4 4v16H6z"/><polyline points="14 2 14 7 19 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>'),
    'briefcase':svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
    'home':     svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
    'settings': svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
    'download': svg('<path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 21h16"/>'),
    'logout':   svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    'edit':     svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    'shield':   svg('<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>'),
    'mail':     svg('<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>'),
    'calendar': svg('<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>'),
    'arrow':    svg('<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>'),
    'chevron':  svg('<polyline points="9 6 15 12 9 18"/>'),
    'bookmark': svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    'share':    svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>'),
    'copy':     svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    'flag':     svg('<path d="M4 22V4"/><path d="M4 4h13l-2.5 4L17 12H4"/>'),
    'grid':     svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    'menu':     svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    'close':    svg('<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>'),
    'eye':      svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    'clock':    svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'),
    'target':   svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
    'star':     svg('<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>'),
    'fire':     svg('<path d="M12 22c4 0 7-2.5 7-7 0-4-3-6-4-9-1 2-2 3-4 3 1-3 0-6-2-7 0 3-4 5-4 13 0 4.5 3 7 7 7z"/>'),
    'facebook': svg('<path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v7h4v-7h3l1-4h-4V9a1 1 0 0 1 1-1z"/>'),
    'youtube':  svg('<rect x="2.5" y="6" width="19" height="12" rx="3"/><polygon points="10.5 9.5 15 12 10.5 14.5"/>'),
    'instagram':svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1"/>'),
    'linkedin': svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7.5" y1="10.5" x2="7.5" y2="16.5"/><circle cx="7.5" cy="7.6" r="0.6"/><path d="M11.5 16.5v-6M11.5 12.5c0-2 1-2.5 2-2.5s2 .8 2 2.5v4"/>'),
}

def icon(name):
    return ICONS[name]

# --------------------------------------------------------------- header ----
NAV_ITEMS = [
    ('index.html', 'home', 'Home'),
    ('mcqs.html', 'mcqs', 'MCQs'),
    ('past-papers.html', 'papers', 'Past Papers'),
    ('tests.html', 'tests', 'Tests'),
    ('latest-jobs.html', 'latest-jobs', 'Jobs &amp; Exams'),
    ('pdfs.html', 'pdfs', 'PDFs'),
]
NAV_MORE = [
    ('categories.html', 'categories', 'Categories'),
    ('blog.html', 'posts', 'Blog &amp; Updates'),
    ('about.html', 'about', 'About MCQCampus'),
    ('contact.html', 'contact', 'Contact'),
]

def header(active='home'):
    main = ''.join(
        f'<a href="{href}" data-nav-section="{key}"{" class=\"active\"" if key == active else ""}>{label}</a>'
        for href, key, label in NAV_ITEMS)
    more = ''.join(f'<a href="{href}" data-nav-section="{key}">{label}</a>' for href, key, label in NAV_MORE)
    searchbox = ('<div class="searchbox public-searchbox">'
                 '<span class="public-search-icon" aria-hidden="true">' + ICONS['search'] + '</span>'
                 '<input aria-label="Search MCQs, papers, categories, jobs..." name="q" placeholder="Search MCQs, papers, categories, jobs..." autocomplete="off">'
                 '<button class="btn primary public-search-submit" type="submit">Search</button></div>')
    user_menu = ('<details class="user-menu"><summary class="header-user-avatar" aria-label="Open account menu"><span>AK</span></summary>'
                 '<div class="user-menu-panel"><div class="user-menu-head"><strong>Ayesha Khan</strong><span>ayesha.khan@example.com</span></div>'
                 f'{""}'
                 '<a class="user-menu-item" href="dashboard.html">' + ICONS['book'] + ' Learner dashboard</a>'
                 '<a class="user-menu-item" href="admin.html">' + ICONS['edit'] + ' Admin workspace</a>'
                 '<a class="user-menu-item" href="super-admin.html">' + ICONS['shield'] + ' Super admin</a>'
                 '<a class="user-menu-item" href="learner-settings.html">' + ICONS['settings'] + ' Settings</a>'
                 '<a class="user-menu-item" href="login.html">' + ICONS['logout'] + ' Log out</a>'
                 '</div></details>')
    return f'''<header class="header reference-header"><div class="container header-inner">
<a class="brand" href="index.html" aria-label="MCQCampus home"><span class="logo-crop"><img src="assets/genfavicon-48.png" srcset="assets/genfavicon-48.png 1x, assets/genfavicon-64.png 2x" width="42" height="42" alt=""></span><span>MCQCampus</span></a>
<nav class="nav" id="main-nav" aria-label="Main navigation">{main}<details class="nav-more"><summary>More <span aria-hidden="true">&#9255;</span></summary><div class="nav-more-menu">{more}</div></details><a class="mobile-menu-auth" href="dashboard.html">{ICONS['user']}<span>My learning</span></a></nav>
<form class="header-search" action="#" role="search"><!-- TODO: connect to backend -->{searchbox}</form>
<div class="header-actions">{user_menu}<button class="btn ghost menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav">{ICONS['menu']}</button></div>
</div></header>'''

# --------------------------------------------------------------- footer ----
FOOTER_HELP = [
    ('about.html', 'About Us'), ('contact.html', 'Contact Us'),
    ('legal.html#privacy', 'Privacy Policy'), ('legal.html#terms', 'Terms &amp; Conditions'),
    ('legal.html#disclaimer', 'Disclaimer'), ('legal.html#cookies', 'Cookie Policy'),
    ('legal.html#advertising', 'Advertising Policy'), ('faq.html', 'FAQ'),
]

def footer():
    quick = ''.join(f'<a href="{h}">{l}</a>' for h, l in [
        ('mcqs.html', 'MCQs'), ('past-papers.html', 'Past Papers'),
        ('pdfs.html', 'PDFs'), ('latest-jobs.html', 'Latest Jobs')])
    help_links = ''.join(f'<a href="{h}">{l}</a>' for h, l in FOOTER_HELP)
    socials = ''.join(
        f'<a href="#" aria-label="{lbl}" title="{lbl}">{ICONS[key]}</a>'
        for key, lbl in [('facebook', 'Facebook'), ('youtube', 'YouTube'),
                         ('instagram', 'Instagram'), ('linkedin', 'LinkedIn')])
    mobile = ''.join(
        f'<a href="{h}"{" class=\"active\"" if k == 'home' else ""}>{ICONS[i]}{l}</a>'
        for h, i, l, k in [('index.html', 'home', 'Home', 'home'), ('mcqs.html', 'book', 'MCQs', 'mcqs'),
                           ('past-papers.html', 'paper', 'Papers', 'papers'),
                           ('latest-jobs.html', 'briefcase', 'Updates', 'latest-jobs'),
                           ('dashboard.html', 'user', 'Profile', 'dashboard')])
    return f'''<footer class="footer" aria-label="Site footer"><div class="container"><div class="footer-grid footer-grid-compact">
<div class="footer-brand-block"><a class="brand" href="index.html" aria-label="MCQCampus home"><span class="logo-crop"><img src="assets/genfavicon-48.png" width="42" height="42" alt=""></span><span>MCQCampus</span></a>
<p>Practice MCQs, solve past papers, discover exam opportunities, and prepare confidently for competitive examinations.</p>
<a class="footer-email" href="mailto:hello@mcqcampus.com">{ICONS['mail']}<span>hello@mcqcampus.com</span></a>
<div class="footer-social" aria-label="MCQ Campus social media">{socials}</div>
<p class="footer-country">Serving learners in Pakistan &#128252; and India &#128252;</p></div>
<div class="footer-column"><strong>Quick Links</strong>{quick}</div>
<div class="footer-column"><strong>Help &amp; Legal</strong>{help_links}</div>
</div><div class="footer-bottom"><span>&copy; 2026 MCQCampus. All rights reserved.</span><span class="footer-bottom-links"><a href="sitemap.html">Sitemap</a></span></div></div></footer>
<nav class="bottom-nav" aria-label="Mobile navigation">{mobile}</nav>'''

# ------------------------------------------------------------- page head ---
def page(title, description, body, active='home', entry='home', jsonld=None, extra_head=''):
    ld = f'<script id="server-jsonld" type="application/ld+json">{jsonld}</script>\n  ' if jsonld else ''
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#102823">
  <meta name="author" content="MCQCampus">
  <meta name="application-name" content="MCQCampus">
  <meta name="mcq-page-entry" content="{entry}">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="16x16" href="assets/genfavicon-16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/genfavicon-32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="assets/genfavicon-48.png">
  <link rel="manifest" href="site.webmanifest">
  <meta name="description" content="{description}">
  <title>{title}</title>
  <meta property="og:site_name" content="MCQCampus">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_PK">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index,follow">
  {ld}<link rel="stylesheet" href="style.css">
{extra_head}</head>
<body data-page-template="{entry}">
  <a class="skip" href="#main">Skip to content</a>
  {header(active)}
  <main id="main" tabindex="-1">
{body}
  </main>
  {footer()}
</body>
</html>
'''

def write(fname, html):
    with open(os.path.join(OUT, fname), 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('wrote', fname)

# ------------------------------------------------------------ shared bits --
def crumbs(items):
    inner = '<a href="index.html">Home</a>'
    for i, (label, href) in enumerate(items):
        inner += '<span aria-hidden="true">/</span>'
        inner += f'<a href="{href}">{label}</a>' if href else f'<span aria-current="page">{label}</span>'
    return f'<nav class="breadcrumbs" aria-label="Breadcrumb">{inner}</nav>'

def stat_card(label, value, subtitle, tone, ic):
    return (f'<div class="stat-card"><div class="stat-card-head"><span class="stat-card-label">{label}</span>'
            f'<span class="stat-card-icon tone-{tone}">{ICONS[ic]}</span></div>'
            f'<strong class="stat-card-value">{value}</strong><span class="small muted">{subtitle}</span></div>')

def home_stat(icon_name, value, label):
    return f'<div class="stat"><span class="stat-icon">{ICONS[icon_name]}</span><div><strong>{value}</strong><br><span>{label}</span></div></div>'

CATEGORIES = [
    ('pakistan-affairs', 'Pakistan Affairs', '248'),
    ('current-affairs', 'Current Affairs', '312'),
    ('general-knowledge', 'General Knowledge', '420'),
    ('english', 'English', '186'),
    ('mathematics', 'Mathematics', '154'),
    ('islamic-studies', 'Islamic Studies', '132'),
]

def question_card(num, text, options, correct, explanation, tags, qid, bookmarked=False):
    letters = ['A', 'B', 'C', 'D']
    opts_html = ''
    for i, opt in enumerate(options):
        state = 'correct' if i == correct else 'wrong'
        opts_html += (f'<button type="button" class="btn option {state}" data-option="{letters[i]}" '
                      f'aria-pressed="{"true" if i == correct else "false"}" disabled>'
                      f'<span class="letter">{letters[i]}</span><span class="option-text">{opt}</span>'
                      f'<span class="option-indicator" aria-hidden="true"></span></button>')
    bm_cls = 'primary' if bookmarked else 'ghost'
    return f'''<article class="card mcq-card mcq-reference-card" data-question="{qid}">
<div class="mcq-top"><div class="mcq-question-label"><span class="badge">MCQ {num}</span>{tags}</div>
<div class="mcq-top-actions"><button class="btn sm {bm_cls}" type="button">{ICONS['bookmark']} Bookmark</button><a class="btn sm ghost" href="mcq-detail.html">Next &rsaquo;</a></div></div>
<div class="mcq-question-panel"><h2><a href="mcq-detail.html">{text}</a></h2></div>
<div class="options mcq-reference-options" role="group" aria-label="Answer options">{opts_html}</div>
<div class="explanation"><strong>Correct answer: {letters[correct]}.</strong> {explanation}</div>
<div class="actions mcq-reference-actions"><span class="spacer"></span>
<button class="btn sm ghost" type="button">{ICONS['share']} Share</button>
<button class="btn sm ghost" type="button">{ICONS['copy']} Copy</button>
<button class="btn sm ghost" type="button">{ICONS['flag']} Report</button></div></article>'''

SAMPLE_MCQS = [
    ("Who is the founder of Pakistan?", ["Allama Muhammad Iqbal", "Quaid-e-Azam Muhammad Ali Jinnah", "Liaquat Ali Khan", "Khawaja Nazimuddin"], 1,
     "Muhammad Ali Jinnah, honoured as Quaid-e-Azam, led the Pakistan Movement and became the first Governor-General of Pakistan on 14 August 1947.",
     '<span class="chip">Pakistan Affairs</span>', 101),
    ("What is the capital city of Australia?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2,
     "Canberra was purpose-built as the capital in 1913 as a compromise between Sydney and Melbourne.",
     '<span class="chip">General Knowledge</span>', 102),
    ("Which gas is most abundant in the Earth's atmosphere?", ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], 2,
     "Nitrogen makes up about 78% of the atmosphere, while oxygen accounts for roughly 21%.",
     '<span class="chip">Everyday Science</span>', 103),
    ("Choose the correct synonym of 'diligent'.", ["Careless", "Hardworking", "Lazy", "Timid"], 1,
     "'Diligent' means showing steady, careful and persistent effort — a synonym of hardworking.",
     '<span class="chip">English</span>', 104),
    ("The Zero Option in IMF terminology refers to:", ["No loan for Pakistan", "Exchange rate determined by market forces", "Zero interest loans", "Canceling all debt"], 1,
     "Under the zero option (floating exchange rate), the central bank does not intervene and the market decides the rupee's value.",
     '<span class="chip">Current Affairs</span>', 105),
    ("How many surahs are there in the Holy Quran?", ["100", "110", "114", "120"], 2,
     "The Holy Quran contains 114 surahs; the longest is Al-Baqarah and the shortest is Al-Kawthar.",
     '<span class="chip">Islamic Studies</span>', 106),
]

JOBS = [
    ('PPSC', 'PPSC Lecturer Recruitment 2026 — BS-17', 'Punjab Public Service Commission (PPSC)',
     'Applications are invited for Lecturer posts in Biology, Chemistry, English and Pakistan Affairs on BS-17. Pay scale Rs. 46,000–97,000. Eligible candidates with a relevant Master&#39;s degree may apply online through the PPSC portal.',
     '15 November 2026', 'ppsc-recruitment-2026'),
    ('FPSC', 'FPSC Combined Competitive Examination 2026', 'Federal Public Service Commission (FPSC)',
     'FPSC has announced the Combined Competitive Examination 2026 for Grade-19 officer slots (CSS). Applicants must hold a Bachelor&#39;s degree with at least a second division and be between 21 and 30 years old.',
     '1 December 2026', 'css-2026'),
    ('NTS', 'NTS Test Schedule for ADPO Posts — Sindh', 'National Testing Service (NTS)',
     'NTS will conduct the written aptitude test for Assistant District Public Officer (ADPO) recruitment in Sindh. Admit cards will be available one week before the test date from the NTS website.',
     '20 November 2026', 'nts-adpo-sindh'),
]

PDFS = [
    ('PPSC CS Preliminary Solved Paper 2024 (PDF)', 'Complete solved MCQ paper of the PPSC Computer Scientist (BS-16) preliminary test 2024 with answer keys and explanations.', 'ppsc-cs-preliminary-2024.pdf', '4.2 MB · 120 MCQs'),
    ('One-Day-Repeater Pak Studies MCQ Book', 'High-yield Pakistan Studies revision sheet covering history, geography and constitutional amendments — ideal for last-minute prep.', 'pak-studies-repeater.pdf', '1.8 MB · 300 MCQs'),
    ('Current Affairs Monthly Digest — October 2026', 'Curated national and international current affairs MCQs for PPSC, FPSC, NTS and CSS aspirants.', 'current-affairs-october-2026.pdf', '2.5 MB · 95 MCQs'),
]

POSTS = [
    ('PPSC Past Papers Pattern Change 2026 — What You Must Know', 'PPSC has revised its preliminary pattern: negative marking removed and subject-weightage increased. Here is how to adjust your preparation strategy.', 'Exam News', '18 October 2026', 'ppsc-pattern-change-2026'),
    ('How to Revise Current Affairs in 30 Minutes a Day', 'A practical daily routine using spaced repetition and one-page repeaters to keep month-by-month current affairs in long-term memory.', 'Study Tips', '9 October 2026', 'revise-current-affairs'),
    ('CSS 2026: Complete Guide to the Pre-Examination Test', 'Everything about the FPSC CSS PET — syllabus split, qualifying marks, essay strategy and recommended books for each compulsory subject.', 'Guides', '28 September 2026', 'css-2026-pet-guide'),
]

PAPERS = [
    ('PPSC', 'punjab-public-service-commission', 'PPSC Assistant Director Revenue 2024', '2024', '100 MCQs · Solved'),
    ('FPSC', 'fpsc', 'FPSC Enforcement Officer 2023', '2023', '80 MCQs · Solved'),
    ('NTS', 'nts', 'NTS Engineering Trainee 2024', '2024', '100 MCQs · Solved'),
    ('CSS', 'css', 'CSS Preliminary European History 2023', '2023', '100 MCQs · Solved'),
]

TEST_QUESTIONS = SAMPLE_MCQS[:5]

PROGRESS_ROWS = [
    ('Pakistan Affairs', '18 attempted · 78% accuracy', 78),
    ('Current Affairs', '24 attempted · 65% accuracy', 65),
    ('English', '12 attempted · 90% accuracy', 90),
    ('Everyday Science', '9 attempted · 55% accuracy', 55),
]

ACTIVITIES = [
    ('Who is the founder of Pakistan?', 'Correct · Pakistan Affairs · Today, 10:42 AM', True),
    ('The Zero Option in IMF terminology refers to:', 'Incorrect · Current Affairs · Today, 10:40 AM', False),
    ('Which gas is most abundant in the Earth&#39;s atmosphere?', 'Correct · Everyday Science · Yesterday, 6:15 PM', True),
    ('Choose the correct synonym of &#39;diligent&#39;.', 'Correct · English · Yesterday, 6:11 PM', True),
    ('How many surahs are there in the Holy Quran?', 'Skipped · Islamic Studies · 23 October 2026', None),
]

QUICK_ACTIONS = ''.join(
    f'<a class="btn sm" href="{h}">{ICONS[i]}{l}</a>' for h, i, l in [
        ('mcqs.html', 'book', 'Practice MCQs'), ('tests.html', 'target', 'Start a test'),
        ('past-papers.html', 'paper', 'Past papers'), ('mcqs.html', 'bookmark', 'Bookmarks')])

LEARNER_NAV = '''<nav aria-label="My Learning" data-learner-navigation>
<a href="dashboard.html">Overview</a>
<a href="learner-subpage.html#history">History</a>
<a href="learner-subpage.html#bookmarks">Bookmarks</a>
<a href="learner-subpage.html#performance">Performance</a>
<a href="learner-settings.html">Settings</a>
</nav>'''

# =================================================================== A =====

# ---- 1. index.html ----
home_mcqs = ''.join(question_card(i + 1, q[0], q[1], q[2], q[3], q[4], q[5]) for i, q in enumerate(SAMPLE_MCQS[:4]))
cat_boxes = ''.join(
    f'<div class="home-cat-group"><div class="home-cat-title"><a href="category-detail.html"><span class="home-cat-icon">{ICONS["grid"]}</span><span>{name}</span><span class="home-cat-arrow" aria-hidden="true">{ICONS["chevron"]}</span></a></div>'
    f'<div class="home-sub-list"><span class="home-sub-link">{count} MCQs</span></div></div>'
    for slug, name, count in CATEGORIES)
body = f'''<div class="container page">
      <section class="hero home-hero-compact">
        <div class="home-hero-copy">
          <p class="eyebrow">COMPETITIVE EXAM PREPARATION</p>
          <h1>Prepare with practice, not guesswork.</h1>
          <p class="hero-copy">Practise thousands of solved MCQs, browse year-wise past papers, take automatic online tests and download preparation PDFs — built for PPSC, FPSC, NTS, CSS and school-board exams.</p>
          <div class="home-hero-actions"><a class="btn primary" href="mcqs.html">Practice MCQs</a><a class="btn" href="mcq-detail.html">Important MCQs</a><a class="btn" href="past-papers.html">Browse Past Papers</a><a class="btn" href="tests.html">Online Tests</a></div>
        </div>
        <div class="home-stats home-top-stats">
          {home_stat('book', '12,480', 'Practice MCQs')}
          {home_stat('paper', '340', 'Past Papers')}
          {home_stat('grid', '96', 'Categories')}
          {home_stat('briefcase', '512', 'Job Notices')}
        </div>
      </section>
      <section class="section home-content-grid home-content-priority">
        <div>
          <div class="section-head"><div><p class="eyebrow">PRACTICE</p><h2>Important MCQs</h2><p class="small muted">2,340 total important MCQs &middot; only 10 load per page</p></div><a class="link" href="mcq-detail.html">Browse all MCQs</a></div>
          <div class="home-mcq-list">{home_mcqs}</div>
          <nav class="pagination" aria-label="Pagination"><span></span><div class="page-numbers"><a class="btn sm primary" href="index.html">1</a><a class="btn sm" href="mcqs.html">2</a><a class="btn sm" href="mcqs.html">3</a></div><a class="btn sm" href="mcqs.html">Next &#8250;</a><span class="small muted pagination-count">2,340 total &middot; Page 1 of 234</span></nav>
        </div>
        <aside class="home-category-nav card">
          <div class="section-head"><div><p class="eyebrow">EXPLORE</p><h2>Categories</h2></div><a class="link" href="categories.html">View all</a></div>
          <div class="home-cat-boxes">{cat_boxes}</div>
          <a class="btn" href="categories.html">All Categories</a>
        </aside>
      </section>
    </div>'''
write('index.html', page(
    'MCQCampus — Practice MCQs, Past Papers &amp; Exam Preparation',
    'MCQCampus offers practice MCQs, past papers, answers and explanations for learners in Pakistan and India',
    body, 'home', 'home',
    '{"@context":"https://schema.org","@type":"WebSite","name":"MCQCampus","url":"https://www.mcqcampus.com/"}'))

# ---- 2. mcqs.html ----
mcq_cards = ''.join(question_card(i + 1, q[0], q[1], q[2], q[3], q[4], q[5]) for i, q in enumerate(SAMPLE_MCQS))
body = f'''<div class="container page">
      {crumbs([('MCQs', '')])}
      <header class="page-heading"><h1>MCQs</h1><p>Practice questions with answers and explanations.</p></header>
      <form action="#" data-form="search"><!-- TODO: connect to backend --><label for="mcq-page-search">Search questions <input id="mcq-page-search" name="q" type="search" placeholder="e.g. founder of Pakistan"></label><button class="btn" type="submit">Search</button></form>
      <div class="chips" style="margin:14px 0"><a class="chip" href="mcq-detail.html">Important MCQs</a><a class="chip" href="category-detail.html">Pakistan Affairs</a><a class="chip" href="category-detail.html">Current Affairs</a><a class="chip" href="category-detail.html">General Knowledge</a><a class="chip" href="category-detail.html">English</a><a class="chip" href="category-detail.html">Mathematics</a><a class="chip" href="category-detail.html">Islamic Studies</a></div>
      <p class="small muted mcq-count">2,340 total MCQs &middot; only 10 load per page</p>
      <div data-mcq-list>{mcq_cards}</div>
      <nav class="pagination" aria-label="Pagination"><span></span><div class="page-numbers"><a class="btn sm primary" href="mcqs.html">1</a><a class="btn sm" href="mcqs.html">2</a><a class="btn sm" href="mcqs.html">3</a><a class="btn sm" href="mcqs.html">&#8230;</a></div><a class="btn sm" href="mcqs.html">Next &#8250;</a><span class="small muted pagination-count">2,340 total &middot; Page 1 of 234</span></nav>
    </div>'''
write('mcqs.html', page('MCQs — Practice With Answers &amp; Explanations | MCQCampus',
                        'Browse and practise solved MCQs for PPSC, FPSC, NTS and CSS exams with correct answers and detailed explanations.',
                        body, 'mcqs', 'mcqs'))

# ---- 3. categories.html ----
cat_cards = ''.join(f'''<a class="card clickable entity-showcase-card" href="category-detail.html">
<div class="entity-card-media"><span class="entity-card-image">{ICONS['grid']}</span></div>
<div class="entity-card-body"><span class="entity-card-badge">Category</span><h3>{name}</h3><p>Solved MCQs with answers and explanations.</p>
<div class="entity-card-meta"><span>{ICONS['book']} {count} MCQs</span></div></div>
<span class="entity-card-arrow" aria-hidden="true">{ICONS['chevron']}</span></a>''' for slug, name, count in CATEGORIES)
body = f'''<div class="container page">
      {crumbs([('MCQ Categories', '')])}
      <header class="page-heading"><h1>MCQ Categories</h1><p>Browse questions by subject.</p></header>
      <section class="card seo-related-block"><div class="section-head"><div><p class="eyebrow">POPULAR SUBJECTS</p><h2>Start with a category</h2></div></div>
      <div class="chips"><a class="chip" href="mcq-detail.html">Important MCQs</a><a class="chip" href="past-papers.html">Past Papers</a><a class="chip" href="pdfs.html">Preparation PDFs</a></div></section>
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:18px">{cat_cards}</div>
    </div>'''
write('categories.html', page('MCQ Categories — Browse by Subject | MCQCampus',
                              'Browse MCQCampus categories: Pakistan Affairs, Current Affairs, General Knowledge, English, Mathematics and Islamic Studies.',
                              body, 'categories', 'categories'))

# ---- 4. past-papers.html ----
org_cards = ''.join(f'''<a class="card clickable entity-showcase-card" href="past-paper-detail.html">
<div class="entity-card-media"><span class="entity-card-image">{ICONS['paper']}</span></div>
<div class="entity-card-body"><span class="entity-card-badge">Organization</span><h3>{org} — {title}</h3><p>{meta}</p>
<div class="entity-card-meta"><span>{ICONS['calendar']} Year {year}</span></div></div>
<span class="entity-card-arrow" aria-hidden="true">{ICONS['chevron']}</span></a>''' for org, slug, title, year, meta in PAPERS)
body = f'''<div class="container page">
      {crumbs([('Past Papers', '')])}
      <header class="page-heading"><h1>Past Papers</h1><p>Browse organizations, boards, agencies and exam years.</p></header>
      <section class="card seo-related-block"><div class="section-head"><div><p class="eyebrow">EXAM PREPARATION</p><h2>Choose an exam year to practise linked MCQs</h2></div></div>
      <p>Choose an exam year to practise linked MCQs, review answers and explanations, and continue with related preparation resources.</p>
      <div class="chips"><a class="chip" href="mcq-detail.html">Important MCQs</a><a class="chip" href="categories.html">Browse MCQ Categories</a><a class="chip" href="pdfs.html">Preparation PDFs</a></div></section>
      <p class="small muted result-count" style="margin:16px 0 10px">340 past-paper records &middot; 10 per page</p>
      <div class="grid paper-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">{org_cards}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="past-papers.html">1</a><a class="btn sm" href="past-papers.html">2</a><a class="btn sm" href="past-papers.html">3</a></div><a class="btn sm" href="past-papers.html">Next &#8250;</a><span class="small muted pagination-count">340 total &middot; Page 1 of 34</span></nav>
    </div>'''
write('past-papers.html', page('Past Papers — PPSC, FPSC, NTS &amp; CSS Solved Papers | MCQCampus',
                               'Browse solved past papers by organization and year: PPSC 2024, FPSC 2023, NTS 2024 and CSS 2023 papers with MCQs.',
                               body, 'papers', 'past-papers'))

# ---- 5. tests.html ----
auto_hero = f'''<section class="card automatic-test-hero"><p class="eyebrow">FULLY AUTOMATIC</p><h2>Smart 10-MCQ Test</h2>
<p>The system selects a source automatically from Important MCQs, Categories, or Papers and rotates the set every 7 days. No Admin test setup is required.</p>
<div class="auto-test-meta"><span class="badge">Current source: Important MCQs</span><span class="small muted">10 questions &middot; next rotation 30 October 2026</span></div>
<div class="card-foot"><a class="btn primary" href="test-attempt.html">Start Test</a><span>Automatic selection &amp; rotation</span></div></section>'''
test_cards = ''.join(f'''<a class="card clickable entity-showcase-card" href="test-attempt.html">
<div class="entity-card-media"><span class="entity-card-image">{ICONS['target']}</span></div>
<div class="entity-card-body"><span class="entity-card-badge">Test</span><h3>{t}</h3><p>{d}</p>
<div class="entity-card-meta"><span>{ICONS['clock']} {m}</span></div></div>
<span class="entity-card-arrow" aria-hidden="true">{ICONS['chevron']}</span></a>''' for t, d, m in [
    ('Pakistan Affairs Mini Test', '10 MCQs on history of Pakistan movement.', '10 min'),
    ('Current Affairs Weekly Quiz', 'October 2026 national &amp; international events.', '8 min'),
    ('English Grammar Sprint', 'Tenses, prepositions and vocabulary.', '12 min'),
    ('Everyday Science Basics', 'Physics, chemistry and biology one-liners.', '10 min'),
    ('Full Model Paper Test', 'Mixed 50-MCQ model paper for PPSC prelims.', '45 min')])
body = f'''<div class="container page">
      {crumbs([('Online Tests', '')])}
      <header class="page-heading"><h1>Online Tests</h1><p>Practice and review your answers.</p></header>
      {auto_hero}
      <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:18px">{test_cards}</div>
    </div>'''
write('tests.html', page('Online Tests — Automatic MCQ Practice Tests | MCQCampus',
                         'Take free automatic 10-MCQ online tests for PPSC, FPSC, NTS and CSS preparation and review your answers instantly.',
                         body, 'tests', 'tests'))

# ---- 6. pdfs.html ----
pdf_cards = ''.join(f'''<article class="card pdf-card pdf-direct-card">
<div class="pdf-direct-copy"><h2><a href="pdf-detail.html">{title}</a></h2><p>{desc}</p><p class="small muted"><a href="pdf-detail.html">Open resource</a> &middot; {size}</p></div>
<div class="pdf-direct-action"><a class="btn primary" href="pdf-detail.html">{ICONS['download']} Download</a></div></article>''' for title, desc, fname, size in PDFS)
body = f'''<div class="container page">
      {crumbs([('PDF Resources', '')])}
      <header class="page-heading"><h1>PDF Resources</h1><p>Study materials and downloadable papers.</p></header>
      <p class="small muted" style="margin-bottom:14px">128 PDF resources available</p>
      <div class="pdf-list">{pdf_cards}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="pdfs.html">1</a><a class="btn sm" href="pdfs.html">2</a></div><a class="btn sm" href="pdfs.html">Next &#8250;</a><span class="small muted pagination-count">128 total &middot; Page 1 of 13</span></nav>
    </div>'''
write('pdfs.html', page('PDF Resources — Solved Papers &amp; Repeater Sheets | MCQCampus',
                        'Download exam preparation PDFs: solved PPSC papers, one-day repeater sheets and monthly current affairs digests.',
                        body, 'pdfs', 'pdfs'))

# ---- 7. blog.html ----
blog_cards = ''.join(f'''<a class="card clickable content-showcase-card" href="blog-detail.html">
<div class="content-showcase-copy"><p class="content-kicker">Latest Update</p><span class="content-pill content-pill-blue">{cat}</span><h3>{title}</h3><p>{excerpt}</p>
<div class="content-date">{ICONS['calendar']}<span>{date}</span></div>
<span class="content-cta">Read update {ICONS['arrow']}</span></div>
<div class="content-showcase-media"><span class="entity-card-image">{ICONS['paper']}</span></div></a>''' for title, excerpt, cat, date, slug in POSTS)
body = f'''<div class="container page">
      {crumbs([('Latest Updates', '')])}
      <header class="page-heading"><h1>Latest Updates</h1><p>Exam news, preparation guidance and announcements.</p></header>
      <div class="chips" style="margin-bottom:16px"><a class="chip" href="blog.html">All</a><a class="chip" href="blog.html">Exam News</a><a class="chip" href="blog.html">Study Tips</a><a class="chip" href="blog.html">Guides</a></div>
      <div class="blog-list">{blog_cards}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="blog.html">1</a><a class="btn sm" href="blog.html">2</a></div><a class="btn sm" href="blog.html">Next &#8250;</a><span class="small muted pagination-count">46 total &middot; Page 1 of 5</span></nav>
    </div>'''
write('blog.html', page('Blog &amp; Latest Updates — Exam News | MCQCampus',
                        'Read the latest exam news, admission updates, results announcements and preparation guides on MCQCampus.',
                        body, 'posts', 'blog'))

# ---- 8. latest-jobs.html ----
job_cards = ''.join(f'''<article class="card latest-job-card"><div class="latest-job-logo"><span class="entity-card-image">{ICONS['briefcase']}</span></div>
<div class="latest-job-copy"><p class="eyebrow">{org}</p><h2><a href="job-detail.html">{title}</a></h2><p>{desc}</p>
<p><strong>Last Date:</strong> {last}</p><p class="small muted"><a href="job-detail.html">Read full advertisement</a></p></div>
<div class="actions"><a class="btn primary sm" href="job-detail.html">Details</a></div></article>''' for org, title, orgfull, desc, last, slug in JOBS)
body = f'''<div class="container page">
      {crumbs([('Jobs &amp; Exams', '')])}
      <header class="page-heading"><h1>Jobs &amp; Exams</h1><p>Latest vacancies and exam announcements.</p></header>
      <p class="small muted" style="margin-bottom:14px">512 job &amp; exam notices</p>
      <div class="jobs-list">{job_cards}</div>
      <nav class="pagination" aria-label="Pagination" style="margin-top:16px"><span></span><div class="page-numbers"><a class="btn sm primary" href="latest-jobs.html">1</a><a class="btn sm" href="latest-jobs.html">2</a><a class="btn sm" href="latest-jobs.html">3</a></div><a class="btn sm" href="latest-jobs.html">Next &#8250;</a><span class="small muted pagination-count">512 total &middot; Page 1 of 52</span></nav>
    </div>'''
write('latest-jobs.html', page('Latest Jobs &amp; Exam Announcements 2026 | MCQCampus',
                               'Latest government job vacancies and exam notices: PPSC lecturer recruitment, FPSC CSS 2026 and NTS ADPO Sindh tests.',
                               body, 'latest-jobs', 'latest-jobs'))

# ------------------------------------------------------------- auth forms --
def auth_page(fname, title, desc, story_title, story_copy, form_title, form_html, active='', entry='login'):
    body = f'''<div class="container page">
      <section class="auth-layout">
        <div class="auth-story"><p class="eyebrow">MCQCampus</p><h2>{story_title}</h2><p>{story_copy}</p></div>
        <div class="auth-form"><h1>{form_title}</h1>{form_html}</div>
      </section>
    </div>'''
    return page(title, desc, body, active, entry)

LOGIN_FORM = '''<p class="muted small">Sign in with your existing MCQCampus account.</p>
<form action="#" data-form="auth-login"><!-- TODO: connect to backend -->
  <div class="field"><label for="auth-login-email">Email <span class="required-mark" aria-hidden="true">*</span></label><input id="auth-login-email" type="email" name="email" autocomplete="email" required></div>
  <div class="field"><label for="auth-login-password">Password <span class="required-mark" aria-hidden="true">*</span></label><div class="password-input-wrap"><input id="auth-login-password" type="password" name="password" autocomplete="current-password" required><button class="password-toggle-btn" type="button" data-password-toggle="auth-login-password" aria-label="Show password" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
  <div class="actions auth-form-actions"><label class="check-line"><input type="checkbox" name="remember"> Remember me</label><span class="spacer"></span><a class="link" href="forgot.html">Forgot password?</a></div>
  <p class="auth-error" role="alert"></p>
  <button class="btn primary" type="submit">Sign in</button>
</form>
<p class="text-center small auth-bottom-copy">New here? <a href="country-entry.html">Choose your country and create an account</a></p>'''

write('login.html', auth_page('login.html', 'Sign In — MCQCampus',
                              'Sign in to your MCQCampus learner account to practise MCQs, track progress and manage bookmarks.',
                              'Make room<br>for progress.', 'Your questions, your pace,<br>your next step forward.',
                              'Sign in', LOGIN_FORM, 'login', 'login'))

REGISTER_FORM = '''<p class="small muted">Create your learner account. All fields marked * are required.</p>
<form action="#" data-form="auth-register"><!-- TODO: connect to backend -->
  <div class="field"><label for="auth-register-first-name">First name <span class="required-mark" aria-hidden="true">*</span></label><input id="auth-register-first-name" name="first_name" autocomplete="given-name" required></div>
  <div class="field"><label for="auth-register-last-name">Last name <span class="required-mark" aria-hidden="true">*</span></label><input id="auth-register-last-name" name="last_name" autocomplete="family-name" required></div>
  <div class="field"><label for="auth-register-email">Email <span class="required-mark" aria-hidden="true">*</span></label><input id="auth-register-email" type="email" name="email" autocomplete="email" required></div>
  <div class="field"><label for="auth-register-country">Country <span class="required-mark" aria-hidden="true">*</span></label><select id="auth-register-country" name="country" required><option value="">Choose country</option><option value="Pakistan">Pakistan</option><option value="India">India</option><option value="USA">USA</option></select></div>
  <div class="field"><label for="auth-register-password">Password <span class="required-mark" aria-hidden="true">*</span></label><div class="password-input-wrap"><input id="auth-register-password" type="password" name="password" autocomplete="new-password" minlength="8" required><button class="password-toggle-btn" type="button" data-password-toggle="auth-register-password" aria-label="Show password" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
  <div class="field"><label for="auth-register-confirm">Confirm password <span class="required-mark" aria-hidden="true">*</span></label><input id="auth-register-confirm" type="password" name="confirm" autocomplete="new-password" minlength="8" required></div>
  <label class="check-line"><input type="checkbox" name="terms" required> I accept the <a href="legal.html#terms">terms</a> and <a href="legal.html#privacy">privacy policy</a> <span class="required-mark" aria-hidden="true">*</span></label>
  <p class="auth-error" role="alert"></p>
  <button class="btn primary" type="submit">Send verification code</button>
</form>
<p class="text-center small auth-bottom-copy">Already registered? <a href="login.html">Choose your country and sign in</a></p>'''

write('register.html', auth_page('register.html', 'Create Account — MCQCampus',
                                 'Create a free MCQCampus learner account for Pakistan, India or USA exam preparation libraries.',
                                 'Start learning.', 'Create your MCQCampus account<br>and start practising today.',
                                 'Create account', REGISTER_FORM, 'register', 'register'))

FORGOT_FORM = '''<p class="muted">Enter your account email and we will send a 6-digit reset code.</p>
<form action="#" data-form="auth-forgot"><!-- TODO: connect to backend -->
  <div class="field"><label for="forgot-email">Email address <span class="required-mark" aria-hidden="true">*</span></label><input id="forgot-email" type="email" name="email" autocomplete="email" required></div>
  <p class="auth-error" role="alert"></p>
  <button class="btn primary" type="submit">Send reset code</button>
</form>
<p class="text-center small auth-bottom-copy"><a href="login.html">Back to sign in</a></p>'''

write('forgot.html', auth_page('forgot.html', 'Forgot Password — MCQCampus',
                               'Request a 6-digit password reset code for your MCQCampus account.',
                               'Reset your password.', 'Enter your account email to receive<br>a secure reset code.',
                               'Forgot your password?', FORGOT_FORM, '', 'forgot'))

RESET_CODE_FORM = '''<p class="muted">Enter the 6-digit code sent to your email. You will choose a new password after the code is verified.</p>
<form action="#" data-form="auth-reset-code"><!-- TODO: connect to backend -->
  <input type="hidden" name="email" value="">
  <div class="field"><label for="reset-code-value">6-digit reset code <span class="required-mark" aria-hidden="true">*</span></label><input id="reset-code-value" type="text" name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></div>
  <p class="auth-error" role="alert"></p>
  <button class="btn primary" type="submit">Verify code</button>
</form>
<p class="text-center small auth-bottom-copy"><a href="forgot.html">Use a different email</a></p>'''

write('reset-code.html', auth_page('reset-code.html', 'Verify Reset Code — MCQCampus',
                                   'Enter the 6-digit reset code sent to your email to verify your MCQCampus account.',
                                   'Verify reset code.', 'Confirm your email with<br>the 6-digit code.',
                                   'Verify reset code', RESET_CODE_FORM, '', 'reset-code'))

RESET_PW_FORM = '''<p class="muted">Your code is verified. Choose a new password for your account.</p>
<form action="#" data-form="auth-reset-password"><!-- TODO: connect to backend -->
  <input type="hidden" name="email" value="">
  <div class="field"><label for="reset-password-value">New password <span class="required-mark" aria-hidden="true">*</span></label><div class="password-input-wrap"><input id="reset-password-value" type="password" name="password" autocomplete="new-password" minlength="8" required><button class="password-toggle-btn" type="button" data-password-toggle="reset-password-value" aria-label="Show password" aria-pressed="false"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
  <div class="field"><label for="reset-password-confirm">Confirm new password <span class="required-mark" aria-hidden="true">*</span></label><input id="reset-password-confirm" type="password" name="confirm" autocomplete="new-password" minlength="8" required></div>
  <p class="auth-error" role="alert"></p>
  <button class="btn primary" type="submit">Update password</button>
</form>
<p class="text-center small auth-bottom-copy"><a href="login.html">Return to sign in</a></p>'''

write('reset-password.html', auth_page('reset-password.html', 'Choose New Password — MCQCampus',
                                       'Set a new password for your verified MCQCampus account.',
                                       'Choose a new password.', 'Set a new password for<br>your MCQCampus account.',
                                       'Choose a new password', RESET_PW_FORM, '', 'reset-password'))

VERIFY_FORM = '''<p class="muted">Enter the 6-digit code sent to your email. Your account is created only after successful verification.</p>
<form action="#" data-form="auth-verify"><!-- TODO: connect to backend -->
  <div class="field"><label for="verify-email">Email address <span class="required-mark" aria-hidden="true">*</span></label><input id="verify-email" type="email" name="email" autocomplete="email" required></div>
  <div class="field"><label for="verify-code">6-digit verification code <span class="required-mark" aria-hidden="true">*</span></label><input id="verify-code" type="text" name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></div>
  <p class="small muted">You can request a new code now.</p>
  <p class="auth-error" role="alert"></p>
  <div class="actions"><button class="btn primary" type="submit">Verify &amp; create account</button><button class="btn ghost" type="button">Resend code</button></div>
</form>
<p class="text-center small auth-bottom-copy"><a href="login.html">Back to login</a></p>'''

write('verify.html', auth_page('verify.html', 'Verify Email — MCQCampus',
                               'Verify your email with the 6-digit code to finish creating your MCQCampus account.',
                               'Verify your email.', 'Finish creating your account<br>using the email code.',
                               'Email verification', VERIFY_FORM, '', 'verify'))

# ---- 15. sitemap.html ----
sm = lambda links: '<ul>' + ''.join(f'<li><a href="{h}">{l}</a></li>' for h, l in links) + '</ul>'
body = f'''<div class="container page">
      <header class="page-heading"><h1>Sitemap</h1><p>Browse public study sections, organizations, past papers and preparation resources.</p></header>
      <div class="sitemap-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
        <section class="card"><div class="section-head"><div><h2>Main Pages</h2></div></div>{sm([('index.html','Home'),('mcqs.html','MCQs'),('categories.html','Categories'),('past-papers.html','Past Papers'),('tests.html','Tests'),('pdfs.html','PDF Resources'),('blog.html','Blog &amp; Updates'),('latest-jobs.html','Jobs &amp; Exams')])}</section>
        <section class="card"><div class="section-head"><div><h2>Account</h2></div></div>{sm([('country-entry.html','Choose Country'),('login.html','Sign In'),('register.html','Create Account'),('verify.html','Email Verification'),('forgot.html','Forgot Password'),('reset-code.html','Verify Reset Code'),('reset-password.html','New Password'),('dashboard.html','My Learning Dashboard')])}</section>
        <section class="card"><div class="section-head"><div><h2>Help &amp; Legal</h2></div></div>{sm([('about.html','About MCQCampus'),('contact.html','Contact'),('faq.html','FAQ'),('legal.html#terms','Terms &amp; Conditions'),('legal.html#privacy','Privacy Policy'),('legal.html#disclaimer','Disclaimer'),('legal.html#cookies','Cookie Policy'),('legal.html#advertising','Advertising Policy')])}</section>
        <section class="card"><div class="section-head"><div><h2>Countries</h2></div></div>{sm([('country-landing.html','Pakistan Library'),('country-landing.html','India Library'),('country-landing.html','USA Library')])}</section>
      </div>
    </div>'''
write('sitemap.html', page('Sitemap — All Pages | MCQCampus',
                           'Complete sitemap of MCQCampus: MCQs, categories, past papers, tests, PDFs, jobs, blog and legal pages.',
                           body, '', 'sitemap'))

# ---- 16. 404.html ----
body = '''<div class="container page">
      <header class="page-heading"><p class="eyebrow">404 &middot; PAGE NOT FOUND</p><h1>We could not find that page.</h1><p>The link may be old, incomplete, or no longer available.</p></header>
      <nav class="actions" aria-label="Suggested pages">
        <a class="btn primary" href="index.html">Go Home</a>
        <a class="btn" href="mcqs.html">Practice MCQs</a>
        <a class="btn" href="past-papers.html">Past Papers</a>
        <a class="btn" href="tests.html">Online Tests</a>
        <a class="btn" href="latest-jobs.html">Jobs &amp; Exams</a>
        <a class="btn ghost" href="contact.html">Report a Broken Link</a>
      </nav>
    </div>'''
write('404.html', page('404 — Page Not Found | MCQCampus',
                       'The page you requested could not be found on MCQCampus. Try the home page, MCQs or past papers.',
                       body, '', 'not-found'))

# ---- 17. country-entry.html ----
def country_card(flag, name, desc):
    return (f'<article class="country-entry-card"><span class="country-entry-flag" aria-hidden="true">{flag}</span><h2>{name}</h2><p>{desc}</p>'
            f'<div class="country-entry-action"><a href="login.html">Sign in</a><span aria-hidden="true">&middot;</span><a href="register.html">Create account</a></div></article>')

body = f'''<div class="country-entry-page">
    <div class="country-entry-shell">
      <a class="country-entry-brand" href="index.html" aria-label="MCQCampus home"><span class="country-entry-brand-mark" aria-hidden="true">M</span><span>MCQ<span>Campus</span></span></a>
      <p class="country-entry-eyebrow">WELCOME TO MCQCAMPUS</p>
      <h1>Choose your country</h1>
      <p class="country-entry-intro">Choose the country library you want to use before signing in or creating your learner account.</p>
      <div class="country-entry-grid">
        {country_card('\U0001F1F5\U0001F1F0', 'Pakistan', 'PPSC, FPSC, SPSC, NTS and more')}
        {country_card('\U0001F1EE\U0001F1F3', 'India', 'Competitive exams and practice')}
        {country_card('\U0001F1FA\U0001F1F8', 'USA', 'Exam practice and learning resources')}
      </div>
      <p class="country-entry-login"><a href="index.html">Return to home</a></p>
    </div>
</div>'''
write('country-entry.html', page('Choose Your Country — MCQCampus',
                                 'Select your country library (Pakistan, India or USA) before signing in or creating an MCQCampus account.',
                                 body, '', 'country-entry'))

# ---- 18. dashboard.html ----
metrics = ''.join([
    stat_card('Total Attempted', '1,248', 'Across 96 practice sessions', 'primary', 'book'),
    stat_card('Accuracy', '72%', 'Last 30 days average', 'success', 'target'),
    stat_card('Bookmarked', '84', 'Saved for revision', 'warning', 'bookmark'),
    stat_card('Streak', '12 days', 'Keep it going!', 'danger', 'fire'),
])
progress_rows = ''.join(
    f'<div class="bar-row"><div class="row"><span>{label}</span><span>{summary}</span></div>'
    f'<div class="progress-track"><span style="width:{pct}%"></span></div></div>'
    for label, summary, pct in PROGRESS_ROWS)
weak_rows = ''.join(f'<div class="weak-row"><span>{n}</span><strong>{a}</strong></div>' for n, a in [
    ('Everyday Science', '55%'), ('Current Affairs', '65%'), ('Mathematics', '68%')])
activity_rows = ''.join(
    f'<div class="learner-activity-row"><span class="status-dot {"ok" if s is True else ("bad" if s is False else "")}"></span>'
    f'<div><strong>{q}</strong><span>{meta}</span></div></div>' for q, meta, s in ACTIVITIES)
body = f'''<div class="container page learner-dashboard-shell">
    <div class="learner-mobile-head"><button class="btn ghost" type="button">{ICONS['menu']} Learning menu</button></div>
    <div class="learner-shell">
      <aside class="learner-side card" id="learner-sidebar">
        <div class="learner-side-head"><strong>My Learning</strong><span class="small muted">Personal preparation center</span></div>
        {LEARNER_NAV}
      </aside>
      <main class="learner-content">
        <div class="profile-band compact-profile-band"><span class="profile-photo profile-photo-fallback">AK</span>
          <div><p class="eyebrow">YOUR LEARNING SPACE</p><h2>Welcome back, Ayesha</h2><span class="small muted">Practice, review mistakes, explore past papers, and track progress.</span></div>
        </div>
        <div class="learner-overview-view">
          <div class="learner-metrics">{metrics}</div>
          <section class="card learner-continue"><div><p class="eyebrow">CONTINUE PREPARATION</p><h2>PPSC Assistant Director Revenue 2024</h2><p class="small muted">You paused at question 34 of 100.</p></div><a class="btn primary" href="past-paper-detail.html">Continue Paper</a></section>
          <div class="learner-quick-actions">{QUICK_ACTIONS}</div>
          <div class="learner-home-grid">
            <section class="card"><div class="section-head"><div><p class="eyebrow">WEEKLY / OVERALL PROGRESS</p><h2>Category progress</h2></div><a href="learner-subpage.html#performance" class="link">Full performance</a></div><div>{progress_rows}</div></section>
            <section class="card"><div class="section-head"><div><p class="eyebrow">WEAK AREAS</p><h2>Needs more practice</h2></div></div><div>{weak_rows}</div></section>
            <section class="card"><div class="section-head"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Latest practice</h2></div><a href="learner-subpage.html#history" class="link">View history</a></div><div>{activity_rows}</div></section>
          </div>
        </div>
      </main>
    </div>
</div>'''
write('dashboard.html', page('My Learning Dashboard — MCQCampus',
                             'Track attempted MCQs, accuracy, bookmarks and daily streak in your MCQCampus learner dashboard.',
                             body, 'dashboard', 'dashboard'))

# ---- 19. admin.html ----
def admin_side_link(href, label, active=False):
    return f'<a href="{href}"{" class=\"active\"" if active else ""}>{label}</a>'

admin_body = f'''<div class="dash-layout">
  <aside class="sidebar" id="admin-sidebar">
    <a class="brand" href="index.html" aria-label="MCQCampus home"><span class="logo-crop"><img src="assets/genfavicon-48.png" width="42" height="42" alt=""></span><span>MCQCampus</span></a>
    <div class="nav-label">ADMIN WORKSPACE</div>
    {admin_side_link('admin.html', ICONS['grid'] + ' Overview', True)}
    <div class="nav-label">Question library</div>
    {admin_side_link('mcqs.html', ICONS['book'] + ' All MCQs')}
    {admin_side_link('mcqs.html', ICONS['star'] + ' Important MCQs')}
    {admin_side_link('categories.html', ICONS['grid'] + ' Categories')}
    <div class="nav-label">Management</div>
    {admin_side_link('past-papers.html', ICONS['paper'] + ' Organizations &amp; Papers')}
    {admin_side_link('latest-jobs.html', ICONS['briefcase'] + ' Jobs &amp; Exams')}
    {admin_side_link('pdfs.html', ICONS['download'] + ' PDF Resources')}
    {admin_side_link('blog.html', ICONS['edit'] + ' Blog &amp; Content')}
    {admin_side_link('login.html', ICONS['logout'] + ' Sign out')}
  </aside>
  <div class="dash-main">
    <header class="dash-top"><button class="btn ghost" type="button" aria-label="Toggle sidebar">{ICONS['menu']}</button>
      <span class="small muted">Workspace / <strong>Overview</strong></span><span class="spacer"></span>
      <span class="badge">Pakistan &#128252;</span><span class="badge">Database connected</span>
      <details class="user-menu"><summary class="header-user-avatar" aria-label="Open account menu"><span>SB</span></summary><div class="user-menu-panel"><div class="user-menu-head"><strong>Site Admin</strong><span>admin@mcqcampus.com</span></div><a class="user-menu-item" href="dashboard.html">{ICONS['book']} Learner dashboard</a><a class="user-menu-item" href="super-admin.html">{ICONS['shield']} Super admin</a><a class="user-menu-item" href="login.html">{ICONS['logout']} Log out</a></div></details>
    </header>
    <main class="dash-content">
      <div class="learner-metrics">
        {stat_card('Total MCQs', '12,480', '+36 added this week', 'primary', 'book')}
        {stat_card('Pending Reports', '7', 'Questions flagged by learners', 'warning', 'flag')}
        {stat_card('Active Users', '3,204', 'Last 30 days', 'success', 'user')}
        {stat_card('Published Papers', '340', 'Across 28 organizations', 'danger', 'paper')}
      </div>
      <section class="card" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">QUESTION LIBRARY</p><h2>Recent MCQs</h2></div><a class="btn primary sm" href="#">Add New MCQ</a></div>
        <table class="admin-table"><thead><tr><th>#</th><th>Question</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {''.join(f'<tr><td>{qid}</td><td>{q[:60]}</td><td>{tag.replace(chr(60),"&#60;")}</td><td><span class="badge">Published</span></td><td><a class="btn sm ghost" href="mcq-detail.html">Edit</a></td></tr>' for (_, _, _, _, tag, qid), q in zip(SAMPLE_MCQS, [s[0] for s in SAMPLE_MCQS]))}
        </tbody></table>
      </section>
      <section class="card" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">MODERATION</p><h2>Open reports</h2></div></div>
        <div class="learner-activity-row"><span class="status-dot bad"></span><div><strong>Answer disputed on MCQ #105 (Zero Option)</strong><span>Reported by 3 learners &middot; 24 October 2026</span></div></div>
        <div class="learner-activity-row"><span class="status-dot bad"></span><div><strong>Typo reported on MCQ #104</strong><span>Reported by 1 learner &middot; 22 October 2026</span></div></div>
      </section>
    </main>
  </div>
</div>'''
write('admin.html', page('Admin Workspace — MCQCampus',
                         'MCQCampus admin workspace: manage MCQs, categories, organizations, past papers, jobs, PDFs and content moderation.',
                         admin_body, '', 'admin'))

# ---- 20. super-admin.html ----
sa_body = f'''<div class="dash-layout">
  <aside class="sidebar" id="admin-sidebar">
    <a class="brand" href="index.html" aria-label="MCQCampus home"><span class="logo-crop"><img src="assets/genfavicon-48.png" width="42" height="42" alt=""></span><span>MCQCampus</span></a>
    <div class="nav-label">SUPER ADMIN</div>
    {admin_side_link('super-admin.html', ICONS['grid'] + ' Overview', True)}
    <div class="nav-label">System</div>
    {admin_side_link('country-landing.html', ICONS['grid'] + ' Countries')}
    {admin_side_link('admin.html', ICONS['user'] + ' Users &amp; Roles')}
    {admin_side_link('learner-settings.html', ICONS['settings'] + ' Site Settings')}
    {admin_side_link('blog.html', ICONS['edit'] + ' Site Content')}
    {admin_side_link('login.html', ICONS['logout'] + ' Sign out')}
  </aside>
  <div class="dash-main">
    <header class="dash-top"><button class="btn ghost" type="button" aria-label="Toggle sidebar">{ICONS['menu']}</button>
      <span class="small muted">Workspace / <strong>Super Admin Overview</strong></span><span class="spacer"></span>
      <span class="badge">All countries</span><span class="badge">Database connected</span>
      <details class="user-menu"><summary class="header-user-avatar" aria-label="Open account menu"><span>SA</span></summary><div class="user-menu-panel"><div class="user-menu-head"><strong>Super Admin</strong><span>root@mcqcampus.com</span></div><a class="user-menu-item" href="admin.html">{ICONS['edit']} Admin workspace</a><a class="user-menu-item" href="login.html">{ICONS['logout']} Log out</a></div></details>
    </header>
    <main class="dash-content">
      <div class="learner-metrics">
        {stat_card('Countries', '3', 'Pakistan, India, USA', 'primary', 'grid')}
        {stat_card('Admins', '12', '2 pending approval', 'warning', 'user')}
        {stat_card('Total Records', '16,540', 'All tables combined', 'success', 'database' if 'database' in ICONS else 'paper')}
        {stat_card('System Health', 'OK', 'API &amp; cache nominal', 'danger', 'shield')}
      </div>
      <section class="card" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">COUNTRY LIBRARIES</p><h2>Manage countries</h2></div><a class="btn primary sm" href="#">Add Country</a></div>
        <table class="admin-table"><thead><tr><th>Flag</th><th>Country</th><th>Users</th><th>MCQs</th><th>Status</th></tr></thead><tbody>
        <tr><td>&#128252;</td><td>Pakistan</td><td>2,410</td><td>9,120</td><td><span class="badge">Active</span></td></tr>
        <tr><td>&#128252;</td><td>India</td><td>640</td><td>2,300</td><td><span class="badge">Active</span></td></tr>
        <tr><td>&#128252;</td><td>USA</td><td>154</td><td>1,060</td><td><span class="badge">Active</span></td></tr>
        </tbody></table>
      </section>
      <section class="card" style="margin-top:16px"><div class="section-head"><div><p class="eyebrow">ROLES</p><h2>Pending approvals</h2></div></div>
        <div class="learner-activity-row"><span class="status-dot"></span><div><strong>bilal.recruiter@example.com &rarr; Admin (Pakistan)</strong><span>Requested 23 October 2026</span></div></div>
        <div class="learner-activity-row"><span class="status-dot"></span><div><strong>priya.content@example.in &rarr; Editor (India)</strong><span>Requested 20 October 2026</span></div></div>
      </section>
    </main>
  </div>
</div>'''
write('super-admin.html', page('Super Admin Workspace — MCQCampus',
                               'MCQCampus super admin workspace: manage countries, roles, users, site settings and system health.',
                               sa_body, '', 'super-admin'))

# ---- 21. about.html ----
body = f'''<div class="container page">
      {crumbs([('About MCQCampus', '')])}
      <header class="page-heading"><h1>About MCQCampus</h1></header>
      <article class="article public-article">
        <p>MCQCampus is an educational preparation platform built for students and job-seekers who appear in competitive examinations such as PPSC, FPSC, NTS, CSS, PMS and school or board tests across Pakistan and India. Our goal is simple: make high-quality, solved practice material available to every learner, free of paywalls.</p>
        <p>The platform combines four pillars — a growing library of <strong>solved MCQs with explanations</strong>, year-wise <strong>past papers</strong> organised by examining body, fully automatic <strong>online tests</strong> that rotate every week, and downloadable <strong>PDF repeaters and digests</strong>. Every question carries its correct answer and a short explanation so learners understand the reasoning instead of memorising keys.</p>
        <p>Content is reviewed by subject editors and improved through learner reports: if an answer ever looks wrong, the report button on each card sends it straight to the moderation queue. MCQCampus does not guarantee exam results or selection; it exists to give you structured, repeatable practice so confidence comes from preparation, not guesswork.</p>
        <div class="chips"><a class="chip" href="mcqs.html">Start Practising</a><a class="chip" href="contact.html">Feedback</a><a class="chip" href="faq.html">FAQ</a></div>
      </article>
    </div>'''
write('about.html', page('About MCQCampus — Our Mission &amp; Platform | MCQCampus',
                         'Learn about MCQCampus: a free exam preparation platform with solved MCQs, past papers, online tests and PDF resources.',
                         body, 'about', 'about'))

# ---- 22. contact.html ----
body = f'''<div class="container page">
      {crumbs([('Contact MCQCampus', '')])}
      <header class="page-heading"><h1>Contact MCQCampus</h1></header>
      <div class="public-layout">
        <main class="public-main">
          <form action="#" data-form="contact"><!-- TODO: connect to backend -->
            <div class="field"><label for="contact-name">Name <span class="required-mark" aria-hidden="true">*</span></label><input id="contact-name" name="name" autocomplete="name" required></div>
            <div class="field"><label for="contact-email">Email <span class="required-mark" aria-hidden="true">*</span></label><input id="contact-email" type="email" name="email" autocomplete="email" required></div>
            <div class="field"><label for="contact-subject">Subject <span class="required-mark" aria-hidden="true">*</span></label><select id="contact-subject" name="subject" required><option value="">Choose a subject</option><option>General Inquiry</option><option>Report Incorrect MCQ</option><option>Report Incorrect Answer</option><option>Report Technical Issue</option><option>Job/Exam Information Correction</option><option>PDF/Purchase Issue</option><option>Advertising Inquiry</option><option>Other</option></select></div>
            <div class="field"><label for="contact-message">Message <span class="required-mark" aria-hidden="true">*</span></label><textarea id="contact-message" name="message" rows="6" required></textarea></div>
            <p class="auth-error" role="alert"></p>
            <button class="btn primary" type="submit">Send message</button>
          </form>
        </main>
        <aside class="public-sidebar" aria-label="Contact details">
          <div class="public-sidebar-head"><strong>Reach us directly</strong></div>
          <div class="public-sidebar-inner">
            <p class="small muted">Email: <a href="mailto:hello@mcqcampus.com">hello@mcqcampus.com</a></p>
            <p class="small muted">Response time: within 2 working days.</p>
            <p class="small muted">For quick MCQ corrections, use the <em>Report</em> button on any question card.</p>
          </div>
        </aside>
      </div>
    </div>'''
write('contact.html', page('Contact MCQCampus — Support &amp; Corrections | MCQCampus',
                           'Contact the MCQCampus team for general inquiries, incorrect MCQ reports, technical issues or advertising questions.',
                           body, 'contact', 'contact'))

print('Batch A complete.')
