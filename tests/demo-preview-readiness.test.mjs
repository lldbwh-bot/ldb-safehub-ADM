import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.demo-preview-'));
const apiBundle = join(temporaryDirectory, 'apiClient.mjs');
const storeBundle = join(temporaryDirectory, 'dataStore.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/apiClient.ts')],
  outfile: apiBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

await build({
  entryPoints: [join(process.cwd(), 'src/dataStore.ts')],
  outfile: storeBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom', 'lucide-react'],
  loader: { '.json': 'json' },
  logLevel: 'silent',
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://demo.ldb-adm-safehub.com/',
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
});

try {
  localStorage.clear();
  localStorage.setItem('ldb_base_data_cleared', 'true');
  localStorage.setItem('ldb_users', '[]');
  localStorage.setItem('ldb_branches', '[]');
  localStorage.setItem('ldb_checklist_items_v10', '[]');
  localStorage.setItem('ldb_sectors', '[]');
  localStorage.setItem('ldb_repair_presets_v3', '[]');

  const api = await import(pathToFileURL(apiBundle).href + '?t=' + Date.now());
  const store = await import(pathToFileURL(storeBundle).href + '?t=' + Date.now());

  assert.equal(api.isCentralApiAvailable(), false, 'Demo/UAT must remain browser-local and not call the production API');
  assert.equal(api.isDemoPreviewHost('demo.ldb-adm-safehub.com'), true, 'Demo/UAT host must be detected explicitly');

  const users = store.getSavedUsers();
  const branches = store.getSavedBranches();
  const checklistItems = store.getSavedChecklistItems();
  const sectors = store.getSavedSectors();
  const repairPresets = store.getSavedRepairPresets();
  const pmAssets = store.getSavedPMAssets();

  assert.ok(users.length >= 3, 'Demo/UAT must provide trial user accounts');
  assert.ok(users.some((user) => user.username === 'demo_admin'), 'Demo/UAT includes an admin trial user');
  assert.ok(users.some((user) => user.status !== 'Admin'), 'Demo/UAT includes branch trial users');
  assert.ok(branches.length > 10, 'Demo/UAT branch master must be populated');
  assert.ok(checklistItems.length > 10, 'Demo/UAT inspection checklist master must be populated');
  assert.ok(sectors.length > 0, 'Demo/UAT sector master must be populated');
  assert.ok(repairPresets.length > 10, 'Demo/UAT repair mapping master must be populated');
  assert.ok(pmAssets.length >= 3, 'Demo/UAT must include sample PM assets so trial users can test the PM function');

  store.savePMAssets([]);
  assert.deepEqual(store.getSavedPMAssets(), [], 'Demo/UAT user deletion of PM assets must persist after bootstrap');

  console.log('Demo/UAT preview readiness checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
