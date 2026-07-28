import type {
  ApiErrorEnvelope,
  HealthResponse,
  VersionResponse,
} from './contracts';

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

const fail = (
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response =>
  json(
    {
      error: { code, message },
      requestId,
    } satisfies ApiErrorEnvelope,
    status,
  );

const checkBindings = async (
  env: Env,
): Promise<HealthResponse['services']> => {
  await env.DB.prepare('SELECT 1 AS ok').first();
  await env.FILES.list({ limit: 1 });
  return { d1: 'ok', r2: 'ok' };
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

      if (url.pathname.startsWith('/api/')) {
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
