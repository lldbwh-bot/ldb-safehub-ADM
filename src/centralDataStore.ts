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
type CentralFileUploadResult = {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

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

const CENTRAL_REVISIONS_KEY = 'ldb_central_dataset_revisions_v1';
const CENTRAL_USERS_REFRESH_KEY = 'ldb_central_users_last_refresh_v1';
const USERS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const readStoredRevisions = (): Partial<Record<CentralDataset, number>> => {
  try {
    const raw = window.localStorage.getItem(CENTRAL_REVISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Partial<Record<CentralDataset, number>>;
  } catch {
    return {};
  }
};

const writeStoredRevisions = (
  revisions: Partial<Record<CentralDataset, number>>,
): void => {
  window.localStorage.setItem(CENTRAL_REVISIONS_KEY, JSON.stringify(revisions));
};

const shouldRefreshUsers = (): boolean => {
  const raw = window.localStorage.getItem(CENTRAL_USERS_REFRESH_KEY);
  const last = raw ? Number(raw) : 0;
  return !Number.isFinite(last) || Date.now() - last > USERS_REFRESH_INTERVAL_MS;
};

const markUsersRefreshed = (): void => {
  window.localStorage.setItem(CENTRAL_USERS_REFRESH_KEY, String(Date.now()));
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

export const uploadCentralFile = async (
  file: Blob,
  options: {
    fileName: string;
    entityType: string;
    entityId: string;
  },
): Promise<CentralFileUploadResult> => {
  const query = new URLSearchParams({
    fileName: options.fileName,
    entityType: options.entityType,
    entityId: options.entityId,
  });
  return apiRequest<CentralFileUploadResult>(`/api/files?${query}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
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
    const result = await uploadCentralFile(blob, {
      fileName: `${entityId}-${path.replace(/[^a-z0-9_-]/gi, '-')}`,
      entityType,
      entityId,
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
  const revisionBootstrap = await apiRequest<{
    revisions: Partial<Record<CentralDataset, number>>;
  }>('/api/bootstrap?revisionsOnly=1');
  const remoteRevisions = revisionBootstrap.revisions || {};
  const localRevisions = readStoredRevisions();
  const changedDatasets = CENTRAL_DATASETS.filter((dataset) => {
    const remote = remoteRevisions[dataset] || 0;
    const local = localRevisions[dataset];
    return local === undefined || local !== remote;
  });

  if (changedDatasets.length) {
    const datasets: Partial<
      Record<CentralDataset, Array<{ record: JsonRecord }>>
    > = {};
    for (const dataset of changedDatasets) {
      const response = await apiRequest<{
        records: Array<{ record: JsonRecord }>;
        revision: number;
      }>(`/api/datasets/${dataset}`);
      datasets[dataset] = response.records;
      remoteRevisions[dataset] = response.revision;
    }
    applyBootstrapToBrowser(datasets);
    writeStoredRevisions({ ...localRevisions, ...remoteRevisions });
  }

  if (!shouldRefreshUsers()) return;
  try {
    const users = await apiRequest<{ users: CentralUser[] }>('/api/users');
    window.localStorage.setItem('ldb_users', JSON.stringify(users.users));
    markUsersRefreshed();
  } catch {
    // Branch users cannot enumerate accounts; their session data remains sufficient.
  }
};

export const forcePullCentralData = async (): Promise<void> => {
  if (!isCentralApiAvailable() || !getApiToken()) return;
  const bootstrap = await apiRequest<{
    datasets: Partial<
      Record<CentralDataset, Array<{ record: JsonRecord }>>
    >;
    revisions: Partial<Record<CentralDataset, number>>;
  }>('/api/bootstrap');
  applyBootstrapToBrowser(bootstrap.datasets);
  writeStoredRevisions(bootstrap.revisions || {});
  try {
    const users = await apiRequest<{ users: CentralUser[] }>('/api/users');
    window.localStorage.setItem('ldb_users', JSON.stringify(users.users));
    markUsersRefreshed();
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
  await forcePullCentralData();
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
      const revisions = readStoredRevisions();
      delete revisions[dataset];
      writeStoredRevisions(revisions);
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
        const preparedUser = await moveFilesToR2(
          user,
          'users',
          user.username.normalize('NFKC').toLocaleLowerCase('en-US'),
        ) as CentralUser;
        await apiRequest(
          `/api/users/${encodeURIComponent(user.username)}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(preparedUser),
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
      window.localStorage.removeItem(CENTRAL_USERS_REFRESH_KEY);
    })
    .catch((error) => {
      console.error('Central user sync failed', error);
    });
  return userQueue;
};
