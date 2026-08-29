import multer from 'multer';
import path from 'path';
import { ASSETS_MEDIA_DIR, LOGO_MEDIA_DIR, sanitizeFilename } from '../utils/fileStorage.js';
import { ValidationError } from '../utils/errors.js';

// Define whitelisted extensions & MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images & GIFs
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/aac',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif',
  '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.ogg', '.m4a',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
]);

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.js', '.py', '.php', '.pl', '.vbs', '.jar', '.com',
]);

const storage = multer.memoryStorage();
const logoStorage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (DISALLOWED_EXTENSIONS.has(ext)) {
    return cb(new ValidationError(`Executable or dangerous file extension '${ext}' is strictly prohibited.`));
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new ValidationError(`Unsupported file extension '${ext}'. Please upload an allowed image, video, audio, or document file.`));
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(new ValidationError(`Unsupported MIME type '${file.mimetype}'.`));
  }

  cb(null, true);
};

export const uploadAssetMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max (videos limit)
  },
});

export const uploadLogoMiddleware = multer({
  storage: logoStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext)) {
      return cb(new ValidationError('Company logo must be an image (.jpg, .png, .webp, .svg).'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max for logo
  },
});
