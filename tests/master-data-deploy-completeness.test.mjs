import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const appSheetMapping = readJson('src/data/AppSheet_Mapping.json');
const checklistFallback = readJson('src/data/checklistitem.json');
const sectors = readJson('src/data/ຂະແໜງ.json');

const formTypes = new Set(appSheetMapping.map((item) => item.Form_Type).filter(Boolean));
const expectedFormTypes = [
  'ສຳນັກງານໃຫຍ່',
  'ສາຂາ',
  'ໜ່ວຍບໍລິການ',
  'ຫ້ອງຮັບເງິນ',
];

for (const formType of expectedFormTypes) {
  assert.equal(formTypes.has(formType), true, `Master checklist includes ${formType}`);
}

assert.ok(
  appSheetMapping.length >= 500,
  `AppSheet_Mapping.json should carry the full checklist master data, got ${appSheetMapping.length}`,
);
assert.equal(
  checklistFallback.length,
  appSheetMapping.length,
  'checklistitem.json fallback must mirror AppSheet_Mapping so deploy/import cannot seed an empty checklist',
);

const checklistIds = new Set(
  appSheetMapping.map((item) => [
    item.Form_Type,
    item['System (ລະບົບທີ່ກວດ)'],
    item['Category (ໝວດລະບົບຍ່ອຍ)'],
    item['Inspection Item (ລາຍການກວດກາ)'],
  ].join('::')),
);

assert.equal(
  checklistIds.size,
  appSheetMapping.length,
  'Checklist master records must have unique stable IDs for D1 upsert/import',
);

assert.ok(sectors.length >= 30, `Sector master data should be complete, got ${sectors.length}`);
assert.equal(
  sectors.every((item) => typeof item['ຂະແໜງ'] === 'string' && item['ຂະແໜງ'].trim()),
  true,
  'Sector master data must not contain blank sector names',
);

console.log('Deploy Master Data completeness checks passed.');
