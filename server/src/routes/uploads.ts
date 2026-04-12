import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { captureException } from '../lib/sentry.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { signMediaPath } from '../lib/mediaAccess.js';

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// Force Cloudinary in production, otherwise uploads will be lost on deploy
if (process.env.NODE_ENV === 'production' && !isCloudinaryConfigured()) {
  const errorMessage = 'CRITICAL: Cloudinary is not configured for production. File uploads will fail. Set CLOUDINARY_URL environment variable.';
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Extend Request type to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

function cleanupUploadedDiskFile(file?: Express.Multer.File) {
  if (!file?.path) return;
  fs.promises.unlink(file.path).catch((error) => {
    console.warn('[uploads] Failed to clean up temporary file:', file.path, error);
  });
}

function ensureNonEmptyUpload(file?: Express.Multer.File): string | null {
  if (!file) return 'No file uploaded';
  if (!Number.isFinite(file.size) || file.size <= 0) {
    cleanupUploadedDiskFile(file);
    return 'Uploaded file is empty';
  }
  return null;
}

// Save under server/uploads regardless of where the process is started
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Check if Cloudinary is configured
const useCloudinary = isCloudinaryConfigured();

if (useCloudinary) {
  debugLog('✅ Cloudinary configured - using cloud storage');
} else {
  debugLog('⚠️  Cloudinary not configured - using local disk storage (ephemeral on Railway!)');
}

// Local disk storage (fallback)
const diskStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, UPLOAD_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${randomUUID()}${ext}`;
    cb(null, name);
  },
});

// Choose storage based on configuration. In production, we MUST use memoryStorage for Cloudinary.
const storage = useCloudinary ? multer.memoryStorage() : diskStorage;

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos/images
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    if (!ok) return cb(new Error('Only image or video files are allowed'));
    cb(null, true);
  },
});

// General file upload (no restrictions)
const fileUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for general files
});

export const uploadsRouter = Router();

// Add error logging middleware
uploadsRouter.use((req, res, next) => {
  debugLog('[uploads] Incoming request:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    contentType: req.headers['content-type'],
  });
  next();
});

uploadsRouter.get('/sign', requireAuth as any, (req: MulterRequest, res) => {
  const rawPath = String((req.query as any).path || '').trim();
  if (!rawPath) {
    return res.status(400).json({ error: 'path is required' });
  }
  if (!rawPath.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'path must start with /uploads/' });
  }
  if (rawPath.includes('..')) {
    return res.status(400).json({ error: 'invalid path' });
  }

  try {
    const signed = signMediaPath(rawPath);
    const base = `${req.protocol}://${req.get('host')}`;
    const signedUrl = `${base}${signed.path}?token=${signed.token}&exp=${signed.exp}`;
    return res.json({ ...signed, signed_url: signedUrl });
  } catch (error: any) {
    console.error('[uploads] Failed to sign media path:', error);
    return res.status(500).json({ error: 'Failed to sign media URL' });
  }
});

// Original media upload endpoint (images/videos only)
uploadsRouter.post('/', requireAuth as any, uploadLimiter as any, upload.single('file'), async (req: MulterRequest, res, next) => {
  const uploadError = ensureNonEmptyUpload(req.file);
  if (uploadError) return res.status(400).json({ error: uploadError });
  const file = req.file as Express.Multer.File;

  // Enforce Cloudinary in production
  if (process.env.NODE_ENV === 'production' && !useCloudinary) {
    const error = new Error('Server is not configured for file uploads in production.');
    captureException(error);
    return res.status(500).json({ error: 'File upload service is unavailable.' });
  }

  try {
    // Cloudinary response has different structure
    let url: string;
    let type: string;
    let signedUrl: string | undefined;
  
    if (useCloudinary) {
      const cloudResult = await uploadBufferToCloudinary(file, {
        resourceType: file.mimetype.startsWith('video/') ? 'video' : 'image',
      });
      url = cloudResult.secure_url || cloudResult.url || '';
      type = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      debugLog('[uploads] Cloudinary upload:', {
        originalname: file.originalname,
        cloudinary_url: url,
        mimetype: file.mimetype,
        size: file.size,
      });
    } else {
      // Local disk file
      const rel = `/uploads/${file.filename}`;
      const base = `${req.protocol}://${req.get('host')}`;
      url = `${base}${rel}`;
      type = file.mimetype.startsWith('video/') ? 'video' : 'image';
      try {
        const signed = signMediaPath(rel);
        signedUrl = `${base}${signed.path}?token=${signed.token}&exp=${signed.exp}`;
      } catch (error) {
        console.warn('[uploads] Unable to sign media URL:', (error as any)?.message || error);
      }
      
      if (process.env.NODE_ENV !== 'production') {
        debugLog('[uploads] Local disk upload:', {
          originalname: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          url,
        });
      }
    }
    
    res.status(201).json({ 
      url, 
      signed_url: signedUrl || undefined,
      type, 
      mime: file.mimetype, 
      size: file.size,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    cleanupUploadedDiskFile(req.file);
    captureException(error as Error, { context: 'media_upload_error', path: req.path });
    next(error);
  }
});

// General file upload endpoint (all file types)
uploadsRouter.post('/files', requireAuth as any, uploadLimiter as any, fileUpload.single('file'), async (req: MulterRequest, res, next) => {
  const uploadError = ensureNonEmptyUpload(req.file);
  if (uploadError) return res.status(400).json({ error: uploadError });
  const file = req.file as Express.Multer.File;
  try {
    // Cloudinary response has different structure
    let url: string;
    let type: string;
    let signedUrl: string | undefined;
  
    if (useCloudinary) {
      const cloudResult = await uploadBufferToCloudinary(file, { resourceType: 'auto' });
      url = cloudResult.secure_url || cloudResult.url || '';
      
      // Determine file type based on MIME type
      if (file.mimetype.startsWith('image/')) type = 'image';
      else if (file.mimetype.startsWith('video/')) type = 'video';
      else if (file.mimetype.startsWith('audio/')) type = 'audio';
      else if (file.mimetype.includes('pdf')) type = 'pdf';
      else if (file.mimetype.includes('zip') || file.mimetype.includes('rar')) type = 'archive';
      else type = 'document';
    } else {
      // Local disk file
      const rel = `/uploads/${file.filename}`;
      const base = `${req.protocol}://${req.get('host')}`;
      url = `${base}${rel}`;
      try {
        const signed = signMediaPath(rel);
        signedUrl = `${base}${signed.path}?token=${signed.token}&exp=${signed.exp}`;
      } catch (error) {
        console.warn('[uploads] Unable to sign file URL:', (error as any)?.message || error);
      }
      
      // Determine file type based on MIME type
      if (file.mimetype.startsWith('image/')) type = 'image';
      else if (file.mimetype.startsWith('video/')) type = 'video';
      else if (file.mimetype.startsWith('audio/')) type = 'audio';
      else if (file.mimetype.includes('pdf')) type = 'pdf';
      else if (file.mimetype.includes('zip') || file.mimetype.includes('rar')) type = 'archive';
      else type = 'document';
    }
    
    res.status(201).json({ 
      url, 
      signed_url: signedUrl || undefined,
      type, 
      mime: file.mimetype, 
      size: file.size,
      originalName: file.originalname,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    cleanupUploadedDiskFile(req.file);
    captureException(error as Error, { context: 'file_upload_error', path: req.path });
    next(error);
  }
});

// Error handler for multer and other upload errors
uploadsRouter.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[uploads] Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
  });
  
  // Capture in Sentry for non-client errors
  if (err.code !== 'LIMIT_FILE_SIZE' && err.message !== 'Only image or video files are allowed') {
    captureException(err, { context: 'upload_middleware_error', path: req.path });
  }
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
  }
  
  if (err.message === 'Only image or video files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  
  // Cloudinary errors
  if (err.http_code) {
    return res.status(err.http_code).json({ 
      error: 'Upload failed', 
      message: err.message 
    });
  }
  
  // Generic error
  res.status(500).json({ 
    error: 'Upload failed', 
    message: err.message || 'Unknown error'
  });
});

// Dev helper: list uploaded files
uploadsRouter.get('/list', requireAuth as any, (_req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith('.'));
    const base = `${_req.protocol}://${_req.get('host')}`;
    return res.json(files.map((f) => ({ file: f, url: `${base}/uploads/${f}` })));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list uploads' });
  }
});
