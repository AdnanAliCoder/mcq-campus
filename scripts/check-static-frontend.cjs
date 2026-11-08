'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('frontend/index.html');
const css = read('frontend/style.css');
const runtime = read('frontend/script.js');
const nginx = read('deploy/nginx/mcqcampus-frontend-locations.conf');
const manifest = JSON.parse(read('frontend/site.webmanifest'));

let failed = false;
function check(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    failed = true;
  } else {
    console.log('OK:', message);
  }
}

check(html.toLowerCase().includes('<!doctype html>'), 'entry document uses standards mode');
check((html.match(/rel="stylesheet"/g) || []).length === 1, 'entry document loads exactly one stylesheet');
check(/href="\/assets\/style\.css(?:\?[^"]*)?"/.test(html), 'entry document loads the unified stylesheet');
check((html.match(/<script\b[^>]*src="\/assets\/script\.js(?:\?[^"]*)?"[^>]*>/g) || []).length === 1, 'entry document loads exactly one first-party runtime');
check(!html.includes('/assets/js/'), 'entry document does not request removed split JavaScript assets');
check(fs.existsSync(path.join(frontend, 'style.css')), 'unified stylesheet exists');
check(fs.existsSync(path.join(frontend, 'script.js')), 'unified runtime exists');

const expectedPages = [
  'home', 'categories', 'past-papers', 'tests', 'pdfs', 'blog', 'login',
  'register', 'forgot', 'reset-code', 'reset-password', 'verify', 'sitemap',
  'not-found', 'dashboard', 'admin', 'super-admin', 'about', 'contact', 'mcq-levels',
];
const pageShells = [...html.matchAll(/<section\s+data-static-page="([^"]+)"/g)].map(match => match[1]);
check(expectedPages.every(page => pageShells.includes(page)), 'all current static page shells exist');
check(pageShells.length === expectedPages.length, 'each current static page shell appears exactly once');
check(new Set(pageShells).size === pageShells.length, 'static page shell identifiers are unique');

for (const page of expectedPages) {
  const start = html.indexOf('data-static-page="' + page + '"');
  const next = html.indexOf('data-static-page="', start + 1);
  const shell = html.slice(start, next < 0 ? html.length : next);
  check(/<main\b/.test(shell), 'static shell has a semantic main region: ' + page);
  if (page !== 'not-found') {
    check(/<h1\b/.test(shell), 'static shell has a primary heading: ' + page);
  }
}

const requiredTemplates = [
  'mcq-layout-template', 'mcq-header-template', 'mcq-footer-template',
  'mcq-home-template', 'mcq-question-card-template', 'mcq-question-option-template',
  'mcq-auth-layout-template', 'mcq-learner-dashboard-template',
  'mcq-admin-layout-template', 'mcq-level-card-template',
  'mcq-blog-detail-template', 'mcq-legal-content-template', 'mcq-faq-content-template',
];
for (const id of requiredTemplates) {
  check(html.includes('id="' + id + '"'), 'reusable template exists: ' + id);
}

const requiredRegions = [
  'home-stats', 'home-categories', 'levels-regular', 'levels-important',
  'category-context', 'category-list', 'mcq-summary', 'mcq-list', 'mcq-pagination',
  'paper-context', 'organization-list', 'past-paper-list', 'past-paper-pagination',
  'test-list', 'pdf-list', 'blog-filters', 'blog-list', 'auth-form',
  'sitemap-content', 'not-found-links', 'learner-dashboard', 'admin-workspace',
  'super-admin-workspace', 'about-content', 'contact-form',
];
for (const region of requiredRegions) {
  check(html.includes('data-api-region="' + region + '"'), 'static API region exists: ' + region);
}

const requiredMarkers = [
  'frontend/js/admin-loader.js', 'frontend/js/integrations.js',
  'frontend/js/modules/service.js', 'frontend/js/modules/ui.js',
  'frontend/js/modules/public-layout.js', 'frontend/js/modules/public.js',
  'frontend/js/modules/carousel.js', 'frontend/js/modules/seo.js',
  'frontend/js/modules/motion.js', 'frontend/js/modules/auth.js',
  'frontend/js/admin/importer.js', 'frontend/js/admin/enhancements.js',
  'frontend/js/pages/about.js', 'frontend/js/pages/admin.js',
  'frontend/js/pages/blog.js', 'frontend/js/pages/categories.js',
  'frontend/js/pages/contact.js', 'frontend/js/pages/dashboard.js',
  'frontend/js/pages/home.js', 'frontend/js/pages/latest-jobs.js',
  'frontend/js/pages/login.js', 'frontend/js/pages/mcqs.js',
  'frontend/js/pages/past-papers.js', 'frontend/js/pages/pdfs.js',
  'frontend/js/pages/register.js', 'frontend/js/pages/super-admin.js',
  'frontend/js/pages/tests.js', 'frontend/js/app.js', 'frontend/js/admin/admin.js',
];
for (const modulePath of requiredMarkers) {
  check(runtime.includes('/* SOURCE: ' + modulePath + ' */'), 'bundled source is present: ' + modulePath);
}
check(!runtime.includes('/assets/js/admin/'), 'runtime does not load deleted split admin assets');
check(runtime.includes('mountDataDrivenPage(base,id){'), 'data-driven route renderer is present');
check(runtime.includes('staticTemplateFragment(id,slots={})'), 'runtime clones reusable HTML templates');
check(runtime.includes('mountStaticPage(base,renderedHtml){'), 'runtime mounts API content into static page shells');
check(runtime.includes('window.MCQCampusBackendReady===false'), 'static fallback remains available when API bootstrap fails');
check(runtime.includes('window.MCQLevels?.init?.()'), 'MCQ level progress is initialized');
check(runtime.includes('window.MCQCampusLoadBundledModule'), 'bundled module loader is present');

check(nginx.includes('location = /assets/style.css'), 'Nginx maps the unified stylesheet');
check(nginx.includes('alias /home/ubuntu/mcq-campus/frontend/style.css;'), 'Nginx stylesheet alias points to the unified file');
check(nginx.includes('location = /assets/script.js'), 'Nginx maps the unified runtime');
check(nginx.includes('alias /home/ubuntu/mcq-campus/frontend/script.js;'), 'Nginx runtime alias points to the unified file');
check(nginx.includes('location ^~ /api/'), 'Nginx proxies API requests separately');

for (const icon of manifest.icons || []) {
  const localPath = String(icon.src || '').split('?')[0].replace(/^\//, '');
  check(Boolean(localPath) && fs.existsSync(path.join(frontend, localPath.replace(/^assets\//, 'assets/'))), 'web manifest icon exists: ' + localPath);
}
check(fs.existsSync(path.join(frontend, 'sw.js')), 'service worker compatibility file exists');
check(read('frontend/sw.js').includes('self.registration.unregister()'), 'legacy service worker registrations are retired');

const syntax = spawnSync(process.execPath, ['--check', path.join(frontend, 'script.js')], { encoding: 'utf8' });
if (syntax.status !== 0) {
  console.error('FAIL: unified frontend runtime syntax check');
  if (syntax.stderr) process.stderr.write(syntax.stderr);
  failed = true;
} else {
  console.log('OK: unified frontend runtime syntax check');
}

if (failed) process.exit(1);
