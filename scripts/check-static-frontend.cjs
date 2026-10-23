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
  'latest-jobs', 'login', 'register', 'dashboard', 'admin', 'super-admin',
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
check(nginx.includes('try_files $uri $uri.html /index.html;'), 'deep browser routes have an SPA fallback');

if (failed) process.exit(1);
