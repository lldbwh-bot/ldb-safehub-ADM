import type { AuthenticatedUser } from './contracts';
import { derivePasswordHash, defaultAllowedTabs } from './auth';
import { fail, json, readJsonObject } from './http';

const adminOnly = (
  user: AuthenticatedUser,
  requestId: string,
): Response | null =>
  user.status === 'Admin'
    ? null
    : fail(403, 'ADMIN_REQUIRED', 'Administrator access is required', requestId);

const normalizeUserImage = (
  image: unknown,
  requestId: string,
): { image: string | null; error: Response | null } => {
  if (typeof image !== 'string') return { image: null, error: null };
  const trimmed = image.trim();
  if (!trimmed) return { image: null, error: null };
  if (trimmed.startsWith('data:')) {
    return {
      image: null,
      error: fail(
        400,
        'USER_IMAGE_MUST_USE_R2',
        'User avatar images must be uploaded to R2 before saving the user record',
        requestId,
      ),
    };
  }
  if (
    trimmed.startsWith('/api/files/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return { image: trimmed, error: null };
  }
  return {
    image: null,
    error: fail(
      400,
      'USER_IMAGE_INVALID',
      'User avatar image must be an R2 file URL or an absolute image URL',
      requestId,
    ),
  };
};

export const handleUsers = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  username: string | undefined,
  requestId: string,
): Promise<Response> => {
  const denied = adminOnly(user, requestId);
  if (denied) return denied;

  if (request.method === 'GET' && !username) {
    const result = await env.DB.prepare(
      `SELECT username, password_raw, status, branch, image, allowed_tabs_json, active,
              created_at, updated_at
         FROM app_users
        WHERE active = 1
        ORDER BY branch, username`,
    ).all<{
      username: string;
      password_raw: string | null;
      status: string;
      branch: string;
      image: string | null;
      allowed_tabs_json: string;
      active: number;
      created_at: string;
      updated_at: string;
    }>();
    return json({
      users: result.results.map((row) => {
        let allowedTabs = defaultAllowedTabs(row.status);
        try {
          const parsed: unknown = JSON.parse(row.allowed_tabs_json);
          if (Array.isArray(parsed)) {
            allowedTabs = parsed.filter(
              (value): value is string => typeof value === 'string',
            );
          }
        } catch {
          // Preserve safe role defaults for malformed legacy data.
        }
        return {
          username: row.username,
          password_raw: row.password_raw || '',
          status: row.status,
          branch: row.branch,
          image: row.image || undefined,
          allowedTabs,
          active: row.active === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
      requestId,
    });
  }

  if ((request.method === 'POST' && !username) || (request.method === 'PUT' && username)) {
    const body = await readJsonObject(request);
    const name = username || (typeof body?.username === 'string' ? body.username.trim() : '');
    const status = body?.status === 'Admin' ? 'Admin' : 'User';
    const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';
    const password = typeof body?.password === 'string'
      ? body.password
      : typeof body?.password_raw === 'string'
        ? body.password_raw
        : '';
    const allowedTabs = Array.isArray(body?.allowedTabs)
      ? body.allowedTabs.filter((value): value is string => typeof value === 'string')
      : defaultAllowedTabs(status);
    if (!name || !branch) {
      return fail(400, 'INVALID_USER', 'username and branch are required', requestId);
    }
    const normalizedImage = normalizeUserImage(body?.image, requestId);
    if (normalizedImage.error) return normalizedImage.error;
    const norm = name.normalize('NFKC').toLocaleLowerCase('en-US');
    const existing = await env.DB.prepare(
      'SELECT password_salt, password_hash, password_raw FROM app_users WHERE username_norm = ?',
    )
      .bind(norm)
      .first<{ password_salt: string; password_hash: string; password_raw: string | null }>();
    if (!existing && !password) {
      return fail(400, 'PASSWORD_REQUIRED', 'password is required for a new user', requestId);
    }
    const salt = password ? crypto.randomUUID() : existing?.password_salt || '';
    const hash = password
      ? await derivePasswordHash(password, salt)
      : existing?.password_hash || '';
    const rawPassword = password || existing?.password_raw || '';
    await env.DB.prepare(
      `INSERT INTO app_users
        (username_norm, username, password_salt, password_hash, password_raw, status, branch,
         image, allowed_tabs_json, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(username_norm) DO UPDATE SET
         username = excluded.username,
         password_salt = excluded.password_salt,
         password_hash = excluded.password_hash,
         password_raw = excluded.password_raw,
         status = excluded.status,
         branch = excluded.branch,
         image = excluded.image,
         allowed_tabs_json = excluded.allowed_tabs_json,
         active = 1,
         updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        norm,
        name,
        salt,
        hash,
        rawPassword,
        status,
        branch,
        normalizedImage.image,
        JSON.stringify(allowedTabs),
      )
      .run();
    return json({ username: name, status, branch, allowedTabs, requestId }, existing ? 200 : 201);
  }

  if (request.method === 'DELETE' && username) {
    await env.DB.prepare(
      `UPDATE app_users SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE username_norm = ?`,
    )
      .bind(username.normalize('NFKC').toLocaleLowerCase('en-US'))
      .run();
    return new Response(null, { status: 204 });
  }

  return fail(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', requestId);
};
