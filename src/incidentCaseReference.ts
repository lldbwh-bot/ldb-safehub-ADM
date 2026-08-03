import type { IncidentRecord, InspectionRecord } from './types';

export interface ChecklistReferenceRow {
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string;
}

export interface IncidentCaseReference {
  displayCode: string;
  inspectionType: string;
  systemCategory: string;
  areaPoint: string;
  inspectionItem: string;
  branch: string;
  division: string;
  sector: string;
  floor: string;
  roomLocation: string;
}

const EMPTY_VALUES = new Set(['', 'none', 'null', 'undefined', 'nan']);
const LEGACY_DEFAULT_SECTORS = new Set([
  'ຂະແໜງ ບໍລິການ',
  'ຂະແແໜງ ບໍລິການ',
]);

const cleanValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).trim();
  return EMPTY_VALUES.has(cleaned.toLocaleLowerCase()) ? '' : cleaned;
};

const normalizeValue = (value: unknown): string =>
  cleanValue(value).replace(/\s+/g, ' ').toLocaleLowerCase();

const firstValue = (...values: unknown[]): string => {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return '';
};

export const normalizeCaseSector = (value: unknown): string => {
  const cleaned = cleanValue(value);
  if (!cleaned) return 'none';
  return LEGACY_DEFAULT_SECTORS.has(cleaned) ? 'none' : cleaned;
};

const isDirectIncident = (incident: IncidentRecord): boolean =>
  cleanValue(incident.ລະຫັດກວດກາ).toUpperCase().startsWith('INC-');

const findParentInspection = (
  incident: IncidentRecord,
  inspections: InspectionRecord[],
): InspectionRecord | undefined => {
  if (isDirectIncident(incident)) return undefined;
  const reference = normalizeValue(incident.ລະຫັດກວດກາ);
  if (!reference) return undefined;
  return inspections.find(
    inspection => normalizeValue(inspection.ລະຫັດກວດກາ) === reference,
  );
};

const getCheckpointAreaPoint = (
  incident: IncidentRecord,
  checklistItems: ChecklistReferenceRow[],
): string => {
  const inspectionItem = normalizeValue(incident.ລາຍການກວດ);
  if (!inspectionItem) return '';

  const itemMatches = checklistItems.filter(
    item => normalizeValue(item.ລາຍການກວດ) === inspectionItem,
  );
  const incidentSystem = normalizeValue(incident.ລະບົບທີ່ກວດ);
  const systemMatches = incidentSystem
    ? itemMatches.filter(
        item => normalizeValue(item.ລະບົບທີ່ກວດ) === incidentSystem,
      )
    : [];
  const resolvedMatches = systemMatches.length > 0 ? systemMatches : itemMatches;
  const uniqueAreaPoints = Array.from(
    new Set(
      resolvedMatches
        .map(item => cleanValue(item.ໝວດລະບົບກວດ))
        .filter(Boolean),
    ),
  );
  return uniqueAreaPoints.length === 1 ? uniqueAreaPoints[0] : '';
};

const getUnambiguousParentAreaPoint = (
  inspection: InspectionRecord | undefined,
): string => {
  const value = cleanValue(inspection?.ໝວດລະບົບກວດ);
  if (!value) return '';
  const parts = value
    .split(/\s+,\s+|[\r\n]+/)
    .map(cleanValue)
    .filter(Boolean);
  return parts.length === 1 ? parts[0] : '';
};

const getValidatedIncidentAreaPoint = (
  incident: IncidentRecord,
  checklistItems: ChecklistReferenceRow[],
): string => {
  const incidentAreaPoint = cleanValue(incident.ໝວດລະບົບກວດ);
  if (!incidentAreaPoint || isDirectIncident(incident)) return incidentAreaPoint;
  if (checklistItems.length === 0) return incidentAreaPoint;

  const incidentSystem = normalizeValue(incident.ລະບົບທີ່ກວດ);
  const validAreaPoints = checklistItems
    .filter(
      item =>
        !incidentSystem ||
        normalizeValue(item.ລະບົບທີ່ກວດ) === incidentSystem,
    )
    .map(item => normalizeValue(item.ໝວດລະບົບກວດ))
    .filter(Boolean);

  return validAreaPoints.includes(normalizeValue(incidentAreaPoint))
    ? incidentAreaPoint
    : '';
};

export function resolveIncidentCaseReference(
  incident: IncidentRecord,
  inspections: InspectionRecord[],
  checklistItems: ChecklistReferenceRow[],
): Omit<IncidentCaseReference, 'displayCode'> {
  const parent = findParentInspection(incident, inspections);
  const checkpointAreaPoint = isDirectIncident(incident)
    ? ''
    : getCheckpointAreaPoint(incident, checklistItems);

  return {
    inspectionType: firstValue(
      incident.ຮູບແບບການກວດ,
      parent?.ຮູບແບບການກວດ,
    ),
    systemCategory: firstValue(
      incident.ລະບົບທີ່ກວດ,
      parent?.ລະບົບທີ່ກວດ,
    ),
    areaPoint: firstValue(
      checkpointAreaPoint,
      getValidatedIncidentAreaPoint(incident, checklistItems),
      getUnambiguousParentAreaPoint(parent),
    ),
    inspectionItem: cleanValue(incident.ລາຍການກວດ),
    branch: firstValue(incident['ສາຂາ '], parent?.['ສາຂາ ']),
    division: firstValue(
      incident['ຝ່າຍ/ໜ່ວຍບໍລິການ'],
      parent?.['ຝ່າຍ/ໜ່ວຍບໍລິການ'],
    ),
    sector: normalizeCaseSector(firstValue(incident.ຂະແໜງ, parent?.ຂະແໜງ)),
    floor: firstValue(incident.ຊັ້ນອາຄານ, parent?.ຊັ້ນອາຄານ),
    roomLocation: firstValue(
      incident.ສະຖານທີ່_ຫ້ອງ,
      parent?.ສະຖານທີ່_ຫ້ອງ,
      parent?.ສະຖານທີ,
    ),
  };
}

export function getIncidentCaseDisplayCode(
  incident: IncidentRecord,
  incidents: IncidentRecord[],
): string {
  const reference = cleanValue(incident.ລະຫັດກວດກາ) || 'INC-REPORT';
  if (isDirectIncident(incident)) return reference;

  const siblings = incidents.filter(
    item =>
      normalizeValue(item.ລະຫັດກວດກາ) === normalizeValue(reference),
  );
  if (siblings.length <= 1) return reference;

  const caseIndex = siblings.findIndex(item => item.PID === incident.PID);
  return caseIndex >= 0 ? `${reference} / Case ${caseIndex + 1}` : reference;
}
