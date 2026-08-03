/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env, SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import worker from './index';

const hashPassword = async (password: string, salt: string): Promise<string> => {
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

const installSchema = async (): Promise<void> => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS app_users (
      username_norm TEXT PRIMARY KEY, username TEXT NOT NULL,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      password_raw TEXT,
      status TEXT NOT NULL, branch TEXT NOT NULL, image TEXT,
      allowed_tabs_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS app_sessions (
      token_hash TEXT PRIMARY KEY, username_norm TEXT NOT NULL,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS app_records (
      dataset TEXT NOT NULL, record_id TEXT NOT NULL, branch TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT, updated_by TEXT NOT NULL,
      PRIMARY KEY (dataset, record_id)
    )`,
    `CREATE TABLE IF NOT EXISTS app_dataset_revisions (
      dataset TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS browser_imports (
      import_id TEXT PRIMARY KEY, username_norm TEXT NOT NULL,
      source_fingerprint TEXT NOT NULL UNIQUE, counts_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS file_objects (
      id TEXT PRIMARY KEY, bucket_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL,
      content_type TEXT, size_bytes INTEGER NOT NULL DEFAULT 0,
      entity_type TEXT, entity_id TEXT, uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT
    )`,
  ];
  for (const statement of statements) await env.DB.prepare(statement).run();
};

const seedUser = async (
  username: string,
  password: string,
  status: 'Admin' | 'User',
  branch: string,
  allowedTabs: string[],
): Promise<void> => {
  const normalized = username.normalize('NFKC').toLocaleLowerCase('en-US');
  const salt = `salt-${normalized}`;
  const hash = await hashPassword(password, salt);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO app_users
      (username_norm, username, password_salt, password_hash, password_raw, status, branch, allowed_tabs_json, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(normalized, username, salt, hash, password, status, branch, JSON.stringify(allowedTabs))
    .run();
};

const login = async (
  username = 'Admin',
  password = 'admin-password',
  branch = '00.HQ',
): Promise<string> => {
  const response = await SELF.fetch('https://example.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, branch }),
  });
  const body = await response.json<{ token: string }>();
  expect(response.status).toBe(200);
  expect(body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  return body.token;
};

describe('LDB SafeHub Worker API', () => {
  beforeAll(async () => {
    await installSchema();
  });

  beforeEach(async () => {
    await seedUser(
      'Admin',
      'admin-password',
      'Admin',
      '00.HQ',
      ['dashboard', 'pm', 'inspections', 'incidents', 'assessment', 'approvals', 'tracking', 'repairs', 'accounts'],
    );
  });

  it('authenticates an active D1 user without returning the password hash', async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS app_users (
        username_norm TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_raw TEXT,
        status TEXT NOT NULL,
        branch TEXT NOT NULL,
        image TEXT,
        allowed_tabs_json TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1
      )
    `).run();
    await env.DB.prepare('DELETE FROM app_users').run();

    const salt = 'test-salt';
    const password = 'correct-password';
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
    const hash = [...new Uint8Array(bits)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    await env.DB.prepare(
      `INSERT INTO app_users
        (username_norm, username, password_salt, password_hash, status, branch, allowed_tabs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        'branch.user',
        'Branch.User',
        salt,
        hash,
        'User',
        '01.ສາຂາ ນະຄອນຫຼວງ',
        '["dashboard","inspections"]',
      )
      .run();

    const response = await SELF.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'BRANCH.USER',
        password,
        branch: '01.ສາຂາ ນະຄອນຫຼວງ',
      }),
    });
    const body = await response.json<Record<string, unknown>>();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user: {
        username: 'Branch.User',
        status: 'User',
        branch: '01.ສາຂາ ນະຄອນຫຼວງ',
        allowedTabs: ['dashboard', 'inspections'],
      },
    });
    expect(JSON.stringify(body)).not.toContain(hash);
    expect(JSON.stringify(body)).not.toContain(salt);
    expect(body).toHaveProperty('token');
  });

  it('restores role defaults when legacy allowed-tabs data is malformed', async () => {
    await env.DB.prepare('DELETE FROM app_users').run();

    const salt = 'legacy-tabs-salt';
    const password = 'correct-password';
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
    const hash = [...new Uint8Array(bits)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    await env.DB.prepare(
      `INSERT INTO app_users
        (username_norm, username, password_salt, password_hash, status, branch, allowed_tabs_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        'admin',
        'Admin',
        salt,
        hash,
        'Admin',
        '00.HQ',
        '[dashboard,pm,inspections]',
      )
      .run();

    const response = await SELF.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Admin',
        password,
        branch: '00.HQ',
      }),
    });
    const body = await response.json<{
      user: { allowedTabs: string[] };
    }>();

    expect(response.status).toBe(200);
    expect(body.user.allowedTabs).toEqual([
      'dashboard',
      'pm',
      'inspections',
      'incidents',
      'assessment',
      'approvals',
      'tracking',
      'repairs',
      'accounts',
    ]);
  });

  it('reports healthy D1 and R2 bindings', async () => {
    const response = await SELF.fetch('https://example.com/api/health');
    const body = await response.json<{
      status: string;
      environment: string;
      services: { d1: string; r2: string };
      requestId: string;
    }>();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.environment).toBe('test');
    expect(body.services).toEqual({ d1: 'ok', r2: 'ok' });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns the environment version', async () => {
    const response = await SELF.fetch('https://example.com/api/version');
    const body = await response.json<{
      environment: string;
      version: string;
      requestId: string;
    }>();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      environment: 'test',
      version: 'test-version',
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await SELF.fetch('https://example.com/api/missing');
    const body = await response.json<{ error: { code: string } }>();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body.error.code).toBe('API_NOT_FOUND');
  });

  it('requires a bearer session and returns the signed-in user', async () => {
    const missing = await SELF.fetch('https://example.com/api/auth/me');
    expect(missing.status).toBe(401);

    const token = await login();
    const response = await SELF.fetch('https://example.com/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json<{ user: { username: string } }>();
    expect(response.status).toBe(200);
    expect(body.user.username).toBe('Admin');
  });

  it('creates, updates, lists, and deletes central dataset records', async () => {
    const token = await login();
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const created = await SELF.fetch('https://example.com/api/datasets/incidents', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        recordId: 'INC-100',
        record: { PID: 'INC-100', branch: '00.HQ', issueDetails: 'Power fault' },
      }),
    });
    expect(created.status).toBe(201);

    const listed = await SELF.fetch('https://example.com/api/datasets/incidents', {
      headers: { authorization: auth.authorization },
    });
    const listBody = await listed.json<{ records: Array<{ recordId: string; record: { issueDetails: string } }> }>();
    expect(listBody.records).toEqual([
      expect.objectContaining({ recordId: 'INC-100', record: expect.objectContaining({ issueDetails: 'Power fault' }) }),
    ]);

    const updated = await SELF.fetch('https://example.com/api/datasets/incidents/INC-100', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({
        version: 1,
        record: { PID: 'INC-100', branch: '00.HQ', issueDetails: 'Power restored' },
      }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ version: 2 });

    const fetched = await SELF.fetch('https://example.com/api/datasets/incidents/INC-100', {
      headers: { authorization: auth.authorization },
    });
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toMatchObject({
      recordId: 'INC-100',
      version: 2,
      record: { issueDetails: 'Power restored' },
    });

    const deleted = await SELF.fetch('https://example.com/api/datasets/incidents/INC-100', {
      method: 'DELETE',
      headers: { authorization: auth.authorization },
    });
    expect(deleted.status).toBe(204);

    const empty = await SELF.fetch('https://example.com/api/datasets/incidents', {
      headers: { authorization: auth.authorization },
    });
    expect(await empty.json()).toMatchObject({ records: [] });
  });

  it('keeps branch users from reading or writing another branch', async () => {
    await seedUser('Branch.User', 'branch-password', 'User', '01.Branch', ['incidents']);
    const adminToken = await login();
    await SELF.fetch('https://example.com/api/datasets/incidents', {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recordId: 'INC-HQ', record: { PID: 'INC-HQ', branch: '00.HQ' } }),
    });
    const branchToken = await login('Branch.User', 'branch-password', '01.Branch');
    const list = await SELF.fetch('https://example.com/api/datasets/incidents', {
      headers: { authorization: `Bearer ${branchToken}` },
    });
    const body = await list.json<{ records: unknown[] }>();
    expect(body.records).toEqual([]);

    const denied = await SELF.fetch('https://example.com/api/datasets/incidents', {
      method: 'POST',
      headers: { authorization: `Bearer ${branchToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recordId: 'INC-BAD', record: { PID: 'INC-BAD', branch: '00.HQ' } }),
    });
    expect(denied.status).toBe(403);
  });

  it('imports a browser snapshot once without duplicating records', async () => {
    const token = await login();
    const request = {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        fingerprint: 'browser-snapshot-1',
        datasets: {
          inspections: [
            { recordId: 'INS-1', record: { PID: 'INS-1', branch: '00.HQ', result: 'ok' } },
          ],
        },
      }),
    };
    const first = await SELF.fetch('https://example.com/api/migrations/browser-import', request);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ alreadyImported: false, counts: { inspections: 1 } });
    const second = await SELF.fetch('https://example.com/api/migrations/browser-import', request);
    expect(await second.json()).toMatchObject({ alreadyImported: true });
  });

  it('does not overwrite newer central records during browser import', async () => {
    const token = await login();
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    await SELF.fetch('https://example.com/api/datasets/incidents', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recordId: 'INC-CENTRAL',
        record: { PID: 'INC-CENTRAL', branch: '00.HQ', issueDetails: 'central value' },
      }),
    });
    const imported = await SELF.fetch(
      'https://example.com/api/migrations/browser-import',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fingerprint: 'browser-snapshot-existing',
          datasets: {
            incidents: [
              {
                recordId: 'INC-CENTRAL',
                record: {
                  PID: 'INC-CENTRAL',
                  branch: '00.HQ',
                  issueDetails: 'stale browser value',
                },
              },
            ],
          },
        }),
      },
    );
    expect(imported.status).toBe(200);
    expect(await imported.json()).toMatchObject({
      counts: { incidents: 0 },
    });

    const fetched = await SELF.fetch(
      'https://example.com/api/datasets/incidents/INC-CENTRAL',
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(await fetched.json()).toMatchObject({
      record: { issueDetails: 'central value' },
      version: 1,
    });
  });

  it('stores and streams authenticated file objects through R2', async () => {
    const token = await login();
    const uploaded = await SELF.fetch('https://example.com/api/files?fileName=evidence.txt&entityType=incidents&entityId=INC-1', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'text/plain',
      },
      body: 'evidence bytes',
    });
    const uploadBody = await uploaded.json<{ fileId: string; url: string }>();
    expect(uploaded.status).toBe(201);
    expect(uploadBody.url).toBe(`/api/files/${uploadBody.fileId}`);

    const downloaded = await SELF.fetch(`https://example.com${uploadBody.url}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toContain('text/plain');
    expect(await downloaded.text()).toBe('evidence bytes');
  });

  it('applies a dataset batch and returns it through bootstrap', async () => {
    const token = await login();
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const response = await SELF.fetch(
      'https://example.com/api/datasets/pm-assets/batch',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          upserts: [
            {
              recordId: 'PM-1',
              record: { assetCode: 'PM-1', branch: '00.HQ', assetName: 'UPS' },
            },
          ],
          deletes: [],
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ upserted: 1, deleted: 0 });

    const bootstrap = await SELF.fetch('https://example.com/api/bootstrap', {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await bootstrap.json<{
      datasets: { 'pm-assets': Array<{ recordId: string }> };
      environment: string;
    }>();
    expect(bootstrap.status).toBe(200);
    expect(body.environment).toBe('test');
    expect(body.datasets['pm-assets']).toEqual([
      expect.objectContaining({ recordId: 'PM-1' }),
    ]);
  });

  it('lets only admins list users with revealable raw passwords but never hash material', async () => {
    const adminToken = await login();
    const response = await SELF.fetch('https://example.com/api/users', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"username":"Admin"');
    expect(text).toContain('"password_raw":"admin-password"');
    expect(text).not.toContain('password_hash');
    expect(text).not.toContain('password_salt');

    await seedUser('Branch.User', 'branch-password', 'User', '01.Branch', ['incidents']);
    const branchToken = await login('Branch.User', 'branch-password', '01.Branch');
    const denied = await SELF.fetch('https://example.com/api/users', {
      headers: { authorization: `Bearer ${branchToken}` },
    });
    expect(denied.status).toBe(403);
  });

  it('persists user create, password update, avatar update, and soft delete in D1', async () => {
    const adminToken = await login();
    const inlineAvatar = await SELF.fetch('https://example.com/api/users/Inline.Avatar', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Inline.Avatar',
        password_raw: 'new-secret',
        status: 'User',
        branch: '02.Branch',
        image: 'data:image/png;base64,QUJD',
        allowedTabs: ['dashboard', 'pm'],
      }),
    });
    expect(inlineAvatar.status).toBe(400);
    await expect(inlineAvatar.json()).resolves.toMatchObject({
      error: { code: 'USER_IMAGE_MUST_USE_R2' },
    });

    const create = await SELF.fetch('https://example.com/api/users/Test.User', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Test.User',
        password_raw: 'new-secret',
        status: 'User',
        branch: '02.Branch',
        image: '/api/files/avatar-create',
        allowedTabs: ['dashboard', 'pm'],
      }),
    });
    expect(create.status).toBe(201);

    const created = await env.DB.prepare(
      `SELECT password_raw, image, active FROM app_users WHERE username_norm = ?`,
    )
      .bind('test.user')
      .first<{ password_raw: string; image: string; active: number }>();
    expect(created).toMatchObject({
      password_raw: 'new-secret',
      image: '/api/files/avatar-create',
      active: 1,
    });

    const update = await SELF.fetch('https://example.com/api/users/Test.User', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'Test.User',
        password_raw: 'changed-secret',
        status: 'Admin',
        branch: '00.HQ',
        image: '/api/files/avatar-update',
        allowedTabs: ['dashboard', 'accounts'],
      }),
    });
    expect(update.status).toBe(200);

    const updated = await env.DB.prepare(
      `SELECT password_raw, status, branch, image, active FROM app_users WHERE username_norm = ?`,
    )
      .bind('test.user')
      .first<{ password_raw: string; status: string; branch: string; image: string; active: number }>();
    expect(updated).toMatchObject({
      password_raw: 'changed-secret',
      status: 'Admin',
      branch: '00.HQ',
      image: '/api/files/avatar-update',
      active: 1,
    });

    const remove = await SELF.fetch('https://example.com/api/users/Test.User', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(remove.status).toBe(204);
    const deleted = await env.DB.prepare(
      `SELECT active FROM app_users WHERE username_norm = ?`,
    )
      .bind('test.user')
      .first<{ active: number }>();
    expect(deleted?.active).toBe(0);

    const listAfterDelete = await SELF.fetch('https://example.com/api/users', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listAfterDelete.status).toBe(200);
    const listBody = await listAfterDelete.json<{ users: Array<{ username: string }> }>();
    expect(listBody.users.map((user) => user.username)).not.toContain('Test.User');
  });
});

