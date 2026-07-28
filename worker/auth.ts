import type { AuthenticatedUser } from './contracts';
import { fail, json, readJsonObject } from './http';

const SESSION_TTL_SECONDS = 60 * 60 * 12;

export const derivePasswordHash = async (
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

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const secureEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const createToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

export const defaultAllowedTabs = (status: string): string[] => {
  const tabs = [
    'dashboard',
    'pm',
    'inspections',
    'incidents',
    'assessment',
    'approvals',
    'tracking',
    'repairs',
  ];
  return status === 'Admin' ? [...tabs, 'accounts'] : tabs;
};

const parseAllowedTabs = (raw: string, status: string): string[] => {
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) {
      const tabs = value.filter(
        (item): item is string => typeof item === 'string',
      );
      if (tabs.length > 0) return tabs;
    }
  } catch {
    // Legacy invalid JSON falls back to role defaults.
  }
  return defaultAllowedTabs(status);
};

type AccountRow = {
  username_norm: string;
  username: string;
  password_salt: string;
  password_hash: string;
  status: string;
  branch: string;
  image: string | null;
  allowed_tabs_json: string;
};

const toUser = (row: AccountRow): AuthenticatedUser => ({
  usernameNorm: row.username_norm,
  username: row.username,
  status: row.status,
  branch: row.branch,
  image: row.image || undefined,
  allowedTabs: parseAllowedTabs(row.allowed_tabs_json, row.status),
});

const publicUser = (user: AuthenticatedUser) => ({
  username: user.username,
  password_raw: '',
  status: user.status,
  branch: user.branch,
  image: user.image,
  allowedTabs: user.allowedTabs,
});

export const login = async (
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> => {
  const body = await readJsonObject(request);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const branch = typeof body?.branch === 'string' ? body.branch.trim() : '';
  if (!username || !password || !branch) {
    return fail(
      400,
      'INVALID_LOGIN_REQUEST',
      'Username, password, and branch are required',
      requestId,
    );
  }

  const account = await env.DB.prepare(
    `SELECT username_norm, username, password_salt, password_hash, status,
            branch, image, allowed_tabs_json
       FROM app_users
      WHERE username_norm = ? AND active = 1
      LIMIT 1`,
  )
    .bind(username.normalize('NFKC').toLocaleLowerCase('en-US'))
    .first<AccountRow>();
  if (!account || account.branch !== branch) {
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid username, password, or branch', requestId);
  }
  const suppliedHash = await derivePasswordHash(password, account.password_salt);
  if (!secureEqual(suppliedHash, account.password_hash)) {
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid username, password, or branch', requestId);
  }

  const token = createToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO app_sessions (token_hash, username_norm, expires_at)
     VALUES (?, ?, ?)`,
  )
    .bind(tokenHash, account.username_norm, expiresAt)
    .run();

  return json({
    token,
    expiresAt,
    user: publicUser(toUser(account)),
    requestId,
  });
};

export const authenticate = async (
  request: Request,
  env: Env,
): Promise<AuthenticatedUser | null> => {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) return null;
  const tokenHash = await sha256(match[1]);
  const row = await env.DB.prepare(
    `SELECT u.username_norm, u.username, u.password_salt, u.password_hash,
            u.status, u.branch, u.image, u.allowed_tabs_json
       FROM app_sessions s
       JOIN app_users u ON u.username_norm = s.username_norm
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > CURRENT_TIMESTAMP
        AND u.active = 1
      LIMIT 1`,
  )
    .bind(tokenHash)
    .first<AccountRow>();
  if (!row) return null;
  await env.DB.prepare(
    'UPDATE app_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .run();
  return toUser(row);
};

export const authMe = (
  user: AuthenticatedUser,
  requestId: string,
): Response => json({ user: publicUser(user), requestId });

export const logout = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (match) {
    await env.DB.prepare(
      'UPDATE app_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?',
    )
      .bind(await sha256(match[1]))
      .run();
  }
  return new Response(null, { status: 204 });
};
