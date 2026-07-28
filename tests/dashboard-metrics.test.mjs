import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { access, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('./dashboard-metrics.bundle.mjs', import.meta.url);
const outputPath = fileURLToPath(output);

async function loadMetrics() {
  await build({
    entryPoints: ['src/dashboardMetrics.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outputPath,
  });
  return import(`${output.href}?cacheBust=${Date.now()}`);
}

const sources = {
  inspections: [
    { PID: 'I-1', 'ລະຫັດກວດກາ': 'CHK-1', 'ສາຂາ ': '00.ສໍານັກງານໃຫຍ່', 'ສະຖານະ': 'ຜິດປົກກະຕີ' },
    { PID: 'I-1-DUP', 'ລະຫັດກວດກາ': 'CHK-1', 'ສາຂາ ': '00.ສໍານັກງານໃຫຍ່', 'ສະຖານະ': 'ຜິດປົກກະຕີ' },
  ],
  incidents: [
    { PID: 'INC-WAIT-ASM', 'ສາຂາ ': '01.ສາຂາ ນະຄອນຫຼວງ', 'ສະຖານະ': 'ລໍຖ້າປະເມີນ', 'ປະເມີນຜົນກະທົບ': 'ສູງ' },
    { PID: 'INC-WAIT-APP', 'ສາຂາ ': '01.ສາຂາ ນະຄອນຫຼວງ', 'ສະຖານະ': 'ລໍຖ້າອະນຸມັດ', 'ປະເມີນຜົນກະທົບ': 'ປານກາງ' },
    { PID: 'INC-TRACK', 'ສາຂາ ': '02.ສາຂາ ຜົ້ງສາລີ', 'ສະຖານະ': 'ກຳລັງສ້ອມ', 'ປະເມີນຜົນກະທົບ': 'ຕ່ຳ' },
    { PID: 'INC-DONE', 'ສາຂາ ': '02.ສາຂາ ຜົ້ງສາລີ', 'ສະຖານະ': 'ສຳເລັດ' },
  ],
  assessments: [{ PID: 'ASM-1', assessmentId: 'ASM-1', incidentId: 'INC-WAIT-APP', assessmentStatus: 'ປະເມີນແລ້ວ' }],
  approvals: [],
  repairTracking: [
    { PID: 'INC-TRACK', trackingStatus: 'ກຳລັງດຳເນີນການ', repairCost: 200000 },
    { PID: 'INC-DONE', trackingStatus: 'ປິດງານແລ້ວ', repairCost: 900000 },
  ],
  repairs: [{ PID: 'INC-DONE', 'ມູນຄ່າສ້ອມແປງ': 1000000, 'ສະຖານະ': 'ສຳເລັດ' }],
  pmAssets: [
    { assetCode: 'PM-DUE', branch: '01.ສາຂາ ນະຄອນຫຼວງ', maintenanceStatus: 'ໃກ້ຮອດກຳນົດ' },
    { assetCode: 'PM-LATE', branch: '02.ສາຂາ ຜົ້ງສາລີ', maintenanceStatus: 'ເກີນກຳນົດ' },
  ],
  pmHistory: [],
  users: [{ username: 'admin', status: 'Admin', allowedTabs: ['dashboard'] }],
  branches: [
    { 'ລຳດັບ': 1, 'ສາຂາ': '00.ສໍານັກງານໃຫຍ່', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'HQ' },
    { 'ລຳດັບ': 2, 'ສາຂາ': '01.ສາຂາ ນະຄອນຫຼວງ', 'ຝ່າຍ/ໜ່ວຍບໍລິການ': 'Branch' },
  ],
};

try {
  const { buildDashboardMetrics, getDashboardRecordBranch, getDashboardRecordDate } = await loadMetrics();
  assert.equal(
    getDashboardRecordBranch({ 'ສາຂາ ': '00.ສໍານັກງານໃຫຍ່' }),
    '00.ສໍານັກງານໃຫຍ່',
  );
  assert.equal(
    getDashboardRecordBranch({ 'ສາຂາຊັບສິນ': '03.ສາຂາ ຫຼວງນ້ຳທາ' }),
    '03.ສາຂາ ຫຼວງນ້ຳທາ',
  );
  assert.equal(
    getDashboardRecordDate({ inspectionDate: '31/01/2026' })?.toISOString(),
    '2026-01-31T00:00:00.000Z',
  );
  assert.equal(
    getDashboardRecordDate({ inspectionDate: 25569 })?.toISOString(),
    '1970-01-01T00:00:00.000Z',
  );

  const mojibakePattern = new RegExp(['\u00e0\u00ba', '\u00e0\u00bb'].join('|'));
  assert.doesNotMatch(await readFile(new URL('../src/dashboardMetrics.ts', import.meta.url), 'utf8'), mojibakePattern);
  assert.doesNotMatch(await readFile(new URL(import.meta.url), 'utf8'), mojibakePattern);

  {
    const model = buildDashboardMetrics(sources, new Date('2026-01-15T00:00:00Z'));
    assert.equal(model.kpi.totalInspections, 1);
    assert.equal(model.kpi.openIncidents, 3);
    assert.equal(model.kpi.waitingAssessment, 1);
    assert.equal(model.kpi.waitingApproval, 1);
    assert.equal(model.kpi.repairing, 1);
    assert.equal(model.kpi.completed, 1);
    assert.equal(model.kpi.pmDueSoon, 1);
    assert.equal(model.kpi.pmOverdue, 1);
    assert.equal(model.kpi.totalRepairCost, 1200000);
    assert.equal(model.users.total, 1);
    assert.doesNotMatch(JSON.stringify(model), /NaN|undefined/);
    assert.equal(getDashboardRecordBranch({ branch: 'North' }), 'North');
    assert.equal(getDashboardRecordDate({ createdAt: '2026-01-14' })?.toISOString(), '2026-01-14T00:00:00.000Z');
  }

  {
    const model = buildDashboardMetrics({
      ...sources,
      incidents: [{ PID: 'INC-PROGRESSION', status: 'Open' }],
      assessments: [{ assessmentId: 'ASM-PROGRESSION', incidentId: 'INC-PROGRESSION', assessmentStatus: 'Completed' }],
      approvals: [{ PID: 'INC-PROGRESSION' }],
      repairTracking: [{ PID: 'INC-PROGRESSION', trackingStatus: 'Completed', repairCost: 450000 }],
      repairs: [{ PID: 'INC-PROGRESSION', repairCost: 700000, status: 'Completed' }],
    });
    assert.equal(model.kpi.waitingAssessment, 0);
    assert.equal(model.kpi.waitingApproval, 0);
    assert.equal(model.kpi.repairing, 0);
    assert.equal(model.kpi.completed, 1);
    assert.equal(model.kpi.totalRepairCost, 700000);
  }

  {
    const model = buildDashboardMetrics({
      ...sources,
      users: [
        { username: 'admin-with-branch', status: 'Admin', branch: 'HQ' },
        { username: 'branch-user-without-branch', status: 'Branch User' },
        { username: 'user-without-branch', status: 'User' },
      ],
    });
    assert.equal(model.users.admins, 1);
    assert.equal(model.users.branchUsers, 2);
  }

  {
    const model = buildDashboardMetrics({
      inspections: [
        { inspectionId: 'DDMMYYYY-1', inspectionDate: '31/01/2026', 'ສາຂາຊັບສິນ': '03.ສາຂາ ຫຼວງນ້ຳທາ' },
      ],
      branches: [{ 'ສາຂາ': '03.ສາຂາ ຫຼວງນ້ຳທາ' }],
    });
    assert.deepEqual(model.monthlyTrend, [
      { month: '2026-01', inspections: 1, incidents: 0, completed: 0 },
    ]);
    assert.equal(
      model.branchPerformance.find(item => item.branch === '03.ສາຂາ ຫຼວງນ້ຳທາ')?.inspections,
      1,
    );
  }

  {
    const model = buildDashboardMetrics({
      branches: [
        { branch: 'Alpha Branch' },
        { branch: 'Beta Branch' },
        { branch: 'Zero Activity Branch' },
      ],
      inspections: [
        { inspectionId: 'ALPHA-INSPECTION', branch: '  alpha   branch ', defectCount: 3, inspectionDate: '2026-03-01', status: 'Checked' },
        { inspectionId: 'BETA-INSPECTION', branch: 'Beta Branch', defectCount: Number.NaN, inspectionDate: '2026-03-01' },
      ],
      incidents: [
        { PID: 'ALPHA-WAIT-ASSESSMENT', branch: 'Alpha Branch', status: 'Open', impactLevel: 'Low', createdAt: '2026-03-01' },
        { PID: 'ALPHA-WAIT-APPROVAL', branch: 'Alpha Branch', status: 'Open', impactLevel: 'Medium', createdAt: '2026-03-01' },
        { PID: 'ALPHA-TRACKING', branch: 'Alpha Branch', status: 'Open', impactLevel: 'Low', createdAt: '2026-03-01' },
        { PID: 'ALPHA-HISTORY', branch: 'Alpha Branch', status: 'Open', impactLevel: 'Low', createdAt: '2026-03-01' },
        { PID: 'BETA-HIGH', branch: 'Beta Branch', status: 'Open', impactLevel: 'High', createdAt: '2026-03-02' },
      ],
      assessments: [
        { assessmentId: 'ASSESS-ALPHA', incidentId: 'ALPHA-WAIT-APPROVAL', branch: 'Alpha Branch', assessmentStatus: 'Completed', assessmentDate: '2026-03-02' },
      ],
      repairTracking: [
        { PID: 'ALPHA-TRACKING', branch: 'Alpha Branch', trackingStatus: 'Repairing', repairCost: 200, updatedAt: '2026-03-04' },
        { PID: 'ALPHA-HISTORY', branch: 'Alpha Branch', trackingStatus: 'Repairing', repairCost: 999, updatedAt: '2026-03-02' },
      ],
      repairs: [
        { id: 'HISTORY-ALPHA', PID: 'ALPHA-HISTORY', branch: 'Alpha Branch', status: 'Completed', repairCost: 700, actualFinishDate: '2026-03-03' },
      ],
      pmAssets: [
        { assetCode: 'ALPHA-DUE', branch: 'Alpha Branch', maintenanceStatus: 'Due Soon' },
        { assetCode: 'BETA-OVERDUE', branch: 'Beta Branch', maintenanceStatus: 'Overdue' },
      ],
    });

    const alpha = model.branchPerformance.find(item => item.branch === 'Alpha Branch');
    const beta = model.branchPerformance.find(item => item.branch === 'Beta Branch');
    const zero = model.branchPerformance.find(item => item.branch === 'Zero Activity Branch');

    assert.deepEqual(alpha, {
      branch: 'Alpha Branch',
      inspections: 1,
      inspectionDefects: 3,
      openIncidents: 4,
      highSeverity: 0,
      waitingAssessment: 1,
      waitingApproval: 1,
      repairing: 1,
      completed: 1,
      pmDueSoon: 1,
      pmOverdue: 0,
      repairCost: 900,
      latestStatus: 'Repairing',
      health: 'attention',
    });
    assert.equal(beta?.inspectionDefects, 0);
    assert.equal(beta?.highSeverity, 1);
    assert.equal(beta?.pmDueSoon, 0);
    assert.equal(beta?.pmOverdue, 1);
    assert.equal(beta?.health, 'critical');
    assert.equal(zero?.health, 'healthy');
    assert.equal(zero?.latestStatus, 'No recent activity');

    for (const branch of model.branchPerformance) {
      for (const [key, metric] of Object.entries(branch)) {
        if (typeof metric === 'number') assert.ok(Number.isFinite(metric), `${branch.branch}.${key} must be finite`);
      }
      assert.ok(branch.latestStatus.trim());
    }
  }

  {
    const model = buildDashboardMetrics({
      branches: [{ branch: 'Alpha' }, { branch: 'Beta' }],
      incidents: [
        { PID: 'SHARED-ASSESS', branch: 'Alpha', status: 'Open' },
        { PID: 'SHARED-ASSESS', branch: 'Beta', status: 'Open' },
        { PID: 'SHARED-APPROVAL', branch: 'Alpha', status: 'Open' },
        { PID: 'SHARED-TRACKING', branch: 'Alpha', status: 'Open' },
      ],
      assessments: [
        { assessmentId: 'BETA-ASSESSMENT', incidentId: 'SHARED-ASSESS', branch: 'Beta', assessmentStatus: 'Completed' },
        { assessmentId: 'ALPHA-ASSESSMENT', incidentId: 'SHARED-APPROVAL', branch: 'Alpha', assessmentStatus: 'Completed' },
      ],
      approvals: [
        { PID: 'SHARED-APPROVAL', branch: 'Beta', status: 'Approved' },
      ],
      repairTracking: [
        { PID: 'SHARED-TRACKING', branch: 'Alpha', trackingStatus: 'Repairing', repairCost: 100 },
      ],
      repairs: [
        { id: 'BETA-HISTORY', PID: 'SHARED-TRACKING', branch: 'Beta', status: 'Completed', repairCost: 500 },
      ],
    });

    const alpha = model.branchPerformance.find(item => item.branch === 'Alpha');
    const beta = model.branchPerformance.find(item => item.branch === 'Beta');
    assert.equal(alpha?.openIncidents, 3, 'cross-branch incident ID collisions must retain Alpha records');
    assert.equal(beta?.openIncidents, 1, 'cross-branch incident ID collisions must retain Beta records');
    assert.equal(alpha?.waitingAssessment, 1, 'Beta assessment must not advance Alpha incident');
    assert.equal(beta?.waitingApproval, 1, 'Beta assessment advances only the Beta incident');
    assert.equal(alpha?.waitingApproval, 1, 'Beta approval must not approve Alpha incident');
    assert.equal(alpha?.repairing, 1, 'Beta history must not complete Alpha tracking');
    assert.equal(alpha?.completed, 0);
    assert.equal(alpha?.repairCost, 100);
    assert.equal(beta?.completed, 1);
    assert.equal(beta?.repairCost, 500);

    assert.equal(model.kpi.openIncidents, 4, 'global incident identity must include branch');
    assert.equal(model.kpi.waitingAssessment, 1, 'global waiting assessment must reconcile to branch totals');
    assert.equal(model.kpi.waitingApproval, 2, 'a downstream row in one branch must not advance another branch');
    assert.equal(model.kpi.repairing, 1, 'history in another branch must not suppress active tracking');
    assert.equal(model.kpi.completed, 1);
    assert.equal(model.kpi.totalRepairCost, 600, 'global repair cost must reconcile to branch totals');
    for (const metric of ['openIncidents', 'waitingAssessment', 'waitingApproval', 'repairing', 'completed']) {
      assert.equal(
        model.kpi[metric],
        model.branchPerformance.reduce((sum, branch) => sum + branch[metric], 0),
        `${metric} must equal the sum of branch metrics when PIDs collide`,
      );
    }
    assert.equal(
      model.kpi.totalRepairCost,
      model.branchPerformance.reduce((sum, branch) => sum + branch.repairCost, 0),
      'repair cost must equal the sum of branch costs when PIDs collide',
    );
  }

  {
    const model = buildDashboardMetrics({
      branches: [{ branch: 'Alpha' }, { branch: 'Beta' }],
      repairs: [
        { historyId: 'ALPHA-ROW-1', PID: 'COLLIDING-HISTORY', branch: ' Alpha ', status: 'Completed', repairCost: 100 },
        { historyId: 'ALPHA-ROW-2', PID: 'COLLIDING-HISTORY', branch: 'alpha', status: 'Completed', repairCost: 999 },
        { historyId: 'BETA-ROW-1', PID: 'COLLIDING-HISTORY', branch: 'Beta', status: 'Completed', repairCost: 200 },
        { historyId: 'NO-PID-ROW', branch: 'Beta', status: 'Completed', repairCost: 50 },
        { historyId: 'NO-PID-ROW', branch: 'Beta', status: 'Completed', repairCost: 500 },
      ],
    });

    assert.equal(model.kpi.completed, 3, 'history completion uses branch plus PID, then history ID when PID is absent');
    assert.equal(model.kpi.totalRepairCost, 350, 'history cost dedupes by branch plus PID and falls back to history ID without PID');
    assert.equal(model.branchPerformance.find(item => item.branch === 'Alpha')?.completed, 1);
    assert.equal(model.branchPerformance.find(item => item.branch === 'Alpha')?.repairCost, 100);
    assert.equal(model.branchPerformance.find(item => item.branch === 'Beta')?.completed, 2);
    assert.equal(model.branchPerformance.find(item => item.branch === 'Beta')?.repairCost, 250);
  }

  {
    const model = buildDashboardMetrics({
      branches: [{ branch: 'History Branch' }, { branch: 'PM Branch' }],
      inspections: [
        { inspectionId: 'PM-TIE', branch: 'PM Branch', inspectionDate: '2026-05-01', status: 'Checked' },
      ],
      repairTracking: [
        { PID: 'HISTORY-WINS', branch: 'History Branch', updatedAt: '2026-04-10', trackingStatus: 'Repairing' },
      ],
      repairs: [
        { id: 'HISTORY-WINS-ROW', PID: 'HISTORY-WINS', branch: 'History Branch', actualFinishDate: '2026-04-08', status: 'Completed' },
      ],
      pmHistory: [
        { id: 'PM-HISTORY', branch: 'PM Branch', inspectionDate: '2026-05-01', overallResult: 'PM Normal' },
      ],
    });

    assert.equal(
      model.branchPerformance.find(item => item.branch === 'History Branch')?.latestStatus,
      'Completed',
      'History must supersede stale Tracking even when Tracking has a later timestamp',
    );
    assert.equal(
      model.branchPerformance.find(item => item.branch === 'PM Branch')?.latestStatus,
      'PM Normal',
      'PM History result must win deterministic same-date activity precedence',
    );
  }

  {
    const model = buildDashboardMetrics({
      inspections: [
        { inspectionId: 'SHARED', inspectionName: 'Generator inspection', branch: 'HQ', status: 'Checked', inspectionDate: 46023 },
        { inspectionId: 'SHARED', inspectionName: 'Duplicate inspection', branch: 'HQ', status: 'Duplicate', inspectionDate: '2026-01-02' },
      ],
      incidents: [
        { incidentId: 'SHARED', issueDetails: 'Cooling alarm', branch: 'North', status: 'Open', createdAt: '31-01-2026', password: 'must-not-leak' },
      ],
      assessments: [
        { assessmentId: 'ASM-1', assetName: 'Cooling unit', branch: 'North', assessmentStatus: 'Completed', assessmentDate: '2026-01-29T10:30:00Z' },
      ],
      approvals: [
        { approvalId: 'APR-1', referenceName: 'Repair approval', branch: 'South', status: 'Approved', approvalDate: '2026-01-28' },
      ],
      repairTracking: [
        { trackingId: 'TRK-1', assetCode: 'AC-77', branch: 'South', trackingStatus: 'Repairing', updatedAt: 'not-a-date' },
      ],
      repairs: [
        { historyId: 'HIS-1', assetName: 'Main pump', branch: '', status: '', actualFinishDate: '2026-01-27', password_raw: 'must-not-leak' },
      ],
      pmHistory: [
        { id: 'PM-1', assetCode: 'PM-AC-1', branch: 'West', overallResult: 'Normal', inspectionDate: '2026-01-26' },
        { assetCode: 'PM-2', branch: 'West', inspectionDate: 'invalid' },
        { branch: '', status: null, date: null },
      ],
    });

    assert.deepEqual(
      model.recentActivity.map(item => item.source),
      ['Incident', 'Assessment', 'Approval', 'Repair History', 'PM History', 'Inspection', 'PM History', 'PM History', 'Tracking'],
      'all seven sources are normalized, valid dates sort newest-first, and missing dates sort last',
    );
    assert.equal(model.recentActivity.filter(item => item.source === 'Inspection').length, 1, 'duplicates within a source are removed');
    assert.ok(model.recentActivity.some(item => item.source === 'Inspection' && item.id === 'SHARED'));
    assert.ok(model.recentActivity.some(item => item.source === 'Incident' && item.id === 'SHARED'), 'ID reuse across sources must not collide');
    assert.equal(model.recentActivity[0].displayDate, '2026-01-31');
    assert.equal(model.recentActivity.find(item => item.source === 'Inspection')?.displayDate, '2026-01-01');
    assert.equal(model.recentActivity.find(item => item.source === 'Tracking')?.displayDate, 'No date');
    assert.equal(model.recentActivity.find(item => item.source === 'Repair History')?.branch, '—');
    assert.equal(model.recentActivity.find(item => item.source === 'Repair History')?.status, 'No status');

    const fallback = model.recentActivity.find(item => item.source === 'PM History' && item.branch === '—');
    assert.ok(fallback?.id.startsWith('pm-history:'), 'records without stable IDs use a deterministic safe fallback');
    assert.equal(fallback?.title, 'PM History');
    assert.equal(fallback?.displayDate, 'No date');

    for (const item of model.recentActivity) {
      assert.deepEqual(Object.keys(item).sort(), ['branch', 'displayDate', 'id', 'source', 'status', 'timestamp', 'title']);
      for (const field of ['id', 'source', 'title', 'branch', 'status', 'displayDate']) {
        assert.equal(typeof item[field], 'string');
        assert.ok(item[field].trim(), `${item.source}.${field} must be non-empty`);
      }
      assert.ok(item.timestamp === null || Number.isFinite(item.timestamp));
    }
    assert.doesNotMatch(JSON.stringify(model.recentActivity), /password|password_raw|must-not-leak|NaN|undefined/i);
  }

  {
    const model = buildDashboardMetrics({
      incidents: Array.from({ length: 25 }, (_, index) => ({
        incidentId: `CAP-${index}`,
        issueDetails: `Issue ${index}`,
        branch: 'Cap Branch',
        status: 'Open',
        createdAt: `2026-02-${String(index + 1).padStart(2, '0')}`,
      })),
    });
    assert.equal(model.recentActivity.length, 20, 'metric activity is capped at 20');
    assert.equal(model.recentActivity[0].id, 'CAP-24');
    assert.equal(model.recentActivity.at(-1)?.id, 'CAP-5');
  }

  {
    const model = buildDashboardMetrics({
      repairTracking: [
        {
          trackingId: '',
          PID: 'TRK-FALLTHROUGH',
          assetName: '',
          issueDetails: 'Pump pressure issue',
          branch: '',
          branchName: 'Fallback Branch',
          status: '',
          trackingStatus: 'Repairing',
          updatedAt: '2026-03-06',
        },
        {
          trackingId: '',
          PID: 'TRK-FALLTHROUGH',
          issueDetails: 'Duplicate row',
          branchName: 'Fallback Branch',
          trackingStatus: 'Repairing',
          updatedAt: '2026-03-05',
        },
      ],
      incidents: [{
        incidentId: Number.POSITIVE_INFINITY,
        PID: 'INC-FINITE',
        assetName: Number.NaN,
        issueDetails: 'Finite display title',
        branch: Number.NEGATIVE_INFINITY,
        branchName: 'Finite Branch',
        status: Number.NaN,
        overallResult: 'Open',
        date: Number.POSITIVE_INFINITY,
        createdAt: '2026-03-07',
      }],
    });

    const trackingItems = model.recentActivity.filter(item => item.source === 'Tracking');
    assert.equal(trackingItems.length, 1, 'empty preferred IDs must fall through to PID before source-scoped deduplication');
    assert.deepEqual(trackingItems[0], {
      id: 'TRK-FALLTHROUGH',
      source: 'Tracking',
      title: 'Pump pressure issue',
      branch: 'Fallback Branch',
      status: 'Repairing',
      timestamp: Date.parse('2026-03-06T00:00:00.000Z'),
      displayDate: '2026-03-06',
    });

    const finiteItem = model.recentActivity.find(item => item.source === 'Incident');
    assert.deepEqual(finiteItem, {
      id: 'INC-FINITE',
      source: 'Incident',
      title: 'Finite display title',
      branch: 'Finite Branch',
      status: 'Open',
      timestamp: Date.parse('2026-03-07T00:00:00.000Z'),
      displayDate: '2026-03-07',
    });
    assert.doesNotMatch(JSON.stringify(model.recentActivity), /NaN|Infinity/);
  }

  {
    const model = buildDashboardMetrics({
      inspections: [
        { PID: 'INSPECTION-PID-ONLY', branch: 'Alpha', inspectionDate: '2026-03-08', status: 'Checked' },
        { PID: 'INSPECTION-PID-ONLY', branch: 'Alpha', inspectionDate: '2026-03-07', status: 'Duplicate' },
      ],
      assessments: [
        { PID: 'ASSESSMENT-PID-ONLY', branch: 'Alpha', assessmentDate: '2026-03-06', assessmentStatus: 'Completed' },
        { PID: 'ASSESSMENT-PID-ONLY', branch: 'Alpha', assessmentDate: '2026-03-05', assessmentStatus: 'Duplicate' },
      ],
      users: [{ username: 'activity-user', branch: 'Alpha', createdAt: '2026-03-09' }],
    });

    assert.equal(model.recentActivity.filter(item => item.source === 'Inspection').length, 1);
    assert.equal(model.recentActivity.find(item => item.source === 'Inspection')?.id, 'INSPECTION-PID-ONLY');
    assert.equal(model.recentActivity.filter(item => item.source === 'Assessment').length, 1);
    assert.equal(model.recentActivity.find(item => item.source === 'Assessment')?.id, 'ASSESSMENT-PID-ONLY');
    assert.doesNotMatch(
      model.recentActivity.map(item => item.source).join(','),
      /User|Permission/,
      'credential administration remains outside the seven-source transaction timeline',
    );
  }

  {
    assert.equal(
      getDashboardRecordDate({ date: '', createdAt: '2026-03-04' })?.toISOString(),
      '2026-03-04T00:00:00.000Z',
      'blank primary dates must not shadow later valid date fields',
    );
    assert.equal(
      getDashboardRecordDate({ date: 'not-a-date', createdAt: '2026-03-05' })?.toISOString(),
      '2026-03-05T00:00:00.000Z',
      'invalid primary dates must not shadow later valid date fields',
    );
    assert.equal(getDashboardRecordDate({ date: '2026-02-30' }), null, 'impossible ISO dates must be rejected');
    assert.equal(
      getDashboardRecordDate({ date: 'Tue, 03 Mar 2026 00:00:00 GMT' })?.toISOString(),
      '2026-03-03T00:00:00.000Z',
      'valid native date formats remain supported',
    );
    assert.equal(
      getDashboardRecordDate({ date: '46179' })?.toISOString(),
      '2026-06-06T00:00:00.000Z',
      'Excel serial dates stored as strings must not be interpreted as five-digit calendar years',
    );
    assert.equal(
      getDashboardRecordDate({ date: '46179-12', createdAt: '2026-06-08' })?.toISOString(),
      '2026-06-08T00:00:00.000Z',
      'malformed spreadsheet fragments must not surface as extended-year dashboard dates',
    );

    const model = buildDashboardMetrics({
      incidents: [
        { incidentId: 'VALID-LATER-KEY', date: 'invalid', createdAt: '2026-03-05' },
        { incidentId: 'IMPOSSIBLE-ISO', date: '2026-02-30' },
      ],
    });
    assert.deepEqual(model.recentActivity.map(item => item.id), ['VALID-LATER-KEY', 'IMPOSSIBLE-ISO']);
    assert.equal(model.recentActivity[1].timestamp, null);
    assert.equal(model.recentActivity[1].displayDate, 'No date');
  }

  {
    const detailed = buildDashboardMetrics({
      inspections: [
        { inspectionId: 'INS-NORMAL', branch: 'HQ', status: 'Normal', defectCount: 0 },
        { inspectionId: 'INS-ABNORMAL', branch: 'HQ', status: 'Abnormal', defectCount: 2 },
      ],
      incidents: [
        { PID: 'INC-HIGH', branch: 'HQ', inspectionCode: 'INC-001', status: 'Open', impactLevel: 'High' },
        { PID: 'INC-MED', branch: 'HQ', inspectionCode: 'INC-002', status: 'Open', impactLevel: 'Medium' },
        { PID: 'LDB-LOW', branch: 'HQ', inspectionCode: 'LDB-001', status: 'Open', impactLevel: 'Low' },
        { PID: 'INC-CANCEL', branch: 'HQ', inspectionCode: 'INC-003', status: 'Cancelled', impactLevel: 'Critical' },
        { PID: 'INC-APPROVED', branch: 'HQ', inspectionCode: 'INC-004', status: 'Open', impactLevel: 'Medium' },
        { PID: 'INC-WAIT-APP', branch: 'HQ', inspectionCode: 'INC-005', status: 'Open', impactLevel: 'Medium' },
        { PID: 'INC-WAIT-ASM', branch: 'HQ', inspectionCode: 'INC-006', status: 'Open', impactLevel: 'Low' },
      ],
      assessments: [
        { assessmentId: 'ASM-WAIT-APP', incidentId: 'INC-WAIT-APP', branch: 'HQ', assessmentStatus: 'Completed' },
      ],
      approvals: [
        { approvalId: 'APP-1', PID: 'INC-APPROVED', branch: 'HQ', status: 'Approved' },
      ],
      repairTracking: [
        { trackingId: 'TR-Q', PID: 'INC-HIGH', branch: 'HQ', trackingStatus: 'Waiting to Start', expectedFinishDate: '2026-01-20', repairCost: 10 },
        { trackingId: 'TR-P', PID: 'INC-MED', branch: 'HQ', trackingStatus: 'In Progress', expectedFinishDate: '2026-01-16', repairCost: 20 },
        { trackingId: 'TR-PART', PID: 'TR-PART', branch: 'HQ', trackingStatus: 'Awaiting Parts', expectedFinishDate: '2026-01-14', repairCost: 30 },
        { trackingId: 'TR-VENDOR', PID: 'TR-VENDOR', branch: 'HQ', trackingStatus: 'Awaiting Vendor', expectedFinishDate: '2026-01-30', repairCost: 40 },
        { trackingId: 'TR-PAUSED', PID: 'TR-PAUSED', branch: 'HQ', trackingStatus: 'Paused', expectedFinishDate: '2026-01-30', repairCost: 50 },
        { trackingId: 'TR-DONE', PID: 'TR-DONE', branch: 'HQ', trackingStatus: 'Repair Completed', expectedFinishDate: '2026-01-11', actualFinishDate: '2026-01-10', repairCost: 500 },
        { trackingId: 'TR-CLOSED', PID: 'TR-CLOSED', branch: 'HQ', trackingStatus: 'Closed', expectedFinishDate: '2026-01-11', actualFinishDate: '2026-01-12', repairCost: 800 },
      ],
      repairs: [
        { historyId: 'H-LDB', PID: 'LDB-LOW', branch: 'HQ', repairCost: 100, totalRepairDays: 4 },
        { historyId: 'H-CLOSED', PID: 'TR-CLOSED', branch: 'HQ', repairCost: 900, totalRepairDays: 6 },
      ],
      pmAssets: [
        { assetCode: 'PM-DUE', branch: 'HQ', maintenanceStatus: 'Due Soon' },
        { assetCode: 'PM-LATE', branch: 'HQ', maintenanceStatus: 'Overdue' },
      ],
    }, new Date('2026-01-15T00:00:00Z'));

    assert.deepEqual({
      totalInspections: detailed.kpi.totalInspections,
      normalInspections: detailed.kpi.normalInspections,
      abnormalInspections: detailed.kpi.abnormalInspections,
      defectRate: detailed.kpi.defectRate,
      inspectionDefects: detailed.kpi.inspectionDefects,
      pmDueSoon: detailed.kpi.pmDueSoon,
      pmOverdue: detailed.kpi.pmOverdue,
    }, { totalInspections: 2, normalInspections: 1, abnormalInspections: 1, defectRate: 50, inspectionDefects: 2, pmDueSoon: 1, pmOverdue: 1 });

    assert.deepEqual({
      incidentFromInspection: detailed.kpi.incidentFromInspection,
      directIncidents: detailed.kpi.directIncidents,
      totalIncidents: detailed.kpi.totalIncidents,
      cancelledIncidents: detailed.kpi.cancelledIncidents,
      activeHighIncidents: detailed.kpi.activeHighIncidents,
      activeMediumIncidents: detailed.kpi.activeMediumIncidents,
      activeLowIncidents: detailed.kpi.activeLowIncidents,
      waitingAssessment: detailed.kpi.waitingAssessment,
      waitingApproval: detailed.kpi.waitingApproval,
      approved: detailed.kpi.approved,
    }, { incidentFromInspection: 0, directIncidents: 7, totalIncidents: 7, cancelledIncidents: 1, activeHighIncidents: 1, activeMediumIncidents: 3, activeLowIncidents: 2, waitingAssessment: 1, waitingApproval: 1, approved: 1 });

    assert.deepEqual({
      queueing: detailed.kpi.queueing,
      inProgress: detailed.kpi.inProgress,
      awaitingParts: detailed.kpi.awaitingParts,
      awaitingVendor: detailed.kpi.awaitingVendor,
      paused: detailed.kpi.paused,
      repairCompleted: detailed.kpi.repairCompleted,
      jobsClosed: detailed.kpi.jobsClosed,
      slaOverdue: detailed.kpi.slaOverdue,
      slaNearOverdue: detailed.kpi.slaNearOverdue,
      totalRepairCost: detailed.kpi.totalRepairCost,
      averageCostPerCase: detailed.kpi.averageCostPerCase,
      averageRepairDays: detailed.kpi.averageRepairDays,
      onTimeRate: detailed.kpi.onTimeRate,
    }, { queueing: 1, inProgress: 1, awaitingParts: 1, awaitingVendor: 1, paused: 1, repairCompleted: 1, jobsClosed: 3, slaOverdue: 1, slaNearOverdue: 1, totalRepairCost: 1150, averageCostPerCase: 144, averageRepairDays: 5, onTimeRate: 50 });

    const emptyDetailed = buildDashboardMetrics({});
    assert.equal(emptyDetailed.kpi.defectRate, 0);
    assert.equal(emptyDetailed.kpi.averageCostPerCase, 0);
    assert.equal(emptyDetailed.kpi.averageRepairDays, 0);
    assert.equal(emptyDetailed.kpi.onTimeRate, 100);
    assert.doesNotMatch(JSON.stringify(emptyDetailed.kpi), /null|undefined|NaN/);
  }

  {
    const operations = buildDashboardMetrics({
      branches: [
        { branch: 'Alpha' },
        { branch: 'Beta' },
      ],
      inspections: [
        {
          PID: 'INS-PID-1',
          inspectionId: 'LDB-INSP-1',
          branch: 'Alpha',
          inspectionDate: '2026-03-01',
          status: 'Abnormal',
          defectCount: 4,
        },
      ],
      incidents: [
        {
          PID: 'CASE-SAFETY',
          branch: 'Alpha',
          inspectionId: 'LDB-INSP-1',
          createdAt: '2026-03-01',
          status: 'Open',
          impactLevel: 'High',
          systemCategory: 'ລະບົບຄວາມປອດໄພ',
          assetCode: 'CCTV-1',
          assetName: 'CCTV',
          issueDetails: 'Camera offline',
        },
        {
          PID: 'CASE-SAFETY',
          branch: 'Alpha',
          inspectionId: 'LDB-INSP-1',
          createdAt: '2026-03-01',
          status: 'Open',
          impactLevel: 'High',
          systemCategory: ' ລະບົບຄວາມປອດໄພ ',
          assetCode: 'CCTV-1',
        },
        {
          PID: 'CASE-EXTERIOR',
          branch: 'Alpha',
          inspectionId: 'INC-101',
          createdAt: '2026-03-02',
          status: 'Open',
          impactLevel: 'Medium',
          systemCategory: 'ດ້ານນອກອາຄານ',
          assetCode: 'none',
          issueDetails: 'Fence damage',
        },
        {
          PID: 'CASE-INTERIOR',
          branch: 'Alpha',
          createdAt: '2026-03-03',
          status: 'Open',
          impactLevel: 'Low',
          systemCategory: 'ດ້ານໃນອາຄານ',
          issueDetails: 'Interior wall',
        },
        {
          PID: 'CASE-INSTALL',
          branch: 'Alpha',
          createdAt: '2026-03-04',
          status: 'Open',
          impactLevel: 'Low',
          systemCategory: 'ລະບົບຕິດຕັ້ງອາຄານ',
          assetName: 'Generator',
          issueDetails: 'Installation issue',
        },
        {
          PID: 'CASE-UNSPECIFIED',
          branch: 'Alpha',
          createdAt: '2026-03-05',
          status: 'Open',
          impactLevel: 'Low',
        },
        {
          PID: 'CASE-BETA',
          branch: 'Beta',
          createdAt: '2026-03-05',
          status: 'Open',
          impactLevel: 'Medium',
          systemCategory: 'ລະບົບຄວາມປອດໄພ',
        },
      ],
      assessments: [
        {
          assessmentId: 'ASM-ACTIVE',
          incidentId: 'CASE-SAFETY',
          branch: 'Alpha',
          assessmentDate: '2026-03-02',
          assessmentStatus: 'Completed',
        },
      ],
      approvals: [
        {
          approvalId: 'APP-ACTIVE',
          PID: 'CASE-SAFETY',
          branch: 'Alpha',
          approvalDate: '2026-03-03',
          status: 'Approved',
        },
      ],
      repairTracking: [
        {
          trackingId: 'TR-ACTIVE',
          PID: 'CASE-SAFETY',
          branch: 'Alpha',
          systemCategory: 'ລະບົບຄວາມປອດໄພ',
          assetName: 'CCTV',
          owner: 'Facilities',
          vendor: 'Vendor A',
          trackingStatus: 'In Progress',
          progressPercent: 45,
          startRepairDate: '2026-03-04',
          expectedFinishDate: '2026-03-08',
          repairCost: 200000,
        },
        {
          trackingId: 'TR-HISTORY',
          PID: 'CASE-EXTERIOR',
          branch: 'Alpha',
          trackingStatus: 'In Progress',
          progressPercent: 80,
          startRepairDate: '2026-03-03',
          expectedFinishDate: '2026-03-09',
          repairCost: 999999,
        },
      ],
      repairs: [
        {
          historyId: 'HISTORY-1',
          PID: 'CASE-EXTERIOR',
          branch: 'Alpha',
          systemCategory: 'ດ້ານນອກອາຄານ',
          status: 'Completed',
          actualFinishDate: '2026-03-07',
          repairCost: 1000000,
        },
        {
          historyId: 'HISTORY-BETA',
          PID: 'CASE-BETA',
          branch: 'Beta',
          systemCategory: 'ລະບົບຄວາມປອດໄພ',
          status: 'Completed',
          actualFinishDate: '2026-03-09',
          repairCost: 300000,
        },
      ],
      pmAssets: [{
        pmAssetId: 'PM-BETA',
        assetCode: 'PM-BETA',
        branch: 'Beta',
        maintenanceStatus: 'Overdue',
      }],
    }, new Date('2026-03-10T00:00:00Z'));

    assert.equal(operations.kpi.inspectionDefects, 4);
    assert.equal(operations.kpi.incidentFromInspection, 1);
    assert.equal(operations.kpi.directIncidents, 5);
    assert.equal(operations.kpi.totalIncidents, 6);

    assert.deepEqual(operations.issueDensity.find(item => item.branch === 'Alpha'), {
      branch: 'Alpha',
      totalCases: 5,
      safetySystem: 1,
      hasAsset: 2,
      exteriorBuilding: 1,
      interiorBuilding: 1,
      buildingInstallation: 1,
    });
    assert.deepEqual(operations.topProblemBranches.map(item => item.name), ['Alpha', 'Beta']);
    assert.equal(operations.topProblemSystems[0].name, 'ລະບົບຄວາມປອດໄພ');
    assert.equal(operations.topProblemSystems[0].value, 2);
    assert.ok(operations.topProblemBranches.length <= 10);
    assert.ok(operations.topProblemSystems.length <= 10);

    assert.deepEqual(operations.activeTracking.map(item => item.pid), ['CASE-SAFETY']);
    assert.equal(operations.activeTracking[0].progressPercent, 45);
    assert.equal(operations.activeTracking[0].slaState, 'overdue');
    const safetyTimeline = operations.repairTimeline.find(item => item.pid === 'CASE-SAFETY');
    assert.equal(safetyTimeline?.milestones.length, 6);
    assert.equal(safetyTimeline?.workflowPercent, 69);
    assert.equal(
      safetyTimeline?.milestones[0].label,
      'ບັນທຶກເຫດການ (Incident recorded)',
    );
    assert.deepEqual(
      safetyTimeline?.milestones.map(item => item.state),
      ['complete', 'complete', 'complete', 'complete', 'current', 'pending'],
    );
    assert.equal(
      safetyTimeline?.milestones[5].label,
      'ສ້ອມສຳເລັດ (Repair completed)',
    );
    assert.equal(
      operations.branchRepairCosts.find(item => item.branch === 'Alpha')?.costLak,
      1200000,
    );
    assert.equal(
      operations.branchRepairCosts.reduce((sum, item) => sum + item.costLak, 0),
      operations.kpi.totalRepairCost,
    );

    const alphaMarch = operations.monthlyBranchTrend.find(
      item => item.branch === 'Alpha' && item.month === '2026-03',
    );
    assert.deepEqual(alphaMarch, {
      month: '2026-03',
      branch: 'Alpha',
      inspections: 1,
      incidents: 5,
      repairCost: 1200000,
      repairCostMillionLak: 1.2,
    });
    assert.ok(operations.executiveInsights.some(item => item.code === 'SLA_OVERDUE'));
    assert.ok(operations.executiveInsights.some(item => item.code === 'HIGH_SEVERITY'));
    assert.ok(operations.executiveInsights.every(item => item.title && item.detail));
    assert.doesNotMatch(JSON.stringify(operations), /null|undefined|NaN|Infinity/);
  }

  {
    const aliasDensity = buildDashboardMetrics({
      branches: [{ branch: 'HQ' }],
      incidents: [
        {
          incidentId: 'INC-SAFE',
          PID: 'INC-SAFE',
          branch: 'HQ',
          systemCategory: 'ຄວາມປອດໄພ',
          assetCode: 'CCTV-01',
        },
        {
          incidentId: 'INC-OUT',
          PID: 'INC-OUT',
          branch: 'HQ',
          systemCategory: 'ສະພາບດ້ານນອກອາຄານ',
          assetCode: 'none',
        },
        {
          incidentId: 'INC-IN',
          PID: 'INC-IN',
          branch: 'HQ',
          systemCategory: 'ສະພາບພາຍໃນອາຄານ',
        },
        {
          incidentId: 'INC-INSTALL',
          PID: 'INC-INSTALL',
          branch: 'HQ',
          systemCategory: 'ລະບົບຕິດຕັ້ງພາຍໃນອາຄານ',
        },
      ],
    });

    assert.deepEqual(aliasDensity.issueDensity[0], {
      branch: 'HQ',
      totalCases: 4,
      safetySystem: 1,
      hasAsset: 1,
      exteriorBuilding: 1,
      interiorBuilding: 1,
      buildingInstallation: 1,
    });
    assert.equal(
      aliasDensity.issueDensity.reduce((sum, row) => sum + row.totalCases, 0),
      aliasDensity.kpi.totalIncidents,
      'Issue Density totals reconcile to unique Incident KPI totals',
    );
  }

  {
    const emptyOperations = buildDashboardMetrics({});
    assert.deepEqual(emptyOperations.issueDensity, []);
    assert.deepEqual(emptyOperations.activeTracking, []);
    assert.deepEqual(emptyOperations.repairTimeline, []);
    assert.deepEqual(emptyOperations.branchRepairCosts, []);
    assert.deepEqual(emptyOperations.monthlyBranchTrend, []);
    assert.ok(emptyOperations.executiveInsights.some(item => item.code === 'NO_DATA'));
    assert.doesNotMatch(JSON.stringify(emptyOperations), /null|undefined|NaN|Infinity/);
  }

  {
    const model = buildDashboardMetrics({
      assessments: [
        {
          assessmentId: 'ASM-100',
          incidentId: 'INC-100',
          branch: '00.HQ',
          subItems: [
            {
              id: 'SUB-1',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Broken lamp',
              sparePart: 'LED lamp',
              workType: '\u0e81\u0ea7\u0e94\u0ec0\u0e8a\u0eb1\u0e81/\u0eaa\u0ec9\u0ead\u0ea1',
              quantity: 1,
              estimatedTotalCost: 100,
            },
            {
              id: 'SUB-1',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Broken lamp',
              sparePart: 'LED lamp',
              workType: '\u0e81\u0ea7\u0e94\u0ec0\u0e8a\u0eb1\u0e81/\u0eaa\u0ec9\u0ead\u0ea1',
              quantity: 1,
              estimatedTotalCost: 100,
            },
          ],
        },
        {
          assessmentId: 'ASM-200',
          incidentId: 'INC-200',
          branch: '01.Branch',
          subItems: [
            {
              id: 'SUB-1',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Broken lamp',
              sparePart: 'LED lamp',
              workType: '\u0e9b\u0ec8\u0ebd\u0e99',
              quantity: 2,
              estimatedTotalCost: 400,
            },
            {
              repairSubCategory: 'Plumbing',
              repairSubItem: 'Blocked drain',
              sparePart: 'Drain service',
              workType: '\u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99',
              quantity: Number.NaN,
              estimatedTotalCost: Number.NaN,
            },
          ],
        },
      ],
    });

    assert.deepEqual(model.repairFrequency.subcategories[0], {
      name: 'Electrical',
      inspectRepair: 1,
      replacePart: 1,
      service: 0,
      total: 2,
      cases: [
        {
          key: 'asm-100::sub-1',
          assessmentId: 'ASM-100',
          incidentId: 'INC-100',
          branch: '00.HQ',
          repairSubCategory: 'Electrical',
          repairSubItem: 'Broken lamp',
          sparePart: 'LED lamp',
          workType: '\u0e81\u0ea7\u0e94\u0ec0\u0e8a\u0eb1\u0e81-\u0eaa\u0ec9\u0ead\u0ea1',
          quantity: 1,
          estimatedTotalCost: 100,
        },
        {
          key: 'asm-200::sub-1',
          assessmentId: 'ASM-200',
          incidentId: 'INC-200',
          branch: '01.Branch',
          repairSubCategory: 'Electrical',
          repairSubItem: 'Broken lamp',
          sparePart: 'LED lamp',
          workType: '\u0e9b\u0ec8\u0ebd\u0e99\u0ead\u0eb0\u0ec4\u0eab\u0ebc\u0ec8',
          quantity: 2,
          estimatedTotalCost: 400,
        },
      ],
    });
    assert.equal(model.repairFrequency.subItems[0].name, 'Broken lamp');
    assert.equal(model.repairFrequency.spareParts[0].name, 'LED lamp');
    assert.equal(model.repairFrequency.subcategories[1].cases[0].quantity, 0);
    assert.doesNotMatch(JSON.stringify(model.repairFrequency), /NaN|undefined|null/);
  }

  {
    const assessmentRows = Array.from({ length: 13 }, (_, index) => {
      const name = index < 2 ? 'Top' : `Name-${String(13 - index).padStart(2, '0')}`;
      return {
        assessmentId: `ASM-RANK-${index}`,
        subItems: [{
          id: `SUB-RANK-${index}`,
          repairSubCategory: name,
          repairSubItem: name,
          sparePart: name,
          workType: '\u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99',
        }],
      };
    });
    const ranked = buildDashboardMetrics({ assessments: assessmentRows }).repairFrequency;
    for (const ranking of [ranked.subcategories, ranked.subItems, ranked.spareParts]) {
      assert.equal(ranking.length, 10);
      assert.deepEqual(ranking.slice(1).map(item => item.name), [
        'Name-01', 'Name-02', 'Name-03', 'Name-04', 'Name-05',
        'Name-06', 'Name-07', 'Name-08', 'Name-09',
      ]);
    }
  }

  {
    const crossBranchAssessments = buildDashboardMetrics({
      assessments: [
        {
          assessmentId: 'ASM-SHARED',
          branch: 'North',
          subItems: [{
            id: 'SUB-SHARED',
            repairSubCategory: 'Electrical',
            repairSubItem: 'Broken lamp',
            sparePart: 'LED lamp',
          }],
        },
        {
          assessmentId: 'ASM-SHARED',
          branch: 'South',
          subItems: [{
            id: 'SUB-SHARED',
            repairSubCategory: 'Electrical',
            repairSubItem: 'Broken lamp',
            sparePart: 'LED lamp',
          }],
        },
      ],
    }).repairFrequency;

    assert.equal(crossBranchAssessments.subcategories[0].total, 2);
    assert.deepEqual(crossBranchAssessments.subcategories[0].cases.map(item => item.branch), ['North', 'South']);
  }

  {
    const emptyRepairFrequency = buildDashboardMetrics({}).repairFrequency;
    assert.deepEqual(emptyRepairFrequency.subcategories, []);
    assert.deepEqual(emptyRepairFrequency.subItems, []);
    assert.deepEqual(emptyRepairFrequency.spareParts, []);
  }

  {
    const report = buildDashboardMetrics({
      assessments: [
        {
          assessmentId: 'ASM-WORK-TYPES',
          branch: 'North',
          subItems: [
            {
              id: 'KNOWN-ALIAS',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Light',
              sparePart: 'Lamp',
              workType: '\u0eaa\u0ec9\u0ead\u0ea1',
            },
            {
              id: 'UNKNOWN-TYPE',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Unknown type item',
              sparePart: 'Unknown type part',
              workType: 'unrecognized legacy value',
            },
            {
              id: 'BLANK-TYPE',
              repairSubCategory: 'Electrical',
              repairSubItem: 'Blank type item',
              sparePart: 'Blank type part',
              workType: '   ',
            },
            {
              id: 'BLANK-DIMENSIONS',
              repairSubCategory: ' ',
              repairSubItem: '',
              sparePart: '  ',
              workType: '\u0e9b\u0ec8\u0ebd\u0e99',
            },
          ],
        },
        {
          branch: 'No ID branch',
          subItems: [{
            id: 'MISSING-ASSESSMENT-ID',
            repairSubCategory: 'Legacy fallback',
            repairSubItem: 'Legacy fallback item',
            sparePart: 'Legacy fallback part',
            workType: '\u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99',
          }],
        },
      ],
    }).repairFrequency;

    const electrical = report.subcategories.find(item => item.name === 'Electrical');
    assert.deepEqual({
      inspectRepair: electrical.inspectRepair,
      replacePart: electrical.replacePart,
      service: electrical.service,
      total: electrical.total,
    }, {
      inspectRepair: 1,
      replacePart: 0,
      service: 0,
      total: 3,
    });
    assert.equal(
      electrical.cases
        .find(item => item.key.includes('unknown-type')).workType,
      '',
      'unknown work types count toward totals but no work-type column',
    );
    assert.equal(
      electrical.cases
        .find(item => item.key.includes('blank-type')).workType,
      '',
      'blank work types count toward totals but no work-type column',
    );
    for (const ranking of [report.subcategories, report.subItems, report.spareParts]) {
      assert.ok(ranking.every(item => item.name.trim()), 'blank dimensions must be excluded from rankings');
      assert.ok(
        ranking.every(item => item.cases.every(repairCase => !repairCase.key.includes('blank-dimensions'))),
        'cases with a blank dimension must not appear in that dimension ranking',
      );
    }
    const missingIdCase = report.subcategories.find(item => item.name === 'Legacy fallback').cases[0];
    assert.equal(missingIdCase.assessmentId, '', 'synthetic assessment IDs must not be reader-facing');
    assert.match(missingIdCase.key, /^assessment:\d+::missing-assessment-id$/, 'missing IDs keep an internal dedupe key');
  }

  console.log('dashboard metrics tests passed');
} finally {
  await rm(output, { force: true });
  await assert.rejects(access(output));
}
