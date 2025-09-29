import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthedRequest } from '../middleware/auth.js';

export const uploadRouter = Router();

const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

uploadRouter.post('/avatar', memory.single('file'), async (req: AuthedRequest, res) => {
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

