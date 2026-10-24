'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('frontend/index.html');
const css = read('frontend/style.css');
const nginx = read('deploy/nginx/mcqcampus-frontend-locations.conf');

const expectedPages = [
  'home', 'mcqs', 'categories', 'past-papers', 'tests', 'pdfs', 'blog',
  'latest-jobs', 'login', 'register', 'country-entry', 'dashboard', 'admin', 'super-admin',
  'about', 'contact', 'sitemap', 'forgot', 'reset-code', 'reset-password', 'verify',
];
const requiredTemplates = [
  'mcq-layout-template', 'mcq-header-template', 'mcq-footer-template',
  'mcq-home-template', 'mcq-auth-layout-template',
  'mcq-learner-dashboard-template', 'mcq-admin-layout-template',
  'mcq-question-card-template', 'mcq-country-landing-template',
  'mcq-country-entry-card-template', 'mcq-category-context-template', 'mcq-paper-context-template',
  'mcq-blog-detail-template', 'mcq-legal-content-template', 'mcq-faq-content-template',
];

let failed = false;
function check(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    failed = true;
  } else {
    console.log('OK:', message);
  }
}

check(html.toLowerCase().includes('<!doctype html>'), 'index.html has a standards-mode doctype');
check(html.includes('href="/assets/style.css'), 'index.html loads the single stylesheet');
check(html.includes('src="/assets/script.js'), 'index.html loads the unified runtime');
check(html.includes('data-api-region="past-paper-pagination"'), 'past-paper pagination has a separate HTML region');
check(html.includes('data-api-region="breadcrumbs"'), 'public shells include a reusable breadcrumb region');
check(!html.includes('<nav data-api-region="mcq-pagination"'), 'pagination regions avoid nested navigation elements');
check(!html.includes('{{') && !html.includes('{%'), 'index.html contains no Django template tags');
check((html.match(/rel="stylesheet"/g) || []).length === 1, 'index.html references one stylesheet');
check(fs.existsSync(path.join(frontend, 'style.css')), 'frontend/style.css exists');
check(fs.existsSync(path.join(frontend, 'script.js')), 'frontend/script.js exists');

for (const page of expectedPages) {
  check(html.includes('data-static-page="' + page + '"'), 'static page shell exists: ' + page);
}
for (const id of requiredTemplates) {
  check(html.includes('id="' + id + '"'), 'reusable HTML template exists: ' + id);
}

const shellMarkers = [...html.matchAll(/<section\s+data-static-page="([^"]+)"/g)];
const pageShells = shellMarkers.map((match, index) => ({
  name: match[1],
  markup: html.slice(match.index, shellMarkers[index + 1]?.index ?? html.length),
}));
const shellNames = pageShells.map(match => match.name);
check(shellNames.length === expectedPages.length, 'each expected route has exactly one static page shell');
check(new Set(shellNames).size === shellNames.length, 'static page shell identifiers are unique');
for (const shell of pageShells) {
  check(/<main\b/.test(shell.markup), 'static page has a semantic main region: ' + shell.name);
  check(/<h1\b/.test(shell.markup), 'static page has a hard-coded primary heading: ' + shell.name);
}
const requiredRegionsByPage = {
  home: ['home-mcqs', 'home-categories'],
  mcqs: ['mcq-list', 'mcq-pagination'],
  categories: ['category-list'],
  'past-papers': ['organization-list', 'past-paper-list'],
  tests: ['test-list'],
  pdfs: ['pdf-list'],
  blog: ['blog-list'],
  'latest-jobs': ['jobs-list'],
  dashboard: ['learner-dashboard'],
  admin: ['admin-workspace'],
  'super-admin': ['super-admin-workspace'],
  about: ['about-content'],
  contact: ['contact-form'],
  sitemap: ['sitemap-content'],
  forgot: ['auth-form'],
  'reset-code': ['auth-form'],
  'reset-password': ['auth-form'],
  verify: ['auth-form'],
};
for (const [page, regions] of Object.entries(requiredRegionsByPage)) {
  const shell = pageShells.find(match => match.name === page)?.markup || '';
  for (const region of regions) {
    check(shell.includes('data-api-region="' + region + '"'), 'static page has its API data region: ' + page + ' / ' + region);
  }
}

function cssBracesBalanced(source) {
  let depth = 0;
  let quote = '';
  let comment = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (comment) {
      if (char === '*' && next === '/') { comment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (char === String.fromCharCode(92)) { i += 1; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '*') { comment = true; i += 1; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') { depth -= 1; if (depth < 0) return false; }
  }
  return !comment && !quote && depth === 0;
}
check(cssBracesBalanced(css), 'style.css has balanced CSS blocks');
check(/@media\s*\(max-width:\s*600px\)/i.test(css), 'stylesheet includes responsive mobile viewport rules');
check(/@media\s*\(max-width:\s*360px\)/i.test(css), 'stylesheet includes narrow-screen responsive rules');
check(/prefers-reduced-motion\s*:\s*reduce/i.test(css), 'stylesheet respects reduced-motion preferences');

check(nginx.includes('location = /assets/style.css'), 'Nginx maps the stylesheet URL to frontend/style.css');
check(nginx.includes('alias /home/ubuntu/mcq-campus/frontend/style.css;'), 'Nginx stylesheet alias is correct');
check(nginx.includes('location = /assets/script.js'), 'Nginx maps the runtime URL to frontend/script.js');
check(nginx.includes('alias /home/ubuntu/mcq-campus/frontend/script.js;'), 'Nginx runtime alias is correct');
check(nginx.includes('location ^~ /api/'), 'API traffic is proxied separately to Django');
check(!nginx.includes('location ^~ /assets/css/'), 'obsolete split CSS asset route is removed');
check(!nginx.includes('location ^~ /assets/js/'), 'obsolete split JavaScript asset route is removed');
check(nginx.includes('location = /favicon.ico { return 301 /assets/favicon.svg; }'), 'missing favicon.ico routes to the existing SVG icon');
check(nginx.includes('try_files $uri $uri.html /index.html;'), 'deep browser routes have an SPA fallback');
const runtime = read('frontend/script.js');
check(runtime.includes("dest.classList.add('public-main','public-main-full')"), 'data regions retain public layout classes for existing CSS');
check(runtime.includes('staticPageNode(shell,page){'), 'static page shells are mounted as DOM nodes');
check(runtime.includes('showStaticShell(){'), 'the runtime activates hard-coded page shells while data loads');
check(runtime.includes("if((first==='login'||first==='register')&&!String(requestedCountry||'').trim())page='country-entry';"), 'login and signup fall back to country selection when no country is selected');
check(html.includes('class="country-entry-grid"') && html.includes('class="country-entry-card"'), 'country selection fallback uses responsive static card markup');
check(html.includes('href="/login?country=USA"') && html.includes('href="/register?country=USA"'), 'country-selection fallback includes USA sign-in and signup routes');
check(html.includes('data-nav-section="tests"') && html.includes('data-nav-section="latest-jobs"'), 'primary navigation contains hard-coded Tests and Jobs & Exams links');
check(html.includes('data-nav-section="categories"') && html.includes('class="nav-more-menu"'), 'secondary navigation is hard-coded in the shared header template');
check(!html.includes('<!-- SLOT:HEADER_NAV -->'), 'navigation links are not generated into the HTML template by JavaScript');
check(css.includes('body[data-page-template="tests"] #main-nav [data-nav-section="tests"]'), 'active static navigation state is styled in CSS');
check(css.includes('.country-entry-grid') && css.includes('.country-entry-card'), 'country selection fallback uses existing responsive CSS');
check(html.includes('Choose your country and create an account') && html.includes('Choose your country and sign in'), 'static auth forms provide a path between signup and sign-in');
check(runtime.includes("else if(page==='admin'||page==='super-admin'){"), 'admin and super-admin shells use the centralized static wrapper');
check(html.includes('id="mcq-admin-layout-template"') && html.includes('class="dash-layout"'), 'admin workspace layout structure is hard-coded in index.html');
check(runtime.includes("populated=fill(regionName,'.dash-layout',parsed.body,'outer')||populated;"), 'protected admin workspace layout mounts into its static shell');
check(runtime.includes("if(!['admin','super-admin'].includes(MCQ.role()))"), 'admin routes retain the existing role guard');
check(runtime.includes('mountStaticPage(base,renderedHtml){'), 'API-backed route content mounts into hard-coded page shells');
check(runtime.includes("const discovery=window.SEO?.discoveryPage?.(location.pathname)"), 'SEO discovery pages are detected before static-shell mounting');
check(runtime.includes("const discovery=window.SEO?.discoveryPage?.(path);if(discovery?.landing?.type==='paper'&&discovery.landing.id){base='paper';id=String(discovery.landing.id);}"), 'SEO organization landing pages prefer the data-driven static renderer');
check(runtime.includes("else if(discovery)html=SEO.renderDiscovery(path);"), 'legacy SEO discovery markup remains only as a fallback');
check(runtime.includes("const groups=Array.isArray(discovery?.groups)&&discovery.groups.length?discovery.groups:"), 'sitemap uses SEO discovery groups inside the hard-coded DOM shell');
check(runtime.includes("if(discovery?.landing?.type==='paper'&&discovery.landing.id)base='paper'"), 'organization SEO landing pages mount into the Past Papers shell');
check(runtime.includes("else if(discovery?.landing?.type==='job'&&discovery.landing.id)base='job'"), 'legacy SEO landing pages retain their Past Papers shell route');
check(runtime.includes('mountDataDrivenPage(base,id){'), 'core public pages have a data-driven static-shell renderer');
check(runtime.includes("['forgot','reset-code','reset-password','verify'].includes(base)"), 'secondary account flows are rendered in static shells');
check(!runtime.includes("const renderedAuth=Auth.view(base)"), 'recovery forms are not generated by the legacy page renderer');
check(runtime.includes('Auth.syncVerificationTimer?.(') && runtime.includes('syncVerificationTimer,ADMIN_PAGE_SIZES'), 'verification resend timer is bound to the static HTML form');
check(html.includes('data-form="auth-forgot"') && html.includes('data-form="auth-reset-code"') && html.includes('data-form="auth-reset-password"') && html.includes('data-form="auth-verify"'), 'all recovery and verification form structures are hard-coded in index.html');
check(html.includes('data-static-page="forgot"') && html.includes('data-static-page="reset-code"') && html.includes('data-static-page="reset-password"') && html.includes('data-static-page="verify"'), 'recovery and verification pages have hard-coded HTML shells');
check(runtime.includes('else if(this.mountDataDrivenPage(base,id))html=null'), 'home, MCQs, categories and organizations bypass legacy whole-page renderers');
const requiredDataDrivenRoutes = [
  'home', 'mcqs', 'important', 'categories', 'papers', 'pdfs', 'latest-jobs',
  'jobs-exams', 'posts', 'tests', 'test', 'login', 'register', 'forgot',
  'reset-code', 'reset-password', 'verify', 'mcq', 'practice', 'category',
  'subcategory', 'topic', 'paper', 'year', 'search', 'pdf', 'latest-job',
  'post', 'about', 'contact', 'faq', 'privacy', 'terms', 'disclaimer',
  'cookies', 'advertising', 'sitemap',
];
const supportedRoutesMatch = runtime.match(/const supported=\[([^\]]+)\];/);
check(Boolean(supportedRoutesMatch) && requiredDataDrivenRoutes.every(route => supportedRoutesMatch[1].includes("'" + route + "'")), 'core public data renderer explicitly supports expected public, auth and legal routes');
check(html.includes('id="mcq-home-category-item-template"'), 'home category cards have a hard-coded HTML template');
check(html.includes('data-api-region="home-top-ad"') && html.includes('data-api-region="home-middle-ad"'), 'home ad placements have static page regions');
check(html.includes('data-api-region="jobs-pagination"'), 'latest-jobs pagination has its own static data region');
check(runtime.includes("Public.pdfResourceCard(item)"), 'PDF listing renders through the reusable PDF card template');
check(runtime.includes("Public.latestJobCard(item)"), 'latest-jobs listing renders through the reusable job card template');
check(runtime.includes("Public.blogPostCard(item)"), 'blog listing renders through the reusable blog card template');
check(runtime.includes('Public.automaticTestPlan()'), 'automatic test listing populates the static tests shell');
check(runtime.includes("else if(base==='test')") && runtime.includes("this.staticTemplateFragment('mcq-test-form-template'"), 'individual online tests populate the hard-coded Tests shell directly');
check(runtime.includes("if(base==='mcq'||base==='practice')"), 'individual MCQ and practice routes mount question cards into the static shell');
check(runtime.includes("else if(base==='category'||base==='subcategory')"), 'category and subcategory pages use static regions for links and MCQs');
check(runtime.includes("else if(base==='paper')"), 'organization detail pages render past papers inside the static shell');
check(runtime.includes("else if(base==='year')"), 'past-paper year pages render linked MCQs inside the static MCQ shell');
check(runtime.includes("dashboard:'dashboard',profile:'dashboard',sitemap:'sitemap"), 'learner dashboard and sitemap have explicit static-shell routes');
check(runtime.includes("fill('learner-dashboard','.learner-dashboard-shell',sourceMain,'inner')"), 'learner dashboard content mounts into the hard-coded dashboard shell');
check(html.includes('data-static-page="sitemap"') && html.includes('data-api-region="sitemap-content"'), 'sitemap uses a hard-coded HTML page shell');
check(runtime.includes("if(base==='search')"), 'search results use the data-driven MCQ shell renderer');
check(runtime.includes("Public.pdfResourceCard(item.record)"), 'search can render PDF results through the shared card template');
check(runtime.includes("}else if(base==='pdf')"), 'PDF detail pages mount into the static PDF shell');
check(runtime.includes("}else if(base==='latest-job')"), 'individual job details mount into the static Jobs shell');
check(runtime.includes("}else if(base==='post')"), 'blog articles mount into the static Blog shell');
check(html.includes('id="mcq-blog-detail-template"'), 'blog detail has a hard-coded article template');
check(html.includes('id="mcq-legal-content-template"'), 'legal pages have a reusable static HTML template');
check(html.includes('id="mcq-faq-content-template"'), 'FAQ details are hard-coded in the central HTML document');
check(runtime.includes('staticTemplateFragment(id,slots={})'), 'dynamic page content clones and fills central DOM templates');
check(runtime.includes("this.staticTemplateFragment('mcq-pdf-detail-template'"), 'PDF detail content mounts from a cloned HTML template');
check(runtime.includes("this.staticTemplateFragment('mcq-latest-job-detail-template'"), 'job detail content mounts from a cloned HTML template');
check(runtime.includes("this.staticTemplateFragment('mcq-blog-detail-template'"), 'blog articles mount from a cloned HTML template');
check(runtime.includes("this.staticTemplateFragment('mcq-legal-content-template'"), 'legal page content mounts from a cloned HTML template');
check(runtime.includes('const setBreadcrumbs=items=>'), 'breadcrumbs are composed from DOM nodes rather than generated HTML');
check(runtime.includes('const appendManagedText=(container,value)=>'), 'managed legal copy is inserted as safe DOM text nodes');
check(runtime.includes("}else if(base==='contact'){"), 'contact form is populated inside its static page shell');
check(runtime.includes("}else if(base==='sitemap'){"), 'sitemap links are created as DOM nodes');
check(runtime.includes("}else if(base==='categories'||base==='papers'||base==='jobs-exams'){"), 'Jobs & Exams renders through the organization and past-paper directory');
check(!runtime.includes("}else if(base==='latest-jobs'||base==='jobs-exams'){"), 'Jobs & Exams is not confused with latest-vacancy listings');
check(html.includes('data-api-region="search-filters"') && html.includes('data-form="search"'), 'the static MCQ page provides an operational search form and filter region');
check(html.includes('id="mcq-paper-context-template"'), 'organization detail has a reusable static context template');
check(html.includes('data-api-region="mcq-related-list"') && html.includes('data-api-region="year-actions"'), 'MCQ detail and past-paper actions have static API regions');
check(runtime.includes("AUTO_TEST_START_LINK:UI.link('test/auto'"), 'automatic test start action is preserved in static rendering');
check(runtime.includes("setMarkup('jobs-pagination'"), 'latest-jobs pagination mounts into the dedicated region');
check(runtime.includes('const showCountryEntry=()=>'), 'login and signup use a dedicated static country-entry shell');
check(runtime.includes("filter(item=>item&&item.active!==false&&String(item.name||'').trim())"), 'country-entry cards use active country settings');
check(html.includes('id="mcq-country-entry-card-template"'), 'country-entry cards have a reusable hard-coded HTML template');
check(html.includes('data-auth-error'), 'static authentication forms provide inline error targets');
check(html.includes('name="confirm"') && html.includes('name="terms" required'), 'static signup form confirms passwords and requires terms acceptance');
check(runtime.includes("search:'mcqs',mcq:'mcqs',practice:'mcqs'"), 'search and individual MCQ routes map into the static MCQ shell');
check(html.includes('data-api-region="home-important-count"'), 'the hard-coded home includes an MCQ count region');
check(runtime.indexOf("const fill=(name,selector") < runtime.indexOf("fill('breadcrumbs','.breadcrumbs',sourceMain)"), 'static region helpers are initialized before use');
check(runtime.includes('form[data-form="search"] input[name="q"]'), 'static MCQ and search shells use the shared search interaction');
check(runtime.includes("document.getElementById('mcq-layout-template')"), 'static fallback uses the shared HTML layout template');
check(runtime.includes('layoutTemplate.content.cloneNode(true)'), 'layout is cloned from the HTML template rather than rebuilt as a page string');
check(runtime.includes("root.replaceChildren(this.staticPageNode(shell,page))"), 'static and API-backed pages mount through DOM replacement');
check(runtime.includes("comment.replaceWith(shell)"), 'the hard-coded page shell is inserted into the layout body slot');
check(!runtime.includes('root.innerHTML=this.staticPageMarkup(shell,page)'), 'legacy whole-page string mounting is removed');
check(runtime.includes("window.MCQCampusBackendReady===false"), 'static fallback remains visible when API bootstrap fails');
check(runtime.includes("else window.App?.showStaticShell?.()"), 'static shells are shown before the initial API bootstrap');

if (failed) process.exit(1);
