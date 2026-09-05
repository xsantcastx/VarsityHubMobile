// Real private S3 + Redis + Postgres journey. Local fixtures only; never points
// at a deployed service. Run with `node --import tsx` and explicit test env.
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

for (const name of ['DATABASE_URL', 'REDIS_URL', 'DATA_EXPORT_S3_ENDPOINT']) {
  const url = new URL(process.env[name] || '');
  assert(['localhost', '127.0.0.1'].includes(url.hostname), `${name} must be loopback`);
}
assert(process.env.NODE_ENV === 'test');
assert(process.env.VARSITYHUB_ENV_PATH === '/dev/null');
const { prisma } = await import('../../lib/prisma.js');
const { dataExportRouter } = await import('../../routes/dataExport.js');
const { initializeQueues, shutdownQueues, isDataExportWorkerAvailable } =
  await import('../../jobs/queues.js');
const { startDataExportWorker, stopDataExportWorker } =
  await import('../../workers/dataExportWorker.js');
const { default: express } = await import('express');
const { default: request } = await import('supertest');
const bucket = `export-fixture-${Date.now()}`;
process.env.DATA_EXPORT_S3_BUCKET = bucket;
const s3 = new S3Client({
  region: process.env.DATA_EXPORT_S3_REGION,
  endpoint: process.env.DATA_EXPORT_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.DATA_EXPORT_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.DATA_EXPORT_S3_SECRET_ACCESS_KEY!,
  },
  maxAttempts: 1,
});
const directory = mkdtempSync(join(tmpdir(), 'varsityhub-storage-'));
const checks: string[] = [];
let userId: string | undefined;
try {
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  userId = (
    await prisma.user.create({ data: { email: `${bucket}@fixture.invalid`, email_verified: true } })
  ).id;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { id: userId, email_verified: true };
    next();
  });
  app.use(dataExportRouter);
  await initializeQueues();
  assert.equal(await isDataExportWorkerAvailable(), false);
  assert.equal((await request(app).post('/me/data-export')).status, 503);
  assert.equal(await prisma.dataExport.count({ where: { user_id: userId } }), 0);
  checks.push('no live worker: unavailable before insertion');
  await startDataExportWorker();
  assert.equal(await isDataExportWorkerAvailable(), true);
  const requested = await request(app).post('/me/data-export');
  assert.equal(requested.status, 202);
  let row;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    row = await prisma.dataExport.findUniqueOrThrow({ where: { id: requested.body.id } });
    if (row.status === 'ready' || row.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(row?.status, 'ready');
  checks.push('HTTP request -> real BullMQ worker -> private S3 upload -> ready');
  const unsigned = `${process.env.DATA_EXPORT_S3_ENDPOINT}/${bucket}/${row!.storage_key}`;
  assert.equal((await fetch(unsigned)).status, 403);
  checks.push('unsigned object download denied');
  const signed = await request(app).get(`/me/data-export/${row!.id}/download`);
  assert.equal(signed.status, 200);
  const response = await fetch(signed.body.url);
  assert.equal(response.status, 200);
  const archive = join(directory, 'export.zip');
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  const manifest = JSON.parse(
    execFileSync('unzip', ['-p', archive, 'MANIFEST.json'], { encoding: 'utf8' })
  );
  assert.equal(manifest.domains_included.length, 26);
  assert.deepEqual(manifest.domains_failed, []);
  checks.push('signed download yields a valid complete 26-section ZIP');
  await prisma.dataExport.update({
    where: { id: row!.id },
    data: { expires_at: new Date(Date.now() + 2400) },
  });
  const short = await request(app).get(`/me/data-export/${row!.id}/download`);
  assert.equal(short.status, 200);
  assert(Number(new URL(short.body.url).searchParams.get('X-Amz-Expires')) <= 2);
  await new Promise(resolve => setTimeout(resolve, 3200));
  assert.equal((await fetch(short.body.url)).status, 403);
  assert.equal((await request(app).get(`/me/data-export/${row!.id}/download`)).status, 410);
  checks.push('real presigned URL expiry and endpoint expiry enforced');
  await request(app).delete(`/me/data-export/${row!.id}`);
  assert.equal(
    (await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 10 }))).KeyCount,
    0
  );
  checks.push('delete removes the private object');
  await stopDataExportWorker();
  assert.equal(await isDataExportWorkerAvailable(), false);
  checks.push('worker shutdown removes availability');
  if (process.env.EXPORT_EVIDENCE_PATH)
    writeFileSync(
      process.env.EXPORT_EVIDENCE_PATH,
      JSON.stringify({ passed: true, checks }, null, 2)
    );
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await stopDataExportWorker();
  await shutdownQueues();
  if (userId) await prisma.user.delete({ where: { id: userId } });
  const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 100 }));
  for (const object of objects.Contents ?? [])
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  s3.destroy();
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
}
process.exit(0);
