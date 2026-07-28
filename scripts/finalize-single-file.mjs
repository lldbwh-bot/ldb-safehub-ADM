import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tempDir = path.join(root, '.single-file-temp');
const sourceHtmlPath = path.join(tempDir, 'standalone.html');
const releaseDir = path.join(root, 'release');
const releasePath = path.join(releaseDir, 'LDB-SafeHub.html');

let html = fs.readFileSync(sourceHtmlPath, 'utf8');
const scriptTag = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleTag = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

if (!scriptTag || !styleTag) {
  throw new Error('Vite output is missing the expected JavaScript or stylesheet asset tag.');
}

const readAsset = assetUrl => {
  const relativePath = assetUrl.replace(/^\.\//, '').replace(/^\//, '');
  return fs.readFileSync(path.join(tempDir, relativePath), 'utf8');
};

const javascript = readAsset(scriptTag[1]);
const stylesheet = readAsset(styleTag[1]);
html = html.replace(styleTag[0], () => `<style>\n${stylesheet}\n</style>`);
html = html.replace(scriptTag[0], () => `<script type="module">\n${javascript}\n</script>`);

fs.rmSync(releaseDir, {recursive: true, force: true});
fs.mkdirSync(releaseDir, {recursive: true});
fs.writeFileSync(releasePath, html, 'utf8');
fs.rmSync(tempDir, {recursive: true, force: true});

console.log(`Created ${releasePath} (${fs.statSync(releasePath).size} bytes).`);
