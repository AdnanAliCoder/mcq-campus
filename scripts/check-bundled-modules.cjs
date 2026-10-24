'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(root, 'frontend', 'script.js');
const requiredModules = [
  'frontend/js/modules/service.js',
  'frontend/js/modules/ui.js',
  'frontend/js/modules/public-layout.js',
  'frontend/js/modules/public.js',
  'frontend/js/modules/seo.js',
  'frontend/js/modules/auth.js',
  'frontend/js/admin/importer.js',
  'frontend/js/admin/admin.js',
];

let failed = false;
if (!fs.existsSync(scriptPath)) {
  console.error('Missing unified frontend runtime: frontend/script.js');
  process.exit(1);
}

const script = fs.readFileSync(scriptPath, 'utf8');
if (script.includes('/assets/js/admin/')) {
  console.error('Legacy split admin asset loader remains in the unified script.');
  process.exit(1);
}
console.log('No requests to deleted split admin JavaScript assets.');
const syntax = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
if (syntax.status !== 0) {
  console.error('Syntax check failed: frontend/script.js');
  if (syntax.stderr) process.stderr.write(syntax.stderr);
  failed = true;
} else {
  console.log('Syntax OK: frontend/script.js');
}

for (const modulePath of requiredModules) {
  const marker = 'SOURCE: ' + modulePath + ' */';
  if (!script.includes(marker)) {
    console.error('Missing bundled module marker:', modulePath);
    failed = true;
  } else {
    console.log('Bundled module present:', modulePath);
  }
}

if (failed) process.exit(1);
