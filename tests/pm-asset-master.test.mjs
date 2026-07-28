import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as XLSX from 'xlsx';

const root = path.resolve(import.meta.dirname, '..');
const modulePath = path.join(root, 'src', 'pmAssetMasterData.ts');
const componentPath = path.join(root, 'src', 'components', 'PreventiveMaintenanceView.tsx');
const tempBundle = path.join(root, 'tests', '.pm-asset-master.bundle.mjs');

assert.ok(fs.existsSync(modulePath), 'src/pmAssetMasterData.ts must exist');

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

  assert.deepEqual(master.PM_ASSET_GROUP_OPTIONS, [
    'AIR_CONDITIONER',
    'ATM',
    'CCTV',
    'FIRE_ALARM',
    'GENERATOR',
    'NOTEBOOK',
    'UPS',
    'ໂຕະ',
    'ຕັ່ງ',
    'ອື່ນໆ',
  ]);
  assert.deepEqual(
    master.getAssetGroupOptions([
      { assetGroup: ' Custom Group ' },
      { assetGroup: 'custom group' },
      { assetGroup: 'CCTV' },
      { assetGroup: '__ADD_NEW__' },
    ]),
    [...master.PM_ASSET_GROUP_OPTIONS, 'Custom Group'],
  );
  assert.equal(master.isReservedPMAssetMasterValue('__ADD_NEW__'), true);
  assert.equal(master.isReservedPMAssetMasterValue(' __add_new__ '), true);
  assert.equal(master.isReservedPMAssetMasterValue('CCTV'), false);
  assert.deepEqual(
    master.getAssetNameOptions(['Camera', '__ADD_NEW__', 'camera', 'UPS']),
    ['Camera', 'UPS'],
  );
  assert.deepEqual(
    master.getAssetCategoryOptions([
      'Equipment',
      ' none ',
      'ບໍ່ມີ',
      '',
      'equipment',
      'Building',
    ]),
    ['Equipment', 'Building'],
  );

  const branches = [
    { ລຳດັບ: 1, ສາຂາ: 'Branch A', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'Division A1' },
    { ລຳດັບ: 2, ສາຂາ: 'Branch B', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'Division B1' },
    { ລຳດັບ: 3, ສາຂາ: 'Branch A', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'Division A2' },
    { ລຳດັບ: 4, ສາຂາ: ' branch a ', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'division a1' },
  ];
  assert.deepEqual(master.getBranchOptions(branches), ['Branch A', 'Branch B']);
  assert.deepEqual(master.getDivisionOptions(branches, 'Branch A'), ['Division A1', 'Division A2']);

  const checklists = [
    { ລະບົບທີ່ກວດ: 'System A', ໝວດລະບົບກວດ: 'Area A1', ລາຍການກວດ: 'One' },
    { ລະບົບທີ່ກວດ: 'System B', ໝວດລະບົບກວດ: 'Area B1', ລາຍການກວດ: 'Two' },
    { ລະບົບທີ່ກວດ: 'System A', ໝວດລະບົບກວດ: 'Area A2', ລາຍການກວດ: 'Three' },
  ];
  assert.deepEqual(master.getSystemOptions(checklists), ['System A', 'System B']);
  assert.deepEqual(master.getAreaPointOptions(checklists, 'System A'), ['Area A1', 'Area A2']);
  assert.deepEqual(master.uniqueNormalizedStrings([' CCTV ', 'cctv', 'ATM']), ['CCTV', 'ATM']);
  assert.equal(master.normalizeSector('ບໍ່ມີ'), 'none');
  assert.equal(master.normalizeSector('none'), 'none');
  assert.equal(master.formatSectorForDisplay('ບໍ່ມີ'), '—');
  assert.equal(master.formatSectorForDisplay('none'), '—');
  assert.equal(master.formatSectorForDisplay('Sector A'), 'Sector A');
  assert.equal(master.floorLabelToLegacyFloor('ຊັ້ນ 7'), '7');

  const asset = {
    assetCode: 'PM-001',
    assetName: 'CCTV Camera',
    assetCategory: 'Equipment',
    assetGroup: 'CCTV',
    branch: 'Branch A',
    division: 'Division A1',
    sector: 'none',
    floor: 'legacy-floor',
    locationDetail: '',
    ສະຖານທີ່_ຫ້ອງ: 'ຊັ້ນ 3',
    systemCategory: 'System A',
    subsystemCategory: 'Area A1',
    maintenanceCycle: '1 ເດືອນ',
    lastMaintenanceDate: '2026-07-01',
    nextMaintenanceDate: '2026-08-01',
    alertBeforeDays: 5,
    responsiblePerson: '',
    vendor: '',
    maintenanceStatus: 'ປົກກະຕິ',
  };
  const assetRow = master.buildPMAssetExportRow(asset, 0);
  assert.deepEqual(Object.keys(assetRow), [
    'ລຳດັບ (No.)',
    'ລະຫັດຊັບສິນ (Asset Code)',
    'ຊື່ຊັບສິນ (Asset Name)',
    'ພາກສ່ວນຊັບສົມບັດ (Asset Category)',
    'ໝວດລາຍການ (Asset Group)',
    'ສາຂາ (Branch)',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)',
    'ຂະແໜງ (Sector)',
    'ຊັ້ນອາຄານ (Floor)',
    'ລາຍລະອຽດສະຖານທີ່ (Location Detail)',
    'ສະຖານທີ່/ຊັ້ນອາຄານ',
    'ລະບົບທີ່ກວດ (System Category)',
    'ພື້ນທີ່/ຈຸດກວດ (Area / Point)',
    'ຮອບວຽນບຳລຸງຮັກສາ (Cycle)',
    'ວັນທີບຳລຸງຮັກສາຫຼ້າສຸດ (Last PM Date)',
    'ວັນທີບຳລຸງຮັກສາຄັ້ງຕໍ່ໄປ (Next PM Date)',
    'ແຈ້ງເຕືອນລ່ວງໜ້າເປັນວັນ (Alert Days)',
    'ຜູ້ຮັບຜິດຊອບ (Person In Charge)',
    'ຜູ້ຮັບເໝົາ/Vendor',
    'ສະຖານະການແຈ້ງເຕືອນ (Alert Status)',
  ]);
  assert.equal(assetRow['ຊັ້ນອາຄານ (Floor)'], 'legacy-floor');
  assert.equal(assetRow['ສະຖານທີ່/ຊັ້ນອາຄານ'], 'ຊັ້ນ 3');
  assert.equal(assetRow['ລະບົບທີ່ກວດ (System Category)'], 'System A');
  assert.equal(assetRow['ພື້ນທີ່/ຈຸດກວດ (Area / Point)'], 'Area A1');
  assert.ok(Object.values(assetRow).every(value => value !== null && value !== undefined));

  const historyRow = master.buildPMHistoryExportRow({
    ...asset,
    id: 'H-1',
    inspectionDate: '2026-07-16',
    inspector: 'Admin',
    overallResult: 'ປົກກະຕິ',
    checklistResults: [],
  }, 0);
  assert.equal(historyRow['ຊັ້ນອາຄານ (Floor)'], 'legacy-floor');
  assert.equal(historyRow['ສະຖານທີ່/ຊັ້ນອາຄານ'], 'ຊັ້ນ 3');
  assert.ok(Object.values(historyRow).every(value => value !== null && value !== undefined));
  assert.deepEqual(Object.keys(historyRow), [
    'ລຳດັບ (No.)',
    'ລະຫັດຊັບສິນ (Asset Code)',
    'ຊື່ຊັບສິນ (Asset Name)',
    'ສາຂາ (Branch)',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)',
    'ຊັ້ນອາຄານ (Floor)',
    'ລາຍລະອຽດສະຖານທີ່ (Location Detail)',
    'ສະຖານທີ່/ຊັ້ນອາຄານ',
    'ລະບົບທີ່ກວດ (System Category)',
    'ພື້ນທີ່/ຈຸດກວດ (Area / Point)',
    'ວັນທີ່ກວດ (PM Date)',
    'ຜູ້ກວດກາ (Inspector)',
    'ຜົນການກວດ (Overall Result)',
    'ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)',
    'ປະເມີນຜົນກະທົບ (Impact Level)',
    'ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)',
    'ລະຫັດ PID ທີ່ກ່ຽວຂ້ອງ (Related PID)',
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([assetRow]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PM Assets');
  const binary = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const roundTripWorkbook = XLSX.read(binary, { type: 'buffer' });
  const roundTripRows = XLSX.utils.sheet_to_json(roundTripWorkbook.Sheets['PM Assets']);
  assert.equal(roundTripRows.length, 1);
  assert.equal(roundTripRows[0]['ລະຫັດຊັບສິນ (Asset Code)'], 'PM-001');
  assert.equal(roundTripRows[0]['ຊັ້ນອາຄານ (Floor)'], 'legacy-floor');
  assert.equal(roundTripRows[0]['ສະຖານທີ່/ຊັ້ນອາຄານ'], 'ຊັ້ນ 3');
  assert.equal(roundTripRows[0]['ພື້ນທີ່/ຈຸດກວດ (Area / Point)'], 'Area A1');

  const historyWorkbook = XLSX.utils.book_new();
  const historyWorksheet = XLSX.utils.json_to_sheet([historyRow]);
  XLSX.utils.book_append_sheet(historyWorkbook, historyWorksheet, 'PM History');
  const historyBinary = XLSX.write(historyWorkbook, { type: 'buffer', bookType: 'xlsx' });
  const historyRoundTripWorkbook = XLSX.read(historyBinary, { type: 'buffer' });
  const historyRoundTripRows = XLSX.utils.sheet_to_json(historyRoundTripWorkbook.Sheets['PM History']);
  assert.equal(historyRoundTripRows[0]['ຊັ້ນອາຄານ (Floor)'], 'legacy-floor');
  assert.equal(historyRoundTripRows[0]['ສະຖານທີ່/ຊັ້ນອາຄານ'], 'ຊັ້ນ 3');

  const component = fs.readFileSync(componentPath, 'utf8');
  const modalStart = component.indexOf('DIALOG MODAL: ADD / EDIT PM ASSET');
  const modalEnd = component.indexOf('DIALOG MODAL: PERFORM MAINTENANCE CHECK');
  const modal = component.slice(modalStart, modalEnd > modalStart ? modalEnd : undefined);

  assert.ok(!modal.includes('ຊັ້ນອາຄານ (Floor)</label>'), 'legacy Floor input must be hidden');
  assert.ok(modal.includes('ລະບົບທີ່ກວດ (System Category)'));
  assert.ok(modal.includes('ພື້ນທີ່/ຈຸດກວດ (Area / Point)'));
  assert.ok(!modal.includes('setIsCustomGroup'), 'Asset Group custom option must be removed');
  assert.ok(modal.includes('id="asset-name-select"'), 'Asset Name must use a master dropdown');
  assert.ok(modal.includes('id="asset-group-select"'), 'Asset Group must use a master dropdown');
  assert.ok(modal.includes('id="new-asset-name-input"'), 'Asset Name must expose an inline add-new input');
  assert.ok(modal.includes('id="new-asset-group-input"'), 'Asset Group must expose an inline add-new input');
  assert.equal(
    (modal.match(/<option value="__ADD_NEW__">\+ ເພີ່ມລາຍການໃໝ່<\/option>/g) || []).length,
    2,
    'both master dropdowns need add-new as their final option'
  );
  assert.ok(!modal.includes("isAddingAssetName ? 'ຍົກເລີກ' : '+ ເພີ່ມລາຍການໃໝ່'"), 'Asset Name must not use a separate add-new button');
  assert.ok(!modal.includes("isAddingAssetGroup ? 'ຍົກເລີກ' : '+ ເພີ່ມລາຍການໃໝ່'"), 'Asset Group must not use a separate add-new button');
  assert.equal((modal.match(/e\.target\.value === '__ADD_NEW__'/g) || []).length, 2, 'both dropdowns must open inline add mode from the sentinel option');
  assert.ok(component.includes('isReservedPMAssetMasterValue(assetName)'), 'save must reject a reserved Asset Name sentinel');
  assert.ok(component.includes('isReservedPMAssetMasterValue(canonicalAssetGroup)'), 'save must reject a reserved Asset Group sentinel');
  assert.ok(component.includes('isAddingAssetName'));
  assert.ok(component.includes('isAddingAssetGroup'));
  assert.ok(component.includes('assetNameBeforeAdd'), 'Cancel must restore the Asset Name selected before add mode');
  assert.ok(component.includes('assetGroupBeforeAdd'), 'Cancel must restore the Asset Group selected before add mode');
  assert.ok(component.includes('setIsAddingAssetGroup(!matchedGroup)'), 'unmatched incident groups must open add mode');
  assert.ok(component.includes('setAssetGroup(matchedGroup || rawGroup)'), 'incident groups must be canonicalized or shown in add mode');
  assert.ok(component.includes('getAssetGroupOptions(pmAssets)'));
  assert.ok(component.includes('getAssetCategoryOptions'));
  assert.ok(modal.includes('ຄ່າພາກສ່ວນເກົ່າທີ່ຮັກສາໄວ້'));
  assert.ok(component.includes('buildPMAssetExportRow'));
  assert.ok(component.includes('buildPMHistoryExportRow'));
  assert.ok(modal.includes('disabled={Boolean(editingAsset)}'), 'Asset Code must be immutable during edit');
  assert.ok(component.includes('item.assetCode !== editingAsset?.assetCode'), 'duplicate Asset Code validation must exclude only the edited identity');
  assert.ok(modal.includes('{branch} (Legacy)'), 'legacy Branch must remain visible until explicitly changed');
  assert.ok(modal.includes('{division} (Legacy)'), 'legacy Division must remain visible until explicitly changed');
  assert.ok(modal.includes('{systemCategory} (Legacy)'), 'legacy System must remain visible until explicitly changed');
  assert.ok(modal.includes('{subsystemCategory} (Legacy)'), 'legacy Area/Point must remain visible until explicitly changed');
  assert.ok(modal.includes('{sector} (Legacy)'), 'legacy Sector must remain visible until explicitly changed');
  assert.ok(component.includes('isPreservedLegacyLocation'), 'legacy location must survive unrelated edits');
  assert.ok(modal.includes('ຄ່າເກົ່າທີ່ຮັກສາໄວ້'), 'legacy location must be shown outside the new dropdown options');
  assert.ok(component.includes('const savedSector = editingAsset?.sector === sector'), 'legacy Sector must survive unrelated edits');
  assert.ok(component.includes('formatSectorForDisplay(asset.sector)'), 'read-only UI must not display none literally');
  assert.ok(component.includes('ລະຫັດຊັບສິນ: selectedAssetForCheck.assetCode'));
  assert.ok(component.includes('ລາຍການ: selectedAssetForCheck.assetName'));
  assert.ok(component.includes('ລະບົບທີ່ກວດ: selectedAssetForCheck.systemCategory'));
  assert.ok(component.includes('ໝວດລະບົບກວດ: selectedAssetForCheck.subsystemCategory'));
  assert.ok(component.includes('relatedIncidentId: activeIncidentId'));

  for (const forbidden of [
    'ອາການເສຍ',
    'ລາຍການສ້ອມ',
    'ມູນຄ່າສ້ອມ',
    'ສະຖານະອະນຸມັດ',
    'Tracking Status',
    'Repair History Status',
  ]) {
    assert.ok(!modal.includes(forbidden), `Add PM Asset must not include case field: ${forbidden}`);
  }

  console.log('PM Asset master checks passed: master options, dependencies, UI rules, and Excel raw-data mapping.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
