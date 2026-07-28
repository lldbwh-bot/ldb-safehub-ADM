import type { BranchInfo, ChecklistItem, PMAsset, PMHistoryRecord } from './types';

export const PM_ASSET_GROUP_OPTIONS = [
  'AIR_CONDITIONER',
  'ATM',
  'CCTV',
  'FIRE_ALARM',
  'GENERATOR',
  'NOTEBOOK',
  'UPS',
  'ໂຕະ',
  'ຕັ່ງ',
  'ອື່ນໆ',
] as const;

const normalizedKey = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();
const safeText = (value: unknown) => value === null || value === undefined ? '' : String(value);
const safeDisplay = (value: unknown) => safeText(value).trim() || '—';
const safeSectorExport = (value: unknown) => normalizeSector(value) === 'none' ? '' : safeText(value).trim();

export function isReservedPMAssetMasterValue(value: unknown): boolean {
  return normalizedKey(value) === normalizedKey('__ADD_NEW__');
}

export function uniqueNormalizedStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const display = safeText(value).trim();
    const key = normalizedKey(display);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(display);
  });

  return result;
}

export function getAssetGroupOptions(assets: Array<Pick<PMAsset, 'assetGroup'>>): string[] {
  return uniqueNormalizedStrings([
    ...PM_ASSET_GROUP_OPTIONS,
    ...assets.map(asset => asset.assetGroup),
  ]).filter(value => !isReservedPMAssetMasterValue(value));
}

export function getAssetNameOptions(values: unknown[]): string[] {
  return uniqueNormalizedStrings(values).filter(value => !isReservedPMAssetMasterValue(value));
}

export function getAssetCategoryOptions(values: unknown[]): string[] {
  return uniqueNormalizedStrings(values).filter(value => {
    const key = normalizedKey(value);
    return key !== 'none' && key !== normalizedKey('ບໍ່ມີ');
  });
}

export function getBranchOptions(branches: BranchInfo[]): string[] {
  return uniqueNormalizedStrings(branches.map(branch => branch.ສາຂາ));
}

export function getDivisionOptions(branches: BranchInfo[], selectedBranch: string): string[] {
  const branchKey = normalizedKey(selectedBranch);
  return uniqueNormalizedStrings(
    branches
      .filter(branch => normalizedKey(branch.ສາຂາ) === branchKey)
      .map(branch => branch['ຝ່າຍ/ໜ່ວຍບໍລິການ'] || branch.ສາຂາ),
  );
}

export function getSystemOptions(checklistItems: ChecklistItem[]): string[] {
  return uniqueNormalizedStrings(checklistItems.map(item => item.ລະບົບທີ່ກວດ));
}

export function getAreaPointOptions(checklistItems: ChecklistItem[], selectedSystem: string): string[] {
  const systemKey = normalizedKey(selectedSystem);
  return uniqueNormalizedStrings(
    checklistItems
      .filter(item => normalizedKey(item.ລະບົບທີ່ກວດ) === systemKey)
      .map(item => item.ໝວດລະບົບກວດ),
  );
}

export function normalizeSector(value: unknown): string {
  const display = safeText(value).trim();
  const key = normalizedKey(display);
  return !key || key === normalizedKey('ບໍ່ມີ') || key === 'none' ? 'none' : display;
}

export function formatSectorForDisplay(value: unknown): string {
  return normalizeSector(value) === 'none' ? '—' : safeDisplay(value);
}

export function floorLabelToLegacyFloor(value: unknown): string {
  const match = safeText(value).trim().match(/(\d+)/);
  return match?.[1] || '';
}

export function buildPMAssetExportRow(asset: PMAsset, index: number): Record<string, string | number> {
  return {
    'ລຳດັບ (No.)': index + 1,
    'ລະຫັດຊັບສິນ (Asset Code)': safeText(asset.assetCode),
    'ຊື່ຊັບສິນ (Asset Name)': safeText(asset.assetName),
    'ພາກສ່ວນຊັບສົມບັດ (Asset Category)': safeText(asset.assetCategory),
    'ໝວດລາຍການ (Asset Group)': safeText(asset.assetGroup),
    'ສາຂາ (Branch)': safeText(asset.branch),
    'ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)': safeText(asset.division),
    'ຂະແໜງ (Sector)': safeSectorExport(asset.sector),
    'ຊັ້ນອາຄານ (Floor)': safeText(asset.floor),
    'ລາຍລະອຽດສະຖານທີ່ (Location Detail)': safeText(asset.locationDetail),
    'ສະຖານທີ່/ຊັ້ນອາຄານ': safeDisplay(asset.ສະຖານທີ່_ຫ້ອງ),
    'ລະບົບທີ່ກວດ (System Category)': safeText(asset.systemCategory),
    'ພື້ນທີ່/ຈຸດກວດ (Area / Point)': safeText(asset.subsystemCategory),
    'ຮອບວຽນບຳລຸງຮັກສາ (Cycle)': safeText(asset.maintenanceCycle),
    'ວັນທີບຳລຸງຮັກສາຫຼ້າສຸດ (Last PM Date)': safeText(asset.lastMaintenanceDate),
    'ວັນທີບຳລຸງຮັກສາຄັ້ງຕໍ່ໄປ (Next PM Date)': safeText(asset.nextMaintenanceDate),
    'ແຈ້ງເຕືອນລ່ວງໜ້າເປັນວັນ (Alert Days)': Number(asset.alertBeforeDays || 0),
    'ຜູ້ຮັບຜິດຊອບ (Person In Charge)': safeText(asset.responsiblePerson),
    'ຜູ້ຮັບເໝົາ/Vendor': safeText(asset.vendor),
    'ສະຖານະການແຈ້ງເຕືອນ (Alert Status)': safeText(asset.maintenanceStatus),
  };
}

export function buildPMHistoryExportRow(item: PMHistoryRecord, index: number): Record<string, string | number> {
  return {
    'ລຳດັບ (No.)': index + 1,
    'ລະຫັດຊັບສິນ (Asset Code)': safeText(item.assetCode),
    'ຊື່ຊັບສິນ (Asset Name)': safeText(item.assetName),
    'ສາຂາ (Branch)': safeText(item.branch),
    'ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)': safeText(item.division),
    'ຊັ້ນອາຄານ (Floor)': safeText(item.floor),
    'ລາຍລະອຽດສະຖານທີ່ (Location Detail)': safeText(item.locationDetail),
    'ສະຖານທີ່/ຊັ້ນອາຄານ': safeDisplay(item.ສະຖານທີ່_ຫ້ອງ),
    'ລະບົບທີ່ກວດ (System Category)': safeText(item.systemCategory),
    'ພື້ນທີ່/ຈຸດກວດ (Area / Point)': safeText(item.subsystemCategory),
    'ວັນທີ່ກວດ (PM Date)': safeText(item.inspectionDate),
    'ຜູ້ກວດກາ (Inspector)': safeText(item.inspector),
    'ຜົນການກວດ (Overall Result)': safeText(item.overallResult),
    'ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)': safeText(item.issueDetails),
    'ປະເມີນຜົນກະທົບ (Impact Level)': safeText(item.impactLevel),
    'ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)': safeText(item.proposedSolution),
    'ລະຫັດ PID ທີ່ກ່ຽວຂ້ອງ (Related PID)': safeText(item.relatedIncidentId),
  };
}
