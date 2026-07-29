import { apiRequest, getApiToken, isCentralApiAvailable } from './apiClient';

export const CENTRAL_DATASETS = [
  'inspections',
  'incidents',
  'assessments',
  'approvals',
  'repair-tracking',
  'repairs',
  'pm-assets',
  'pm-history',
  'branches',
  'checklist-items',
  'sectors',
  'repair-presets',
] as const;

export type CentralDataset = (typeof CENTRAL_DATASETS)[number];
type JsonRecord = Record<string, unknown>;
type DatasetSnapshot = Partial<Record<CentralDataset, JsonRecord[]>>;
type CentralUser = JsonRecord & { username: string };

const LOCAL_KEYS: Record<CentralDataset, string> = {
  inspections: 'ldb_local_inspections',
  incidents: 'ldb_local_incidents',
  assessments: 'ldb_local_assessments',
  approvals: 'ldb_local_approvals',
  'repair-tracking': 'ldb_local_repair_tracking',
  repairs: 'ldb_local_repairs',
  'pm-assets': 'ldb_pm_assets',
  'pm-history': 'ldb_pm_history',
  branches: 'ldb_branches',
  'checklist-items': 'ldb_checklist_items_v10',
  sectors: 'ldb_sectors',
  'repair-presets': 'ldb_repair_presets_v3',
};

const firstString = (record: JsonRecord, names: string[]): string => {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
};

export const getStableRecordId = (
  dataset: CentralDataset,
  record: JsonRecord,
  index: number,
): string => {
  if (dataset === 'branches') {
    return `${firstString(record, ['ສາຂາ', 'branch'])}::${firstString(record, [
      'ຝ່າຍ/ໜ່ວຍບໍລິການ',
      'division',
    ])}`;
  }
  if (dataset === 'checklist-items') {
    return [
      firstString(record, ['Form_Type']),
      firstString(record, ['ລະບົບທີ່ກວດ']),
      firstString(record, ['ໝວດລະບົບກວດ']),
      firstString(record, ['ລາຍການກວດ']),
    ].join('::');
  }
  if (dataset === 'sectors') return firstString(record, ['ຂະແໜງ', 'sector']);
  return firstString(record, [
    'PID',
    'assessmentId',
    'approvalId',
    'trackingId',
    'historyId',
    'pmAssetId',
    'assetCode',
    'id',
    'recordId',
  ]) || `${dataset}-${index + 1}`;
};

export const buildDatasetRecords = (
  dataset: CentralDataset,
  values: JsonRecord[],
): Array<{ recordId: string; record: JsonRecord }> =>
  values.map((record, index) => ({
    recordId: getStableRecordId(dataset, record, index),
    record,
  }));

export const unwrapDataset = (
  values: Array<{ record: JsonRecord }>,
): JsonRecord[] => values.map((value) => value.record);

const fingerprint = async (snapshot: DatasetSnapshot): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const dataUrlToBlob = (value: string): Blob | null => {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(value);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
  } catch {
    return null;
  }
};

const moveFilesToR2 = async (
  value: unknown,
  entityType: string,
  entityId: string,
  path = 'attachment',
): Promise<unknown> => {
  if (typeof value === 'string' && value.startsWith('data:')) {
    const blob = dataUrlToBlob(value);
    if (!blob) return value;
    const query = new URLSearchParams({
      fileName: `${entityId}-${path.replace(/[^a-z0-9_-]/gi, '-')}`,
      entityType,
      entityId,
    });
    const result = await apiRequest<{ url: string }>(`/api/files?${query}`, {
      method: 'POST',
      headers: { 'content-type': blob.type },
      body: blob,
    });
    return result.url;
  }
  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        moveFilesToR2(item, entityType, entityId, `${path}-${index}`),
      ),
    );
  }
  if (value && typeof value === 'object') {
    const output: JsonRecord = {};
    for (const [key, entry] of Object.entries(value as JsonRecord)) {
      output[key] = await moveFilesToR2(
        entry,
        entityType,
        entityId,
        `${path}-${key}`,
      );
    }
    return output;
  }
  return value;
};

const prepareRecords = async (
  dataset: CentralDataset,
  values: JsonRecord[],
): Promise<Array<{ recordId: string; record: JsonRecord }>> => {
  const records = buildDatasetRecords(dataset, values);
  return Promise.all(
    records.map(async ({ recordId, record }) => ({
      recordId,
      record: await moveFilesToR2(
        record,
        dataset,
        recordId,
      ) as JsonRecord,
    })),
  );
};

export const applyBootstrapToBrowser = (
  datasets: Partial<Record<CentralDataset, Array<{ record: JsonRecord }>>>,
): void => {
  for (const dataset of CENTRAL_DATASETS) {
    if (!datasets[dataset]) continue;
    window.localStorage.setItem(
      LOCAL_KEYS[dataset],
      JSON.stringify(unwrapDataset(datasets[dataset]!)),
    );
  }
  window.localStorage.setItem('ldb_base_data_cleared', 'true');
};

export const pullCentralData = async (): Promise<void> => {
  if (!isCentralApiAvailable() || !getApiToken()) return;
  const bootstrap = await apiRequest<{
    datasets: Partial<
      Record<CentralDataset, Array<{ record: JsonRecord }>>
    >;
  }>('/api/bootstrap');
  applyBootstrapToBrowser(bootstrap.datasets);
  try {
    const users = await apiRequest<{ users: CentralUser[] }>('/api/users');
    window.localStorage.setItem('ldb_users', JSON.stringify(users.users));
  } catch {
    // Branch users cannot enumerate accounts; their session data remains sufficient.
  }
};

export const initializeCentralData = async (
  snapshot: DatasetSnapshot,
): Promise<void> => {
  if (!isCentralApiAvailable() || !getApiToken()) return;
  const datasets: Record<string, Array<{ recordId: string; record: JsonRecord }>> = {};
  for (const dataset of CENTRAL_DATASETS) {
    const records = snapshot[dataset];
    if (!records) continue;
    datasets[dataset] = await prepareRecords(dataset, records);
  }
  await apiRequest('/api/migrations/browser-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fingerprint: await fingerprint(snapshot),
      datasets,
    }),
  });
  await pullCentralData();
};

const queues = new Map<CentralDataset, Promise<void>>();
let userQueue: Promise<void> = Promise.resolve();

export const queueCentralSnapshot = (
  dataset: CentralDataset,
  values: JsonRecord[],
): Promise<void> => {
  if (!isCentralApiAvailable() || !getApiToken()) return Promise.resolve();
  const previous = queues.get(dataset) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const prepared = await prepareRecords(dataset, values);
      const current = await apiRequest<{
        records: Array<{ recordId: string }>;
      }>(`/api/datasets/${dataset}`);
      const ids = new Set(prepared.map((item) => item.recordId));
      const deletes = current.records
        .map((item) => item.recordId)
        .filter((recordId) => !ids.has(recordId));
      await apiRequest(`/api/datasets/${dataset}/batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ upserts: prepared, deletes }),
      });
    })
    .catch((error) => {
      console.error(`Central sync failed for ${dataset}`, error);
    });
  queues.set(dataset, next);
  return next;
};

export const queueCentralUsers = (values: CentralUser[]): Promise<void> => {
  if (!isCentralApiAvailable() || !getApiToken()) return Promise.resolve();
  userQueue = userQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await apiRequest<{ users: CentralUser[] }>('/api/users');
      const incoming = new Map(
        values.map((user) => [user.username.toLocaleLowerCase('en-US'), user]),
      );
      for (const user of values) {
        await apiRequest(
          `/api/users/${encodeURIComponent(user.username)}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(user),
          },
        );
      }
      for (const user of current.users) {
        if (!incoming.has(user.username.toLocaleLowerCase('en-US'))) {
          await apiRequest(
            `/api/users/${encodeURIComponent(user.username)}`,
            { method: 'DELETE' },
          );
        }
      }
    })
    .catch((error) => {
      console.error('Central user sync failed', error);
    });
  return userQueue;
};
