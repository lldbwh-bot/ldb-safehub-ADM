import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.pm-assets-'));
const bundle = join(temporaryDirectory, 'dataStore.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/dataStore.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom', 'lucide-react'],
  loader: { '.json': 'json' },
  logLevel: 'silent',
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://ldb-adm-safehub.com/',
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
});

try {
  localStorage.clear();
  const { getSavedPMAssets, savePMAssets } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());

  assert.deepEqual(
    getSavedPMAssets(),
    [],
    'PM Assets must start empty when no saved production/UAT data exists',
  );
  assert.equal(
    localStorage.getItem('ldb_pm_assets'),
    null,
    'PM Assets must not reseed sample/default rows into localStorage',
  );

  const saved = [{
    assetCode: 'PM-NEW-001',
    assetName: 'ຊັບສິນໃໝ່',
    assetGroup: 'OTHER',
    branch: '00.ສໍານັກງານໃຫຍ່',
    division: '00.ສໍານັກງານໃຫຍ່',
    sector: 'none',
    systemCategory: 'ດ້ານນອກອາຄານ',
    areaPoint: 'ສະຖານທີ່ຈອດລົດ',
    maintenanceCycle: '1 ເດືອນ',
    lastMaintenanceDate: '2026-07-01',
    nextMaintenanceDate: '2026-08-01',
    alertBeforeDays: 5,
    maintenanceStatus: 'ປົກກະຕິ',
    responsiblePerson: 'Admin',
    vendor: '',
  }];
  savePMAssets(saved);
  assert.equal(
    getSavedPMAssets()[0]?.assetCode,
    'PM-NEW-001',
    'New PM Asset records remain readable after saving',
  );

  savePMAssets([]);
  assert.deepEqual(
    getSavedPMAssets(),
    [],
    'Deleting all PM Assets must persist as an empty list instead of restoring defaults',
  );

  console.log('PM asset empty-default and delete persistence checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
