import type { ApiErrorEnvelope } from './contracts';

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

export const fail = (
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

export const readJsonObject = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};
