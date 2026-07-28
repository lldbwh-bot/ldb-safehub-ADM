import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const [appSource, dashboardSource, overviewSource, branchIntelligenceSource, recentActivitySource, operationsSource, repairFrequencySource] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/DashboardView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/DashboardOverview.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/BranchIntelligence.tsx', import.meta.url), 'utf8').catch(() => ''),
  readFile(new URL('../src/components/dashboard/RecentActivity.tsx', import.meta.url), 'utf8').catch(() => ''),
  readFile(new URL('../src/components/dashboard/DashboardOperationsReports.tsx', import.meta.url), 'utf8').catch(() => ''),
  readFile(new URL('../src/components/dashboard/RepairFrequencyReport.tsx', import.meta.url), 'utf8').catch(() => ''),
]);

for (const marker of [
  'dashboard-kpi-grid',
  'repair-status-chart',
  'incident-severity-chart',
  'pm-status-chart',
  'monthly-operations-chart',
  'branch-performance-chart',
]) assert.match(overviewSource, new RegExp(`id=["']${marker}["']`));

for (const marker of ['dashboard-kpi-group-a', 'dashboard-kpi-group-b', 'dashboard-kpi-group-c']) {
  assert.match(overviewSource, new RegExp(`["']${marker}["']`));
}

for (const heading of [
  'A. ກຸ່ມ KPI ການກວດກາ ແລະ PM (Inspection & PM KPIs)',
  'B. ກຸ່ມ KPI ເຫດການ & ຄວາມສ່ຽງ (Incident & Risk KPIs)',
  'C. ກຸ່ມ KPI ສ້ອມແປງ / SLA / ຄ່າໃຊ້ຈ່າຍ (Repair, SLA & Cost KPIs)',
]) assert.ok(overviewSource.includes(heading), `missing KPI group heading: ${heading}`);

assert.match(overviewSource, /aria-label=/);
assert.match(overviewSource, /ResponsiveContainer/);
assert.match(overviewSource, /layout=["']vertical["']/);
assert.match(overviewSource, /type=["']category["']/);
assert.match(overviewSource, /type=["']number["']/);
assert.match(overviewSource, /branchChartData/);
assert.match(overviewSource, /zeroActivityBranchCount/);
assert.match(overviewSource, /overflow-y-auto/);
assert.doesNotMatch(overviewSource, /dataKey=["']branch["'][^>]*angle=/);
assert.match(overviewSource, /onExport:\s*\(\)\s*=>\s*void/);
assert.match(overviewSource, /onClick=\{onExport\}/);
assert.match(overviewSource, /aria-label=["']Export dashboard data as CSV["']/);
assert.match(overviewSource, /import DashboardOperationsReports from ['"]\.\/DashboardOperationsReports['"]/);
assert.match(overviewSource, /<DashboardOperationsReports\s+metrics=\{metrics\}/);

for (const marker of [
  'issue-density-report',
  'active-tracking-report',
  'repair-timeline-report',
  'branch-repair-cost-report',
  'top-problem-branches-report',
  'monthly-branch-trend-report',
  'executive-insights-report',
  'top-problem-systems-report',
]) {
  assert.match(operationsSource, new RegExp(`id=["']${marker}["']`));
}
for (const dataset of [
  'issueDensity',
  'activeTracking',
  'repairTimeline',
  'branchRepairCosts',
  'topProblemBranches',
  'monthlyBranchTrend',
  'executiveInsights',
  'topProblemSystems',
]) {
  assert.match(operationsSource, new RegExp(`metrics\\.${dataset}\\b`));
}
assert.match(operationsSource, /overflow-x-auto/);
assert.match(operationsSource, /No matching operational data/);
assert.match(operationsSource, /ResponsiveContainer/);
assert.match(operationsSource, /Repair Timeline & Milestones/);
assert.match(operationsSource, /ຄວາມຄືບໜ້າ \(Workflow progress\)/);
assert.match(operationsSource, /ລໍຖ້າວັນທີ \(Pending date\)/);
assert.match(operationsSource, /item\.workflowPercent/);
assert.match(operationsSource, /Detail Active Tracking Records/);
assert.match(operationsSource, /LDB SafeHub Executive Recommendations & AI Insights/);
for (const tone of ['text-emerald-', 'text-amber-', 'text-rose-', 'text-cyan-']) {
  assert.match(operationsSource, new RegExp(tone));
}

assert.match(operationsSource, /<RepairFrequencyReport\s+report=\{metrics\.repairFrequency\}/);
assert.match(repairFrequencySource, /id=["']repair-frequency-report["']/);
for (const heading of [
  'ລາຍງານລາຍການສ້ອມທີ່ພົບຫຼາຍສຸດ',
  'ໝວດຍ່ອຍສ້ອມ',
  'ລາຍການສ້ອມຍ່ອຍ',
  'ອະໄຫຼ່/ຄ່າບໍລິການ',
  'ກວດເຊັກ-ສ້ອມ',
  'ປ່ຽນອະໄຫຼ່',
  'ບໍລິການ',
  'ລວມ',
]) assert.ok(repairFrequencySource.includes(heading));
assert.match(repairFrequencySource, /role=["']dialog["']/);
assert.match(repairFrequencySource, /aria-modal=["']true["']/);
assert.match(repairFrequencySource, /event\.key\s*===\s*['"]Escape['"]/);
assert.match(repairFrequencySource, /event\.key\s*===\s*['"]Tab['"]/);
assert.match(repairFrequencySource, /querySelectorAll<HTMLElement>\s*\(/);
assert.match(repairFrequencySource, /document\.body\.children/);
assert.match(repairFrequencySource, /setAttribute\(\s*['"]inert['"]/);
assert.match(repairFrequencySource, /removeAttribute\(\s*['"]inert['"]/);
assert.match(repairFrequencySource, /assessmentId/);
assert.match(repairFrequencySource, /incidentId/);
assert.match(repairFrequencySource, /estimatedTotalCost/);
assert.doesNotMatch(repairFrequencySource, /assessmentDate/);

for (const metric of [
  'totalInspections', 'inspectionDefects', 'waitingAssessment',
  'waitingApproval', 'pmDueSoon', 'pmOverdue',
  'totalRepairCost',
]) assert.match(overviewSource, new RegExp(`metrics\\.kpi\\.${metric}\\b`));

for (const metric of [
  'normalInspections', 'abnormalInspections', 'defectRate', 'incidentFromInspection',
  'directIncidents', 'totalIncidents', 'cancelledIncidents', 'activeHighIncidents',
  'activeMediumIncidents', 'activeLowIncidents', 'approved', 'queueing', 'inProgress',
  'awaitingParts', 'awaitingVendor', 'paused', 'repairCompleted', 'jobsClosed',
  'slaOverdue', 'slaNearOverdue', 'averageCostPerCase', 'averageRepairDays', 'onTimeRate',
]) assert.match(overviewSource, new RegExp(`metrics\\.kpi\\.${metric}\\b`));

for (const label of [
  'Direct / Urgent Incidents', 'Total Incidents', 'Active High / Critical',
  'Awaiting Parts', 'Awaiting Vendor', 'Jobs Closed', 'Overdue SLA',
  'Near Overdue', 'Avg Cost / Case', 'Avg Repair Days', 'On-time Rate',
]) assert.ok(overviewSource.includes(label), `missing detailed KPI label: ${label}`);

for (const metric of ['total', 'admins', 'branchUsers', 'permissionAssignments']) {
  assert.match(overviewSource, new RegExp(`metrics\\.users\\.${metric}\\b`));
}

assert.match(dashboardSource, /import[^;]*\buseMemo\b[^;]*from ['"]react['"]/);
assert.match(dashboardSource, /import[^;]*\bbuildDashboardMetrics\b[^;]*from ['"]\.\.\/dashboardMetrics['"]/);
assert.match(dashboardSource, /import[^;]*\bgetDashboardRecordDate\b[^;]*from ['"]\.\.\/dashboardMetrics['"]/);
assert.match(dashboardSource, /import DashboardOverview from ['"]\.\/dashboard\/DashboardOverview['"]/);
assert.match(dashboardSource, /useMemo\s*\(/);
assert.match(dashboardSource, /buildDashboardMetrics\s*\(/);
assert.match(dashboardSource, /<DashboardOverview\b/);
assert.match(dashboardSource, /import BranchIntelligence from ['"]\.\/dashboard\/BranchIntelligence['"]/);
assert.match(dashboardSource, /<BranchIntelligence\s+branches=\{metrics\.branchPerformance\}/);
assert.ok(
  dashboardSource.indexOf('<BranchIntelligence') > dashboardSource.indexOf('<DashboardOverview'),
  'Branch Intelligence must render after DashboardOverview',
);
assert.match(dashboardSource, /import RecentActivity from ['"]\.\/dashboard\/RecentActivity['"]/);
assert.match(dashboardSource, /<RecentActivity\s+items=\{metrics\.recentActivity\}/);
assert.ok(
  dashboardSource.indexOf('<RecentActivity') > dashboardSource.indexOf('<BranchIntelligence'),
  'Recent Activity must render after Branch Intelligence',
);
assert.match(recentActivitySource, /id=["']dashboard-recent-activity["']/);
assert.match(recentActivitySource, /aria-label=["']Recent activity timeline["']/);
assert.match(recentActivitySource, /role=["']list["']/);
assert.match(recentActivitySource, /role=["']listitem["']/);
assert.match(recentActivitySource, /items\.slice\(0,\s*10\)/);
assert.match(recentActivitySource, /ຍັງບໍ່ມີກິດຈະກຳ/);
for (const field of ['source', 'title', 'branch', 'status', 'displayDate']) {
  assert.match(recentActivitySource, new RegExp(`item\\.${field}\\b`));
}
assert.doesNotMatch(
  [dashboardSource, overviewSource, branchIntelligenceSource, recentActivitySource, operationsSource].join('\n'),
  /password(?:_raw)?/i,
  'Dashboard presentation sources must never reference credentials',
);
assert.match(dashboardSource, /onExport=\{handleExportCSV\}/);
assert.match(dashboardSource, /\bkpi\b/);

assert.match(branchIntelligenceSource, /import[^;]*\buseState\b[^;]*from ['"]react['"]/);
assert.match(branchIntelligenceSource, /import[^;]*\buseEffect\b[^;]*from ['"]react['"]/);
assert.match(branchIntelligenceSource, /import\s+\{\s*getBranchImage\s*\}\s+from ['"]\.\.\/\.\.\/dashboardBranchMedia['"]/);
assert.match(branchIntelligenceSource, /BranchPerformanceItem\[\]/);
for (const stateName of ['activeIndex', 'selectedBranch', 'isPaused']) {
  assert.match(branchIntelligenceSource, new RegExp(`\\b${stateName}\\b`));
}
assert.match(branchIntelligenceSource, /aria-roledescription=["']carousel["']/);
assert.match(branchIntelligenceSource, /aria-label=["']Previous branch["']/);
assert.match(branchIntelligenceSource, /aria-label=["']Next branch["']/);
assert.match(branchIntelligenceSource, /aria-label=\{`Go to branch \$\{index \+ 1\}`\}/);
assert.match(branchIntelligenceSource, /setInterval\s*\(/);
assert.match(branchIntelligenceSource, /6000/);
assert.match(branchIntelligenceSource, /clearInterval\s*\(/);
assert.match(branchIntelligenceSource, /matchMedia\s*\(\s*['"]\(prefers-reduced-motion: reduce\)['"]\s*\)/);
assert.match(branchIntelligenceSource, /branches\.length\s*>\s*1/);
assert.match(branchIntelligenceSource, /onMouseEnter=/);
assert.match(branchIntelligenceSource, /onMouseLeave=/);
assert.match(branchIntelligenceSource, /onFocus=/);
assert.match(branchIntelligenceSource, /onBlur=/);
assert.match(branchIntelligenceSource, /role=["']dialog["']/);
assert.match(branchIntelligenceSource, /aria-modal=["']true["']/);
assert.match(branchIntelligenceSource, /event\.key\s*===\s*['"]Escape['"]/);
assert.match(branchIntelligenceSource, /event\.target\s*===\s*event\.currentTarget/);
assert.match(branchIntelligenceSource, /closeButtonRef/);
assert.match(branchIntelligenceSource, /dialogRef/);
assert.match(branchIntelligenceSource, /dialogTriggerRef/);
assert.match(branchIntelligenceSource, /closeButtonRef\.current\?\.focus\s*\(/);
assert.match(branchIntelligenceSource, /dialogTriggerRef\.current\?\.focus\s*\(/);
assert.match(branchIntelligenceSource, /querySelectorAll<HTMLElement>\s*\(/);
assert.match(branchIntelligenceSource, /event\.key\s*===\s*['"]Tab['"]/);
assert.match(branchIntelligenceSource, /event\.shiftKey/);
assert.match(branchIntelligenceSource, /inert=\{Boolean\(selectedBranch\)\}/);
assert.match(branchIntelligenceSource, /import\s+\{\s*createPortal\s*\}\s+from ['"]react-dom['"]/);
assert.match(branchIntelligenceSource, /createPortal\s*\(/);
assert.match(branchIntelligenceSource, /document\.body\.children/);
assert.match(branchIntelligenceSource, /setAttribute\(\s*['"]inert['"]/);
assert.match(branchIntelligenceSource, /removeAttribute\(\s*['"]inert['"]/);
assert.match(branchIntelligenceSource, /getBranchImage\s*\(\s*branch\.branch\s*\)/);
assert.match(branchIntelligenceSource, /loading=["']lazy["']/);
assert.match(branchIntelligenceSource, /onError=/);
assert.match(branchIntelligenceSource, /failedImages\.has\(branch\.branch\)/);
assert.match(branchIntelligenceSource, /role=["']img["']/);
assert.match(branchIntelligenceSource, /aria-label=\{`Image unavailable for \$\{branch\.branch\}`\}/);
assert.doesNotMatch(branchIntelligenceSource, /https?:\/\//, 'image fallback must not depend on remote assets');
assert.match(branchIntelligenceSource, /No branch performance data/);
for (const metric of [
  'inspections', 'inspectionDefects', 'openIncidents', 'waitingAssessment', 'waitingApproval',
  'repairing', 'completed', 'pmDueSoon', 'pmOverdue', 'repairCost', 'latestStatus', 'health',
]) assert.match(branchIntelligenceSource, new RegExp(`(?:branch|selectedBranch)\\.${metric}\\b`));

const getRecordDateSource = dashboardSource.slice(
  dashboardSource.indexOf('const getRecordDate'),
  dashboardSource.indexOf('// Helper: check SLA status'),
);
assert.match(getRecordDateSource, /return getDashboardRecordDate\(item\);/);

const preventiveSource = dashboardSource.slice(dashboardSource.indexOf('/* Preventive Maintenance Executive Dashboard Subtab */'));
assert.match(preventiveSource, /const filteredPMAssets = fPmAssets;/);
assert.match(preventiveSource, /const filteredPMHistory = fPmHistory;/);
assert.doesNotMatch(preventiveSource, /\bpmAssets\.filter\s*\(/);
assert.doesNotMatch(preventiveSource, /\bpmHistory\.filter\s*\(/);

for (const preservedToken of [
  'handleExportCSV', 'handleSaveApproval', 'onApproveIncident', 'isApproveOpen',
  'selectedIncident', 'Approval Workflows', 'dialog repair approval modal form',
]) assert.match(dashboardSource, new RegExp(preservedToken));

for (const themedSection of [
  ['dashboard-slicer-filters', 'bg-\\[#04101f\\]'],
  ['dashboard-subtab-navigation', 'bg-\\[#071426\\]'],
  ['approval-workflow-wrapper', 'bg-\\[#04101f\\]'],
  ['pm-dashboard-wrapper', 'bg-\\[#04101f\\]'],
]) {
  const [id, classToken] = themedSection;
  const sectionStart = dashboardSource.indexOf(`id="${id}"`);
  assert.ok(sectionStart >= 0, `missing themed dashboard section: ${id}`);
  assert.match(dashboardSource.slice(Math.max(0, sectionStart - 300), sectionStart + 500), new RegExp(classToken));
}
assert.match(dashboardSource, /dashboard-slicer-control/);
assert.match(dashboardSource, /focus:ring-cyan-300\/40/);
assert.match(dashboardSource, /border-cyan-300\/20/);
assert.match(dashboardSource, /bg-\[#08182b\]\/90/);

for (const obsoleteAnalyticsToken of [
  'kpiTotalInspections', 'monthlyChartData', 'branchRiskScores', 'sortedBranchRisk',
]) assert.doesNotMatch(dashboardSource, new RegExp(`\\b${obsoleteAnalyticsToken}\\b`));

for (const subtab of ["'analytics'", "'approvals'", "'preventive'"]) {
  assert.match(dashboardSource, new RegExp(subtab));
}

for (const prop of ['assessments', 'users', 'branches', 'pmAssets', 'pmHistory']) {
  assert.match(appSource, new RegExp(`${prop}=\\{`));
  assert.match(dashboardSource, new RegExp(`\\b${prop}\\??:`));
}

for (const setter of ['setPmAssets', 'setPmHistory']) {
  assert.match(appSource, new RegExp(`\\b${setter}\\b`));
}

for (const filter of [
  'filterYear', 'filterMonth', 'filterFromDate', 'filterToDate', 'filterBranch',
  'filterDept', 'filterSec', 'filterSystem', 'filterImpact', 'filterStatus',
  'filterVendor', 'filterOwner', 'timeRange',
]) assert.match(dashboardSource, new RegExp(`\\b${filter}\\b`));

assert.doesNotMatch(dashboardSource, /getSavedPMAssets|getSavedPMHistory/);
assert.match(appSource, /getSavedPMAssets/);
assert.match(appSource, /getSavedPMHistory/);

assert.match(dashboardSource, /export function dashboardRecordMatchesFilters\b/);
assert.match(dashboardSource, /fBranches:\s*branches\.filter\(item\s*=>\s*matchRecord\(item,\s*true\)\)/);

const cashRoomLabel = '\u0eab\u0ec9\u0ead\u0e87\u0eae\u0eb1\u0e9a\u0ec0\u0e87\u0eb4\u0e99';
const headquartersLabels = [
  '\u0eaa\u0ecd\u0eb2\u0e99\u0eb1\u0e81\u0e87\u0eb2\u0e99\u0ec3\u0eab\u0e8d\u0ec8',
  '\u0eaa\u0eb3\u0e99\u0eb1\u0e81\u0e87\u0eb2\u0e99\u0ec3\u0eab\u0e8d\u0ec8',
];
const ordinaryBranchLabel = '\u0eaa\u0eb2\u0e82\u0eb2 \u0e99\u0eb0\u0e84\u0ead\u0e99\u0eab\u0ebc\u0ea7\u0e87';

assert.deepEqual(
  [...cashRoomLabel].map((character) => character.codePointAt(0)),
  [0x0eab, 0x0ec9, 0x0ead, 0x0e87, 0x0eae, 0x0eb1, 0x0e9a, 0x0ec0, 0x0e87, 0x0eb4, 0x0e99],
);

const bundleDirectory = await mkdtemp(join(tmpdir(), 'ldb-dashboard-branch-media-'));
const bundlePath = join(bundleDirectory, 'dashboardBranchMedia.mjs');

try {
  await build({
    entryPoints: [fileURLToPath(new URL('../src/dashboardBranchMedia.ts', import.meta.url))],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    loader: { '.png': 'dataurl' },
  });

  const { getBranchImage, getBranchMediaKind } = await import(pathToFileURL(bundlePath).href);

  assert.equal(getBranchMediaKind(`00.${headquartersLabels[0]}`), 'headquarters');
  assert.equal(getBranchMediaKind(`00.${headquartersLabels[1]}`), 'headquarters');
  assert.equal(getBranchMediaKind(`01.${ordinaryBranchLabel}`), 'branch');
  assert.equal(getBranchMediaKind(cashRoomLabel), 'cash-room');
  assert.equal(getBranchMediaKind(''), 'branch');

  for (const name of ['', `00.${headquartersLabels[0]}`, cashRoomLabel]) {
    assert.equal(typeof getBranchImage(name), 'string');
    assert.ok(getBranchImage(name).length > 0);
  }
} finally {
  await rm(bundleDirectory, { recursive: true, force: true });
}

const uiBehaviorDirectory = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.dashboard-ui-behavior-'));
const dashboardBundlePath = join(uiBehaviorDirectory, 'DashboardView.mjs');
const branchBundlePath = join(uiBehaviorDirectory, 'BranchIntelligence.mjs');
const recentActivityBundlePath = join(uiBehaviorDirectory, 'RecentActivity.mjs');

try {
  await Promise.all([
    build({
      entryPoints: [fileURLToPath(new URL('../src/components/DashboardView.tsx', import.meta.url))],
      outfile: dashboardBundlePath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external',
      loader: { '.png': 'dataurl' },
    }),
    build({
      entryPoints: [fileURLToPath(new URL('../src/components/dashboard/BranchIntelligence.tsx', import.meta.url))],
      outfile: branchBundlePath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external',
      loader: { '.png': 'dataurl' },
    }),
    build({
      entryPoints: [fileURLToPath(new URL('../src/components/dashboard/RecentActivity.tsx', import.meta.url))],
      outfile: recentActivityBundlePath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external',
    }),
  ]);

  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  };
  let dashboardModule;
  try {
    dashboardModule = await import(pathToFileURL(dashboardBundlePath).href);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
  assert.equal(typeof dashboardModule.dashboardRecordMatchesFilters, 'function');
  assert.equal(typeof dashboardModule.getDashboardBranchOptions, 'function');
  assert.deepEqual(
    dashboardModule.getDashboardBranchOptions({
      uniqueBranches: [' Inspection Only ', 'inspection   only'],
      branches: [{ branch: 'Branch Master Only' }],
      inspections: [{ branch: 'Inspection Only' }],
      incidents: [{ branchName: 'Incident Only' }],
      assessments: [{ branch: 'Assessment Only' }],
      approvals: [{ branch: 'Approval Only' }],
      repairTracking: [{ branch: 'Tracking Only' }],
      repairs: [{ branch: 'History Only' }],
      pmAssets: [{ branch: 'PM Asset Only' }],
      pmHistory: [{ branch: 'Cash Room' }],
    }),
    [
      'Approval Only', 'Assessment Only', 'Branch Master Only', 'Cash Room', 'History Only',
      'Incident Only', 'Inspection Only', 'PM Asset Only', 'Tracking Only',
    ],
    'admin branch choices union Branch Master and every operational source with normalized deduplication',
  );
  const dateRestrictedFilters = {
    isAdmin: true,
    userBranch: '',
    filterBranch: 'ALL',
    filterYear: '2025',
    filterMonth: '2',
    filterFromDate: '',
    filterToDate: '',
    filterDept: 'Operations',
    filterSec: 'ALL',
    filterSystem: 'ALL',
    filterImpact: 'ALL',
    filterStatus: 'ALL',
    filterVendor: 'ALL',
    filterOwner: 'ALL',
    timeRange: 'LAST_7_DAYS',
    now: new Date('2026-07-21T00:00:00Z'),
  };
  const branchMaster = { branch: 'Alpha', division: 'Operations' };
  assert.equal(dashboardModule.dashboardRecordMatchesFilters(branchMaster, dateRestrictedFilters, true), true);
  assert.equal(
    dashboardModule.dashboardRecordMatchesFilters(
      { branch: '  Inspection   Only  ' },
      { ...dateRestrictedFilters, filterBranch: 'inspection only', filterDept: 'ALL' },
      true,
    ),
    true,
    'normalized branch options must still select operational rows with whitespace/case variants',
  );
  assert.equal(
    dashboardModule.dashboardRecordMatchesFilters(branchMaster, { ...dateRestrictedFilters, filterDept: 'Finance' }, true),
    false,
    'applicable categorical filters still apply to Branch Master',
  );
  assert.equal(
    dashboardModule.dashboardRecordMatchesFilters(branchMaster, { ...dateRestrictedFilters, isAdmin: false, userBranch: 'Beta' }, true),
    false,
    'RLS still applies to Branch Master',
  );
  assert.equal(
    dashboardModule.dashboardRecordMatchesFilters(branchMaster, { ...dateRestrictedFilters, filterBranch: 'Beta' }, true),
    false,
    'admin branch filter still applies to Branch Master',
  );

  const { default: BranchIntelligence } = await import(pathToFileURL(branchBundlePath).href);
  const markup = renderToStaticMarkup(React.createElement(BranchIntelligence, {
    branches: [{
      branch: 'Alpha', inspections: 1, inspectionDefects: 2, openIncidents: 3, highSeverity: 0,
      waitingAssessment: 1, waitingApproval: 0, repairing: 1, completed: 4, pmDueSoon: 1,
      pmOverdue: 0, repairCost: 500, latestStatus: 'Repairing', health: 'attention',
    }],
  }));
  assert.match(markup, /aria-roledescription="carousel"/);
  assert.match(markup, /aria-label="Previous branch"/);
  assert.match(markup, /aria-label="Next branch"/);
  assert.match(markup, /alt="Alpha branch facility"/);
  assert.match(markup, />Needs attention</);

  const { default: RecentActivity } = await import(pathToFileURL(recentActivityBundlePath).href);
  const activities = Array.from({ length: 12 }, (_, index) => ({
    id: `activity-${index}`,
    source: 'Incident',
    title: `Issue ${index}`,
    branch: 'Alpha',
    status: 'Open',
    timestamp: Date.UTC(2026, 0, 12 - index),
    displayDate: `2026-01-${String(12 - index).padStart(2, '0')}`,
  }));
  const activityMarkup = renderToStaticMarkup(React.createElement(RecentActivity, { items: activities }));
  assert.match(activityMarkup, /id="dashboard-recent-activity"/);
  assert.match(activityMarkup, /aria-label="Recent activity timeline"/);
  assert.equal((activityMarkup.match(/role="listitem"/g) || []).length, 10, 'timeline renders at most 10 events');
  assert.match(activityMarkup, /Issue 0/);
  assert.doesNotMatch(activityMarkup, /Issue 10/);

  const emptyMarkup = renderToStaticMarkup(React.createElement(RecentActivity, { items: [] }));
  assert.match(emptyMarkup, /ຍັງບໍ່ມີກິດຈະກຳ/);
} finally {
  await rm(uiBehaviorDirectory, { recursive: true, force: true });
}

console.log('dashboard UI contract tests passed');
