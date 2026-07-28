import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const modulePath = path.join(root, 'src', 'cascadeDelete.ts');
const appPath = path.join(root, 'src', 'App.tsx');
const inspectionsViewPath = path.join(root, 'src', 'components', 'InspectionsView.tsx');
const incidentsViewPath = path.join(root, 'src', 'components', 'IncidentsView.tsx');
const tempBundle = path.join(root, 'tests', '.cascade-delete.bundle.mjs');

assert.ok(fs.existsSync(modulePath), 'src/cascadeDelete.ts must exist');

await build({
  entryPoints: [modulePath],
  outfile: tempBundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

const inspection = (PID, code) => ({ PID, ລະຫັດກວດກາ: code });
const incident = (PID, code, extra = {}) => ({ PID, ລະຫັດກວດກາ: code, ...extra });
const assessment = (PID, incidentId, inspectionId) => ({
  PID,
  assessmentId: PID,
  incidentId,
  inspectionId,
});
const workflow = (PID, code, extra = {}) => ({ PID, ລະຫັດກວດກາ: code, ...extra });

const collections = {
  inspections: [
    inspection('INSP-1', 'CHK-1'),
    inspection('INSP-12', 'CHK-12'),
  ],
  incidents: [
    incident('INSP-1-1', 'CHK-1', { ຮູບພາບລາຍການທີ່ເພ: 'data:image/png;base64,A' }),
    incident('INSP-1-2', 'CHK-1'),
    incident('INC-12', 'CHK-12'),
  ],
  assessments: [
    assessment('ASM-CHILD-A', 'INSP-1-1', 'CHK-1'),
    assessment('ASM-CHILD-B', 'INSP-1-2', 'CHK-1'),
    assessment('ASM-LOOKALIKE', 'INC-12', 'CHK-12'),
  ],
  approvals: [
    workflow('INSP-1-1', 'CHK-1', { ເອກະສານອະນຸມັດ: 'approval-a.pdf' }),
    workflow('INSP-1-2', 'CHK-1'),
    workflow('INC-12', 'CHK-12'),
  ],
  repairTracking: [
    workflow('INSP-1-1', 'CHK-1', { beforePhoto: 'before-a.jpg', duringPhoto: 'during-a.jpg' }),
    workflow('INSP-1-2', 'CHK-1', { afterPhoto: 'after-b.jpg' }),
    workflow('INC-12', 'CHK-12'),
  ],
  repairs: [
    workflow('INSP-1-1', 'CHK-1', { ຮູບພາຍຫຼັງການແກ້ໄຂ: 'history-a.jpg' }),
    workflow('INSP-1-2', 'CHK-1'),
    workflow('INC-12', 'CHK-12'),
  ],
};

try {
  const cascade = await import(`${pathToFileURL(tempBundle).href}?t=${Date.now()}`);

  const inspectionPlan = cascade.planCascadeDelete(collections, 'inspection', [' INSP-1 ', '', 'INSP-1']);
  assert.deepEqual(inspectionPlan.impact, {
    inspections: 1,
    incidents: 2,
    assessments: 2,
    approvals: 2,
    repairTracking: 2,
    repairs: 2,
    attachments: 6,
    totalRecords: 11,
  });
  assert.equal(inspectionPlan.remaining.inspections.some(item => item.PID === 'INSP-12'), true);
  assert.equal(inspectionPlan.remaining.incidents.some(item => item.PID === 'INC-12'), true);
  assert.equal(inspectionPlan.deletedPids.includes('ASM-CHILD-A'), true);
  assert.equal(inspectionPlan.deletedPids.includes('ASM-CHILD-B'), true);
  assert.equal(new Set(inspectionPlan.deletedPids).size, inspectionPlan.deletedPids.length);

  const incidentPlan = cascade.planCascadeDelete(collections, 'incident', ['INSP-1-1']);
  assert.equal(incidentPlan.impact.inspections, 0, 'incident deletion must preserve its parent inspection');
  assert.equal(incidentPlan.impact.incidents, 1);
  assert.equal(incidentPlan.impact.assessments, 1);
  assert.equal(incidentPlan.remaining.inspections.some(item => item.PID === 'INSP-1'), true);
  assert.equal(incidentPlan.remaining.incidents.some(item => item.PID === 'INSP-1-2'), true);
  assert.equal(incidentPlan.remaining.assessments.some(item => item.PID === 'ASM-CHILD-B'), true);
  assert.equal(incidentPlan.remaining.incidents.some(item => item.PID === 'INC-12'), true);

  const prefixSafetyCollections = {
    inspections: [],
    incidents: [incident('INC-1', ''), incident('INC-1-CHILD', ''), incident('INC-12', '')],
    assessments: [],
    approvals: [],
    repairTracking: [],
    repairs: [],
  };
  const prefixPlan = cascade.planCascadeDelete(prefixSafetyCollections, 'incident', ['INC-1']);
  assert.deepEqual(prefixPlan.deleted.incidents.map(item => item.PID), ['INC-1']);
  assert.deepEqual(prefixPlan.remaining.incidents.map(item => item.PID), ['INC-1-CHILD', 'INC-12']);

  const blankLinks = {
    inspections: [inspection('ROOT', '')],
    incidents: [incident('UNRELATED', '')],
    assessments: [assessment('ASM-EMPTY', '', '')],
    approvals: [workflow('APP-EMPTY', '')],
    repairTracking: [workflow('TRK-EMPTY', '')],
    repairs: [workflow('LOG-EMPTY', '')],
  };
  const blankPlan = cascade.planCascadeDelete(blankLinks, 'inspection', ['ROOT']);
  assert.equal(blankPlan.impact.totalRecords, 1);
  assert.equal(blankPlan.remaining.incidents.length, 1);
  assert.equal(blankPlan.remaining.assessments.length, 1);

  const orphanHistoryCollections = {
    inspections: [inspection('ORPHAN-ROOT', 'CHK-ORPHAN')],
    incidents: [],
    assessments: [],
    approvals: [],
    repairTracking: [],
    repairs: [workflow('ORPHAN-HISTORY', 'CHK-ORPHAN')],
  };
  const orphanHistoryPlan = cascade.planCascadeDelete(
    orphanHistoryCollections,
    'inspection',
    ['ORPHAN-ROOT'],
  );
  assert.equal(
    orphanHistoryPlan.impact.repairs,
    1,
    'inspection deletion must include repair history even when its incident was already removed',
  );
  assert.deepEqual(orphanHistoryPlan.deleted.repairs.map(item => item.PID), ['ORPHAN-HISTORY']);
  assert.equal(orphanHistoryPlan.remaining.repairs.length, 0);
  assert.equal(orphanHistoryPlan.deletedPids.includes('ORPHAN-HISTORY'), true);

  const appSource = fs.readFileSync(appPath, 'utf8');
  assert.match(appSource, /planCascadeDelete/);
  assert.match(appSource, /executeCascadeDelete\('inspection', pids\)/);
  assert.match(appSource, /executeCascadeDelete\('incident', pids\)/);
  for (const saveName of [
    'saveInspections',
    'saveIncidents',
    'saveAssessments',
    'saveApprovals',
    'saveRepairTracking',
    'saveRepairs',
  ]) {
    assert.match(appSource, new RegExp(`${saveName}\\(plan\\.remaining\\.`));
  }
  assert.match(appSource, /addDeletedPIDs\(plan\.deletedPids\)/);

  const inspectionsSource = fs.readFileSync(inspectionsViewPath, 'utf8');
  assert.match(inspectionsSource, /getDeleteImpact/);
  for (const label of ['Inspection', 'Incident', 'Assessment', 'Approval', 'Tracking', 'History', 'Attachments / Evidence']) {
    assert.ok(inspectionsSource.includes(label), `${label} Inspection impact label must render`);
  }
  assert.match(inspectionsSource, /totalRecords\s*===\s*0/);
  assert.match(appSource, /getDeleteImpact=\{\(pids\)\s*=>\s*getDeleteImpact\('inspection', pids\)\}/);

  const incidentsSource = fs.readFileSync(incidentsViewPath, 'utf8');
  assert.match(incidentsSource, /getDeleteImpact/);
  for (const label of ['Inspection', 'Incident', 'Assessment', 'Approval', 'Tracking', 'History', 'Attachments / Evidence']) {
    assert.ok(incidentsSource.includes(label), `${label} Incident impact label must render`);
  }
  assert.match(incidentsSource, /currentUser\.status\s*===\s*["']Admin["']/);
  assert.match(incidentsSource, /onDeleteIncidents\(pendingDeletePids\)/);
  assert.match(incidentsSource, /setSelectedPids\(\[\]\)/);
  assert.match(incidentsSource, /totalRecords\s*===\s*0/);
  assert.match(appSource, /getDeleteImpact=\{\(pids\)\s*=>\s*getDeleteImpact\('incident', pids\)\}/);

  console.log('Cascade delete planner checks passed.');
} finally {
  fs.rmSync(tempBundle, { force: true });
}
