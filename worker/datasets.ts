import type {
  AuthenticatedUser,
  CentralRecordEnvelope,
  DatasetName,
} from './contracts';
import { fail, json, readJsonObject } from './http';

const DATASET_TAB: Record<DatasetName, string> = {
  inspections: 'inspections',
  incidents: 'incidents',
  assessments: 'assessment',
  approvals: 'approvals',
  'repair-tracking': 'tracking',
  repairs: 'repairs',
  'pm-assets': 'pm',
  'pm-history': 'pm',
  branches: 'accounts',
  'checklist-items': 'accounts',
  sectors: 'accounts',
  'repair-presets': 'accounts',
};

const MASTER_DATASETS = new Set<DatasetName>([
  'branches',
  'checklist-items',
  'sectors',
  'repair-presets',
]);

export const isAdmin = (user: AuthenticatedUser): boolean =>
  user.status === 'Admin';

export const canUseDataset = (
  user: AuthenticatedUser,
  dataset: DatasetName,
  write: boolean,
): boolean => {
  if (isAdmin(user)) return true;
  if (write && MASTER_DATASETS.has(dataset)) return false;
  return user.allowedTabs.includes(DATASET_TAB[dataset]);
};

const normalizedRecord = (
  value: unknown,
): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringField = (record: Record<string, unknown>, names: string[]): string => {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const extractBranch = (record: Record<string, unknown>): string =>
  stringField(record, [
    'branch',
    'Branch',
    'branchName',
    'assetBranch',
    'ສາຂາ',
    'ສາຂາ ',
  ]);

const visibleBranch = (user: AuthenticatedUser, branch: string): boolean =>
  isAdmin(user) || branch === user.branch || branch === '';

const rowEnvelope = (row: {
  record_id: string;
  branch: string;
  payload_json: string;
  version: number;
  created_at: string;
  updated_at: string;
}): CentralRecordEnvelope => ({
  recordId: row.record_id,
  branch: row.branch,
  record: JSON.parse(row.payload_json) as Record<string, unknown>,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const bumpRevision = (env: Env, dataset: DatasetName): D1PreparedStatement =>
  env.DB.prepare(
    `INSERT INTO app_dataset_revisions (dataset, revision, updated_at)
     VALUES (?, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(dataset) DO UPDATE SET
       revision = revision + 1,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(dataset);

export const listDataset = async (
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
): Promise<CentralRecordEnvelope[]> => {
  const query = isAdmin(user)
    ? env.DB.prepare(
        `SELECT record_id, branch, payload_json, version, created_at, updated_at
           FROM app_records
          WHERE dataset = ? AND deleted_at IS NULL
          ORDER BY updated_at, record_id`,
      ).bind(dataset)
    : env.DB.prepare(
        `SELECT record_id, branch, payload_json, version, created_at, updated_at
           FROM app_records
          WHERE dataset = ? AND deleted_at IS NULL AND (branch = ? OR branch = '')
          ORDER BY updated_at, record_id`,
      ).bind(dataset, user.branch);
  const result = await query.all<{
    record_id: string;
    branch: string;
    payload_json: string;
    version: number;
    created_at: string;
    updated_at: string;
  }>();
  return result.results.map(rowEnvelope);
};

const getDatasetRecord = async (
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
  recordId: string,
): Promise<CentralRecordEnvelope | null | 'forbidden'> => {
  const row = await env.DB.prepare(
    `SELECT record_id, branch, payload_json, version, created_at, updated_at
       FROM app_records
      WHERE dataset = ? AND record_id = ? AND deleted_at IS NULL`,
  )
    .bind(dataset, recordId)
    .first<{
      record_id: string;
      branch: string;
      payload_json: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>();
  if (!row) return null;
  if (!visibleBranch(user, row.branch)) return 'forbidden';
  return rowEnvelope(row);
};

const upsertRecord = async (
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
  recordId: string,
  record: Record<string, unknown>,
  expectedVersion?: number,
): Promise<{ envelope: CentralRecordEnvelope; created: boolean } | 'conflict' | 'forbidden'> => {
  const branch = extractBranch(record);
  if (!visibleBranch(user, branch)) return 'forbidden';
  const existing = await env.DB.prepare(
    `SELECT version, created_at FROM app_records
      WHERE dataset = ? AND record_id = ? AND deleted_at IS NULL`,
  )
    .bind(dataset, recordId)
    .first<{ version: number; created_at: string }>();
  if (expectedVersion !== undefined && existing?.version !== expectedVersion) {
    return 'conflict';
  }
  const nextVersion = existing ? existing.version + 1 : 1;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO app_records
        (dataset, record_id, branch, payload_json, version, updated_by, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(dataset, record_id) DO UPDATE SET
         branch = excluded.branch,
         payload_json = excluded.payload_json,
         version = excluded.version,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = excluded.updated_by,
         deleted_at = NULL`,
    ).bind(
      dataset,
      recordId,
      branch,
      JSON.stringify(record),
      nextVersion,
      user.usernameNorm,
    ),
    bumpRevision(env, dataset),
  ]);
  const saved = await env.DB.prepare(
    `SELECT record_id, branch, payload_json, version, created_at, updated_at
       FROM app_records WHERE dataset = ? AND record_id = ?`,
  )
    .bind(dataset, recordId)
    .first<{
      record_id: string;
      branch: string;
      payload_json: string;
      version: number;
      created_at: string;
      updated_at: string;
    }>();
  if (!saved) throw new Error('Record write did not persist');
  return { envelope: rowEnvelope(saved), created: !existing };
};

export const handleDatasetRequest = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
  recordId: string | undefined,
  requestId: string,
): Promise<Response> => {
  const write = request.method !== 'GET';
  if (!canUseDataset(user, dataset, write)) {
    return fail(403, 'DATASET_FORBIDDEN', 'Dataset access is not allowed', requestId);
  }

  if (request.method === 'GET' && !recordId) {
    const records = await listDataset(env, user, dataset);
    const revision =
      (await env.DB.prepare(
        'SELECT revision FROM app_dataset_revisions WHERE dataset = ?',
      )
        .bind(dataset)
        .first<{ revision: number }>())?.revision || 0;
    return json({ dataset, revision, records, requestId });
  }

  if (request.method === 'GET' && recordId) {
    const record = await getDatasetRecord(env, user, dataset, recordId);
    if (record === 'forbidden') {
      return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    }
    if (!record) {
      return fail(404, 'RECORD_NOT_FOUND', 'Record not found', requestId);
    }
    return json({ ...record, requestId });
  }

  if (request.method === 'POST' && !recordId) {
    const body = await readJsonObject(request);
    const id = typeof body?.recordId === 'string' ? body.recordId.trim() : '';
    const record = normalizedRecord(body?.record);
    if (!id || !record) {
      return fail(400, 'INVALID_RECORD', 'recordId and record are required', requestId);
    }
    const result = await upsertRecord(env, user, dataset, id, record);
    if (result === 'forbidden') return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    if (result === 'conflict') return fail(409, 'VERSION_CONFLICT', 'Record version changed', requestId);
    return json({ ...result.envelope, requestId }, result.created ? 201 : 200);
  }

  if (request.method === 'PUT' && recordId) {
    const body = await readJsonObject(request);
    const record = normalizedRecord(body?.record);
    const version = typeof body?.version === 'number' ? body.version : undefined;
    if (!record) return fail(400, 'INVALID_RECORD', 'record is required', requestId);
    const result = await upsertRecord(env, user, dataset, recordId, record, version);
    if (result === 'forbidden') return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    if (result === 'conflict') return fail(409, 'VERSION_CONFLICT', 'Record version changed', requestId);
    return json({ ...result.envelope, requestId }, result.created ? 201 : 200);
  }

  if (request.method === 'DELETE' && recordId) {
    const row = await env.DB.prepare(
      `SELECT branch FROM app_records
        WHERE dataset = ? AND record_id = ? AND deleted_at IS NULL`,
    )
      .bind(dataset, recordId)
      .first<{ branch: string }>();
    if (!row) return fail(404, 'RECORD_NOT_FOUND', 'Record not found', requestId);
    if (!visibleBranch(user, row.branch)) return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE app_records
            SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                updated_by = ?, version = version + 1
          WHERE dataset = ? AND record_id = ?`,
      ).bind(user.usernameNorm, dataset, recordId),
      bumpRevision(env, dataset),
    ]);
    return new Response(null, { status: 204 });
  }

  return fail(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', requestId);
};

export const importRecords = async (
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
  records: Array<{ recordId: string; record: Record<string, unknown> }>,
): Promise<number> => {
  let count = 0;
  for (const item of records) {
    const existing = await env.DB.prepare(
      `SELECT 1 AS found FROM app_records
        WHERE dataset = ? AND record_id = ? AND deleted_at IS NULL`,
    )
      .bind(dataset, item.recordId)
      .first<{ found: number }>();
    if (existing) continue;
    const result = await upsertRecord(env, user, dataset, item.recordId, item.record);
    if (result !== 'forbidden' && result !== 'conflict') count += 1;
  }
  return count;
};

export const handleDatasetBatch = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  dataset: DatasetName,
  requestId: string,
): Promise<Response> => {
  if (!canUseDataset(user, dataset, true)) {
    return fail(403, 'DATASET_FORBIDDEN', 'Dataset access is not allowed', requestId);
  }
  const body = await readJsonObject(request);
  const rawUpserts = Array.isArray(body?.upserts) ? body.upserts : [];
  const rawDeletes = Array.isArray(body?.deletes) ? body.deletes : [];
  let upserted = 0;
  let deleted = 0;
  for (const raw of rawUpserts) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.recordId === 'string' ? item.recordId.trim() : '';
    const record = normalizedRecord(item.record);
    const version = typeof item.version === 'number' ? item.version : undefined;
    if (!id || !record) continue;
    const result = await upsertRecord(env, user, dataset, id, record, version);
    if (result === 'forbidden') {
      return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    }
    if (result === 'conflict') {
      return fail(409, 'VERSION_CONFLICT', `Record ${id} changed`, requestId);
    }
    upserted += 1;
  }
  for (const rawId of rawDeletes) {
    if (typeof rawId !== 'string' || !rawId.trim()) continue;
    const row = await env.DB.prepare(
      `SELECT branch FROM app_records
        WHERE dataset = ? AND record_id = ? AND deleted_at IS NULL`,
    )
      .bind(dataset, rawId)
      .first<{ branch: string }>();
    if (!row) continue;
    if (!visibleBranch(user, row.branch)) {
      return fail(403, 'BRANCH_FORBIDDEN', 'Record belongs to another branch', requestId);
    }
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE app_records
            SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
                updated_by = ?, version = version + 1
          WHERE dataset = ? AND record_id = ?`,
      ).bind(user.usernameNorm, dataset, rawId),
      bumpRevision(env, dataset),
    ]);
    deleted += 1;
  }
  return json({ dataset, upserted, deleted, requestId });
};
