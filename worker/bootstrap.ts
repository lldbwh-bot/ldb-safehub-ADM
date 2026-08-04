import type { AuthenticatedUser } from './contracts';
import { DATASET_NAMES } from './contracts';
import { canUseDataset, listDataset } from './datasets';
import { json } from './http';

const getVisibleRevisions = async (
  env: Env,
  user: AuthenticatedUser,
): Promise<Record<string, number>> => {
  const rows = await env.DB.prepare(
    'SELECT dataset, revision FROM app_dataset_revisions',
  ).all<{ dataset: string; revision: number }>();
  const revisions: Record<string, number> = {};
  for (const dataset of DATASET_NAMES) {
    if (!canUseDataset(user, dataset, false)) continue;
    revisions[dataset] =
      rows.results.find((row) => row.dataset === dataset)?.revision || 0;
  }
  return revisions;
};

export const bootstrap = async (
  env: Env,
  user: AuthenticatedUser,
  requestId: string,
  options: { revisionsOnly?: boolean } = {},
): Promise<Response> => {
  const revisions = await getVisibleRevisions(env, user);
  if (options.revisionsOnly) {
    return json({
      environment: env.APP_ENV,
      version: env.APP_VERSION,
      revisions,
      requestId,
    });
  }

  const datasets: Record<string, unknown[]> = {};
  for (const dataset of DATASET_NAMES) {
    if (!canUseDataset(user, dataset, false)) continue;
    datasets[dataset] = await listDataset(env, user, dataset);
  }
  return json({
    environment: env.APP_ENV,
    version: env.APP_VERSION,
    datasets,
    revisions,
    requestId,
  });
};
