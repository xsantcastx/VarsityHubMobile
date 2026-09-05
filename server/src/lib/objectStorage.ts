/**
 * Object storage adapter for private archive storage (GDPR data exports).
 *
 * Kept intentionally narrow: the three operations the data-export flow
 * needs, no more. Interface-first so v1 is S3-compatible and not
 * vendor-bound — R2, AWS S3, and MinIO all work via `DATA_EXPORT_S3_ENDPOINT`
 * override.
 *
 * This adapter is NOT for media delivery. Cloudinary stays the media CDN.
 *
 * Required env:
 *   DATA_EXPORT_S3_BUCKET              — bucket name
 *   DATA_EXPORT_S3_REGION              — region (use "auto" for R2)
 *   DATA_EXPORT_S3_ACCESS_KEY_ID       — credentials
 *   DATA_EXPORT_S3_SECRET_ACCESS_KEY   — credentials
 *
 * Optional:
 *   DATA_EXPORT_S3_ENDPOINT            — override for R2/MinIO
 *   DATA_EXPORT_SIGNED_URL_TTL_SECONDS — default 300 (5 minutes)
 */

import type { Readable } from 'node:stream';

export interface ObjectStorageAdapter {
  /** True iff all required env vars are present. Cheap — no network call. */
  isConfigured(): boolean;

  /**
   * Upload a buffer or readable stream to the configured bucket under `key`.
   * Throws on failure. Object is stored server-side encrypted (SSE) where
   * the backend supports it; callers do not pass encryption options.
   */
  putObject(key: string, body: Buffer | Readable, contentType: string): Promise<void>;

  /**
   * Generate a short-lived signed URL the user can `GET` to download the
   * object. TTL defaults to `DATA_EXPORT_SIGNED_URL_TTL_SECONDS` (300).
   * The URL is single-purpose — callers should not log it (it grants read
   * access). Throws if not configured.
   */
  getSignedDownloadUrl(key: string, ttlSeconds?: number, signingDate?: Date): Promise<string>;

  /**
   * Delete an object. Safe to call on a key that doesn't exist — idempotent.
   */
  deleteObject(key: string): Promise<void>;
}

/** Loud, clear error type so callers can distinguish "not configured" from
 *  real I/O failures and return 503 vs 500 accordingly. */
export class ObjectStorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage adapter is not configured (DATA_EXPORT_S3_* env vars)');
    this.name = 'ObjectStorageNotConfiguredError';
  }
}

// ─── S3-compatible implementation ────────────────────────────────────────────

class S3CompatibleAdapter implements ObjectStorageAdapter {
  private lazyClient: any | null = null;
  private lazySigner: ((key: string, ttl: number) => Promise<string>) | null = null;

  private env() {
    return {
      bucket: process.env.DATA_EXPORT_S3_BUCKET || '',
      region: process.env.DATA_EXPORT_S3_REGION || '',
      accessKeyId: process.env.DATA_EXPORT_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.DATA_EXPORT_S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.DATA_EXPORT_S3_ENDPOINT || undefined,
      defaultTtl: Number(process.env.DATA_EXPORT_SIGNED_URL_TTL_SECONDS) || 300,
    };
  }

  isConfigured(): boolean {
    const e = this.env();
    return Boolean(e.bucket && e.region && e.accessKeyId && e.secretAccessKey);
  }

  private async getClient() {
    if (this.lazyClient) return this.lazyClient;
    if (!this.isConfigured()) throw new ObjectStorageNotConfiguredError();
    const e = this.env();
    // Dynamic import so the AWS SDK is only loaded when storage is actually
    // used. Saves ~30MB of RAM and cold-start time on servers that never
    // run the export worker.
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.lazyClient = new S3Client({
      region: e.region,
      endpoint: e.endpoint,
      credentials: { accessKeyId: e.accessKeyId, secretAccessKey: e.secretAccessKey },
      // R2 requires path-style to work with custom endpoints
      forcePathStyle: Boolean(e.endpoint),
      maxAttempts: 1,
    });
    return this.lazyClient;
  }

  async putObject(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    const { runWithBreaker } = await import('./circuitBreaker.js');
    const client = await this.getClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const e = this.env();
    await runWithBreaker(
      'data-export-storage',
      () =>
        client.send(
          new PutObjectCommand({
            Bucket: e.bucket,
            Key: key,
            Body: body as any,
            ContentType: contentType,
            // R2 encrypts at rest automatically and does not accept the S3 SSE
            // header. AWS endpoints support explicitly requesting AES256.
            ...(!e.endpoint ? { ServerSideEncryption: 'AES256' as const } : {}),
            CacheControl: 'private, no-store',
            ContentDisposition: 'attachment; filename="varsityhub-data.zip"',
          }),
          { abortSignal: AbortSignal.timeout(25_000) }
        ),
      { timeout: 30_000 }
    );
  }

  async getSignedDownloadUrl(
    key: string,
    ttlSeconds?: number,
    signingDate = new Date()
  ): Promise<string> {
    const client = await this.getClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const e = this.env();
    const ttl = Math.floor(ttlSeconds ?? e.defaultTtl);
    if (!Number.isFinite(ttl) || ttl < 1 || ttl > 300)
      throw new Error('Invalid export URL lifetime');
    return getSignedUrl(client, new GetObjectCommand({ Bucket: e.bucket, Key: key }), {
      expiresIn: ttl,
      signingDate,
    });
  }

  async deleteObject(key: string): Promise<void> {
    const { runWithBreaker } = await import('./circuitBreaker.js');
    const client = await this.getClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const e = this.env();
    try {
      await runWithBreaker(
        'data-export-storage',
        () =>
          client.send(new DeleteObjectCommand({ Bucket: e.bucket, Key: key }), {
            abortSignal: AbortSignal.timeout(25_000),
          }),
        { timeout: 30_000 }
      );
    } catch (err: any) {
      // S3/R2 return 204 for deletes regardless of existence, so this path
      // is rare. Swallow NoSuchKey for idempotency; re-throw anything else.
      if (err?.name === 'NoSuchKey') return;
      throw err;
    }
  }
}

// Singleton. Safe to cache because it's stateless until first use; the
// lazyClient inside the instance keeps the SDK load deferred.
let adapterInstance: ObjectStorageAdapter | null = null;

/**
 * Return the process-wide object storage adapter. First call constructs the
 * S3-compatible implementation; subsequent calls return the same instance.
 *
 * The adapter may be unconfigured (`isConfigured()` returns false) — callers
 * must check before issuing operations that would otherwise throw.
 */
export function getObjectStorageAdapter(): ObjectStorageAdapter {
  if (!adapterInstance) adapterInstance = new S3CompatibleAdapter();
  return adapterInstance;
}

/**
 * Test-only: swap in a fake adapter. Never called from production code.
 * Returns the previous adapter so tests can restore it in afterAll.
 */
export function __setObjectStorageAdapterForTests(
  fake: ObjectStorageAdapter
): ObjectStorageAdapter | null {
  const prev = adapterInstance;
  adapterInstance = fake;
  return prev;
}
