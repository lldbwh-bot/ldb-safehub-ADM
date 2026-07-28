import type { IncidentRecord } from './types';

export const INCIDENT_ASSET_ADD_NEW_SENTINEL = '__ADD_NEW__';

const normalizedKey = (value: unknown): string => (
  typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''
);

const RESERVED_INCIDENT_ASSET_MASTER_VALUES = new Set([
  'none',
  normalizedKey('ບໍ່ມີ'),
  normalizedKey('ບໍ່ມີຊັບສິນ'),
  normalizedKey('ບໍ່ມີຊັບສິນ (Case ທົ່ວໄປ)'),
  normalizedKey('ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)'),
  normalizedKey(INCIDENT_ASSET_ADD_NEW_SENTINEL),
]);

export function isReservedIncidentAssetMasterValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;

  const key = normalizedKey(value);
  return !key || RESERVED_INCIDENT_ASSET_MASTER_VALUES.has(key);
}

export function uniqueIncidentMasterValues(values: unknown[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const value of values) {
    if (isReservedIncidentAssetMasterValue(value)) continue;

    const display = (value as string).trim();
    const key = normalizedKey(display);
    if (seen.has(key)) continue;

    seen.add(key);
    options.push(display);
  }

  return options;
}

export function getIncidentItemTypeOptions(incidents: IncidentRecord[]): string[] {
  return uniqueIncidentMasterValues(incidents.map(incident => incident.ໝວດລາຍການ));
}

export function getIncidentAssetCategoryOptions(incidents: IncidentRecord[]): string[] {
  return uniqueIncidentMasterValues(incidents.map(incident => incident.ພາກສ່ວນຊັບສົມບັດ));
}

export function getDirectIncidentAssetNameOptions(
  incidents: IncidentRecord[],
  itemType: string,
): string[] {
  if (isReservedIncidentAssetMasterValue(itemType)) return [];

  const itemTypeKey = normalizedKey(itemType);
  return uniqueIncidentMasterValues(
    incidents
      .filter(incident => normalizedKey(incident.ໝວດລາຍການ) === itemTypeKey)
      .map(incident => incident.ລາຍການ),
  );
}

export function getInspectionAssetNameOptions(
  incidents: IncidentRecord[],
  assetCategory: string,
  assetGroup: string,
): string[] {
  if (
    isReservedIncidentAssetMasterValue(assetCategory)
    || isReservedIncidentAssetMasterValue(assetGroup)
  ) {
    return [];
  }

  const categoryKey = normalizedKey(assetCategory);
  const groupKey = normalizedKey(assetGroup);
  return uniqueIncidentMasterValues(
    incidents
      .filter(incident => (
        normalizedKey(incident.ພາກສ່ວນຊັບສົມບັດ) === categoryKey
        && normalizedKey(incident.ໝວດລາຍການ) === groupKey
      ))
      .map(incident => incident.ລາຍການ),
  );
}

export function canonicalizeIncidentMasterValue(value: string, options: string[]): string {
  const key = normalizedKey(value);
  return options.find(option => normalizedKey(option) === key) ?? value.trim();
}
