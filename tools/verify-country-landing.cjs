// Regression checks for the public, unauthenticated country landing page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'frontend/assets/js/public.js'), 'utf8');
const start = source.indexOf(' function countryLanding(){');
const end = source.indexOf(' function home(){', start);
assert(start >= 0 && end > start, 'countryLanding function boundaries should exist');

const landingSource = source.slice(start, end);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const UI = {
  href: (route, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return '/' + route + (query ? '?' + query : '');
  },
  countryFlag: name => ({ Pakistan: '🇵🇰', India: '🇮🇳', 'United States': '🇺🇸' }[name] || '🌐')
};
const icon = name => '<svg data-icon="' + escapeHtml(name) + '"></svg>';
const link = (route, label, className = '') =>
  '<a class="' + escapeHtml(className) + '" href="/' + escapeHtml(route) + '">' + label + '</a>';
const makeLanding = new Function('MCQ', 'UI', 'e', 'icon', 'link', landingSource + '; return countryLanding;');

const html = makeLanding({
  db: {
    countries: [
      { name: 'United States', active: true, mcqCount: 75 },
      { name: 'India', active: true, mcqCount: 250 },
      { name: 'Disabled Country', active: false, mcqCount: 12 },
      { name: 'Pakistan', active: true, mcqCount: 125 }
    ],
    totalApprovedMcqs: 450
  }
}, UI, escapeHtml, icon, link)();

assert(html.indexOf('>United States</h2>') < html.indexOf('>India</h2>'), 'configured country order should be preserved');
assert(html.indexOf('>India</h2>') < html.indexOf('>Pakistan</h2>'), 'configured country order should be preserved');
assert(html.includes('450'), 'global approved MCQ total should be visible');
assert(html.includes('3 countries available'), 'only active countries should be counted');
assert(html.includes('75'), 'country-level MCQ counts should be visible');
assert(html.includes('/register?country=United+States'), 'country card should select the matching signup country');
assert(!html.includes('Disabled Country'), 'inactive country cards should not be rendered');

const fallback = makeLanding({ db: { countries: [], totalApprovedMcqs: 0 } }, UI, escapeHtml, icon, link)();
assert(fallback.includes('>Pakistan</h2>'), 'Pakistan should remain as a safe fallback if no country list is available');
assert(fallback.includes('1 country available'), 'fallback country count should be accurate');

console.log('PASS configured country order, active-country filtering, counts, signup URLs, and fallback behavior');
