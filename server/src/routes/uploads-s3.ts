import crypto from 'crypto';
import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const uploadsS3Router = Router();

uploadsS3Router.post('/s3-sign', requireAuth as any, async (req: AuthedRequest, res) => {
  const { S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env as any;
  if (!S3_REGION || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return res.status(400).json({ error: 'S3 not configured on server' });
  }

  const { fileName, fileType } = req.body;
  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'fileName and fileType are required' });
  }

  try {
    // Generate presigned POST policy for direct browser upload to S3
    const bucket = S3_BUCKET;
    const region = S3_REGION;
    const key = `uploads/${req.user?.id}/${Date.now()}-${fileName}`;
    const expirationTime = new Date(Date.now() + 3600000); // 1 hour from now
    const amzDate = expirationTime.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = expirationTime.toISOString().split('T')[0].replace(/-/g, '');

    // Build policy
    const policy = {
      expiration: expirationTime.toISOString(),
      conditions: [
        { bucket },
        ['content-length-range', 0, 52428800], // 50MB max
        { key },
        { 'Content-Type': fileType },
        { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
        { 'x-amz-credential': `${S3_ACCESS_KEY_ID}/${dateStamp}/${region}/s3/aws4_request` },
        { 'x-amz-date': amzDate },
      ],
    };

    const policyString = Buffer.from(JSON.stringify(policy)).toString('base64');

    // Sign the policy
    const kDate = crypto
      .createHmac('sha256', `AWS4${S3_SECRET_ACCESS_KEY}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto
      .createHmac('sha256', kSigning)
      .update(policyString)
      .digest('hex');

    // Return presigned POST data
    return res.json({
      url: `https://${bucket}.s3.${region}.amazonaws.com/`,
      fields: {
        key,
        'Content-Type': fileType,
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        'x-amz-credential': `${S3_ACCESS_KEY_ID}/${dateStamp}/${region}/s3/aws4_request`,
        'x-amz-date': amzDate,
        policy: policyString,
        'x-amz-signature': signature,
      },
    });
  } catch (error: any) {
    console.error('S3 signing error:', error);
    return res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

