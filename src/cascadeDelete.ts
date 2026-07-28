import type {
  IncidentRecord,
  InspectionRecord,
  RepairApprovalRecord,
  RepairAssessmentRecord,
  RepairLogRecord,
  RepairTrackingRecord,
} from './types';

export type CascadeDeleteSource = 'inspection' | 'incident';

export interface CascadeDeleteCollections {
  inspections: InspectionRecord[];
  incidents: IncidentRecord[];
  assessments: RepairAssessmentRecord[];
  approvals: RepairApprovalRecord[];
  repairTracking: RepairTrackingRecord[];
  repairs: RepairLogRecord[];
}

export interface CascadeDeleteImpact {
  inspections: number;
  incidents: number;
  assessments: number;
  approvals: number;
  repairTracking: number;
  repairs: number;
  attachments: number;
  totalRecords: number;
}

export interface CascadeDeletePlan {
  remaining: CascadeDeleteCollections;
  deleted: CascadeDeleteCollections;
  deletedPids: string[];
  impact: CascadeDeleteImpact;
}

type AnyWorkflowRecord = Record<string, unknown>;

const ATTACHMENT_KEYS = new Set([
  'ຮູບພາບລາຍການທີ່ເພ',
  'ຮູບພາບກ່ອນສ້ອມແປງ',
  'ຮູບພາຍຫຼັງການແກ້ໄຂ',
  'ເອກະສານອະນຸມັດ',
  'ຊຸດເອກະສານຈ່າຍເງິນ',
  'beforePhoto',
  'duringPhoto',
  'afterPhoto',
  'photo',
  'attachment',
  'attachments',
  'evidence',
  'document',
  'file',
]);

const PLACEHOLDER_ATTACHMENTS = new Set([
  '[Truncated Base64]',
  '[Large File Truncated for Storage]',
  '[Large Content Truncated]',
]);

const clean = (value: unknown): string => String(value ?? '').trim();

const cleanSet = (values: unknown[]): Set<string> =>
  new Set(values.map(clean).filter(Boolean));

const isExactOrChild = (value: unknown, roots: Set<string>): boolean => {
  const candidate = clean(value);
  if (!candidate) return false;
  for (const root of roots) {
    if (candidate === root || candidate.startsWith(`${root}-`)) return true;
  }
  return false;
};

const inspectionCode = (record: unknown): string =>
  clean((record as AnyWorkflowRecord | null)?.['ລະຫັດກວດກາ']);

const recordPid = (record: unknown): string =>
  clean((record as AnyWorkflowRecord | null)?.PID);

const isAttachmentKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return ATTACHMENT_KEYS.has(key)
    || normalized.includes('photo')
    || normalized.includes('attachment')
    || normalized.includes('evidence')
    || normalized.includes('document')
    || key.includes('ຮູບ')
    || key.includes('ເອກະສານ')
    || key.includes('ຫຼັກຖານ');
};

const countAttachmentValue = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countAttachmentValue(item), 0);
  }
  const normalized = clean(value);
  if (!normalized || PLACEHOLDER_ATTACHMENTS.has(normalized)) return 0;
  return 1;
};

const countAttachments = (collections: CascadeDeleteCollections): number => {
  const records = [
    ...collections.inspections,
    ...collections.incidents,
    ...collections.assessments,
    ...collections.approvals,
    ...collections.repairTracking,
    ...collections.repairs,
  ];

  return records.reduce((total, record) => {
    if (!record || typeof record !== 'object') return total;
    return total + Object.entries(record as unknown as AnyWorkflowRecord).reduce(
      (recordTotal, [key, value]) => recordTotal + (isAttachmentKey(key) ? countAttachmentValue(value) : 0),
      0,
    );
  }, 0);
};

const partition = <T>(items: T[], shouldDelete: (item: T) => boolean): { deleted: T[]; remaining: T[] } => {
  const deleted: T[] = [];
  const remaining: T[] = [];
  for (const item of items) {
    (shouldDelete(item) ? deleted : remaining).push(item);
  }
  return { deleted, remaining };
};

const emptyPlan = (collections: CascadeDeleteCollections): CascadeDeletePlan => ({
  remaining: collections,
  deleted: {
    inspections: [],
    incidents: [],
    assessments: [],
    approvals: [],
    repairTracking: [],
    repairs: [],
  },
  deletedPids: [],
  impact: {
    inspections: 0,
    incidents: 0,
    assessments: 0,
    approvals: 0,
    repairTracking: 0,
    repairs: 0,
    attachments: 0,
    totalRecords: 0,
  },
});

export function planCascadeDelete(
  collections: CascadeDeleteCollections,
  source: CascadeDeleteSource,
  requestedPids: string[],
): CascadeDeletePlan {
  const requested = cleanSet(requestedPids);
  if (requested.size === 0) return emptyPlan(collections);

  const inspectionRoots = source === 'inspection'
    ? partition(collections.inspections, item => requested.has(recordPid(item)))
    : { deleted: [] as InspectionRecord[], remaining: collections.inspections };

  const selectedInspectionCodes = cleanSet(inspectionRoots.deleted.map(inspectionCode));

  const incidentRoots = partition(collections.incidents, item => {
    const pid = recordPid(item);
    if (source === 'incident') return requested.has(pid);
    return isExactOrChild(pid, requested)
      || (selectedInspectionCodes.size > 0 && selectedInspectionCodes.has(inspectionCode(item)));
  });

  const incidentPids = cleanSet(incidentRoots.deleted.map(recordPid));
  const incidentCodes = cleanSet(incidentRoots.deleted.map(inspectionCode));

  const safeIncidentCodes = source === 'inspection'
    ? new Set([...selectedInspectionCodes, ...incidentCodes])
    : new Set([...incidentCodes].filter(code =>
      !collections.incidents.some(item => inspectionCode(item) === code && !incidentPids.has(recordPid(item))),
    ));

  const isLinkedDownstream = (item: unknown): boolean => {
    if (!item || typeof item !== 'object') return false;
    const record = item as AnyWorkflowRecord;
    if (isExactOrChild(record.PID, incidentPids)) return true;
    if (isExactOrChild(record.incidentId, incidentPids)) return true;

    const linkedCode = clean(record.inspectionId) || inspectionCode(record);
    return Boolean(linkedCode && safeIncidentCodes.has(linkedCode));
  };

  const assessmentPlan = partition<RepairAssessmentRecord>(collections.assessments, item => isLinkedDownstream(item));
  const approvalPlan = partition<RepairApprovalRecord>(collections.approvals, item => isLinkedDownstream(item));
  const trackingPlan = partition<RepairTrackingRecord>(collections.repairTracking, item => isLinkedDownstream(item));
  const repairPlan = partition<RepairLogRecord>(collections.repairs, item => isLinkedDownstream(item));

  const deleted: CascadeDeleteCollections = {
    inspections: inspectionRoots.deleted,
    incidents: incidentRoots.deleted,
    assessments: assessmentPlan.deleted,
    approvals: approvalPlan.deleted,
    repairTracking: trackingPlan.deleted,
    repairs: repairPlan.deleted,
  };

  const remaining: CascadeDeleteCollections = {
    inspections: inspectionRoots.remaining,
    incidents: incidentRoots.remaining,
    assessments: assessmentPlan.remaining,
    approvals: approvalPlan.remaining,
    repairTracking: trackingPlan.remaining,
    repairs: repairPlan.remaining,
  };

  const impact: CascadeDeleteImpact = {
    inspections: deleted.inspections.length,
    incidents: deleted.incidents.length,
    assessments: deleted.assessments.length,
    approvals: deleted.approvals.length,
    repairTracking: deleted.repairTracking.length,
    repairs: deleted.repairs.length,
    attachments: countAttachments(deleted),
    totalRecords: 0,
  };
  impact.totalRecords = impact.inspections
    + impact.incidents
    + impact.assessments
    + impact.approvals
    + impact.repairTracking
    + impact.repairs;

  const deletedPids = [...cleanSet([
    ...requested,
    ...deleted.inspections.map(recordPid),
    ...deleted.incidents.map(recordPid),
    ...deleted.assessments.map(recordPid),
    ...deleted.approvals.map(recordPid),
    ...deleted.repairTracking.map(recordPid),
    ...deleted.repairs.map(recordPid),
  ])];

  return { remaining, deleted, deletedPids, impact };
}
