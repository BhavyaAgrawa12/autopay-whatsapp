import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Portable candidate paths for server/.env and root/.env
const envCandidatePaths = [
  path.resolve(process.cwd(), 'server', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '.env'),
];

for (const envPath of envCandidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  CLIENT_ORIGIN: z.string().optional(),

  // Single Administrator Auth Configuration (Phase 2)
  ADMIN_EMAIL: z.string().email().default('admin@itcompany.com'),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_PASSWORD: z.string().default('Admin@123456'),
  JWT_SECRET: z.string().default('it-company-whatsapp-campaign-manager-jwt-access-secret-2026'),
  JWT_REFRESH_SECRET: z.string().default('it-company-whatsapp-campaign-manager-jwt-refresh-secret-2026'),

  // MongoDB Permanent Database Connection (Configured purely via environment variable)
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/whatsapp_campaign_manager'),

  // Official WhatsApp Business Cloud API Configuration (Phase 5)
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v18.0'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default('it-company-whatsapp-webhook-verify-2026'),
  WHATSAPP_APP_SECRET: z.string().optional(),

  // Sending Engine Tuning & Adaptive Rate Limiting
  WHATSAPP_SEND_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  WHATSAPP_MAX_CONCURRENCY: z.string().default('5').transform((val) => parseInt(val, 10)),
  WHATSAPP_INITIAL_BACKOFF_MS: z.string().default('1000').transform((val) => parseInt(val, 10)),
  WHATSAPP_MAX_BACKOFF_MS: z.string().default('60000').transform((val) => parseInt(val, 10)),
  WHATSAPP_MAX_RETRIES: z.string().default('3').transform((val) => parseInt(val, 10)),
  WHATSAPP_SUCCESS_RAMP_STREAK: z.string().default('10').transform((val) => parseInt(val, 10)),
  CAMPAIGN_MAX_MESSAGES_PER_HOUR: z.string().default('100').transform((val) => parseInt(val, 10)),

  // Login Rate Limiting Configuration
  AUTH_RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform((val) => parseInt(val, 10)),
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.string().default('10').transform((val) => parseInt(val, 10)),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables schema');
  throw new Error('Environment validation failed');
}

export const env = parsedEnv.data;

// Production Fail-Fast Environment Validation Guard
if (env.NODE_ENV === 'production') {
  const missingSecrets: string[] = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.includes('it-company-whatsapp-campaign-manager-jwt-access-secret-2026')) {
    missingSecrets.push('JWT_SECRET');
  }
  if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.includes('it-company-whatsapp-campaign-manager-jwt-refresh-secret-2026')) {
    missingSecrets.push('JWT_REFRESH_SECRET');
  }
  if (!env.MONGODB_URI || env.MONGODB_URI.includes('127.0.0.1')) {
    missingSecrets.push('MONGODB_URI');
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_ACCESS_TOKEN.trim().length === 0) {
    missingSecrets.push('WHATSAPP_ACCESS_TOKEN');
  }
  if (!env.WHATSAPP_PHONE_NUMBER_ID || env.WHATSAPP_PHONE_NUMBER_ID.trim().length === 0) {
    missingSecrets.push('WHATSAPP_PHONE_NUMBER_ID');
  }
  if (missingSecrets.length > 0) {
    console.error(`[FATAL] Production startup aborted. Insecure or missing environment configuration: ${missingSecrets.join(', ')}`);
    throw new Error(`Production environment validation failed for: ${missingSecrets.join(', ')}`);
  }
}
