import type { ChecklistItem } from './types';

export const SAFETY_FORM_TYPES = [
  'ສຳນັກງານໃຫຍ່',
  'ສາຂາ',
  'ໜ່ວຍບໍລິການ',
  'ຫ້ອງຮັບເງິນ',
] as const;

export type SafetyFormType = (typeof SAFETY_FORM_TYPES)[number];

const normalize = (value: unknown): string => String(value ?? '').trim();

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

export function detectSafetyFormType(branch: string, division: string): SafetyFormType {
  const branchValue = normalize(branch);
  const divisionValue = normalize(division);
  const combined = `${divisionValue} ${branchValue}`;

  if (combined.includes('ຫ້ອງຮັບເງິນ') || combined.includes('ຫຮ')) {
    return 'ຫ້ອງຮັບເງິນ';
  }
  if (combined.includes('ໜ່ວຍບໍລິການ') || combined.includes('ນບ')) {
    return 'ໜ່ວຍບໍລິການ';
  }
  if (
    branchValue.includes('ສໍານັກງານໃຫຍ່')
    || branchValue.includes('ສຳນັກງານໃຫຍ່')
    || branchValue.includes('ສນຍ')
    || branchValue.startsWith('00.')
  ) {
    return 'ສຳນັກງານໃຫຍ່';
  }
  return 'ສາຂາ';
}

const matchesFormType = (item: ChecklistItem, formType: SafetyFormType): boolean => {
  const itemFormType = normalize(item.Form_Type);
  return itemFormType === '' || itemFormType === formType;
};

export function getSystemsForFormType(
  items: readonly ChecklistItem[],
  formType: SafetyFormType,
): string[] {
  return unique(
    items
      .filter(item => matchesFormType(item, formType))
      .map(item => normalize(item.ລະບົບທີ່ກວດ)),
  );
}

export function getAreasForFormTypeAndSystem(
  items: readonly ChecklistItem[],
  formType: SafetyFormType,
  system: string,
): string[] {
  const expectedSystem = normalize(system);
  if (!expectedSystem) return [];

  return unique(
    items
      .filter(item =>
        matchesFormType(item, formType)
        && normalize(item.ລະບົບທີ່ກວດ) === expectedSystem)
      .map(item => normalize(item.ໝວດລະບົບກວດ)),
  );
}
