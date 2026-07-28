import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(root, 'src', 'repairAssessmentWorkTypes.ts');
const componentPath = path.join(root, 'src', 'components', 'RepairAssessmentView.tsx');
const tempBundle = path.join(root, 'tests', '.repair-assessment-work-types.bundle.mjs');

assert.ok(fs.existsSync(helperPath), 'src/repairAssessmentWorkTypes.ts must exist');

await build({
  entryPoints: [helperPath],
  outfile: tempBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

try {
  const workTypes = await import(`${pathToFileURL(tempBundle).href}?t=${Date.now()}`);

  assert.deepEqual(workTypes.REPAIR_ASSESSMENT_WORK_TYPES, [
    'ກວດເຊັກ-ສ້ອມ',
    'ປ່ຽນອະໄຫຼ່',
    'ບໍລິການ',
  ]);
  assert.equal(workTypes.normalizeRepairAssessmentWorkType('ສ້ອມ'), 'ກວດເຊັກ-ສ້ອມ');
  assert.equal(workTypes.normalizeRepairAssessmentWorkType('ປ່ຽນ'), 'ປ່ຽນອະໄຫຼ່');
  assert.equal(workTypes.normalizeRepairAssessmentWorkType('ປັບປຸງ'), 'ກວດເຊັກ-ສ້ອມ');
  assert.equal(workTypes.normalizeRepairAssessmentWorkType('ກວດເຊັກ'), 'ກວດເຊັກ-ສ້ອມ');
  assert.equal(workTypes.normalizeRepairAssessmentWorkType('ກວດເຊັກ/ສ້ອມ'), 'ກວດເຊັກ-ສ້ອມ');

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  assert.match(componentSource, /REPAIR_ASSESSMENT_WORK_TYPES\.map/);
  for (const removed of ['ສ້ອມ', 'ປ່ຽນ', 'ປັບປຸງ', 'ກວດເຊັກ', 'ກວດເຊັກ/ສ້ອມ']) {
    assert.doesNotMatch(componentSource, new RegExp(`<option value="${removed}"`));
  }

  console.log('Repair Assessment work-type checks passed.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
