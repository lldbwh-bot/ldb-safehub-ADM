import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.equal(
  typeof packageJson.scripts?.['build:single'],
  'string',
  'package.json must define build:single',
);

const build = spawnSync('npm run build:single', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
});

assert.equal(
  build.status,
  0,
  `single-file build failed:\n${build.stdout}\n${build.stderr}`,
);

const releaseDir = path.join(root, 'release');
const releaseEntries = fs.readdirSync(releaseDir, {withFileTypes: true});
assert.deepEqual(releaseEntries.map(entry => entry.name), ['LDB-SafeHub.html']);
assert.equal(releaseEntries[0].isFile(), true);

const html = fs.readFileSync(path.join(releaseDir, 'LDB-SafeHub.html'), 'utf8');
assert.match(html, /<div id="root"><\/div>/);
assert.match(html, /<script type="module">[\s\S]+<\/script>/);
assert.match(html, /<style>[\s\S]+<\/style>/);
assert.match(html, /data:image\/(?:jpeg|png);base64,/);
assert.doesNotMatch(html, /window\.location\.replace/);
assert.doesNotMatch(html, /http:\/\/127\.0\.0\.1:3000/);
assert.doesNotMatch(html, /<script[^>]+src=/);
assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
assert.doesNotMatch(html, /(?:src|href)="\/?assets\//);
assert.doesNotMatch(html, /src="\/src\/main\.tsx"/);

console.log(`Single-file preview test passed (${html.length} characters).`);
