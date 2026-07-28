/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('LDB SafeHub Worker API', () => {
  it('authenticates an active D1 user without returning the password hash', async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS app_users (
        username_norm TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
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
});
