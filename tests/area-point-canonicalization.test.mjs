import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.area-point-canonicalization-'));
const dataStoreBundle = join(temporaryDirectory, 'dataStore.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/dataStore.ts')],
  outfile: dataStoreBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
});

try {
  const dataStore = await import(pathToFileURL(dataStoreBundle).href);
  const legacy = 'ຫ້ອງສາງເຄື່ື່ອງຊັ້ນ 4 ຂອງ ຝ່າຍບັນຊີ';
  const canonical = 'ຫ້ອງສາງເຄື່ອງຊັ້ນ4ຂອງຝ່າຍບັນຊີ';

  assert.equal(
    dataStore.canonicalizeAreaPointLabel(legacy),
    canonical,
    'the exact legacy Area/Point label is converted to the canonical label',
  );
  assert.equal(
    dataStore.canonicalizeAreaPointLabel('ຫ້ອງປະຊຸມ'),
    'ຫ້ອງປະຊຸມ',
    'unrelated labels remain unchanged',
  );

  const originalRecord = {
    PID: 'KEEP-ID',
    ໝວດລະບົບກວດ: legacy,
    nested: [{ subsystemCategory: legacy, status: 'KEEP-STATUS' }],
  };
  const migratedRecord = dataStore.canonicalizeAreaPointData(originalRecord);
  assert.deepEqual(migratedRecord, {
    PID: 'KEEP-ID',
    ໝວດລະບົບກວດ: canonical,
    nested: [{ subsystemCategory: canonical, status: 'KEEP-STATUS' }],
  });
  assert.equal(
    originalRecord.ໝວດລະບົບກວດ,
    legacy,
    'canonicalization does not mutate the original transaction record',
  );

  const masterCategories = dataStore.APPSHEET_MAPPING.map(item => item.ໝວດລະບົບກວດ);
  assert.equal(
    masterCategories.includes(canonical),
    true,
    'the static Master Data exposes the corrected Area/Point label',
  );
  assert.equal(
    masterCategories.includes(legacy),
    false,
    'the static Master Data no longer exposes the legacy label',
  );

  const untouchedSerializedValue = JSON.stringify([{ PID: 'UNRELATED', value: 'KEEP-BYTES' }]);
  localStorage.setItem('ldb_local_inspections', JSON.stringify([
    { inspectionId: 'INS-KEEP', areaPoint: legacy, status: 'OPEN' },
  ]));
  localStorage.setItem('ldb_pm_assets', JSON.stringify([
    { pmAssetId: 'PM-KEEP', subsystemCategory: legacy, active: true },
  ]));
  localStorage.setItem('ldb_local_incidents', untouchedSerializedValue);

  assert.equal(
    dataStore.migrateLegacyAreaPointStorage(),
    2,
    'only stores containing the exact legacy label are rewritten',
  );
  assert.deepEqual(JSON.parse(localStorage.getItem('ldb_local_inspections')), [
    { inspectionId: 'INS-KEEP', areaPoint: canonical, status: 'OPEN' },
  ]);
  assert.deepEqual(JSON.parse(localStorage.getItem('ldb_pm_assets')), [
    { pmAssetId: 'PM-KEEP', subsystemCategory: canonical, active: true },
  ]);
  assert.equal(
    localStorage.getItem('ldb_local_incidents'),
    untouchedSerializedValue,
    'unrelated browser data remains byte-for-byte unchanged',
  );

  console.log('Area/Point canonicalization and storage migration checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
