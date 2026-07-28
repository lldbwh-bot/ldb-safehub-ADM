import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.safety-form-master-data-'));
const bundlePath = join(temporaryDirectory, 'safetyFormMasterData.mjs');

try {
  await build({
    entryPoints: [join(process.cwd(), 'src/safetyFormMasterData.ts')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });

  const master = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

  assert.equal(
    master.detectSafetyFormType('00.ສໍານັກງານໃຫຍ່', 'ຫ້ອງຮັບເງິນ ຫຮ01'),
    'ຫ້ອງຮັບເງິນ',
    'cash-office divisions under branch 00 use the cash-office form',
  );
  assert.equal(
    master.detectSafetyFormType('00.ສໍານັກງານໃຫຍ່', 'ໜ່ວຍບໍລິການ ນບ01'),
    'ໜ່ວຍບໍລິການ',
    'service-unit divisions under branch 00 use the service-unit form',
  );
  assert.equal(
    master.detectSafetyFormType('00.ສໍານັກງານໃຫຍ່', 'ຝ່າຍບໍລິຫານ'),
    'ສຳນັກງານໃຫຍ່',
  );
  assert.equal(
    master.detectSafetyFormType('23.ສາຂາ ວັງວຽງ', '23.ສາຂາ ວັງວຽງ'),
    'ສາຂາ',
  );

  const items = [
    {
      Form_Type: 'ສາຂາ',
      ລະບົບທີ່ກວດ: 'BRANCH SYSTEM',
      ໝວດລະບົບກວດ: 'BRANCH AREA',
      ລາຍການກວດ: 'B1',
    },
    {
      Form_Type: 'ສຳນັກງານໃຫຍ່',
      ລະບົບທີ່ກວດ: 'HQ SYSTEM',
      ໝວດລະບົບກວດ: 'HQ AREA',
      ລາຍການກວດ: 'H1',
    },
    {
      Form_Type: 'ໜ່ວຍບໍລິການ',
      ລະບົບທີ່ກວດ: 'SERVICE SYSTEM',
      ໝວດລະບົບກວດ: 'SERVICE AREA',
      ລາຍການກວດ: 'S1',
    },
    {
      Form_Type: 'ຫ້ອງຮັບເງິນ',
      ລະບົບທີ່ກວດ: 'CASH SYSTEM',
      ໝວດລະບົບກວດ: 'CASH AREA',
      ລາຍການກວດ: 'C1',
    },
    {
      Form_Type: '',
      ລະບົບທີ່ກວດ: 'SHARED SYSTEM',
      ໝວດລະບົບກວດ: 'SHARED AREA',
      ລາຍການກວດ: 'X1',
    },
    {
      Form_Type: 'ສາຂາ',
      ລະບົບທີ່ກວດ: 'BRANCH SYSTEM',
      ໝວດລະບົບກວດ: 'BRANCH AREA',
      ລາຍການກວດ: 'B2',
    },
  ];

  assert.deepEqual(
    master.getSystemsForFormType(items, 'ສາຂາ'),
    ['BRANCH SYSTEM', 'SHARED SYSTEM'],
    'branch systems exclude systems owned by other forms and deduplicate repeated rows',
  );
  assert.deepEqual(
    master.getAreasForFormTypeAndSystem(items, 'ສາຂາ', 'BRANCH SYSTEM'),
    ['BRANCH AREA'],
  );
  assert.deepEqual(
    master.getAreasForFormTypeAndSystem(items, 'ສາຂາ', 'HQ SYSTEM'),
    [],
    'an area from another form cannot leak into branch options',
  );
  assert.deepEqual(master.getSystemsForFormType([], 'ສາຂາ'), []);
  assert.deepEqual(master.getAreasForFormTypeAndSystem(items, 'ສາຂາ', ''), []);

  console.log('Safety form-type Master Data helper checks passed.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
