import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

// Save under server/uploads regardless of where the process is started
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (!ok) return cb(new Error('Only image or video files are allowed'));
    cb(null, true);
  },
});

// General file upload (no restrictions)
const fileUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for general files
});

export const uploadsRouter = Router();

// Original media upload endpoint (images/videos only)
uploadsRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const rel = `/uploads/${req.file.filename}`;
  const base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}${rel}`;
  const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  // Dev: print detailed upload info to assist debugging when running locally
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('[uploads] saved file:', {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: rel,
        url,
      });
    } catch (e) {
      // ignore logging errors
    }
  }
  res.status(201).json({ url, path: rel, type, mime: req.file.mimetype, size: req.file.size });
});

// General file upload endpoint (all file types)
uploadsRouter.post('/files', fileUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const rel = `/uploads/${req.file.filename}`;
  const base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}${rel}`;
  
  // Determine file type based on MIME type
  let type = 'document';
  if (req.file.mimetype.startsWith('image/')) type = 'image';
  else if (req.file.mimetype.startsWith('video/')) type = 'video';
  else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
  else if (req.file.mimetype.includes('pdf')) type = 'pdf';
  else if (req.file.mimetype.includes('zip') || req.file.mimetype.includes('rar')) type = 'archive';
  
  res.status(201).json({ 
    url, 
    path: rel, 
    type, 
    mime: req.file.mimetype, 
    size: req.file.size,
    originalName: req.file.originalname
  });
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
