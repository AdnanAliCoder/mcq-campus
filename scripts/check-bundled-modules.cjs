'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appPath = path.resolve(__dirname, '..', 'frontend', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');
const marker = 'const sources = Object.freeze(';
const markerIndex = source.indexOf(marker);

if (markerIndex < 0) {
  console.error('Could not find the embedded source map in frontend/app.js.');
  process.exit(1);
}

const objectStart = source.indexOf('{', markerIndex + marker.length);
if (objectStart < 0) {
  console.error('Could not locate the embedded source map object.');
  process.exit(1);
}

// The bundled module map is JSON. Walk braces while respecting escaped quotes.
let depth = 0;
let inString = false;
let escaped = false;
let objectEnd = -1;

for (let i = objectStart; i < source.length; i += 1) {
  const character = source[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '"') inString = false;
    continue;
  }
  if (character === '"') inString = true;
  else if (character === '{') depth += 1;
  else if (character === '}') {
    depth -= 1;
    if (depth === 0) {
      objectEnd = i + 1;
      break;
    }
  }
}

if (objectEnd < 0) {
  console.error('Could not find the end of the embedded source map.');
  process.exit(1);
}

let modules;
try {
  modules = JSON.parse(source.slice(objectStart, objectEnd));
} catch (error) {
  console.error('The embedded source map is invalid JSON:', error.message);
  process.exit(1);
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcqcampus-js-check-'));
let failed = false;

try {
  for (const [moduleName, moduleSource] of Object.entries(modules)) {
    const safeName = moduleName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const modulePath = path.join(temporaryDirectory, safeName);
    fs.writeFileSync(modulePath, moduleSource, 'utf8');

    const result = spawnSync(process.execPath, ['--check', modulePath], {
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      failed = true;
      console.error('Syntax check failed for embedded module:', moduleName);
      if (result.stdout) process.stderr.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    } else {
      console.log('Syntax OK:', moduleName);
    }
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (failed) process.exit(1);
