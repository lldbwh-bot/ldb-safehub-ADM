import type { AuthenticatedUser } from './contracts';
import { fail, json } from './http';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const uploadFile = async (
  request: Request,
  env: Env,
  user: AuthenticatedUser,
  url: URL,
  requestId: string,
): Promise<Response> => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_FILE_BYTES) {
    return fail(413, 'FILE_TOO_LARGE', 'File exceeds the 10 MB limit', requestId);
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
    return fail(400, 'INVALID_FILE', 'File is empty or too large', requestId);
  }
  const fileId = crypto.randomUUID();
  const rawName = url.searchParams.get('fileName') || 'upload.bin';
  const fileName = rawName.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 180);
  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const entityType = url.searchParams.get('entityType') || '';
  const entityId = url.searchParams.get('entityId') || '';
  const bucketKey = `${env.APP_ENV}/${entityType || 'unlinked'}/${fileId}/${fileName}`;
  await env.FILES.put(bucketKey, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedBy: user.usernameNorm,
      entityType,
      entityId,
    },
  });
  await env.DB.prepare(
    `INSERT INTO file_objects
      (id, bucket_key, file_name, content_type, size_bytes,
       entity_type, entity_id, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      fileId,
      bucketKey,
      fileName,
      contentType,
      bytes.byteLength,
      entityType || null,
      entityId || null,
      user.usernameNorm,
    )
    .run();
  return json(
    {
      fileId,
      fileName,
      contentType,
      sizeBytes: bytes.byteLength,
      url: `/api/files/${fileId}`,
      requestId,
    },
    201,
  );
};

export const downloadFile = async (
  env: Env,
  fileId: string,
  requestId: string,
): Promise<Response> => {
  const metadata = await env.DB.prepare(
    `SELECT bucket_key, file_name, content_type
       FROM file_objects WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(fileId)
    .first<{ bucket_key: string; file_name: string; content_type: string | null }>();
  if (!metadata) return fail(404, 'FILE_NOT_FOUND', 'File not found', requestId);
  const object = await env.FILES.get(metadata.bucket_key);
  if (!object) return fail(404, 'FILE_NOT_FOUND', 'File not found', requestId);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', metadata.content_type || 'application/octet-stream');
  headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(metadata.file_name)}`);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
};

export const deleteFile = async (
  env: Env,
  user: AuthenticatedUser,
  fileId: string,
  requestId: string,
): Promise<Response> => {
  const metadata = await env.DB.prepare(
    `SELECT bucket_key, uploaded_by FROM file_objects
      WHERE id = ? AND deleted_at IS NULL`,
  )
    .bind(fileId)
    .first<{ bucket_key: string; uploaded_by: string | null }>();
  if (!metadata) return fail(404, 'FILE_NOT_FOUND', 'File not found', requestId);
  if (user.status !== 'Admin' && metadata.uploaded_by !== user.usernameNorm) {
    return fail(403, 'FILE_FORBIDDEN', 'File access is not allowed', requestId);
  }
  await env.FILES.delete(metadata.bucket_key);
  await env.DB.prepare(
    'UPDATE file_objects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
  )
    .bind(fileId)
    .run();
  return new Response(null, { status: 204 });
};
