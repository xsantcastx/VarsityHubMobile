import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getCloudinaryCredentials, getCloudinaryFolder, isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { captureException } from '../lib/sentry.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { signMediaPath } from '../lib/mediaAccess.js';

// Magic byte signatures for file type validation (prevents MIME spoofing)
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header; WEBP at offset 8
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp at offset 4
  { mime: 'video/quicktime', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // same ftyp box
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

function validateMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (!buffer || buffer.length < 12) return false;
  const candidates = MAGIC_BYTES.filter(m => m.mime === claimedMime);
  if (candidates.length === 0) return false; // Unknown type — reject
  return candidates.some(({ bytes, offset = 0 }) =>
    bytes.every((b, i) => buffer[offset + i] === b)
  );
}

// HEIC/HEIF uses ftyp box (same as mp4) with brand 'heic', 'heix', 'mif1'
function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const brand = buffer.toString('ascii', 8, 12);
  return ['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand);
}

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.ENABLE_SERVER_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// Force Cloudinary in production, otherwise uploads will be lost on deploy
if (process.env.NODE_ENV === 'production' && !isCloudinaryConfigured()) {
  const errorMessage = 'CRITICAL: Cloudinary is not configured for production. File uploads will fail. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Railway.';
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Extend Request type to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
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
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

// Choose storage based on configuration. In production, we MUST use memoryStorage for Cloudinary.
const storage = useCloudinary ? multer.memoryStorage() : diskStorage;

// Image/video whitelist — block SVG (image/svg+xml) to prevent XSS; require extension cross-check (M7)
// Include HEIC/HEIF — iPhone default format; create-post.tsx explicitly supports it
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']);
const IMAGE_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov']);
const VIDEO_MIMETYPES = new Set(['video/mp4', 'video/quicktime']);

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit — memory storage, concurrent uploads can OOM at higher limits
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (IMAGE_MIMETYPES.has(file.mimetype) && IMAGE_EXTENSIONS.has(ext)) {
      return cb(null, true);
    }
    if (VIDEO_MIMETYPES.has(file.mimetype) && VIDEO_EXTENSIONS.has(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Only image (jpg, png, gif, webp, heic) or video (mp4, mov) files are allowed'));
  },
});

// Allowed file types for general upload (whitelist)
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.pdf']);
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime',
  'application/pdf',
]);

const fileUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — memory storage, concurrent uploads can OOM at higher limits
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIMETYPES.has(file.mimetype)) {
      return cb(new Error('File type not allowed. Accepted: jpg, png, gif, webp, mp4, mov, pdf'));
    }
    cb(null, true);
  },
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

// -----------------------------------------------
// GET /uploads/cloudinary-signature
// Returns a signed payload for direct client-to-Cloudinary upload.
// The file never touches this server — goes straight from phone to CDN.
// -----------------------------------------------
uploadsRouter.get('/cloudinary-signature', requireAuth as any, uploadLimiter as any, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!useCloudinary) {
    return res.status(503).json({ error: 'Direct upload not available — Cloudinary not configured' });
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const folder = getCloudinaryFolder();
    const timestamp = Math.floor(Date.now() / 1000);

    const params: Record<string, string> = { folder, timestamp: String(timestamp) };
    // Cloudinary requires alphabetically-sorted params for signature
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

    return res.json({
      cloudName,
      apiKey,  // Public identifier (not a secret) — required by Cloudinary signed upload SDK
      signature,
      timestamp,
      folder,
    });
  } catch (error: any) {
    console.error('[uploads] Failed to generate Cloudinary signature:', error);
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  }
});

uploadsRouter.get('/sign', requireAuth as any, uploadLimiter as any, (req: MulterRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
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
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Magic byte validation — verify file content matches claimed MIME type
  const fileBuffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
  if (fileBuffer) {
    const mime = req.file.mimetype;
    const isHeic = mime === 'image/heic' || mime === 'image/heif';
    const magicValid = isHeic ? isHeicBuffer(fileBuffer) : validateMagicBytes(fileBuffer, mime);
    if (!magicValid) {
      console.warn(`[uploads] Magic byte mismatch: claimed ${mime}, file rejected`);
      return res.status(400).json({ error: 'File content does not match declared type. Upload rejected.' });
    }
  }

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
      const cloudResult = await uploadBufferToCloudinary(req.file, {
        resourceType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      });
      url = cloudResult.secure_url || cloudResult.url || '';
      type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      debugLog('[uploads] Cloudinary upload:', {
        originalname: req.file.originalname,
        cloudinary_url: url,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } else {
      // Local disk file
      const rel = `/uploads/${req.file.filename}`;
      const base = `${req.protocol}://${req.get('host')}`;
      url = `${base}${rel}`;
      type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      try {
        const signed = signMediaPath(rel);
        signedUrl = `${base}${signed.path}?token=${signed.token}&exp=${signed.exp}`;
      } catch (error) {
        console.warn('[uploads] Unable to sign media URL:', (error as any)?.message || error);
      }
      
      if (process.env.NODE_ENV !== 'production') {
        debugLog('[uploads] Local disk upload:', {
          originalname: req.file.originalname,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          url,
        });
      }
    }
    
    res.status(201).json({ 
      url, 
      signed_url: signedUrl || undefined,
      type, 
      mime: req.file.mimetype, 
      size: req.file.size,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    captureException(error as Error, { context: 'media_upload_error', path: req.path });
    next(error);
  }
});

// General file upload endpoint (all file types)
uploadsRouter.post('/files', requireAuth as any, uploadLimiter as any, fileUpload.single('file'), async (req: MulterRequest, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Magic byte validation
  const fileBuf = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
  if (fileBuf) {
    const mime = req.file.mimetype;
    const isHeic = mime === 'image/heic' || mime === 'image/heif';
    const magicValid = isHeic ? isHeicBuffer(fileBuf) : validateMagicBytes(fileBuf, mime);
    if (!magicValid) {
      console.warn(`[uploads] Magic byte mismatch on /files: claimed ${mime}, file rejected`);
      return res.status(400).json({ error: 'File content does not match declared type. Upload rejected.' });
    }
  }

  try {
    // Cloudinary response has different structure
    let url: string;
    let type: string;
    let signedUrl: string | undefined;
  
    if (useCloudinary) {
      const cloudResult = await uploadBufferToCloudinary(req.file, { resourceType: 'auto' });
      url = cloudResult.secure_url || cloudResult.url || '';
      
      // Determine file type based on MIME type
      if (req.file.mimetype.startsWith('image/')) type = 'image';
      else if (req.file.mimetype.startsWith('video/')) type = 'video';
      else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
      else if (req.file.mimetype.includes('pdf')) type = 'pdf';
      else if (req.file.mimetype.includes('zip') || req.file.mimetype.includes('rar')) type = 'archive';
      else type = 'document';
    } else {
      // Local disk file
      const rel = `/uploads/${req.file.filename}`;
      const base = `${req.protocol}://${req.get('host')}`;
      url = `${base}${rel}`;
      try {
        const signed = signMediaPath(rel);
        signedUrl = `${base}${signed.path}?token=${signed.token}&exp=${signed.exp}`;
      } catch (error) {
        console.warn('[uploads] Unable to sign file URL:', (error as any)?.message || error);
      }
      
      // Determine file type based on MIME type
      if (req.file.mimetype.startsWith('image/')) type = 'image';
      else if (req.file.mimetype.startsWith('video/')) type = 'video';
      else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
      else if (req.file.mimetype.includes('pdf')) type = 'pdf';
      else if (req.file.mimetype.includes('zip') || req.file.mimetype.includes('rar')) type = 'archive';
      else type = 'document';
    }
    
    res.status(201).json({ 
      url, 
      signed_url: signedUrl || undefined,
      type, 
      mime: req.file.mimetype, 
      size: req.file.size,
      originalName: req.file.originalname,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    captureException(error as Error, { context: 'file_upload_error', path: req.path });
    next(error);
  }
});

// Avatar upload endpoint (images only, 5MB limit, stricter rate limiting)
const avatarMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const AVATAR_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

// snyk:ignore - endpoint is protected by requireAuth + uploadLimiter rate-limiting middleware
uploadsRouter.post('/avatar', requireAuth as any, uploadLimiter as any, avatarMemory.single('file'), async (req: MulterRequest, res) => {
  if (!(req as any).user) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'Missing file' });

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
  }

  try {
    if (useCloudinary) {
      const cloudResult = await uploadBufferToCloudinary(req.file, { resourceType: 'image' });
      const url = cloudResult.secure_url || cloudResult.url || '';
      res.set('Cache-Control', 'no-store, private');
      return res.json({ url });
    }
    // Local disk fallback
    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const name = `${(req as any).user.id}_${Date.now()}${ext}`;
    const full = path.join(AVATAR_DIR, name);
    await fs.promises.writeFile(full, req.file.buffer);
    const base = `${req.protocol}://${req.get('host')}`;
    const url = `${base}/uploads/avatars/${name}`;
    res.set('Cache-Control', 'no-store, private');
    return res.json({ url });
  } catch (e: any) {
    console.error('[uploads] POST /avatar error:', e);
    return res.status(500).json({ error: 'Internal server error' });
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
  const isClientError = err.code === 'LIMIT_FILE_SIZE'
    || err.message === 'Only image or video files are allowed'
    || err.message?.startsWith('File type not allowed');
  if (!isClientError) {
    captureException(err, { context: 'upload_middleware_error', path: req.path });
  }
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
  }
  
  if (err.message === 'Only image or video files are allowed' || err.message?.startsWith('File type not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  
  // Cloudinary errors
  if (err.http_code) {
    return res.status(err.http_code).json({ error: 'Upload failed' });
  }

  // Generic error
  res.status(500).json({ error: 'Upload failed' });
});
