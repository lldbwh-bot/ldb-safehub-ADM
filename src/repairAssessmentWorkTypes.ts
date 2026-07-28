export const REPAIR_ASSESSMENT_WORK_TYPES = [
  'ກວດເຊັກ-ສ້ອມ',
  'ປ່ຽນອະໄຫຼ່',
  'ບໍລິການ',
] as const;

export type RepairAssessmentWorkType = typeof REPAIR_ASSESSMENT_WORK_TYPES[number];

const DEFAULT_WORK_TYPE: RepairAssessmentWorkType = 'ກວດເຊັກ-ສ້ອມ';

const LEGACY_WORK_TYPE_ALIASES: Readonly<Record<string, RepairAssessmentWorkType>> = {
  'ສ້ອມ': 'ກວດເຊັກ-ສ້ອມ',
  'ປ່ຽນ': 'ປ່ຽນອະໄຫຼ່',
  'ປັບປຸງ': 'ກວດເຊັກ-ສ້ອມ',
  'ກວດເຊັກ': 'ກວດເຊັກ-ສ້ອມ',
  'ກວດເຊັກ/ສ້ອມ': 'ກວດເຊັກ-ສ້ອມ',
};

export function normalizeRepairAssessmentWorkType(
  value: unknown,
): RepairAssessmentWorkType {
  if (typeof value !== 'string') return DEFAULT_WORK_TYPE;

  const trimmed = value.trim();
  if (REPAIR_ASSESSMENT_WORK_TYPES.includes(trimmed as RepairAssessmentWorkType)) {
    return trimmed as RepairAssessmentWorkType;
  }

  return LEGACY_WORK_TYPE_ALIASES[trimmed] || DEFAULT_WORK_TYPE;
}

export function isNoPartRepairAssessmentWorkType(value: unknown): boolean {
  const normalized = normalizeRepairAssessmentWorkType(value);
  return normalized === 'ກວດເຊັກ-ສ້ອມ' || normalized === 'ບໍລິການ';
}
