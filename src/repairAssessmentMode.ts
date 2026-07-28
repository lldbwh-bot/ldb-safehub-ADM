import type { RepairAssessmentRecord, RepairSubItem } from './types';

export type AssessmentRepairerType = '' | 'ຊ່າງພາຍໃນ' | 'Vendor';

export interface AssessmentModeDraft {
  noAssessmentRequired: boolean;
  assessorType: string;
  minorTaskRepairerName: string;
  vendorName: string;
  subItems: RepairSubItem[];
}

export interface AssessmentLevelRepairerInput {
  noAssessmentRequired: boolean;
  assessorType: string;
  minorTaskRepairerName: string;
}

export type AssessmentRepairerSaveInput = AssessmentModeDraft;

export interface AssessmentRepairerSaveResult {
  assessorType: AssessmentRepairerType;
  minorTaskRepairerName: string;
  vendorName: string;
  subItems: RepairSubItem[];
}

const INTERNAL_REPAIRER = 'ຊ່າງພາຍໃນ' as const;
const VENDOR_REPAIRER = 'Vendor' as const;

function normalizeRepairerType(value: unknown): AssessmentRepairerType {
  return value === INTERNAL_REPAIRER || value === VENDOR_REPAIRER ? value : '';
}

export function isAssessmentLevelRepairerVisible(
  noAssessmentRequired: boolean,
): boolean {
  return noAssessmentRequired;
}

export function isSubItemRepairerAuthoritative(
  noAssessmentRequired: boolean,
): boolean {
  return !noAssessmentRequired;
}

export function switchAssessmentMode(input: AssessmentModeDraft): AssessmentModeDraft {
  if (input.noAssessmentRequired) {
    const type = normalizeRepairerType(input.assessorType) || INTERNAL_REPAIRER;
    return {
      noAssessmentRequired: true,
      assessorType: type,
      minorTaskRepairerName: input.minorTaskRepairerName.trim(),
      vendorName: type === VENDOR_REPAIRER ? input.minorTaskRepairerName.trim() : '',
      subItems: [],
    };
  }

  return {
    noAssessmentRequired: false,
    assessorType: '',
    minorTaskRepairerName: '',
    vendorName: '',
    subItems: input.subItems,
  };
}

export function validateAssessmentLevelRepairer(
  input: AssessmentLevelRepairerInput,
): string | null {
  if (!input.noAssessmentRequired) return null;

  const type = normalizeRepairerType(input.assessorType);
  if (!type) return 'ກະລຸນາເລືອກ ປະເພດຜູ້ສ້ອມ';
  if (input.minorTaskRepairerName.trim()) return null;
  return type === VENDOR_REPAIRER
    ? 'ກະລຸນາລະບຸ ຊື່ບໍລິສັດ / Vendor'
    : 'ກະລຸນາລະບຸ ຊື່ພະນັກງານຜູ້ສ້ອມ';
}

export function normalizeAssessmentRepairerForSave(
  input: AssessmentRepairerSaveInput,
): AssessmentRepairerSaveResult {
  if (!input.noAssessmentRequired) {
    return {
      assessorType: '',
      minorTaskRepairerName: '',
      vendorName: '',
      subItems: input.subItems,
    };
  }

  const assessorType =
    normalizeRepairerType(input.assessorType) || INTERNAL_REPAIRER;
  const minorTaskRepairerName = input.minorTaskRepairerName.trim();
  return {
    assessorType,
    minorTaskRepairerName,
    vendorName: assessorType === VENDOR_REPAIRER ? minorTaskRepairerName : '',
    subItems: [],
  };
}

export function resolveMinorTaskRepairerName(
  record: Pick<
    RepairAssessmentRecord,
    'assessorName' | 'assessorType' | 'vendorName' | 'minorTaskRepairerName'
  >,
): string {
  const current = record.minorTaskRepairerName?.trim();
  if (current) return current;
  if (record.assessorType === VENDOR_REPAIRER) return record.vendorName?.trim() || '';
  return record.assessorName?.trim() || '';
}
