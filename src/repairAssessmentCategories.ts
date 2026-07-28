import type { RepairPreset } from './types';

export const AIR_FAN_CATEGORY = 'ລະບົບ ແອເຟັນ';
export const LEGACY_AIR_CONDITIONER_CATEGORY = 'ລະບົບເຄື່ອງປັບອາກາດ';
export const WATER_AND_SANITARY_CATEGORY = 'ລະບົບນໍ້າປະປາ & ສຸຂະພັນ';

const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  [LEGACY_AIR_CONDITIONER_CATEGORY]: AIR_FAN_CATEGORY,
  'ລະບົບນ້ຳປະປາ & ສຸຂະພັນ': WATER_AND_SANITARY_CATEGORY,
  'ລະບົບນ້ຳປະປາ ແລະ ສຸຂະພັນ': WATER_AND_SANITARY_CATEGORY,
};

export function normalizeRepairSubCategory(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  return CATEGORY_ALIASES[trimmed] || trimmed;
}

export function getRepairSubCategoryOptions(
  presets: Array<Pick<RepairPreset, 'repairSubCategory'>>,
): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];

  presets.forEach(preset => {
    const category = normalizeRepairSubCategory(preset.repairSubCategory);
    if (!category || seen.has(category)) return;

    seen.add(category);
    categories.push(category);
  });

  return categories;
}
