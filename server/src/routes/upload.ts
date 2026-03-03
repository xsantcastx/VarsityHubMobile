import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const uploadRouter = Router();

const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// SECURITY: Rate limit uploads per user (10 per hour) to prevent resource exhaustion
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per windowMs
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  skip: (req) => !(req as any).user, // Skip if not authenticated
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many uploads. Max 10 per hour.' });
  },
});

uploadRouter.post('/avatar', requireAuth as any, uploadLimiter, memory.single('file'), async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'Missing file' });
  
  try {
    const ext = (req.file.mimetype && req.file.mimetype.includes('png')) ? '.png' : '.jpg';
    const name = `${req.user.id}_${Date.now()}${ext}`;
    const full = path.join(UPLOAD_DIR, name);
    await fs.promises.writeFile(full, req.file.buffer);
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/avatars/${name}`;
    res.set('Cache-Control', 'no-store, private');
    return res.json({ url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Upload failed' });
  }
});

