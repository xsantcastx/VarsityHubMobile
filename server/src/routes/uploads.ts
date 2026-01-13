import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
<<<<<<< HEAD
import { isCloudinaryConfigured, uploadBufferToCloudinary } from '../lib/cloudinary.js';
import { debugLog } from '../lib/debugLog.js';
=======
import { cloudinary, getCloudinaryFolder, isCloudinaryConfigured } from '../lib/cloudinary.js';
import type { AuthedRequest } from '../middleware/auth.js';
>>>>>>> f6efb4f (fix: force commit regenerated package-lock.json and package.json for EAS build integrity)

// Extend Request type to include multer file and user
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: { id: string };
}

// SECURITY: File magic bytes for validation (first few bytes of file)
const MAGIC_BYTES: Record<string, number[][]> = {
  // Images
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP starts with RIFF)
  // Videos
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp at offset 4
  'video/quicktime': [[0x00, 0x00, 0x00]], // MOV files
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]], // WebM/MKV
  'video/x-msvideo': [[0x52, 0x49, 0x46, 0x46]], // AVI (RIFF)
};

// SECURITY: Allowed file extensions
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm'];
const ALLOWED_EXTENSIONS = [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS];

/**
 * SECURITY: Validate file by checking magic bytes against declared MIME type
 */
function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) {
    // For video/mp4 and video/quicktime, check for 'ftyp' at offset 4
    if (declaredMime === 'video/mp4' || declaredMime === 'video/quicktime') {
      if (buffer.length >= 8) {
        const ftyp = buffer.slice(4, 8).toString('ascii');
        return ftyp === 'ftyp';
      }
    }
    return false;
  }

  return signatures.some(sig =>
    sig.every((byte, index) => buffer[index] === byte)
  );
}

/**
 * SECURITY: Validate file extension against allowlist
 */
function validateExtension(filename: string, isVideo: boolean): boolean {
  const ext = path.extname(filename).toLowerCase();
  const allowedList = isVideo ? ALLOWED_VIDEO_EXTENSIONS : ALLOWED_IMAGE_EXTENSIONS;
  return allowedList.includes(ext);
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

const memoryStorage = multer.memoryStorage();

// Choose storage based on configuration
const storage = useCloudinary ? memoryStorage : diskStorage;

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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

// SECURITY: Require authentication for uploads
function requireAuth(req: MulterRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required for uploads' });
  }
  next();
}

// Original media upload endpoint (images/videos only)
<<<<<<< HEAD
uploadsRouter.post('/', upload.single('file'), async (req: MulterRequest, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    // Cloudinary response has different structure
    let url: string;
    let type: string;
  
    if (useCloudinary) {
      const cloudResult = await uploadBufferToCloudinary(req.file, {
        resourceType: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      });
      url = cloudResult.secure_url || cloudResult.url || '';
      type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      debugLog('[uploads] Cloudinary upload:', {
=======
// SECURITY: Now requires authentication
uploadsRouter.post('/', requireAuth, upload.single('file'), async (req: MulterRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const isVideo = req.file.mimetype.startsWith('video/');

  // SECURITY: Validate file extension
  if (!validateExtension(req.file.originalname, isVideo)) {
    console.warn(`[uploads] Rejected file with invalid extension: ${req.file.originalname}`);
    return res.status(400).json({ error: 'Invalid file extension. Allowed: ' + ALLOWED_EXTENSIONS.join(', ') });
  }

  // SECURITY: For local uploads, validate magic bytes
  // Note: Cloudinary handles its own validation, but we still check extension above
  if (!useCloudinary && req.file.path) {
    try {
      const fileBuffer = await fs.promises.readFile(req.file.path);
      const headerBuffer = fileBuffer.slice(0, 16);

      if (!validateMagicBytes(headerBuffer, req.file.mimetype)) {
        // Delete the uploaded file
        await fs.promises.unlink(req.file.path).catch(() => {});
        console.warn(`[uploads] Rejected file with invalid magic bytes: ${req.file.originalname}, claimed: ${req.file.mimetype}`);
        return res.status(400).json({ error: 'File content does not match declared type' });
      }
    } catch (err) {
      console.error('[uploads] Error validating file:', err);
      return res.status(500).json({ error: 'Failed to validate file' });
    }
  }

  // Cloudinary response has different structure
  let url: string;
  let type: string;

  if (useCloudinary && 'path' in req.file) {
    // Cloudinary file
    url = (req.file as any).path; // Cloudinary URL
    type = isVideo ? 'video' : 'image';

    console.log('[uploads] Cloudinary upload:', {
      user_id: req.user?.id,
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
    type = isVideo ? 'video' : 'image';

    if (process.env.NODE_ENV !== 'production') {
      console.log('[uploads] Local disk upload:', {
        user_id: req.user?.id,
>>>>>>> f6efb4f (fix: force commit regenerated package-lock.json and package.json for EAS build integrity)
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
      type, 
      mime: req.file.mimetype, 
      size: req.file.size,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    next(error);
  }
<<<<<<< HEAD
});

// General file upload endpoint (all file types)
uploadsRouter.post('/files', fileUpload.single('file'), async (req: MulterRequest, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    // Cloudinary response has different structure
    let url: string;
    let type: string;
  
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
      type, 
      mime: req.file.mimetype, 
      size: req.file.size,
      originalName: req.file.originalname,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    next(error);
  }
=======

  res.status(201).json({
    url,
    type,
    mime: req.file.mimetype,
    size: req.file.size,
    storage: useCloudinary ? 'cloudinary' : 'local'
  });
});

// SECURITY: Allowed extensions for general file uploads
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const ALLOWED_FILE_EXTENSIONS = [...ALLOWED_EXTENSIONS, ...ALLOWED_DOCUMENT_EXTENSIONS];

// General file upload endpoint (restricted file types)
// SECURITY: Now requires authentication
uploadsRouter.post('/files', requireAuth, fileUpload.single('file'), (req: MulterRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // SECURITY: Validate file extension against allowlist
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    console.warn(`[uploads] Rejected file with disallowed extension: ${req.file.originalname}`);
    return res.status(400).json({ error: 'File type not allowed. Allowed: ' + ALLOWED_FILE_EXTENSIONS.join(', ') });
  }

  // Cloudinary response has different structure
  let url: string;
  let type: string;

  if (useCloudinary && 'path' in req.file) {
    // Cloudinary file
    url = (req.file as any).path;

    // Determine file type based on MIME type
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
    else if (req.file.mimetype.includes('pdf')) type = 'pdf';
    else type = 'document';
  } else {
    // Local disk file
    const rel = `/uploads/${req.file.filename}`;
    const base = `${req.protocol}://${req.get('host')}`;
    url = `${base}${rel}`;

    // Determine file type based on MIME type
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
    else if (req.file.mimetype.includes('pdf')) type = 'pdf';
    else type = 'document';
  }

  console.log('[uploads] File upload:', {
    user_id: req.user?.id,
    originalname: req.file.originalname,
    type,
  });

  res.status(201).json({
    url,
    type,
    mime: req.file.mimetype,
    size: req.file.size,
    originalName: req.file.originalname,
    storage: useCloudinary ? 'cloudinary' : 'local'
  });
>>>>>>> f6efb4f (fix: force commit regenerated package-lock.json and package.json for EAS build integrity)
});

// Error handler for multer and other upload errors
uploadsRouter.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[uploads] Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
  });
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
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

// SECURITY: Dev helper to list uploaded files - disabled in production
uploadsRouter.get('/list', (_req, res) => {
  // SECURITY: Only allow listing files in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'File listing disabled in production' });
  }

  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith('.'));
    const base = `${_req.protocol}://${_req.get('host')}`;
    return res.json(files.map((f) => ({ file: f, url: `${base}/uploads/${f}` })));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list uploads' });
  }
});
