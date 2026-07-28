/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('LDB SafeHub Worker API', () => {
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
