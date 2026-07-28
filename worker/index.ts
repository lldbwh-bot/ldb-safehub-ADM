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

const derivePasswordHash = async (
  password: string,
  salt: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
    },
    key,
    256,
  );
  return [...new Uint8Array(bits)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
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
        const body = await request.json<{
          username?: unknown;
          password?: unknown;
          branch?: unknown;
        }>();
        const username =
          typeof body.username === 'string' ? body.username.trim() : '';
        const password =
          typeof body.password === 'string' ? body.password : '';
        const branch = typeof body.branch === 'string' ? body.branch.trim() : '';
        if (!username || !password || !branch) {
          return fail(
            400,
            'INVALID_LOGIN_REQUEST',
            'Username, password, and branch are required',
            requestId,
          );
        }

        const account = await env.DB.prepare(
          `SELECT username, password_salt, password_hash, status, branch, image,
                  allowed_tabs_json
             FROM app_users
            WHERE username_norm = ? AND active = 1
            LIMIT 1`,
        )
          .bind(username.normalize('NFKC').toLocaleLowerCase('en-US'))
          .first<{
            username: string;
            password_salt: string;
            password_hash: string;
            status: string;
            branch: string;
            image: string | null;
            allowed_tabs_json: string;
          }>();

        if (!account || account.branch !== branch) {
          return fail(
            401,
            'INVALID_CREDENTIALS',
            'Invalid username, password, or branch',
            requestId,
          );
        }

        const suppliedHash = await derivePasswordHash(
          password,
          account.password_salt,
        );
        if (!timingSafeEqual(suppliedHash, account.password_hash)) {
          return fail(
            401,
            'INVALID_CREDENTIALS',
            'Invalid username, password, or branch',
            requestId,
          );
        }

        let allowedTabs: string[] = [];
        try {
          const parsed = JSON.parse(account.allowed_tabs_json);
          if (Array.isArray(parsed)) {
            allowedTabs = parsed.filter(
              (tab): tab is string => typeof tab === 'string',
            );
          }
        } catch {
          allowedTabs = [];
        }

        return json({
          user: {
            username: account.username,
            password_raw: '',
            status: account.status,
            branch: account.branch,
            image: account.image || undefined,
            allowedTabs,
          },
          requestId,
        });
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
