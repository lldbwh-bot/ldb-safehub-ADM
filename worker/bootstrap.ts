import type { AuthenticatedUser } from './contracts';
import { DATASET_NAMES } from './contracts';
import { canUseDataset, listDataset } from './datasets';
import { json } from './http';

export const bootstrap = async (
  env: Env,
  user: AuthenticatedUser,
  requestId: string,
): Promise<Response> => {
  const datasets: Record<string, unknown[]> = {};
  const revisions: Record<string, number> = {};
  for (const dataset of DATASET_NAMES) {
    if (!canUseDataset(user, dataset, false)) continue;
    datasets[dataset] = await listDataset(env, user, dataset);
    revisions[dataset] =
      (await env.DB.prepare(
        'SELECT revision FROM app_dataset_revisions WHERE dataset = ?',
      )
        .bind(dataset)
        .first<{ revision: number }>())?.revision || 0;
  }
  return json({
    environment: env.APP_ENV,
    version: env.APP_VERSION,
    datasets,
    revisions,
    requestId,
  });
};
