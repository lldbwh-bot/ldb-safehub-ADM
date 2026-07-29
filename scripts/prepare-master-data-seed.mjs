import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const escapeSql = (value) => String(value ?? '').replace(/'/g, "''");
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const appSheetMapping = readJson('src/data/AppSheet_Mapping.json');
const sectors = readJson('src/data/ຂະແໜງ.json');

const rows = [];

for (const item of appSheetMapping) {
  const record = {
    Form_Type: item.Form_Type,
    'ລະບົບທີ່ກວດ': item['System (ລະບົບທີ່ກວດ)'],
    'ໝວດລະບົບກວດ': item['Category (ໝວດລະບົບຍ່ອຍ)'],
    'ລາຍການກວດ': item['Inspection Item (ລາຍການກວດກາ)'],
  };
  const recordId = [
    record.Form_Type,
    record['ລະບົບທີ່ກວດ'],
    record['ໝວດລະບົບກວດ'],
    record['ລາຍການກວດ'],
  ].join('::');
  rows.push(['checklist-items', recordId, record]);
}

for (const record of sectors) {
  const recordId = record['ຂະແໜງ'];
  if (!recordId) continue;
  rows.push(['sectors', recordId, record]);
}

let sql = '';
for (const [dataset, recordId, record] of rows) {
  sql += [
    'INSERT INTO app_records',
    '(dataset, record_id, branch, payload_json, version, updated_by, deleted_at)',
    `VALUES ('${escapeSql(dataset)}','${escapeSql(recordId)}','',json('${escapeSql(JSON.stringify(record))}'),1,'codex-master-seed',NULL)`,
    'ON CONFLICT(dataset, record_id) DO UPDATE SET',
    'branch=excluded.branch,',
    'payload_json=excluded.payload_json,',
    'updated_at=CURRENT_TIMESTAMP,',
    'updated_by=excluded.updated_by,',
    'deleted_at=NULL;',
  ].join(' ') + '\n';
}

for (const dataset of ['checklist-items', 'sectors']) {
  sql += [
    'INSERT INTO app_dataset_revisions (dataset, revision, updated_at)',
    `VALUES ('${dataset}', 1, CURRENT_TIMESTAMP)`,
    'ON CONFLICT(dataset) DO UPDATE SET',
    'revision = revision + 1, updated_at = CURRENT_TIMESTAMP;',
  ].join(' ') + '\n';
}

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/master-data-seed.sql', sql);
console.log(`Prepared ${rows.length} master-data seed rows in .tmp/master-data-seed.sql`);
