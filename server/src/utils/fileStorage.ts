import fs from 'fs';
import path from 'path';

// Define base storage directory inside server/storage
export const STORAGE_BASE_DIR = path.join(process.cwd(), 'storage', 'company');
export const ASSETS_MEDIA_DIR = path.join(STORAGE_BASE_DIR, 'assets');
export const LOGO_MEDIA_DIR = path.join(STORAGE_BASE_DIR, 'logo');

export const PROFILE_JSON_PATH = path.join(STORAGE_BASE_DIR, 'profile.json');
export const ASSETS_JSON_PATH = path.join(STORAGE_BASE_DIR, 'assets.json');

/**
 * Initializes storage directories and default JSON files on startup.
 */
export function initStorage(): void {
  if (!fs.existsSync(STORAGE_BASE_DIR)) {
    fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
  }
  if (!fs.existsSync(ASSETS_MEDIA_DIR)) {
    fs.mkdirSync(ASSETS_MEDIA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGO_MEDIA_DIR)) {
    fs.mkdirSync(LOGO_MEDIA_DIR, { recursive: true });
  }

  // Create default profile.json if missing
  if (!fs.existsSync(PROFILE_JSON_PATH)) {
    const defaultProfile = {
      companyName: 'AutoPay Tech',
      description: 'Modern IT and digital solutions provider specializing in cloud architecture, custom software, and marketing automation.',
      website: 'https://autopaytech.com',
      phone: '+91 98765 43210',
      email: 'contact@autopaytech.com',
      address: '101 Tech Park, Malviya Nagar, Jaipur, Rajasthan, India',
      logoUrl: undefined,
      socialLinks: {
        linkedin: 'https://linkedin.com/company/autopaytech',
        twitter: 'https://twitter.com/autopaytech',
        facebook: 'https://facebook.com/autopaytech',
        instagram: 'https://instagram.com/autopaytech',
      },
      services: [
        {
          id: 'srv-1',
          name: 'Web Application Development',
          description: 'Custom React & Node.js scalable web applications.',
          isActive: true,
          order: 1,
        },
        {
          id: 'srv-2',
          name: 'Mobile App Development',
          description: 'Cross-platform iOS and Android mobile solutions.',
          isActive: true,
          order: 2,
        },
        {
          id: 'srv-3',
          name: 'Cloud & DevOps Architecture',
          description: 'AWS, GCP, and Docker cloud infrastructure management.',
          isActive: true,
          order: 3,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    writeJsonAtomic(PROFILE_JSON_PATH, defaultProfile);
  }

  // Create default assets.json if missing
  if (!fs.existsSync(ASSETS_JSON_PATH)) {
    writeJsonAtomic(ASSETS_JSON_PATH, []);
  }
}

/**
 * Safely reads a JSON file from disk.
 */
export function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading JSON file at ${filePath}:`, error);
    return fallback;
  }
}

/**
 * Atomic write to JSON file using a temporary swap file to prevent corruption.
 */
export function writeJsonAtomic<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Sanitizes a filename to prevent path traversal and shell execution risks.
 */
export function sanitizeFilename(filename: string): string {
  // Strip directory separators and path traversal
  const basename = path.basename(filename);
  // Remove non-alphanumeric chars except dots, underscores, dashes
  return basename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}
