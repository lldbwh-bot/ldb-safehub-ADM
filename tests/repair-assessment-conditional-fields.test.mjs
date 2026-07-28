import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(root, 'src', 'repairAssessmentMode.ts');
const componentPath = path.join(root, 'src', 'components', 'RepairAssessmentView.tsx');
const typesPath = path.join(root, 'src', 'types.ts');
const tempBundle = path.join(root, 'tests', '.repair-assessment-conditional-fields.bundle.mjs');

assert.ok(fs.existsSync(helperPath), 'src/repairAssessmentMode.ts must exist');

await build({
  entryPoints: [helperPath],
  outfile: tempBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

try {
  const mode = await import(`${pathToFileURL(tempBundle).href}?t=${Date.now()}`);

  assert.equal(mode.isAssessmentLevelRepairerVisible(true), true);
  assert.equal(mode.isAssessmentLevelRepairerVisible(false), false);
  assert.equal(mode.isSubItemRepairerAuthoritative(true), false);
  assert.equal(mode.isSubItemRepairerAuthoritative(false), true);

  assert.deepEqual(
    mode.switchAssessmentMode({
      noAssessmentRequired: true,
      assessorType: '',
      minorTaskRepairerName: '',
      vendorName: 'stale vendor',
      subItems: [{ id: 'sub-1' }],
    }),
    {
      noAssessmentRequired: true,
      assessorType: 'ຊ່າງພາຍໃນ',
      minorTaskRepairerName: '',
      vendorName: '',
      subItems: [],
    },
  );

  assert.deepEqual(
    mode.switchAssessmentMode({
      noAssessmentRequired: false,
      assessorType: 'Vendor',
      minorTaskRepairerName: 'Unsaved Vendor',
      vendorName: 'Unsaved Vendor',
      subItems: [],
    }),
    {
      noAssessmentRequired: false,
      assessorType: '',
      minorTaskRepairerName: '',
      vendorName: '',
      subItems: [],
    },
  );

  assert.match(
    mode.validateAssessmentLevelRepairer({
      noAssessmentRequired: true,
      assessorType: '',
      minorTaskRepairerName: '',
    }),
    /ປະເພດຜູ້ສ້ອມ/,
  );
  assert.match(
    mode.validateAssessmentLevelRepairer({
      noAssessmentRequired: true,
      assessorType: 'ຊ່າງພາຍໃນ',
      minorTaskRepairerName: '',
    }),
    /ຊື່ພະນັກງານ/,
  );
  assert.match(
    mode.validateAssessmentLevelRepairer({
      noAssessmentRequired: true,
      assessorType: 'Vendor',
      minorTaskRepairerName: '',
    }),
    /Vendor/,
  );
  assert.equal(
    mode.validateAssessmentLevelRepairer({
      noAssessmentRequired: false,
      assessorType: '',
      minorTaskRepairerName: '',
    }),
    null,
  );

  assert.deepEqual(
    mode.normalizeAssessmentRepairerForSave({
      noAssessmentRequired: true,
      assessorType: 'Vendor',
      minorTaskRepairerName: 'LDB Service',
      vendorName: 'old value',
      subItems: [{ id: 'sub-1' }],
    }),
    {
      assessorType: 'Vendor',
      minorTaskRepairerName: 'LDB Service',
      vendorName: 'LDB Service',
      subItems: [],
    },
  );
  assert.deepEqual(
    mode.normalizeAssessmentRepairerForSave({
      noAssessmentRequired: false,
      assessorType: 'Vendor',
      minorTaskRepairerName: 'must clear',
      vendorName: 'must clear',
      subItems: [{ id: 'sub-2', repairerType: 'Vendor', vendorName: 'Sub Vendor' }],
    }),
    {
      assessorType: '',
      minorTaskRepairerName: '',
      vendorName: '',
      subItems: [{ id: 'sub-2', repairerType: 'Vendor', vendorName: 'Sub Vendor' }],
    },
  );

  assert.equal(
    mode.resolveMinorTaskRepairerName({
      assessorName: 'Assessor',
      assessorType: 'Vendor',
      minorTaskRepairerName: '',
      vendorName: 'Legacy Vendor',
    }),
    'Legacy Vendor',
  );
  assert.equal(
    mode.resolveMinorTaskRepairerName({
      assessorName: 'Legacy Internal Person',
      assessorType: 'ຊ່າງພາຍໃນ',
      minorTaskRepairerName: '',
      vendorName: '',
    }),
    'Legacy Internal Person',
  );

  const typesSource = fs.readFileSync(typesPath, 'utf8');
  assert.match(typesSource, /minorTaskRepairerName\?: string/);

  const componentSource = fs.readFileSync(componentPath, 'utf8');
  assert.match(componentSource, /isAssessmentLevelRepairerVisible/);
  assert.match(componentSource, /normalizeAssessmentRepairerForSave/);
  assert.match(componentSource, /resolveMinorTaskRepairerName/);

  for (const header of [
    'ປະເພດຜູ້ສ້ອມ (Repairer Type)',
    'ຊື່ພະນັກງານຜູ້ສ້ອມ (Internal Repairer)',
    'ຊື່ບໍລິສັດ/ຜູ້ຮັບເໝົາ (Vendor)',
  ]) {
    assert.match(componentSource, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(
    componentSource,
    /const minorTaskRepairerName = resolveMinorTaskRepairerName\(asm\)/,
  );
  assert.match(
    componentSource,
    /asm\.assessorType === 'Vendor' \? '' : minorTaskRepairerName/,
  );
  assert.match(
    componentSource,
    /asm\.assessorType === 'Vendor' \? minorTaskRepairerName : ''/,
  );
  assert.doesNotMatch(
    componentSource,
    /"ປະເພດຜູ້ສ້ອມ \(Repairer Type\)": "—"/,
  );

  console.log('Repair Assessment conditional repairer checks passed.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
