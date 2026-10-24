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
  'about', 'contact',
];
const requiredTemplates = [
  'mcq-layout-template', 'mcq-header-template', 'mcq-footer-template',
  'mcq-home-template', 'mcq-auth-layout-template',
  'mcq-learner-dashboard-template', 'mcq-admin-layout-template',
  'mcq-question-card-template', 'mcq-country-landing-template',
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

const shellMarkers = [...html.matchAll(/data-static-page="([^"]+)"/g)];
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
};
for (const [page, regions] of Object.entries(requiredRegionsByPage)) {
  const shell = pageShells.find(match => match[1] === page)?.[2] || '';
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
check(runtime.includes('staticPageMarkup(shell,page){'), 'a single shared layout wraps static page shells');
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
check(runtime.includes("if(!page||['dashboard','admin','super-admin'].includes(page))return false;"), 'private dashboard and admin routes stay behind session-aware rendering');
check(runtime.includes('mountStaticPage(base,renderedHtml){'), 'API-backed route content mounts into hard-coded page shells');
check(runtime.includes("search:'mcqs',mcq:'mcqs',practice:'mcqs'"), 'search and individual MCQ routes map into the static MCQ shell');
check(html.includes('data-api-region="home-important-count"'), 'the hard-coded home includes an MCQ count region');
check(runtime.indexOf("const fill=(name,selector") < runtime.indexOf("fill('breadcrumbs','.breadcrumbs',sourceMain)"), 'static region helpers are initialized before use');
check(runtime.includes('form[data-form="mcq-filter"]'), 'the static MCQ search form has an interaction handler');
check(runtime.includes('window.UI?.layout?.(shell.outerHTML,page)'), 'static fallback includes the shared header/footer through one layout template');
check(runtime.includes("window.MCQCampusBackendReady===false"), 'static fallback remains visible when API bootstrap fails');
check(runtime.includes("else window.App?.showStaticShell?.()"), 'static shells are shown before the initial API bootstrap');

if (failed) process.exit(1);
