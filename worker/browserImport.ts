import type { AuthenticatedUser, DatasetName } from './contracts';
import { isDatasetName } from './contracts';
import { importRecords } from './datasets';
import { fail, json, readJsonObject } from './http';

export const handleBrowserImport = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  requestId: string,
): Promise<Response> => {
  const body = await readJsonObject(request);
  const fingerprint =
    typeof body?.fingerprint === 'string' ? body.fingerprint.trim() : '';
  const datasets =
    body?.datasets !== null &&
    typeof body?.datasets === 'object' &&
    !Array.isArray(body.datasets)
      ? (body.datasets as Record<string, unknown>)
      : null;
  if (!fingerprint || !datasets) {
    return fail(400, 'INVALID_IMPORT', 'fingerprint and datasets are required', requestId);
  }
  const existing = await env.DB.prepare(
    'SELECT counts_json FROM browser_imports WHERE source_fingerprint = ?',
  )
    .bind(fingerprint)
    .first<{ counts_json: string }>();
  if (existing) {
    return json({
      alreadyImported: true,
      counts: JSON.parse(existing.counts_json) as Record<string, number>,
      requestId,
    });
  }

  const counts: Partial<Record<DatasetName, number>> = {};
  for (const [dataset, rawItems] of Object.entries(datasets)) {
    if (!isDatasetName(dataset) || !Array.isArray(rawItems)) continue;
    const items = rawItems.flatMap((raw) => {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
      const value = raw as Record<string, unknown>;
      if (
        typeof value.recordId !== 'string' ||
        value.record === null ||
        typeof value.record !== 'object' ||
        Array.isArray(value.record)
      ) {
        return [];
      }
      return [{
        recordId: value.recordId,
        record: value.record as Record<string, unknown>,
      }];
    });
    counts[dataset] = await importRecords(env, user, dataset, items);
  }

  await env.DB.prepare(
    `INSERT INTO browser_imports
      (import_id, username_norm, source_fingerprint, counts_json)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), user.usernameNorm, fingerprint, JSON.stringify(counts))
    .run();
  return json({ alreadyImported: false, counts, requestId });
};
