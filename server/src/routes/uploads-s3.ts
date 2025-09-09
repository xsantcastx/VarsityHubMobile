import { Router } from 'express';

export const uploadsS3Router = Router();

uploadsS3Router.get('/s3-sign', (_req, res) => {
  const { S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env as any;
  if (!S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return res.status(501).json({ error: 'S3 not configured' });
  }
  // Placeholder: when credentials are provided, implement presigned URL flow here.
  return res.status(501).json({ error: 'S3 signing not implemented yet' });
});

