import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataPath = new URL('../src/repairMappingMasterData.json', import.meta.url);
const storePath = new URL('../src/dataStore.ts', import.meta.url);

assert.ok(fs.existsSync(dataPath), 'repair mapping master data file must exist');

const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
assert.equal(rows.length, 133, 'the supplied list contains 133 rows (sequence 124 is absent)');

const sequences = rows.map((row) => row.sequence);
assert.equal(new Set(sequences).size, 133, 'sequence numbers must be unique');
assert.ok(!sequences.includes(124), 'do not invent the missing sequence 124');

for (const row of rows) {
  for (const field of ['sparePart', 'repairSubCategory', 'repairSubItem', 'unit']) {
    assert.equal(typeof row[field], 'string', `${field} must be text at sequence ${row.sequence}`);
    assert.ok(row[field].trim(), `${field} must not be blank at sequence ${row.sequence}`);
  }
}

assert.deepEqual(rows[0], {
  sequence: 1,
  sparePart: 'ມໍເຕີພັດລົມແຜງເຢັນ',
  repairSubCategory: 'ລະບົບ ແອເຟັນ',
  repairSubItem: 'ມໍເຕີພັດລົມແຜງເຢັນເພ',
  unit: 'ອັນ'
});
assert.equal(rows.at(-1).sequence, 134);
assert.equal(rows.at(-1).sparePart, 'ຈັກນັບເງິນ (ຊຸດອະໄຫຼ່)');

const storeSource = fs.readFileSync(storePath, 'utf8');
assert.match(storeSource, /ldb_repair_presets_v3/g, 'mapping storage must use v3 to replace the old 54-row dataset');
assert.doesNotMatch(storeSource, /ldb_repair_presets_v2/g, 'the old mapping storage key must no longer be active');

console.log('Mapping master data checks passed: 133 supplied rows, no fabricated sequence 124.');
