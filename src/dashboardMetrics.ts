import { normalizeRepairAssessmentWorkType } from './repairAssessmentWorkTypes';

type MetricRecord = Record<string, unknown>;

export interface DashboardMetricSources {
  inspections?: unknown[] | null;
  incidents?: unknown[] | null;
  assessments?: unknown[] | null;
  approvals?: unknown[] | null;
  repairTracking?: unknown[] | null;
  repairs?: unknown[] | null;
  pmAssets?: unknown[] | null;
  pmHistory?: unknown[] | null;
  users?: unknown[] | null;
  branches?: unknown[] | null;
}

export interface DashboardMetricModel {
  kpi: {
    totalInspections: number;
    normalInspections: number;
    abnormalInspections: number;
    defectRate: number;
    inspectionDefects: number;
    incidentFromInspection: number;
    directIncidents: number;
    totalIncidents: number;
    cancelledIncidents: number;
    activeHighIncidents: number;
    activeMediumIncidents: number;
    activeLowIncidents: number;
    openIncidents: number;
    waitingAssessment: number;
    waitingApproval: number;
    approved: number;
    queueing: number;
    inProgress: number;
    awaitingParts: number;
    awaitingVendor: number;
    paused: number;
    repairCompleted: number;
    jobsClosed: number;
    slaOverdue: number;
    slaNearOverdue: number;
    repairing: number;
    completed: number;
    pmDueSoon: number;
    pmOverdue: number;
    totalRepairCost: number;
    averageCostPerCase: number;
    averageRepairDays: number;
    onTimeRate: number;
  };
  users: {
    total: number;
    admins: number;
    branchUsers: number;
    permissionAssignments: number;
  };
  repairStatus: ChartItem[];
  incidentSeverity: ChartItem[];
  pmStatus: ChartItem[];
  monthlyTrend: MonthlyTrendItem[];
  branchPerformance: BranchPerformanceItem[];
  recentActivity: RecentActivityItem[];
  issueDensity: IssueDensityItem[];
  topProblemBranches: RankedProblemItem[];
  topProblemSystems: RankedProblemItem[];
  activeTracking: ActiveTrackingItem[];
  repairTimeline: RepairTimelineItem[];
  branchRepairCosts: BranchRepairCostItem[];
  monthlyBranchTrend: MonthlyBranchTrendItem[];
  executiveInsights: ExecutiveInsight[];
  repairFrequency: RepairFrequencyReport;
}

export interface ChartItem {
  name: string;
  value: number;
}

export interface MonthlyTrendItem {
  month: string;
  inspections: number;
  incidents: number;
  completed: number;
}

export interface BranchPerformanceItem {
  branch: string;
  inspections: number;
  inspectionDefects: number;
  openIncidents: number;
  highSeverity: number;
  waitingAssessment: number;
  waitingApproval: number;
  repairing: number;
  completed: number;
  pmDueSoon: number;
  pmOverdue: number;
  repairCost: number;
  latestStatus: string;
  health: 'healthy' | 'attention' | 'critical';
}

export interface RecentActivityItem {
  id: string;
  source: string;
  title: string;
  branch: string;
  status: string;
  timestamp: number | null;
  displayDate: string;
}

export interface IssueDensityItem {
  branch: string;
  totalCases: number;
  safetySystem: number;
  hasAsset: number;
  exteriorBuilding: number;
  interiorBuilding: number;
  buildingInstallation: number;
}

export interface RankedProblemItem {
  name: string;
  value: number;
  highSeverity: number;
}

export interface ActiveTrackingItem {
  id: string;
  pid: string;
  branch: string;
  system: string;
  item: string;
  owner: string;
  vendor: string;
  status: string;
  progressPercent: number;
  startDate: string;
  expectedFinishDate: string;
  slaState: 'overdue' | 'near' | 'within';
  repairCost: number;
}

export interface RepairMilestone {
  key: 'incident' | 'assessment' | 'approval' | 'started' | 'progress' | 'completed';
  label: string;
  date: string;
  state: 'complete' | 'current' | 'pending';
}

export interface RepairTimelineItem {
  pid: string;
  branch: string;
  title: string;
  workflowPercent: number;
  milestones: RepairMilestone[];
}

export interface BranchRepairCostItem {
  branch: string;
  costLak: number;
  costMillionLak: number;
}

export interface MonthlyBranchTrendItem {
  month: string;
  branch: string;
  inspections: number;
  incidents: number;
  repairCost: number;
  repairCostMillionLak: number;
}

export interface ExecutiveInsight {
  code: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  branch: string;
  system: string;
  value: number;
}

export interface RepairFrequencyCase {
  key: string;
  assessmentId: string;
  incidentId: string;
  branch: string;
  repairSubCategory: string;
  repairSubItem: string;
  sparePart: string;
  workType:
    | '\u0e81\u0ea7\u0e94\u0ec0\u0e8a\u0eb1\u0e81-\u0eaa\u0ec9\u0ead\u0ea1'
    | '\u0e9b\u0ec8\u0ebd\u0e99\u0ead\u0eb0\u0ec4\u0eab\u0ebc\u0ec8'
    | '\u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99'
    | '';
  quantity: number;
  estimatedTotalCost: number;
}

export interface RepairFrequencyRankItem {
  name: string;
  inspectRepair: number;
  replacePart: number;
  service: number;
  total: number;
  cases: RepairFrequencyCase[];
}

export interface RepairFrequencyReport {
  subcategories: RepairFrequencyRankItem[];
  subItems: RepairFrequencyRankItem[];
  spareParts: RepairFrequencyRankItem[];
}

const LAO_INSPECTION_ID = 'ລະຫັດກວດກາ';
const LAO_STATUS = 'ສະຖານະ';
const LAO_BRANCH = 'ສາຂາ';
const LAO_BRANCH_WITH_SPACE = 'ສາຂາ ';
const LAO_ASSET_BRANCH = 'ສາຂາຊັບສິນ';
const LAO_IMPACT = 'ປະເມີນຜົນກະທົບ';
const LAO_DEFECT_COUNT = 'ຈຳນວນເຫດການທີ່ພົບ';
const LAO_REPAIR_COST = 'ມູນຄ່າສ້ອມແປງ';
const LAO_INSPECTION_DATE = 'ວັນທີ່ກວດ';
const LAO_REPAIR_DATE = 'ວັນທີ່ສ້ອມແປງ';
const LAO_APPROVAL_DATE = 'ວັນທີ່ອະນຸມັດ';
const LAO_COMPLETED_DATE = 'ວັນທີ່ສຳເລັດ';
const LAO_ASSET_CODE = 'ລະຫັດຊັບສິນ';
const LAO_ITEM = 'ລາຍການ';
const LAO_INSPECTION_ITEM = 'ລາຍການກວດ';
const LAO_ISSUE_DETAILS = 'ລາຍລະອຽດປັນຫາທີ່ພົບ';
const LAO_SYSTEM = 'ລະບົບທີ່ກວດ';

function records(value: unknown): MetricRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is MetricRecord => Boolean(item) && typeof item === 'object')
    : [];
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  return '';
}

function value(record: MetricRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== null && record[key] !== undefined) return record[key];
  }
  return undefined;
}

function firstText(record: MetricRecord, keys: string[]): string {
  for (const key of keys) {
    const candidate = text(record[key]);
    if (candidate) return candidate;
  }
  return '';
}

function finite(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(text(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, ' ');
}

function safeLabel(value: unknown, fallback = '—'): string {
  return text(value) || fallback;
}

function isoDateOrEmpty(value: unknown): string {
  const parsed = parseDashboardDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : '';
}

function getSystemCategory(record: MetricRecord): string {
  return firstText(record, ['systemCategory', LAO_SYSTEM]);
}

type IssueDensitySystem = 'safety' | 'exterior' | 'interior' | 'installation' | '';

function classifyIssueDensitySystem(record: MetricRecord): IssueDensitySystem {
  const system = normalized(getSystemCategory(record));
  if (!system) return '';
  if (system.includes(normalized('ຄວາມປອດໄພ'))) return 'safety';
  if (system.includes(normalized('ດ້ານນອກອາຄານ'))) return 'exterior';
  if (
    system.includes(normalized('ຕິດຕັ້ງອາຄານ'))
    || system.includes(normalized('ຕິດຕັ້ງພາຍໃນອາຄານ'))
  ) return 'installation';
  if (
    system.includes(normalized('ດ້ານໃນອາຄານ'))
    || system.includes(normalized('ພາຍໃນອາຄານ'))
  ) return 'interior';
  return '';
}

function hasMeaningfulAssetReference(record: MetricRecord): boolean {
  const candidates = [
    firstText(record, ['assetCode', LAO_ASSET_CODE]),
    firstText(record, ['assetName', LAO_ITEM]),
    firstText(record, ['assetGroup', 'ໝວດລາຍການ']),
  ];
  return candidates.some(candidate => {
    const key = normalized(candidate);
    return Boolean(key) && !['none', 'n/a', 'na', 'ບໍ່ມີ'].includes(key);
  });
}

function keyFor(record: MetricRecord, keys: string[], fallback: string): string {
  return firstText(record, keys) || fallback;
}

function scopedKeyFor(record: MetricRecord, keys: string[], fallback: string): string {
  return `${normalized(getDashboardRecordBranch(record))}\u0000${keyFor(record, keys, fallback)}`;
}

function repairHistoryKey(record: MetricRecord, index: number): string {
  const branch = normalized(getDashboardRecordBranch(record));
  const pid = firstText(record, ['PID']);
  if (pid) return `${branch}\u0000${pid}`;
  const rowId = firstText(record, ['historyId', 'id']);
  return `${branch}\u0000history:${rowId || index}`;
}

function uniqueBy(recordsToDedupe: MetricRecord[], getKey: (record: MetricRecord, index: number) => string): MetricRecord[] {
  const seen = new Set<string>();
  return recordsToDedupe.filter((record, index) => {
    const key = getKey(record, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getStatus(record: MetricRecord): string {
  return firstText(record, ['status', 'trackingStatus', 'assessmentStatus', 'maintenanceStatus', 'overallResult', LAO_STATUS]);
}

function getImpact(record: MetricRecord): string {
  return firstText(record, ['impactLevel', 'severity', 'priority', LAO_IMPACT]);
}

function getUserRole(record: MetricRecord): string {
  return normalized(value(record, ['status', 'role', LAO_STATUS]));
}

function isCompletedStatus(value: unknown): boolean {
  const status = normalized(value);
  return /\b(closed|completed|complete|resolved|done)\b/.test(status)
    || status.includes('ສຳເລັດ')
    || status.includes('ສໍາເລັດ')
    || status.includes('ປິດງານ');
}

function isCancelledStatus(value: unknown): boolean {
  const status = normalized(value);
  return /\b(cancelled|canceled|cancel)\b/.test(status) || status.includes('ຍົກເລີກ');
}

function isActiveStatus(value: unknown): boolean {
  return !isCompletedStatus(value) && !isCancelledStatus(value);
}

function isHighSeverity(value: unknown): boolean {
  const impact = normalized(value);
  return impact === 'high' || impact === 'critical' || impact.includes('ສູງ');
}

function isMediumSeverity(value: unknown): boolean {
  const impact = normalized(value);
  return impact === 'medium' || impact.includes('ປານກາງ');
}

function isLowSeverity(value: unknown): boolean {
  const impact = normalized(value);
  return !impact || impact === 'low' || impact.includes('ຕ່ຳ') || impact.includes('ຕໍ່າ');
}

function isNormalInspection(value: unknown): boolean {
  const status = normalized(value);
  return /\b(normal|pass)\b/.test(status) || status.includes('ປົກກະຕິ');
}

function isAbnormalInspection(value: unknown): boolean {
  const status = normalized(value);
  return /\b(defect|abnormal|fail)\b/.test(status)
    || status.includes('ຜິດປົກກະຕິ')
    || status.includes('ຜິດປົກກະຕີ');
}

function hasTrackingStatus(record: MetricRecord, ...tokens: string[]): boolean {
  const status = normalized(getStatus(record));
  return tokens.some(token => status === normalized(token));
}

function recordDate(record: MetricRecord, keys: string[]): Date | null {
  for (const key of keys) {
    const parsed = parseDashboardDateValue(record[key]);
    if (parsed) return parsed;
  }
  return null;
}

function isPmDueSoon(value: unknown): boolean {
  const status = normalized(value);
  return status.includes('ໃກ້ຮອດກຳນົດ') || /near[ -]?due|due soon/.test(status);
}

function isPmOverdue(value: unknown): boolean {
  const status = normalized(value);
  return status.includes('ເກີນກຳນົດ') || status.includes('overdue');
}

function isSubmittedAssessment(record: MetricRecord): boolean {
  const status = normalized(getStatus(record));
  return /\b(submitted|completed|complete|approved)\b/.test(status)
    || status.includes('ປະເມີນແລ້ວ')
    || status.includes('no assessment required');
}

function chart(items: Iterable<string>): ChartItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = text(item) || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns a record branch as a safe, trimmed string. */
export function getDashboardRecordBranch(record: unknown): string {
  if (!record || typeof record !== 'object') return '';
  return firstText(record as MetricRecord, ['branch', 'branchName', LAO_BRANCH_WITH_SPACE, LAO_BRANCH, LAO_ASSET_BRANCH]);
}

/** Returns the first valid operational date found on a record, or null. */
export function getDashboardRecordDate(record: unknown): Date | null {
  if (!record || typeof record !== 'object') return null;
  const dateRecord = record as MetricRecord;
  const dateKeys = [
    'date', 'createdAt', 'updatedAt', 'inspectionDate', 'assessmentDate', 'approvalDate',
    'startRepairDate', 'actualFinishDate', 'closedAt', 'nextMaintenanceDate', 'lastMaintenanceDate',
    LAO_INSPECTION_DATE, LAO_REPAIR_DATE, LAO_APPROVAL_DATE, LAO_COMPLETED_DATE,
  ];

  for (const key of dateKeys) {
    const parsed = parseDashboardDateValue(dateRecord[key]);
    if (parsed) return parsed;
  }
  return null;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function isSupportedDashboardDate(date: Date): boolean {
  const year = date.getUTCFullYear();
  return Number.isFinite(date.getTime()) && year >= 1900 && year <= 9999;
}

function parseDashboardDateValue(dateValue: unknown): Date | null {
  if (dateValue instanceof Date) return isSupportedDashboardDate(dateValue) ? new Date(dateValue.getTime()) : null;
  if (typeof dateValue === 'number' && Number.isFinite(dateValue)) {
    const time = dateValue > 10000000000
      ? dateValue
      : Date.UTC(1899, 11, 30) + dateValue * 86400000;
    const parsed = new Date(time);
    return isSupportedDashboardDate(parsed) ? parsed : null;
  }
  const dateText = text(dateValue);
  if (!dateText) return null;

  // Browser storage and spreadsheet imports can preserve an Excel serial date
  // as text. Passing that value to `new Date()` interprets it as a calendar
  // year (for example, "46179" becomes year 46179) instead of an Excel day.
  if (/^\d{5,6}(?:\.\d+)?$/.test(dateText)) {
    const serial = Number(dateText);
    const parsed = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return isSupportedDashboardDate(parsed) ? parsed : null;
  }

  const dayFirstMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(dateText);
  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const year = Number(dayFirstMatch[3]);
    if (isValidCalendarDate(year, month, day)) return new Date(Date.UTC(year, month - 1, day));
    return null;
  }

  const isoCalendarMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?=$|[T\s])/.exec(dateText);
  if (isoCalendarMatch && !isValidCalendarDate(
    Number(isoCalendarMatch[1]),
    Number(isoCalendarMatch[2]),
    Number(isoCalendarMatch[3]),
  )) {
    return null;
  }

  const parsed = new Date(dateText);
  return isSupportedDashboardDate(parsed) ? parsed : null;
}

function activityFallbackId(source: string, branch: string, date: Date | null, index: number): string {
  const sourcePart = source.toLowerCase().replace(/\s+/g, '-');
  const branchPart = encodeURIComponent(normalized(branch) || 'unknown');
  const datePart = date ? date.toISOString() : 'no-date';
  return `${sourcePart}:${branchPart}:${datePart}:${index}`;
}

function activityTitle(record: MetricRecord, id: string, source: string): string {
  return firstText(record, [
    'assetName', 'issueDetails', 'inspectionName', 'referenceName',
    LAO_ITEM, LAO_ISSUE_DETAILS, LAO_INSPECTION_ITEM,
    'assetCode', LAO_ASSET_CODE, 'inspectionCode', LAO_INSPECTION_ID,
    'referenceCode', LAO_SYSTEM,
  ]) || id || source;
}

function buildRecentActivity(sources: DashboardMetricSources): RecentActivityItem[] {
  const definitions: Array<{
    source: string;
    records: MetricRecord[];
    idKeys: string[];
  }> = [
    { source: 'Inspection', records: records(sources.inspections), idKeys: ['inspectionId', LAO_INSPECTION_ID, 'PID'] },
    { source: 'Incident', records: records(sources.incidents), idKeys: ['incidentId', 'PID'] },
    { source: 'Assessment', records: records(sources.assessments), idKeys: ['assessmentId', 'id', 'PID'] },
    { source: 'Approval', records: records(sources.approvals), idKeys: ['approvalId', 'PID'] },
    { source: 'Tracking', records: records(sources.repairTracking), idKeys: ['trackingId', 'PID'] },
    { source: 'Repair History', records: records(sources.repairs), idKeys: ['historyId', 'PID'] },
    { source: 'PM History', records: records(sources.pmHistory), idKeys: ['id', 'assetCode'] },
  ];
  const seen = new Set<string>();
  const activities: RecentActivityItem[] = [];

  for (const definition of definitions) {
    definition.records.forEach((record, index) => {
      const branchText = getDashboardRecordBranch(record);
      const date = getDashboardRecordDate(record);
      const stableId = firstText(record, definition.idKeys);
      const id = stableId || activityFallbackId(definition.source, branchText, date, index);
      const dedupeKey = `${definition.source}:${normalized(branchText)}:${id}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      activities.push({
        id,
        source: definition.source,
        title: activityTitle(record, stableId, definition.source),
        branch: branchText || '—',
        status: getStatus(record) || 'No status',
        timestamp: date ? date.getTime() : null,
        displayDate: date ? date.toISOString().slice(0, 10) : 'No date',
      });
    });
  }

  return activities
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp !== null) return 1;
      if (a.timestamp !== null && b.timestamp === null) return -1;
      if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return a.source.localeCompare(b.source) || a.id.localeCompare(b.id);
    })
    .slice(0, 20);
}

function buildRepairFrequencyCases(assessments: MetricRecord[]): RepairFrequencyCase[] {
  const cases: RepairFrequencyCase[] = [];
  const seen = new Set<string>();

  assessments.forEach((assessment, assessmentIndex) => {
    const assessmentId = firstText(assessment, ['assessmentId', 'PID']);
    const assessmentIdentity = normalized(assessmentId) || `assessment:${assessmentIndex}`;
    const incidentId = firstText(assessment, ['incidentId']);
    const branch = getDashboardRecordBranch(assessment);

    records(assessment.subItems).forEach((subItem, subItemIndex) => {
      const subItemId = firstText(subItem, ['id']);
      const repairSubCategory = firstText(subItem, ['repairSubCategory']);
      const repairSubItem = firstText(subItem, ['repairSubItem']);
      const sparePart = firstText(subItem, ['sparePart']);
      const fields = [repairSubCategory, repairSubItem, sparePart].map(normalized).join('\u0000');
      const key = subItemId
        ? `${assessmentIdentity}::${normalized(subItemId)}`
        : `${assessmentIdentity}::item:${subItemIndex}:${fields}`;
      const dedupeKey = `${normalized(branch)}\u0000${key}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      cases.push({
        key,
        assessmentId,
        incidentId,
        branch,
        repairSubCategory,
        repairSubItem,
        sparePart,
        workType: normalizeRepairFrequencyWorkType(subItem.workType),
        quantity: finite(subItem.quantity),
        estimatedTotalCost: finite(subItem.estimatedTotalCost),
      });
    });
  });

  return cases;
}

const REPAIR_FREQUENCY_RECOGNIZED_WORK_TYPES = new Set([
  'ກວດເຊັກ-ສ້ອມ',
  'ປ່ຽນອະໄຫຼ່',
  'ບໍລິການ',
  'ສ້ອມ',
  'ປ່ຽນ',
  'ປັບປຸງ',
  'ກວດເຊັກ',
  'ກວດເຊັກ/ສ້ອມ',
]);

function normalizeRepairFrequencyWorkType(value: unknown): RepairFrequencyCase['workType'] {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return REPAIR_FREQUENCY_RECOGNIZED_WORK_TYPES.has(trimmed)
    ? normalizeRepairAssessmentWorkType(trimmed)
    : '';
}

function rankRepairFrequency(
  cases: RepairFrequencyCase[],
  field: 'repairSubCategory' | 'repairSubItem' | 'sparePart',
): RepairFrequencyRankItem[] {
  const ranks = new Map<string, RepairFrequencyRankItem>();

  for (const repairCase of cases) {
    const name = repairCase[field];
    const key = normalized(name);
    if (!key) continue;

    const rank = ranks.get(key) || {
      name,
      inspectRepair: 0,
      replacePart: 0,
      service: 0,
      total: 0,
      cases: [],
    };
    ranks.set(key, rank);
    rank.total += 1;
    rank.cases.push(repairCase);

    if (repairCase.workType === '\u0e81\u0ea7\u0e94\u0ec0\u0e8a\u0eb1\u0e81-\u0eaa\u0ec9\u0ead\u0ea1') rank.inspectRepair += 1;
    if (repairCase.workType === '\u0e9b\u0ec8\u0ebd\u0e99\u0ead\u0eb0\u0ec4\u0eab\u0ebc\u0ec8') rank.replacePart += 1;
    if (repairCase.workType === '\u0e9a\u0ecd\u0ea5\u0eb4\u0e81\u0eb2\u0e99') rank.service += 1;
  }

  return [...ranks.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, 10);
}

/**
 * Reconciles source collections into dashboard-safe metrics without mutating their records.
 */
export function buildDashboardMetrics(sources: DashboardMetricSources, now = new Date()): DashboardMetricModel {
  const safeSources = sources || {};
  const inspections = uniqueBy(records(safeSources.inspections), (record, index) =>
    scopedKeyFor(record, [LAO_INSPECTION_ID, 'inspectionId'], firstText(record, ['PID']) || `inspection:${index}`));
  const incidents = uniqueBy(records(safeSources.incidents), (record, index) =>
    scopedKeyFor(record, ['PID'], `incident:${index}`));
  const assessments = uniqueBy(records(safeSources.assessments), (record, index) =>
    scopedKeyFor(record, ['assessmentId', 'PID'], `assessment:${index}`));
  const approvals = uniqueBy(records(safeSources.approvals), (record, index) =>
    scopedKeyFor(record, ['PID'], `approval:${index}`));
  const tracking = uniqueBy(records(safeSources.repairTracking), (record, index) =>
    scopedKeyFor(record, ['PID'], `tracking:${index}`));
  const repairs = uniqueBy(records(safeSources.repairs), (record, index) =>
    repairHistoryKey(record, index));
  const pmAssets = uniqueBy(records(safeSources.pmAssets), (record, index) =>
    scopedKeyFor(record, ['assetCode'], `pm-asset:${index}`));
  const pmHistory = uniqueBy(records(safeSources.pmHistory), (record, index) =>
    scopedKeyFor(record, ['id'], `pm-history:${index}`));
  const users = uniqueBy(records(safeSources.users), (record, index) =>
    keyFor(record, ['username'], `user:${index}`));
  const branches = uniqueBy(records(safeSources.branches), (record, index) =>
    normalized(keyFor(record, ['branch', LAO_BRANCH], `branch:${index}`)));

  const scopedInspections = inspections;
  const scopedIncidents = incidents;
  const scopedAssessments = assessments;
  const scopedApprovals = approvals;
  const scopedTracking = tracking;
  const scopedRepairs = repairs;
  const scopedPmAssets = pmAssets;
  const scopedPmHistory = pmHistory;
  const repairFrequencyCases = buildRepairFrequencyCases(scopedAssessments);
  const repairFrequency: RepairFrequencyReport = {
    subcategories: rankRepairFrequency(repairFrequencyCases, 'repairSubCategory'),
    subItems: rankRepairFrequency(repairFrequencyCases, 'repairSubItem'),
    spareParts: rankRepairFrequency(repairFrequencyCases, 'sparePart'),
  };

  const incidentBranches = new Map<string, Set<string>>();
  for (const incident of incidents) {
    const pid = firstText(incident, ['PID']);
    if (!pid) continue;
    const branchesForPid = incidentBranches.get(pid) || new Set<string>();
    branchesForPid.add(normalized(getDashboardRecordBranch(incident)));
    incidentBranches.set(pid, branchesForPid);
  }
  const workflowKey = (record: MetricRecord, idKeys: string[]): string => {
    const id = firstText(record, idKeys);
    if (!id) return '';
    let branch = normalized(getDashboardRecordBranch(record));
    const knownBranches = incidentBranches.get(id);
    if (!branch && knownBranches?.size === 1) branch = [...knownBranches][0];
    return `${branch}\u0000${id}`;
  };
  const assessmentIncidentKeys = new Set(assessments.map(record => workflowKey(record, ['incidentId'])).filter(Boolean));
  const submittedAssessmentIncidentKeys = new Set(
    assessments.filter(isSubmittedAssessment).map(record => workflowKey(record, ['incidentId'])).filter(Boolean),
  );
  const approvalKeys = new Set(approvals.map(record => workflowKey(record, ['PID'])).filter(Boolean));
  const historyWorkflowKeys = new Set(repairs.map(record => workflowKey(record, ['PID'])).filter(Boolean));
  const completedTrackingKeys = new Set(
    tracking.filter(record => isCompletedStatus(getStatus(record))).map(record => workflowKey(record, ['PID'])).filter(Boolean),
  );
  const trackingKeys = new Set(tracking.map(record => workflowKey(record, ['PID'])).filter(Boolean));
  const activeIncidents = incidents.filter(record => isActiveStatus(getStatus(record)));
  const repairingKeys = new Set(
    tracking
      .filter(record => isActiveStatus(getStatus(record)))
      .map(record => workflowKey(record, ['PID']))
      .filter(key => Boolean(key) && !historyWorkflowKeys.has(key)),
  );
  const completedKeys = new Set([
    ...repairs.map(repairHistoryKey),
    ...[...completedTrackingKeys].filter(key => !historyWorkflowKeys.has(key)),
  ]);

  const statusForRepair = (record: MetricRecord): string => {
    const key = workflowKey(record, ['PID']);
    if (key && historyWorkflowKeys.has(key)) return 'Completed';
    return getStatus(record);
  };
  const historyCost = repairs.reduce((sum, record) => sum + finite(value(record, ['repairCost', LAO_REPAIR_COST])), 0);
  const activeTrackingCost = tracking
    .filter(record => {
      const key = workflowKey(record, ['PID']);
      return isActiveStatus(getStatus(record)) && (!key || !historyWorkflowKeys.has(key));
    })
    .reduce((sum, record) => sum + finite(value(record, ['repairCost', LAO_REPAIR_COST])), 0);

  const inspectionDefects = inspections.reduce(
    (sum, record) => sum + finite(value(record, ['defectCount', 'issueCount', LAO_DEFECT_COUNT])),
    0,
  );
  const normalInspections = inspections.filter(record => isNormalInspection(getStatus(record))).length;
  const abnormalInspections = inspections.filter(record => isAbnormalInspection(getStatus(record))).length;
  const defectRate = inspections.length > 0
    ? Number(((abnormalInspections / inspections.length) * 100).toFixed(1))
    : 0;
  const inspectionReferences = new Set(
    inspections.flatMap(record => [
      firstText(record, ['inspectionId']),
      firstText(record, [LAO_INSPECTION_ID]),
      firstText(record, ['PID']),
    ]).map(normalized).filter(Boolean),
  );
  const inspectionOriginIncidents = incidents.filter(record => {
    const reference = normalized(firstText(record, [
      'inspectionId',
      'inspectionCode',
      LAO_INSPECTION_ID,
    ]));
    return Boolean(reference) && inspectionReferences.has(reference);
  });
  const incidentFromInspection = inspectionOriginIncidents.length;
  const directIncidents = incidents.length - incidentFromInspection;
  const cancelledIncidents = incidents.filter(record => isCancelledStatus(getStatus(record))).length;
  const activeHighIncidents = activeIncidents.filter(record => isHighSeverity(getImpact(record))).length;
  const activeMediumIncidents = activeIncidents.filter(record => isMediumSeverity(getImpact(record))).length;
  const activeLowIncidents = activeIncidents.filter(record => isLowSeverity(getImpact(record))).length;
  const approved = new Set(
    [...approvalKeys].filter(key => !trackingKeys.has(key) && !historyWorkflowKeys.has(key)),
  ).size;

  const currentTracking = tracking.filter((record, index) => {
    const key = workflowKey(record, ['PID'])
      || scopedKeyFor(record, ['trackingId', 'id'], `tracking:${index}`);
    return !historyWorkflowKeys.has(key);
  });
  const queueing = currentTracking.filter(record => hasTrackingStatus(
    record,
    'Waiting to Start', 'Queueing', 'ລໍຖ້າເລີ່ມສ້ອມ',
  )).length;
  const inProgress = currentTracking.filter(record => hasTrackingStatus(
    record,
    'In Progress', 'Repairing', 'ກຳລັງດຳເນີນການ', 'ກຳລັງສ້ອມແປງ',
  )).length;
  const awaitingParts = currentTracking.filter(record => hasTrackingStatus(
    record,
    'Awaiting Parts', 'ລໍຖ້າອະໄຫຼ່',
  )).length;
  const awaitingVendor = currentTracking.filter(record => hasTrackingStatus(
    record,
    'Awaiting Vendor', 'ລໍຖ້າ Vendor',
  )).length;
  const paused = currentTracking.filter(record => hasTrackingStatus(
    record,
    'Paused', 'ຢຸດຊົ່ວຄາວ',
  )).length;
  const repairCompleted = currentTracking.filter(record => hasTrackingStatus(
    record,
    'Repair Completed', 'ສ້ອມສຳເລັດ', 'ສ້ອມສໍາເລັດ',
  )).length;

  const midnightUtc = (date: Date): number => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const slaState = (record: MetricRecord): 'overdue' | 'near' | 'on-time' | 'late' | 'within' => {
    const impact = getImpact(record);
    const fallbackDays = isHighSeverity(impact) ? 3 : isMediumSeverity(impact) ? 7 : 15;
    const start = recordDate(record, ['startRepairDate', LAO_APPROVAL_DATE, LAO_INSPECTION_DATE]);
    const expected = recordDate(record, ['expectedFinishDate'])
      || (start ? new Date(start.getTime() + fallbackDays * 86400000) : null);
    if (!expected) return 'within';
    const actual = recordDate(record, ['actualFinishDate', LAO_COMPLETED_DATE]);
    if (isCompletedStatus(getStatus(record))) {
      return !actual || midnightUtc(actual) <= midnightUtc(expected) ? 'on-time' : 'late';
    }
    const daysLeft = Math.ceil((midnightUtc(expected) - midnightUtc(now)) / 86400000);
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 1) return 'near';
    return 'within';
  };
  const openTracking = currentTracking.filter(record => isActiveStatus(getStatus(record)));
  const slaOverdue = openTracking.filter(record => slaState(record) === 'overdue').length;
  const slaNearOverdue = openTracking.filter(record => slaState(record) === 'near').length;
  const closedTracking = tracking.filter(record => isCompletedStatus(getStatus(record)));
  const onTimeTracking = closedTracking.filter(record => slaState(record) === 'on-time').length;
  const onTimeRate = closedTracking.length > 0
    ? Number(((onTimeTracking / closedTracking.length) * 100).toFixed(1))
    : 100;
  const uniqueRepairCases = new Set([
    ...tracking.map((record, index) => workflowKey(record, ['PID'])
      || scopedKeyFor(record, ['trackingId', 'id'], `tracking:${index}`)),
    ...repairs.map((record, index) => repairHistoryKey(record, index)),
  ]);
  const totalRepairCost = historyCost + activeTrackingCost;
  const averageCostPerCase = uniqueRepairCases.size > 0
    ? Math.round(totalRepairCost / uniqueRepairCases.size)
    : 0;
  const repairDays = repairs
    .map(record => finite(value(record, ['totalRepairDays', 'ລວມມື້ທີ່ສຳເລັດ'])))
    .filter(days => days > 0);
  const averageRepairDays = repairDays.length > 0
    ? Number((repairDays.reduce((sum, days) => sum + days, 0) / repairDays.length).toFixed(1))
    : 0;

  const operationalRecords = [
    ...scopedInspections, ...scopedIncidents, ...scopedAssessments, ...scopedApprovals,
    ...scopedTracking, ...scopedRepairs, ...scopedPmAssets, ...scopedPmHistory,
  ];
  const branchNames = new Map<string, string>();
  for (const record of [...branches, ...operationalRecords]) {
    const branch = getDashboardRecordBranch(record);
    const branchKey = normalized(branch);
    if (branchKey && !branchNames.has(branchKey)) branchNames.set(branchKey, branch);
  }
  const matchesBranch = (record: MetricRecord, branchKey: string): boolean =>
    normalized(getDashboardRecordBranch(record)) === branchKey;

  const branchPerformance = [...branchNames.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([branchKey, branch]): BranchPerformanceItem => {
      const branchInspections = scopedInspections.filter(record => matchesBranch(record, branchKey));
      const branchAllIncidents = scopedIncidents.filter(record => matchesBranch(record, branchKey));
      const branchIncidents = branchAllIncidents.filter(record => isActiveStatus(getStatus(record)));
      const branchAssessments = scopedAssessments.filter(record => matchesBranch(record, branchKey));
      const branchApprovals = scopedApprovals.filter(record => matchesBranch(record, branchKey));
      const branchTracking = scopedTracking.filter(record => matchesBranch(record, branchKey));
      const branchRepairs = scopedRepairs.filter(record => matchesBranch(record, branchKey));
      const branchPmAssets = scopedPmAssets.filter(record => matchesBranch(record, branchKey));
      const branchPmHistory = scopedPmHistory.filter(record => matchesBranch(record, branchKey));
      const branchAssessmentIncidentIds = new Set(
        branchAssessments.map(record => firstText(record, ['incidentId'])).filter(Boolean),
      );
      const branchSubmittedAssessmentIncidentIds = new Set(
        branchAssessments
          .filter(isSubmittedAssessment)
          .map(record => firstText(record, ['incidentId']))
          .filter(Boolean),
      );
      const branchApprovalPids = new Set(
        branchApprovals.map(record => firstText(record, ['PID'])).filter(Boolean),
      );
      const branchTrackingPids = new Set(
        branchTracking.map(record => firstText(record, ['PID'])).filter(Boolean),
      );
      const branchHistoryPids = new Set(
        branchRepairs.map(record => firstText(record, ['PID'])).filter(Boolean),
      );
      const waitingAssessment = branchIncidents.filter(record => {
        const pid = firstText(record, ['PID']);
        return Boolean(pid)
          && !branchAssessmentIncidentIds.has(pid)
          && !branchApprovalPids.has(pid)
          && !branchTrackingPids.has(pid)
          && !branchHistoryPids.has(pid);
      }).length;
      const waitingApproval = branchIncidents.filter(record => {
        const pid = firstText(record, ['PID']);
        return Boolean(pid)
          && branchSubmittedAssessmentIncidentIds.has(pid)
          && !branchApprovalPids.has(pid)
          && !branchTrackingPids.has(pid)
          && !branchHistoryPids.has(pid);
      }).length;
      const repairing = new Set(
        branchTracking
          .filter(record => isActiveStatus(getStatus(record)))
          .map(record => firstText(record, ['PID']))
          .filter(pid => Boolean(pid) && !branchHistoryPids.has(pid)),
      ).size;
      const completed = new Set([
        ...branchRepairs.map(repairHistoryKey),
        ...branchTracking
          .filter(record => isCompletedStatus(getStatus(record)))
          .map(record => workflowKey(record, ['PID']))
          .filter(key => Boolean(key) && !historyWorkflowKeys.has(key)),
      ]).size;
      const pmDueSoon = branchPmAssets.filter(record => isPmDueSoon(getStatus(record))).length;
      const pmOverdue = branchPmAssets.filter(record => isPmOverdue(getStatus(record))).length;
      const highSeverity = branchIncidents.filter(record => isHighSeverity(getImpact(record))).length;
      const repairCost = branchRepairs
        .reduce((sum, record) => sum + finite(value(record, ['repairCost', LAO_REPAIR_COST])), 0)
        + branchTracking
          .filter(record => {
            const pid = firstText(record, ['PID']);
            return isActiveStatus(getStatus(record)) && (!pid || !branchHistoryPids.has(pid));
          })
          .reduce((sum, record) => sum + finite(value(record, ['repairCost', LAO_REPAIR_COST])), 0);
      const activityCandidates = [
        ...branchInspections.map(record => ({ record, precedence: 20, fallback: 'Inspection recorded', key: keyFor(record, [LAO_INSPECTION_ID, 'inspectionId', 'PID'], '') })),
        ...branchAllIncidents.map(record => ({ record, precedence: 30, fallback: 'Incident recorded', key: keyFor(record, ['PID'], '') })),
        ...branchAssessments.map(record => ({ record, precedence: 40, fallback: 'Assessment recorded', key: keyFor(record, ['assessmentId', 'PID'], '') })),
        ...branchApprovals.map(record => ({ record, precedence: 50, fallback: 'Approval recorded', key: keyFor(record, ['PID'], '') })),
        ...branchTracking
          .filter(record => {
            const pid = firstText(record, ['PID']);
            return !pid || !branchHistoryPids.has(pid);
          })
          .map(record => ({ record, precedence: 60, fallback: 'Repair in progress', key: keyFor(record, ['PID'], '') })),
        ...branchPmHistory.map(record => ({ record, precedence: 70, fallback: 'PM completed', key: keyFor(record, ['id', 'assetCode'], '') })),
        ...branchRepairs.map(record => ({ record, precedence: 80, fallback: 'Completed', key: keyFor(record, ['id', 'PID'], '') })),
      ].map(activity => ({ ...activity, date: getDashboardRecordDate(activity.record) }))
        .filter((activity): activity is typeof activity & { date: Date } => Boolean(activity.date))
        .sort((a, b) => b.date.getTime() - a.date.getTime()
          || b.precedence - a.precedence
          || a.key.localeCompare(b.key));
      const latestActivity = activityCandidates[0];
      const latestStatus = latestActivity
        ? getStatus(latestActivity.record) || latestActivity.fallback
        : 'No recent activity';
      const openIncidents = branchIncidents.length;
      const health: BranchPerformanceItem['health'] = pmOverdue > 0 || highSeverity > 0
        ? 'critical'
        : openIncidents > 0 || waitingAssessment > 0 || waitingApproval > 0 || repairing > 0 || pmDueSoon > 0
          ? 'attention'
          : 'healthy';

      return {
        branch,
        inspections: branchInspections.length,
        inspectionDefects: branchInspections.reduce(
          (sum, record) => sum + finite(value(record, ['defectCount', 'issueCount', LAO_DEFECT_COUNT])),
          0,
        ),
        openIncidents,
        highSeverity,
        waitingAssessment,
        waitingApproval,
        repairing,
        completed,
        pmDueSoon,
        pmOverdue,
        repairCost,
        latestStatus,
        health,
      };
    });

  const monthMap = new Map<string, MonthlyTrendItem>();
  const addMonth = (record: MetricRecord, metric: keyof Omit<MonthlyTrendItem, 'month'>) => {
    const date = getDashboardRecordDate(record);
    if (!date) return;
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const item = monthMap.get(month) || { month, inspections: 0, incidents: 0, completed: 0 };
    item[metric] += 1;
    monthMap.set(month, item);
  };
  inspections.forEach(record => addMonth(record, 'inspections'));
  incidents.forEach(record => addMonth(record, 'incidents'));
  repairs.forEach(record => addMonth(record, 'completed'));
  tracking.filter(record => isCompletedStatus(getStatus(record)) && !historyWorkflowKeys.has(workflowKey(record, ['PID'])))
    .forEach(record => addMonth(record, 'completed'));

  const issueDensity = [...branchNames.entries()]
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([branchKey, branch]): IssueDensityItem => {
      const branchIncidents = incidents.filter(record => matchesBranch(record, branchKey));
      const countSystem = (expected: Exclude<IssueDensitySystem, ''>) => branchIncidents.filter(
        record => classifyIssueDensitySystem(record) === expected,
      ).length;
      return {
        branch,
        totalCases: branchIncidents.length,
        safetySystem: countSystem('safety'),
        hasAsset: branchIncidents.filter(hasMeaningfulAssetReference).length,
        exteriorBuilding: countSystem('exterior'),
        interiorBuilding: countSystem('interior'),
        buildingInstallation: countSystem('installation'),
      };
    });

  const topProblemBranches: RankedProblemItem[] = issueDensity
    .filter(item => item.totalCases > 0)
    .map(item => ({
      name: item.branch,
      value: item.totalCases,
      highSeverity: branchPerformance.find(branch => branch.branch === item.branch)?.highSeverity || 0,
    }))
    .sort((a, b) => b.value - a.value || b.highSeverity - a.highSeverity || a.name.localeCompare(b.name))
    .slice(0, 10);

  const systemCounts = new Map<string, RankedProblemItem>();
  for (const incident of incidents) {
    const label = getSystemCategory(incident) || 'Unspecified system';
    const key = normalized(label);
    const current = systemCounts.get(key) || { name: label, value: 0, highSeverity: 0 };
    current.value += 1;
    if (isHighSeverity(getImpact(incident))) current.highSeverity += 1;
    systemCounts.set(key, current);
  }
  const topProblemSystems = [...systemCounts.values()]
    .sort((a, b) => b.value - a.value || b.highSeverity - a.highSeverity || a.name.localeCompare(b.name))
    .slice(0, 10);

  const activeTracking: ActiveTrackingItem[] = currentTracking
    .filter(record => isActiveStatus(getStatus(record)))
    .map((record, index): ActiveTrackingItem => {
      const state = slaState(record);
      return {
        id: firstText(record, ['trackingId', 'id']) || `tracking:${index}`,
        pid: firstText(record, ['PID', 'incidentId']) || `tracking:${index}`,
        branch: safeLabel(getDashboardRecordBranch(record)),
        system: safeLabel(getSystemCategory(record)),
        item: safeLabel(firstText(record, ['assetName', LAO_ITEM, LAO_ISSUE_DETAILS])),
        owner: safeLabel(firstText(record, ['owner', 'responsiblePerson'])),
        vendor: safeLabel(firstText(record, ['vendor', 'vendorName', 'vendor ຜູ້ສະໜອງ'])),
        status: safeLabel(getStatus(record), 'No status'),
        progressPercent: Math.min(100, Math.max(0, finite(record.progressPercent))),
        startDate: isoDateOrEmpty(record.startRepairDate),
        expectedFinishDate: isoDateOrEmpty(record.expectedFinishDate),
        slaState: state === 'overdue' ? 'overdue' : state === 'near' ? 'near' : 'within',
        repairCost: finite(value(record, ['repairCost', LAO_REPAIR_COST])),
      };
    })
    .sort((a, b) => {
      const priority = { overdue: 0, near: 1, within: 2 };
      return priority[a.slaState] - priority[b.slaState]
        || a.expectedFinishDate.localeCompare(b.expectedFinishDate)
        || a.id.localeCompare(b.id);
    });

  const assessmentByIncident = new Map<string, MetricRecord>();
  for (const record of assessments) {
    const key = workflowKey(record, ['incidentId']);
    if (key && !assessmentByIncident.has(key)) assessmentByIncident.set(key, record);
  }
  const approvalByIncident = new Map<string, MetricRecord>();
  for (const record of approvals) {
    const key = workflowKey(record, ['PID', 'incidentId']);
    if (key && !approvalByIncident.has(key)) approvalByIncident.set(key, record);
  }
  const trackingByIncident = new Map<string, MetricRecord>();
  for (const record of tracking) {
    const key = workflowKey(record, ['PID', 'incidentId']);
    if (key && !trackingByIncident.has(key)) trackingByIncident.set(key, record);
  }
  const historyByIncident = new Map<string, MetricRecord>();
  for (const record of repairs) {
    const key = workflowKey(record, ['PID', 'incidentId']);
    if (key && !historyByIncident.has(key)) historyByIncident.set(key, record);
  }

  const repairTimeline: RepairTimelineItem[] = incidents.map((incident, index) => {
    const pid = firstText(incident, ['PID', 'incidentId']) || `incident:${index}`;
    const key = workflowKey(incident, ['PID', 'incidentId']);
    const assessment = assessmentByIncident.get(key);
    const approval = approvalByIncident.get(key);
    const trackingRecord = trackingByIncident.get(key);
    const history = historyByIncident.get(key);
    const incidentDate = getDashboardRecordDate(incident);
    const assessmentDate = assessment ? getDashboardRecordDate(assessment) : null;
    const approvalDate = approval ? getDashboardRecordDate(approval) : null;
    const startedDate = trackingRecord
      ? recordDate(trackingRecord, ['startRepairDate', LAO_APPROVAL_DATE])
      : null;
    const progressDate = trackingRecord
      ? recordDate(trackingRecord, ['updatedAt', 'startRepairDate', LAO_APPROVAL_DATE])
      : null;
    const completedDate = history
      ? recordDate(history, ['actualFinishDate', LAO_COMPLETED_DATE, LAO_REPAIR_DATE])
      : trackingRecord
        ? recordDate(trackingRecord, ['actualFinishDate', 'closedAt'])
        : null;
    const progressPercent = Math.min(100, Math.max(0, finite(trackingRecord?.progressPercent)));
    const isCompleted = Boolean(history)
      || Boolean(trackingRecord && isCompletedStatus(getStatus(trackingRecord)));
    const workflowPercent = isCompleted
      ? 100
      : trackingRecord
        ? Math.round(60 + (progressPercent * 0.2))
        : approval
          ? 40
          : assessment
            ? 20
            : 0;
    const currentKey: RepairMilestone['key'] = isCompleted
      ? 'completed'
      : trackingRecord
        ? 'progress'
        : approval
          ? 'started'
          : assessment
            ? 'approval'
            : 'assessment';
    const rawMilestones: Array<{
      key: RepairMilestone['key'];
      label: string;
      date: Date | null;
      complete: boolean;
    }> = [
      { key: 'incident', label: 'ບັນທຶກເຫດການ (Incident recorded)', date: incidentDate, complete: true },
      { key: 'assessment', label: 'ສົ່ງການປະເມີນ (Assessment submitted)', date: assessmentDate, complete: Boolean(assessment) },
      { key: 'approval', label: 'ອະນຸມັດການສ້ອມ (Repair approved)', date: approvalDate, complete: Boolean(approval) },
      { key: 'started', label: 'ເລີ່ມສ້ອມ (Repair started)', date: startedDate, complete: Boolean(trackingRecord) },
      { key: 'progress', label: `ຄວາມຄືບໜ້າ ${progressPercent}% (Progress ${progressPercent}%)`, date: progressDate, complete: isCompleted },
      { key: 'completed', label: 'ສ້ອມສຳເລັດ (Repair completed)', date: completedDate, complete: isCompleted },
    ];
    return {
      pid,
      branch: safeLabel(getDashboardRecordBranch(incident)),
      title: safeLabel(firstText(incident, [LAO_ISSUE_DETAILS, 'issueDetails', 'assetName', LAO_ITEM]), pid),
      workflowPercent,
      milestones: rawMilestones.map(milestone => ({
        key: milestone.key,
        label: milestone.label,
        date: milestone.date ? milestone.date.toISOString().slice(0, 10) : '',
        state: milestone.complete
          ? 'complete'
          : milestone.key === currentKey
            ? 'current'
            : 'pending',
      })),
    };
  });

  const branchRepairCosts: BranchRepairCostItem[] = branchPerformance
    .map(item => ({
      branch: item.branch,
      costLak: finite(item.repairCost),
      costMillionLak: Number((finite(item.repairCost) / 1000000).toFixed(3)),
    }))
    .sort((a, b) => b.costLak - a.costLak || a.branch.localeCompare(b.branch));

  const monthlyBranchMap = new Map<string, MonthlyBranchTrendItem>();
  const getMonthlyBranchItem = (record: MetricRecord, explicitDate?: Date | null) => {
    const date = explicitDate === undefined ? getDashboardRecordDate(record) : explicitDate;
    if (!date) return null;
    const branch = getDashboardRecordBranch(record) || 'Unknown branch';
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const key = `${normalized(branch)}\u0000${month}`;
    const item = monthlyBranchMap.get(key) || {
      month,
      branch,
      inspections: 0,
      incidents: 0,
      repairCost: 0,
      repairCostMillionLak: 0,
    };
    monthlyBranchMap.set(key, item);
    return item;
  };
  for (const record of inspections) {
    const item = getMonthlyBranchItem(record);
    if (item) item.inspections += 1;
  }
  for (const record of incidents) {
    const item = getMonthlyBranchItem(record);
    if (item) item.incidents += 1;
  }
  for (const record of repairs) {
    const item = getMonthlyBranchItem(record);
    if (item) item.repairCost += finite(value(record, ['repairCost', LAO_REPAIR_COST]));
  }
  for (const record of tracking) {
    const key = workflowKey(record, ['PID']);
    if (!isActiveStatus(getStatus(record)) || (key && historyWorkflowKeys.has(key))) continue;
    const item = getMonthlyBranchItem(record);
    if (item) item.repairCost += finite(value(record, ['repairCost', LAO_REPAIR_COST]));
  }
  const monthlyBranchTrend = [...monthlyBranchMap.values()]
    .map(item => ({
      ...item,
      repairCostMillionLak: Number((item.repairCost / 1000000).toFixed(3)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.branch.localeCompare(b.branch));

  const executiveInsights: ExecutiveInsight[] = [];
  if (slaOverdue > 0) {
    executiveInsights.push({
      code: 'SLA_OVERDUE',
      severity: 'critical',
      title: `${slaOverdue} repair case${slaOverdue === 1 ? '' : 's'} exceeded SLA`,
      detail: 'Prioritize overdue active repairs and confirm owner, vendor, and expected completion dates.',
      branch: activeTracking.find(item => item.slaState === 'overdue')?.branch || 'All branches',
      system: activeTracking.find(item => item.slaState === 'overdue')?.system || 'All systems',
      value: slaOverdue,
    });
  }
  if (activeHighIncidents > 0) {
    const topHighBranch = branchPerformance
      .filter(item => item.highSeverity > 0)
      .sort((a, b) => b.highSeverity - a.highSeverity || a.branch.localeCompare(b.branch))[0];
    executiveInsights.push({
      code: 'HIGH_SEVERITY',
      severity: 'critical',
      title: `${activeHighIncidents} active high-severity incident${activeHighIncidents === 1 ? '' : 's'}`,
      detail: 'Review containment, assessment, approval, and repair ownership for every high-severity case.',
      branch: topHighBranch?.branch || 'All branches',
      system: 'All systems',
      value: activeHighIncidents,
    });
  }
  const leadingBranch = topProblemBranches[0];
  if (leadingBranch) {
    executiveInsights.push({
      code: 'BRANCH_CONCENTRATION',
      severity: leadingBranch.highSeverity > 0 ? 'warning' : 'info',
      title: `${leadingBranch.name} has the highest incident volume`,
      detail: `${leadingBranch.value} unique incident case${leadingBranch.value === 1 ? '' : 's'} in the current dashboard scope.`,
      branch: leadingBranch.name,
      system: 'All systems',
      value: leadingBranch.value,
    });
  }
  const leadingSystem = topProblemSystems[0];
  if (leadingSystem) {
    executiveInsights.push({
      code: 'REPEATED_SYSTEM',
      severity: leadingSystem.value > 1 ? 'warning' : 'info',
      title: `${leadingSystem.name} is the most affected system`,
      detail: `${leadingSystem.value} unique incident case${leadingSystem.value === 1 ? '' : 's'} require review of recurring controls or maintenance.`,
      branch: 'All branches',
      system: leadingSystem.name,
      value: leadingSystem.value,
    });
  }
  const costLeader = branchRepairCosts.find(item => item.costLak > 0);
  if (costLeader) {
    executiveInsights.push({
      code: 'COST_CONCENTRATION',
      severity: 'info',
      title: `${costLeader.branch} has the highest repair cost`,
      detail: `${costLeader.costLak.toLocaleString('en-US')} LAK in reconciled active and completed repairs.`,
      branch: costLeader.branch,
      system: 'All systems',
      value: costLeader.costLak,
    });
  }
  const pmOverdueCount = pmAssets.filter(record => isPmOverdue(getStatus(record))).length;
  if (pmOverdueCount > 0) {
    executiveInsights.push({
      code: 'PM_OVERDUE',
      severity: 'warning',
      title: `${pmOverdueCount} PM asset${pmOverdueCount === 1 ? '' : 's'} overdue`,
      detail: 'Schedule overdue preventive maintenance to reduce avoidable operational incidents.',
      branch: 'All branches',
      system: 'All systems',
      value: pmOverdueCount,
    });
  }
  if (executiveInsights.length === 0) {
    executiveInsights.push({
      code: incidents.length || inspections.length || tracking.length || repairs.length ? 'HEALTHY' : 'NO_DATA',
      severity: 'positive',
      title: incidents.length || inspections.length || tracking.length || repairs.length
        ? 'No immediate operational exception detected'
        : 'No matching operational data',
      detail: incidents.length || inspections.length || tracking.length || repairs.length
        ? 'Continue monitoring the current dashboard scope and preventive-maintenance schedule.'
        : 'Adjust dashboard filters or add operational records to generate recommendations.',
      branch: 'All branches',
      system: 'All systems',
      value: 0,
    });
  }

  const activities = buildRecentActivity(safeSources);

  return {
    kpi: {
      totalInspections: inspections.length,
      normalInspections,
      abnormalInspections,
      defectRate,
      inspectionDefects,
      incidentFromInspection,
      directIncidents,
      totalIncidents: incidents.length,
      cancelledIncidents,
      activeHighIncidents,
      activeMediumIncidents,
      activeLowIncidents,
      openIncidents: activeIncidents.length,
      waitingAssessment: activeIncidents.filter(record => {
        const key = workflowKey(record, ['PID']);
        return Boolean(key) && !assessmentIncidentKeys.has(key) && !approvalKeys.has(key) && !trackingKeys.has(key) && !historyWorkflowKeys.has(key);
      }).length,
      waitingApproval: activeIncidents.filter(record => {
        const key = workflowKey(record, ['PID']);
        return Boolean(key) && submittedAssessmentIncidentKeys.has(key) && !approvalKeys.has(key) && !trackingKeys.has(key) && !historyWorkflowKeys.has(key);
      }).length,
      approved,
      queueing,
      inProgress,
      awaitingParts,
      awaitingVendor,
      paused,
      repairCompleted,
      jobsClosed: completedKeys.size,
      slaOverdue,
      slaNearOverdue,
      repairing: repairingKeys.size,
      completed: completedKeys.size,
      pmDueSoon: pmAssets.filter(record => isPmDueSoon(getStatus(record))).length,
      pmOverdue: pmAssets.filter(record => isPmOverdue(getStatus(record))).length,
      totalRepairCost,
      averageCostPerCase,
      averageRepairDays,
      onTimeRate,
    },
    users: {
      total: users.length,
      admins: users.filter(record => getUserRole(record) === 'admin').length,
      branchUsers: users.filter(record => ['user', 'branch user'].includes(getUserRole(record))).length,
      permissionAssignments: users.reduce((sum, record) => sum + (Array.isArray(record.allowedTabs) ? record.allowedTabs.length : 0), 0),
    },
    repairStatus: chart([...tracking, ...repairs].map(statusForRepair)),
    incidentSeverity: chart(incidents.map(getImpact)),
    pmStatus: chart(pmAssets.map(getStatus)),
    monthlyTrend: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    branchPerformance,
    recentActivity: activities,
    issueDensity,
    topProblemBranches,
    topProblemSystems,
    activeTracking,
    repairTimeline,
    branchRepairCosts,
    monthlyBranchTrend,
    executiveInsights,
    repairFrequency,
  };
}
