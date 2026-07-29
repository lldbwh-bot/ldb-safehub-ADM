import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.date-time-format-'));
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
  const pmSource = await readFile(
    join(process.cwd(), 'src/components/PreventiveMaintenanceView.tsx'),
    'utf8',
  );
  const dashboardSource = await readFile(
    join(process.cwd(), 'src/components/DashboardView.tsx'),
    'utf8',
  );
  const {
    formatDateSafe,
    formatExcelDate,
    formatTimeSafe,
    formatDateTimeSafe,
  } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());

  const date = new Date(2026, 6, 29, 8, 5, 9);

  assert.equal(
    formatDateSafe(date),
    '29/07/2026',
    'System display dates must use dd/mm/yyyy English/world format',
  );
  assert.equal(
    formatExcelDate('2026-07-29'),
    '29/07/2026',
    'Export/display date formatter must normalize ISO dates to dd/mm/yyyy',
  );
  assert.equal(
    formatExcelDate('29/07/2026'),
    '29/07/2026',
    'Existing dd/mm/yyyy dates must stay dd/mm/yyyy',
  );
  assert.equal(
    formatExcelDate('29/07/26'),
    '29/07/2026',
    'Existing dd/mm/yy dates must expand to dd/mm/yyyy',
  );
  assert.equal(
    formatTimeSafe(date),
    '08:05:09',
    'System times must use English/world 24-hour format',
  );
  assert.equal(
    formatDateTimeSafe(date),
    '29/07/2026 08:05:09',
    'Combined timestamps must use dd/mm/yyyy plus 24-hour English/world time',
  );
  assert.match(
    pmSource,
    /formatExcelDate\(asset\.lastMaintenanceDate\)/,
    'PM asset table must display Last PM Date through the regional date formatter',
  );
  assert.match(
    pmSource,
    /formatExcelDate\(asset\.nextMaintenanceDate\)/,
    'PM asset table must display Next PM Date through the regional date formatter',
  );
  assert.match(
    dashboardSource,
    /formatExcelDate\(asset\.nextMaintenanceDate\)/,
    'Dashboard PM due table must display Next PM Date through the regional date formatter',
  );

  console.log('Date/time regional format checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
