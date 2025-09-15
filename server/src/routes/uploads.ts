import { Router, Request } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

// Save under server/uploads regardless of where the process is started
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, UPLOAD_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (!ok) return cb(new Error('Only image or video files are allowed'));
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const rel = `/uploads/${req.file.filename}`;
  const base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}${rel}`;
  const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  res.status(201).json({ url, path: rel, type, mime: req.file.mimetype, size: req.file.size });
});

// Dev helper: list uploaded files
uploadsRouter.get('/list', (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith('.'));
    const base = `${_req.protocol}://${_req.get('host')}`;
    return res.json(files.map((f) => ({ file: f, url: `${base}/uploads/${f}` })));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list uploads' });
  }
});
