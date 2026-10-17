// Regression checks for the public, unauthenticated country landing page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'frontend/assets/js/public.js'), 'utf8');
const start = source.indexOf(' function countryLanding(');
const end = source.indexOf(' function home(){', start);
assert(start >= 0 && end > start, 'countryLanding function boundaries should exist');

const landingSource = source.slice(start, end);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const UI = {
  assetUrl: path => path,
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

const loginHtml = makeLanding({
  db: {
    countries: [
      { name: 'Pakistan', active: true, mcqCount: 125 },
      { name: 'United States', active: true, mcqCount: 75 }
    ],
    totalApprovedMcqs: 200
  }
}, UI, escapeHtml, icon, link)('login');
assert(loginHtml.includes('/login?country=Pakistan'), 'login entry must preserve the selected country');
assert(loginHtml.includes('Sign in'), 'login country cards should state the intended action');

const app = fs.readFileSync(path.join(root, 'frontend/assets/js/app.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'frontend/assets/js/auth.js'), 'utf8');
const middleware = fs.readFileSync(path.join(root, 'core/middleware.py'), 'utf8');
const urls = fs.readFileSync(path.join(root, 'core/urls.py'), 'utf8');
const views = fs.readFileSync(path.join(root, 'core/views.py'), 'utf8');
const geolocation = fs.readFileSync(path.join(root, 'core/geolocation.py'), 'utf8');

assert(app.includes("else if(base==='home')html=Public.home();"), 'homepage must render the public country dashboard');
assert(!app.includes("Auth.user?Public.home():Public.countryLanding()"), 'homepage must not be replaced by the auth country chooser');
assert(auth.includes('return Public.countryLanding(type);'), 'country chooser should be part of login/register entry');
assert(auth.includes("endpoint=user?'/bootstrap':'/public/bootstrap';"), 'guest route loading must use the public bootstrap');
assert(urls.includes("path('public/bootstrap',views.public_bootstrap)"), 'public bootstrap URL must be registered');
assert(middleware.includes("'/api/public/bootstrap'"), 'anonymous visitors must be allowed to load public bootstrap');
assert(views.includes("data['detectedCountry']=selected_country"), 'startup should return the detected country');
const services = fs.readFileSync(path.join(root, 'core/services.py'), 'utf8');
assert(services.includes("data['settings']={'country':country,'mcqEntryCountry':country}"), 'guest bootstrap must align the frontend dashboard with its selected country');
assert(views.includes('visitor_country_code(request)'), 'country routing must consult visitor country detection');
assert(geolocation.includes('HTTP_CF_IPCOUNTRY') && geolocation.includes('HTTP_CLOUDFRONT_VIEWER_COUNTRY'), 'supported CDN country headers must be recognized');
assert(geolocation.includes('mcqcampus:ip-country:v1:'), 'country lookups must cache country under a hashed IP key');
assert(geolocation.includes('MCQCAMPUS_GEOLOOKUP_ENABLED'), 'external IP lookup must be configurable');

console.log('PASS country chooser, public homepage, IP country routing, auth entry and public-bootstrap regression checks');
