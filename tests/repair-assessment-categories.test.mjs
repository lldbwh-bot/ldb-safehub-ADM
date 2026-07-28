import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(root, 'src', 'repairAssessmentCategories.ts');
const componentPath = path.join(root, 'src', 'components', 'RepairAssessmentView.tsx');
const masterPath = path.join(root, 'src', 'repairMappingMasterData.json');
const tempBundle = path.join(root, 'tests', '.repair-assessment-categories.bundle.mjs');

const AIR_FAN = 'ລະບົບ ແອເຟັນ';
const LEGACY_AIR_CONDITIONER = 'ລະບົບເຄື່ອງປັບອາກາດ';
const WATER_AND_SANITARY = 'ລະບົບນໍ້າປະປາ & ສຸຂະພັນ';
const LEGACY_WATER = 'ລະບົບນ້ຳປະປາ ແລະ ສຸຂະພັນ';

assert.ok(fs.existsSync(helperPath), 'src/repairAssessmentCategories.ts must exist');

await build({
  entryPoints: [helperPath],
  outfile: tempBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

try {
  const categories = await import(`${pathToFileURL(tempBundle).href}?t=${Date.now()}`);
  const masterPresets = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  const options = categories.getRepairSubCategoryOptions(masterPresets);
  const expected = [...new Set(masterPresets.map(item => item.repairSubCategory))];

  assert.deepEqual(options, expected);
  assert.equal(options.length, 9);
  assert.equal(options[0], AIR_FAN);
  assert.ok(!options.includes(LEGACY_AIR_CONDITIONER));
  assert.equal(categories.normalizeRepairSubCategory(LEGACY_AIR_CONDITIONER), AIR_FAN);
  assert.equal(categories.normalizeRepairSubCategory(LEGACY_WATER), WATER_AND_SANITARY);

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  assert.match(componentSource, /getRepairSubCategoryOptions\(masterPresets\)/);
  assert.match(componentSource, /repairCategoryOptions\.map/);
  assert.doesNotMatch(
    componentSource,
    new RegExp(`<option value="${LEGACY_AIR_CONDITIONER}"`),
  );

  console.log('Repair Assessment category master checks passed.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
