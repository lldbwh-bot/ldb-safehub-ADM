import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const modulePath = path.join(root, 'src', 'incidentCaseReference.ts');

assert.ok(
  fs.existsSync(modulePath),
  'src/incidentCaseReference.ts must provide one shared Incident Case resolver',
);

const temporaryDirectory = await mkdtemp(path.join(root, 'tests', '.incident-case-reference-'));
const bundlePath = path.join(temporaryDirectory, 'incidentCaseReference.mjs');

try {
  await build({
    entryPoints: [modulePath],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });

  const {
    getIncidentCaseDisplayCode,
    normalizeCaseSector,
    resolveIncidentCaseReference,
  } = await import(pathToFileURL(bundlePath).href);

  const legacyDefaultSector = '\u0e82\u0eb0\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99';
  const legacyTypoDefaultSector = '\u0e82\u0eb0\u0ec1\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99';
  const trueSector = '\u0e82\u0eb0\u0ec1\u0edc\u0e87 IT';

  assert.equal(
    normalizeCaseSector(legacyDefaultSector),
    'none',
    'legacy default service Sector must not be shown as a real Case sector',
  );
  assert.equal(
    normalizeCaseSector(legacyTypoDefaultSector),
    'none',
    'legacy typo default service Sector must not be shown as a real Case sector',
  );
  assert.equal(
    normalizeCaseSector(trueSector),
    trueSector,
    'real non-default Sector values must be preserved',
  );
  assert.equal(normalizeCaseSector(''), 'none');

  const inspection = {
    PID: 'inspection-parent',
    ລະຫັດກວດກາ: 'LDB-SAF-202',
    ຮູບແບບການກວດ: 'ກວດປະຈໍາວັນ',
    ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
    ໝວດລະບົບກວດ: 'ສະຖານທີ່ຈອດລົດ , ສາງLDBWH-B',
    ລາຍການກວດ: 'ກວດດອກໄຟ , ກວດຫຼັງຄາ',
    'ສາຂາ ': '00.ສໍານັກງານໃຫຍ່',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': '00.ສໍານັກງານໃຫຍ່',
    ຂະແໜງ: 'none',
    ຊັ້ນອາຄານ: 'ຊັ້ນ 1',
    ສະຖານທີ່_ຫ້ອງ: 'Parent room',
  };
  const caseOne = {
    PID: 'inspection-parent-1',
    ລະຫັດກວດກາ: 'LDB-SAF-202',
    ຮູບແບບການກວດ: 'ກວດປະຈໍາວັນ',
    ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
    ໝວດລະບົບກວດ: 'CCTV',
    ລາຍການກວດ: 'ກວດດອກໄຟ',
    'ສາຂາ ': '00.ສໍານັກງານໃຫຍ່',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ຝ່າຍ A',
    ຂະແໜງ: 'ຂະແໜງ A',
    ຊັ້ນອາຄານ: 'ຊັ້ນ 2',
    ສະຖານທີ່_ຫ້ອງ: 'Room A',
  };
  const caseTwo = {
    ...caseOne,
    PID: 'inspection-parent-2',
    ໝວດລະບົບກວດ: 'ATM',
    ລາຍການກວດ: 'ກວດຫຼັງຄາ',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ຝ່າຍ B',
    ຂະແໜງ: 'ຂະແໜງ B',
    ຊັ້ນອາຄານ: 'ຊັ້ນ 4',
    ສະຖານທີ່_ຫ້ອງ: 'Room B',
  };
  const checklistItems = [
    {
      ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
      ໝວດລະບົບກວດ: 'ສະຖານທີ່ຈອດລົດ',
      ລາຍການກວດ: 'ກວດດອກໄຟ',
    },
    {
      ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
      ໝວດລະບົບກວດ: 'ສາງLDBWH-B',
      ລາຍການກວດ: 'ກວດຫຼັງຄາ',
    },
  ];

  const resolvedOne = resolveIncidentCaseReference(caseOne, [inspection], checklistItems);
  const resolvedTwo = resolveIncidentCaseReference(caseTwo, [inspection], checklistItems);

  assert.equal(
    resolvedOne.areaPoint,
    'ສະຖານທີ່ຈອດລົດ',
    'Case 1 derives its own Area/Point from its referenced checkpoint',
  );
  assert.equal(
    resolvedTwo.areaPoint,
    'ສາງLDBWH-B',
    'Case 2 derives its own Area/Point from its referenced checkpoint',
  );
  assert.equal(resolvedOne.floor, 'ຊັ້ນ 2');
  assert.equal(resolvedTwo.floor, 'ຊັ້ນ 4');
  assert.equal(resolvedOne.roomLocation, 'Room A');
  assert.equal(resolvedTwo.roomLocation, 'Room B');
  assert.notEqual(
    resolvedOne.areaPoint,
    inspection.ໝວດລະບົບກວດ,
    'a Case must not display the parent Inspection combined Area/Point',
  );

  const siblings = [caseOne, caseTwo];
  assert.equal(getIncidentCaseDisplayCode(caseOne, siblings), 'LDB-SAF-202 / Case 1');
  assert.equal(getIncidentCaseDisplayCode(caseTwo, siblings), 'LDB-SAF-202 / Case 2');

  const directIncident = {
    PID: 'direct-1',
    ລະຫັດກວດກາ: 'INC-501',
    ຮູບແບບການກວດ: 'ການແຈ້ງເຫດດ່ວນ',
    ລະບົບທີ່ກວດ: 'ລະບົບໄຟຟ້າ',
    ໝວດລະບົບກວດ: 'ຫ້ອງ Server',
    ລາຍການກວດ: 'ວຽກຈາກການແຈ້ງເຫດ',
    'ສາຂາ ': '01.ສາຂາ',
    'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'ຝ່າຍ IT',
    ຂະແໜງ: 'IT',
    ຊັ້ນອາຄານ: 'ຊັ້ນ 3',
    ສະຖານທີ່_ຫ້ອງ: 'Server A',
  };
  const directResolved = resolveIncidentCaseReference(
    directIncident,
    [{ ...inspection, ລະຫັດກວດກາ: 'INC-501' }],
    checklistItems,
  );
  assert.equal(directResolved.areaPoint, 'ຫ້ອງ Server');
  assert.equal(directResolved.systemCategory, 'ລະບົບໄຟຟ້າ');
  assert.equal(getIncidentCaseDisplayCode(directIncident, [directIncident]), 'INC-501');

  const ambiguousChecklist = [
    {
      ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
      ໝວດລະບົບກວດ: 'ຈຸດ A',
      ລາຍການກວດ: 'ລາຍການຊ້ຳ',
    },
    {
      ລະບົບທີ່ກວດ: 'ດ້ານນອກອາຄານ',
      ໝວດລະບົບກວດ: 'ຈຸດ B',
      ລາຍການກວດ: 'ລາຍການຊ້ຳ',
    },
  ];
  const ambiguousResolved = resolveIncidentCaseReference(
    {
      ...caseOne,
      PID: 'inspection-parent-ambiguous',
      ໝວດລະບົບກວດ: 'CCTV',
      ລາຍການກວດ: 'ລາຍການຊ້ຳ',
    },
    [inspection],
    ambiguousChecklist,
  );
  assert.equal(
    ambiguousResolved.areaPoint,
    '',
    'an invalid legacy Asset Group must never be shown as Area/Point when the checkpoint is ambiguous',
  );

  const emptyLegacy = resolveIncidentCaseReference(
    {
      PID: 'legacy-empty',
      ລະຫັດກວດກາ: 'LDB-SAF-MISSING',
      ລະບົບທີ່ກວດ: null,
      ໝວດລະບົບກວດ: undefined,
      ລາຍການກວດ: '',
    },
    [],
    [],
  );
  for (const value of Object.values(emptyLegacy)) {
    assert.notEqual(value, null);
    assert.notEqual(value, undefined);
    assert.notEqual(value, 'null');
    assert.notEqual(value, 'undefined');
  }

  const inspectionsViewSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'InspectionsView.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    inspectionsViewSource,
    /ໝວດລະບົບກວດ:\s*dForm\.assetGroup/g,
    'Inspection-derived Incidents must not store Asset Group in the Case Area/Point field',
  );
  assert.ok(
    (inspectionsViewSource.match(
      /ໝວດລະບົບກວດ:\s*matchedCheckpoint\?\.ໝວດລະບົບກວດ\s*\|\|\s*['"]{2}/g,
    ) || []).length >= 2,
    'new and edited Inspection save paths must persist Case Area/Point from the selected checkpoint',
  );

  const appSource = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
  const updateIncidentSource = appSource.slice(
    appSource.indexOf('const handleUpdateIncident ='),
    appSource.indexOf('const handleDeleteIncidents ='),
  );
  assert.match(
    updateIncidentSource,
    /item\.PID\s*===\s*pid/,
    'Incident edit must update the selected Case by exact PID',
  );
  assert.doesNotMatch(
    updateIncidentSource,
    /setInspections|saveInspections/,
    'editing one Incident Case must not write Case values back to the shared parent Inspection',
  );

  const approvalFlowSource = appSource.slice(
    appSource.indexOf('const handleApproveIncident ='),
    appSource.indexOf('// 3.1 Cancel Repair'),
  );
  assert.match(
    approvalFlowSource,
    /incidents\.find\(item\s*=>\s*item\.PID\s*===\s*pid\)/,
    'approval must resolve the exact Incident Case by PID',
  );
  assert.match(
    approvalFlowSource,
    /resolveIncidentCaseReference\(\s*linkedIncident,/,
    'approval and tracking snapshots must use the shared Case resolver',
  );

  const repairAssessmentSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'RepairAssessmentView.tsx'),
    'utf8',
  );
  assert.match(
    repairAssessmentSource,
    /resolveIncidentCaseReference\(/,
    'Repair Assessment must use the same per-Case reference resolver',
  );
  assert.doesNotMatch(
    repairAssessmentSource,
    /return\s+matchedInsp\.ໝວດລະບົບກວດ/,
    'Repair Assessment must not use the parent Inspection combined Area/Point',
  );

  const incidentsViewSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'IncidentsView.tsx'),
    'utf8',
  );
  assert.doesNotMatch(
    incidentsViewSource,
    /useState\(['"]\u0e82\u0eb0\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99['"]\)/,
    'Direct Incident state must not default Sector to service branch',
  );
  assert.doesNotMatch(
    incidentsViewSource,
    /\|\|\s*['"]\u0e82\u0eb0\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99['"]/,
    'Direct Incident fallbacks must not inject the service branch Sector',
  );
  const startEditingSource = incidentsViewSource.slice(
    incidentsViewSource.indexOf('const startEditing ='),
    incidentsViewSource.indexOf('const handleUpdateIncidentSubmit ='),
  );
  assert.match(
    startEditingSource,
    /resolveIncidentCaseReference\(/,
    'Incident Edit must initialize Case fields through the shared resolver',
  );

  const resolverHelpersSource = incidentsViewSource.slice(
    incidentsViewSource.indexOf('const getCaseReference ='),
    incidentsViewSource.indexOf('// Search & Filter State'),
  );
  assert.match(
    resolverHelpersSource,
    /resolveIncidentCaseReference\(/,
    'Card and Detail helper values must come from the shared Case resolver',
  );
  assert.doesNotMatch(
    resolverHelpersSource,
    /return\s+matchedInsp\.ໝວດລະບົບກວດ/,
    'Card and Detail must not prefer the parent combined Area/Point',
  );

  const exportSource = incidentsViewSource.slice(
    incidentsViewSource.indexOf('const handleExportExcel ='),
    incidentsViewSource.indexOf('const filteredList ='),
  );
  assert.match(
    exportSource,
    /resolveIncidentCaseReference\(\s*inc,/,
    'Excel export must use the shared Case resolver',
  );
  assert.match(
    exportSource,
    /caseReference\.areaPoint/,
    'Excel Area/Point must be the selected Case Area/Point',
  );
  assert.doesNotMatch(
    exportSource,
    /matchedInsp\.ໝວດລະບົບກວດ/,
    'Excel must not export the parent combined Area/Point for every Case',
  );

  assert.ok(
    (incidentsViewSource.match(/getIncidentCaseDisplayCode\(/g) || []).length >= 3,
    'pending Card, approved table, and Detail must distinguish sibling Case labels',
  );

  assert.doesNotMatch(
    inspectionsViewSource,
    /\u0e82\u0eb0\u0ec1\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99|\u0e82\u0eb0\u0ec1\u0edc\u0e87 \u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99/,
    'Inspection form must not seed new Cases with legacy default service Sector values',
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
