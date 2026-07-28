import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const modulePath = path.join(root, 'src', 'incidentAssetMasterData.ts');
const incidentsViewPath = path.join(root, 'src', 'components', 'IncidentsView.tsx');
const inspectionsViewPath = path.join(root, 'src', 'components', 'InspectionsView.tsx');
const tempBundle = path.join(root, 'tests', '.incident-history-dropdowns.bundle.mjs');

assert.ok(fs.existsSync(modulePath), 'src/incidentAssetMasterData.ts must exist');
assert.ok(fs.existsSync(incidentsViewPath), 'src/components/IncidentsView.tsx must exist');
assert.ok(fs.existsSync(inspectionsViewPath), 'src/components/InspectionsView.tsx must exist');

const incidentsViewSource = fs.readFileSync(incidentsViewPath, 'utf8');
assert.match(
  incidentsViewSource,
  /ບັນທຶກການແກ້ໄຂ \(Save Changes\)/,
  'the Edit Incident action uses the Lao Save Changes label',
);
assert.doesNotMatch(
  incidentsViewSource,
  /บันทึกการแก้ไข/,
  'the Edit Incident action must not display the Thai Save Changes label',
);
const directFormSource = incidentsViewSource.slice(
  incidentsViewSource.indexOf('{/* Dialog 1: Direct Incident Creation Form */}'),
  incidentsViewSource.indexOf('{/* Dialog 2: Manager Repair Approval Form */}'),
);

assert.match(directFormSource, /<select\s+[\s\S]*?id="incident-item-type-select"/);
assert.match(
  directFormSource,
  /<select\s+[\s\S]*?id="incident-asset-name-select"/,
  'Direct Incident Asset Name must use the same dropdown pattern as Item Type',
);
assert.match(
  directFormSource,
  /id="new-incident-asset-name-input"/,
  'choosing Add New must open the inline Asset Name input',
);
assert.doesNotMatch(
  directFormSource,
  /id="incident-asset-name-combobox"/,
  'Direct Incident Asset Name must not use the editable datalist appearance',
);
assert.match(directFormSource, /id="new-incident-item-type-input"/);
assert.match(
  directFormSource,
  /<option\s+value=\{INCIDENT_ASSET_ADD_NEW_SENTINEL\}>\+ ເພີ່ມໝວດລາຍການໃໝ່<\/option>/,
);
assert.match(
  directFormSource,
  /<option\s+value=\{INCIDENT_ASSET_ADD_NEW_SENTINEL\}>\+ ເພີ່ມລາຍການໃໝ່<\/option>/,
);
assert.match(incidentsViewSource, /getIncidentItemTypeOptions\(incidents\)/);
assert.match(incidentsViewSource, /getDirectIncidentAssetNameOptions\(incidents, assetGroup\)/);
assert.match(incidentsViewSource, /isReservedIncidentAssetMasterValue\(submittedAssetGroup\)/);
assert.match(incidentsViewSource, /isReservedIncidentAssetMasterValue\(submittedAssetName\)/);

const directOptionDerivationSource = incidentsViewSource.slice(
  incidentsViewSource.indexOf('getIncidentItemTypeOptions(incidents)'),
  incidentsViewSource.indexOf('getDirectIncidentAssetNameOptions(incidents, assetGroup)')
    + 'getDirectIncidentAssetNameOptions(incidents, assetGroup)'.length,
);
assert.doesNotMatch(directOptionDerivationSource, /CHECKLIST_ITEMS|APPSHEET_MAPPING|inspections|assessments/);

const inspectionsViewSource = fs.readFileSync(inspectionsViewPath, 'utf8');
const newInspectionSource = inspectionsViewSource.slice(
  inspectionsViewSource.indexOf('interface ManualIncidentForm'),
  inspectionsViewSource.indexOf('{/* Modal: Link Incident Form'),
);
const newInspectionAssetBlock = inspectionsViewSource.slice(
  inspectionsViewSource.indexOf('{/* Modal: New Inspection Form */}'),
  inspectionsViewSource.indexOf('{/* Modal: Link Incident Form'),
);
const inspectionAssetGroupBlock = newInspectionAssetBlock.slice(
  newInspectionAssetBlock.indexOf('(Asset Group) *'),
  newInspectionAssetBlock.indexOf('(Asset Category) *'),
);
const inspectionAssetCategoryBlock = newInspectionAssetBlock.slice(
  newInspectionAssetBlock.indexOf('(Asset Category) *'),
  newInspectionAssetBlock.indexOf('(Asset Name) *'),
);
const inspectionCheckpointBlock = newInspectionAssetBlock.slice(
  newInspectionAssetBlock.indexOf('(Referenced Checkpoint) *'),
  newInspectionAssetBlock.indexOf("{dForm.hasAsset !== 'no' ? ("),
);

assert.match(inspectionAssetGroupBlock, /<select[\s\S]*?value=\{dForm\.assetCategory\}/);
assert.match(inspectionAssetGroupBlock, /ASSET_CATEGORIES\.map/);
assert.doesNotMatch(inspectionAssetGroupBlock, /data-incident-master|INCIDENT_ASSET_ADD_NEW_SENTINEL/);
assert.match(inspectionAssetCategoryBlock, /<select[\s\S]*?data-incident-master="inspection-asset-category"/);
assert.match(inspectionAssetCategoryBlock, /value=\{dForm\.hasAsset === 'no' \? 'none' : dForm\.assetGroup\}/);
assert.match(inspectionAssetCategoryBlock, /inspectionAssetItemTypeOptions\.map/);
assert.equal(
  [...inspectionCheckpointBlock.matchAll(/handleManualCheckpointChange\(dForm\.id, val\)/g)].length,
  2,
  'both checkpoint selects must reset incident-only asset context',
);
assert.doesNotMatch(
  inspectionCheckpointBlock,
  /handleUpdateManualIncident\(dForm\.id, 'assetGroup', matched\./,
);
assert.match(newInspectionAssetBlock, /<select[\s\S]*?data-incident-master="inspection-asset-name"/);
assert.match(inspectionAssetCategoryBlock, /data-incident-master-input="inspection-asset-category"/);
assert.match(newInspectionAssetBlock, /data-incident-master-input="inspection-asset-name"/);
assert.match(
  newInspectionAssetBlock,
  /data-incident-master="inspection-asset-category"[\s\S]*?<option value=\{INCIDENT_ASSET_ADD_NEW_SENTINEL\}>\+ ເພີ່ມໝວດລາຍການໃໝ່<\/option>[\s\S]*?<\/select>/,
);
assert.match(
  newInspectionAssetBlock,
  /data-incident-master="inspection-asset-name"[\s\S]*?<option value=\{INCIDENT_ASSET_ADD_NEW_SENTINEL\}>\+ ເພີ່ມລາຍການໃໝ່<\/option>[\s\S]*?<\/select>/,
);
assert.match(newInspectionSource, /getIncidentItemTypeOptions\(incidents\)/);
assert.match(
  newInspectionAssetBlock,
  /getInspectionAssetNameOptions\(incidents, dForm\.assetCategory, dForm\.assetGroup\)/,
);
assert.match(newInspectionSource, /isReservedIncidentAssetMasterValue\(dForm\.assetGroup\)/);
assert.match(newInspectionSource, /isReservedIncidentAssetMasterValue\(dForm\.assetName\)/);
const addManualIncidentSource = newInspectionSource.slice(
  newInspectionSource.indexOf('const handleAddManualIncident'),
  newInspectionSource.indexOf('const handleRemoveManualIncident'),
);
const newManualIncidentFormSource = addManualIncidentSource.slice(
  addManualIncidentSource.indexOf('const newForm: ManualIncidentForm'),
);
assert.match(newManualIncidentFormSource, /assetGroup: ''/);
assert.doesNotMatch(newManualIncidentFormSource, /assetGroup: itemCat/);
assert.match(newManualIncidentFormSource, /assetName: ''/);

const newInspectionUpdateSource = newInspectionSource.slice(
  newInspectionSource.indexOf('const handleUpdateManualIncident'),
  newInspectionSource.indexOf('const selectInspectionAssetCategory'),
);
const hasAssetYesResetSource = newInspectionUpdateSource.slice(
  newInspectionUpdateSource.indexOf("field === 'hasAsset' && value === 'yes'"),
  newInspectionUpdateSource.indexOf("if (field === 'assetCategory' || field === 'assetGroup')"),
);
assert.match(hasAssetYesResetSource, /updated\.assetCategory = \(ASSET_CATEGORIES\[0\]/);
assert.match(hasAssetYesResetSource, /updated\.assetName = ''/);
assert.match(hasAssetYesResetSource, /updated\.assetGroup = ''/);
assert.doesNotMatch(hasAssetYesResetSource, /matchedOpt|selectedCategories/);

const contextInvalidationSource = newInspectionUpdateSource.slice(
  newInspectionUpdateSource.indexOf("if (field === 'assetCategory' || field === 'assetGroup')"),
);
assert.match(contextInvalidationSource, /updated\.previousAssetName = ''/);
assert.match(contextInvalidationSource, /updated\.isAddingAssetName = false/);
assert.match(contextInvalidationSource, /updated\.newAssetName = ''/);

const checkpointHandlerSource = newInspectionSource.slice(
  newInspectionSource.indexOf('const handleManualCheckpointChange'),
  newInspectionSource.indexOf('const selectInspectionAssetCategory'),
);
assert.match(checkpointHandlerSource, /const isWithAsset = form\.hasAsset !== 'no'/);
assert.match(checkpointHandlerSource, /assetGroup: isWithAsset \? '' : 'none'/);
assert.match(checkpointHandlerSource, /assetName: isWithAsset \? '' : 'none'/);
assert.match(checkpointHandlerSource, /\.\.\.\(isWithAsset \? \{/);
assert.match(checkpointHandlerSource, /isAddingAssetGroup: false/);
assert.match(checkpointHandlerSource, /previousAssetName: ''/);

const restoreSource = newInspectionSource.slice(
  newInspectionSource.indexOf('const acceptInspectionAssetMasterValue'),
  newInspectionSource.indexOf('const handleManualAssetCodeChange'),
);
assert.match(restoreSource, /getInspectionAssetNameOptions\(incidents, form\.assetCategory, form\.assetGroup\)/);
assert.match(restoreSource, /isValidInspectionAssetName/);
assert.match(restoreSource, /isValidInspectionAssetName\(previousValue, validNames\) \? previousValue : ''/);
assert.match(restoreSource, /field: 'assetGroup' \| 'assetName'/);
assert.doesNotMatch(restoreSource, /field: 'assetCategory' \| 'assetName'/);

const masterDataSource = fs.readFileSync(modulePath, 'utf8');
assert.doesNotMatch(masterDataSource, /CHECKLIST_ITEMS|APPSHEET_MAPPING|inspections|assessments/);

await build({
  entryPoints: [modulePath],
  outfile: tempBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

try {
  const master = await import(`${pathToFileURL(tempBundle).href}?t=${Date.now()}`);

  const incidents = [
    {
      ໝວດລາຍການ: ' CCTV ',
      ພາກສ່ວນຊັບສົມບັດ: ' Equipment ',
      ລາຍການ: ' Lobby Camera ',
      unrelatedItemType: 'Generator',
      unrelatedCategory: 'Building',
      unrelatedAssetName: 'Static Camera',
    },
    {
      ໝວດລາຍການ: 'cctv',
      ພາກສ່ວນຊັບສົມບັດ: 'equipment',
      ລາຍການ: 'lobby camera',
    },
    {
      ໝວດລາຍການ: ' CCTV ',
      ພາກສ່ວນຊັບສົມບັດ: ' Security ',
      ລາຍການ: 'Parking Camera',
    },
    {
      ໝວດລາຍການ: 'UPS',
      ພາກສ່ວນຊັບສົມບັດ: 'Equipment',
      ລາຍການ: 'Server UPS',
    },
    {
      ໝວດລາຍການ: 'UPS',
      ພາກສ່ວນຊັບສົມບັດ: 'Security',
      ລາຍການ: 'Wrong Group Asset',
    },
    { ໝວດລາຍການ: '', ພາກສ່ວນຊັບສົມບັດ: ' ', ລາຍການ: '' },
    { ໝວດລາຍການ: ' none ', ພາກສ່ວນຊັບສົມບັດ: 'NONE', ລາຍການ: 'none' },
    { ໝວດລາຍການ: 'ບໍ່ມີ', ພາກສ່ວນຊັບສົມບັດ: 'ບໍ່ມີຊັບສິນ', ລາຍການ: 'ບໍ່ມີຊັບສິນ (Case ທົ່ວໄປ)' },
    { ໝວດລາຍການ: '__ADD_NEW__', ພາກສ່ວນຊັບສົມບັດ: ' __add_new__ ', ລາຍການ: '__ADD_NEW__' },
    { ໝວດລາຍການ: null, ພາກສ່ວນຊັບສົມບັດ: 'Equipment', ລາຍການ: 'Malformed Type' },
    { ໝວດລາຍການ: 'UPS', ພາກສ່ວນຊັບສົມບັດ: undefined, ລາຍການ: 'Malformed Category' },
    { ໝວດລາຍການ: 'UPS', ພາກສ່ວນຊັບສົມບັດ: 'Equipment', ລາຍການ: null },
  ];

  assert.equal(master.INCIDENT_ASSET_ADD_NEW_SENTINEL, '__ADD_NEW__');
  assert.deepEqual(master.getIncidentItemTypeOptions(incidents), ['CCTV', 'UPS']);
  assert.deepEqual(master.getIncidentAssetCategoryOptions(incidents), ['Equipment', 'Security']);
  assert.doesNotThrow(() => master.getDirectIncidentAssetNameOptions(incidents, 'CCTV'));
  assert.doesNotThrow(() => master.getInspectionAssetNameOptions(incidents, 'Equipment', 'UPS'));
  assert.deepEqual(master.getDirectIncidentAssetNameOptions(incidents, ' cCtV '), [
    'Lobby Camera',
    'Parking Camera',
  ]);
  assert.deepEqual(master.getDirectIncidentAssetNameOptions(incidents, ''), []);
  assert.deepEqual(master.getDirectIncidentAssetNameOptions(incidents, 'Generator'), []);
  assert.deepEqual(master.getInspectionAssetNameOptions(incidents, ' equipment ', ' ups '), [
    'Server UPS',
  ]);
  assert.deepEqual(master.getInspectionAssetNameOptions(incidents, 'Security', 'UPS'), [
    'Wrong Group Asset',
  ]);
  assert.deepEqual(master.getInspectionAssetNameOptions(incidents, '', 'UPS'), []);
  assert.deepEqual(master.getInspectionAssetNameOptions(incidents, 'Equipment', ''), []);

  assert.equal(master.isReservedIncidentAssetMasterValue(undefined), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('  '), true);
  assert.equal(master.isReservedIncidentAssetMasterValue(' NoNe '), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('ບໍ່ມີ'), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('ບໍ່ມີຊັບສິນ'), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('ບໍ່ມີຊັບສິນ (Case ທົ່ວໄປ)'), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)'), true);
  assert.equal(master.isReservedIncidentAssetMasterValue(' __add_new__ '), true);
  assert.equal(master.isReservedIncidentAssetMasterValue('CCTV'), false);
  assert.deepEqual(
    master.uniqueIncidentMasterValues([
      ' First Value ',
      'first value',
      'Second Value',
      '',
      'none',
      'ບໍ່ມີຊັບສິນ',
      '__ADD_NEW__',
    ]),
    ['First Value', 'Second Value'],
  );
  assert.equal(
    master.canonicalizeIncidentMasterValue(' lobby CAMERA ', ['Lobby Camera', 'Parking Camera']),
    'Lobby Camera',
  );
  assert.equal(
    master.canonicalizeIncidentMasterValue('Unknown Camera', ['Lobby Camera', 'Parking Camera']),
    'Unknown Camera',
  );

  console.log('Incident-history dropdown helper checks passed.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
