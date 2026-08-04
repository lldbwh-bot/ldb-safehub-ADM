import { authenticate, authMe, login, logout } from './auth';
import { bootstrap } from './bootstrap';
import { handleBrowserImport } from './browserImport';
import { isDatasetName } from './contracts';
import type { HealthResponse, VersionResponse } from './contracts';
import { handleDatasetBatch, handleDatasetRequest } from './datasets';
import { deleteFile, downloadFile, uploadFile } from './files';
import { fail, json } from './http';
import { handleUsers } from './users';

const checkBindings = async (
  env: Env,
): Promise<HealthResponse['services']> => {
  await env.DB.prepare('SELECT 1 AS ok').first();
  await env.FILES.list({ limit: 1 });
  return { d1: 'ok', r2: 'ok' };
};

const authenticated = async (
  request: Request,
  env: Env,
  requestId: string,
) => {
  const user = await authenticate(request, env);
  return user || fail(401, 'AUTH_REQUIRED', 'Authentication is required', requestId);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        const services = await checkBindings(env);
        return json({
          status: 'ok',
          environment: env.APP_ENV,
          version: env.APP_VERSION,
          timestamp: new Date().toISOString(),
          services,
          requestId,
        } satisfies HealthResponse);
      }

      if (request.method === 'GET' && url.pathname === '/api/version') {
        return json({
          environment: env.APP_ENV,
          version: env.APP_VERSION,
          requestId,
        } satisfies VersionResponse);
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        return login(request, env, requestId);
      }

      if (url.pathname.startsWith('/api/')) {
        const isProtectedRoute =
          url.pathname === '/api/auth/me' ||
          url.pathname === '/api/auth/logout' ||
          url.pathname === '/api/migrations/browser-import' ||
          url.pathname === '/api/bootstrap' ||
          url.pathname === '/api/users' ||
          url.pathname.startsWith('/api/users/') ||
          url.pathname === '/api/files' ||
          url.pathname.startsWith('/api/files/') ||
          url.pathname.startsWith('/api/datasets/');
        if (!isProtectedRoute) {
          return fail(404, 'API_NOT_FOUND', 'API route not found', requestId);
        }
        const auth = await authenticated(request, env, requestId);
        if (auth instanceof Response) return auth;

        if (request.method === 'GET' && url.pathname === '/api/auth/me') {
          return authMe(auth, requestId);
        }
        if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
          return logout(request, env);
        }
        if (
          request.method === 'POST' &&
          url.pathname === '/api/migrations/browser-import'
        ) {
          return handleBrowserImport(request, env, auth, requestId);
        }
        if (request.method === 'GET' && url.pathname === '/api/bootstrap') {
          return bootstrap(env, auth, requestId, {
            revisionsOnly: url.searchParams.get('revisionsOnly') === '1',
          });
        }
        const userMatch = /^\/api\/users(?:\/([^/]+))?$/.exec(url.pathname);
        if (userMatch) {
          return handleUsers(
            request,
            env,
            auth,
            userMatch[1] ? decodeURIComponent(userMatch[1]) : undefined,
            requestId,
          );
        }
        if (url.pathname === '/api/files' && request.method === 'POST') {
          return uploadFile(request, env, auth, url, requestId);
        }
        const fileMatch = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
        if (fileMatch && request.method === 'GET') {
          return downloadFile(env, decodeURIComponent(fileMatch[1]), requestId);
        }
        if (fileMatch && request.method === 'DELETE') {
          return deleteFile(
            env,
            auth,
            decodeURIComponent(fileMatch[1]),
            requestId,
          );
        }

        const datasetMatch =
          /^\/api\/datasets\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
        if (datasetMatch) {
          const dataset = decodeURIComponent(datasetMatch[1]);
          if (!isDatasetName(dataset)) {
            return fail(
              404,
              'DATASET_NOT_FOUND',
              'Dataset is not supported',
              requestId,
            );
          }
          if (datasetMatch[2] === 'batch' && request.method === 'POST') {
            return handleDatasetBatch(request, env, auth, dataset, requestId);
          }
          return handleDatasetRequest(
            request,
            env,
            auth,
            dataset,
            datasetMatch[2]
              ? decodeURIComponent(datasetMatch[2])
              : undefined,
            requestId,
          );
        }

        return fail(404, 'API_NOT_FOUND', 'API route not found', requestId);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'request failed',
          requestId,
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return fail(
        503,
        'SERVICE_UNAVAILABLE',
        'A required service is unavailable',
        requestId,
      );
    }
  },
} satisfies ExportedHandler<Env>;
