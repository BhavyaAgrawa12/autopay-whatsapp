import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';

const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if (env.CLIENT_ORIGIN) {
  allowedOrigins.push(env.CLIENT_ORIGIN);
}

export const securityMiddleware = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows static storage images to load in frontend
    contentSecurityPolicy: false, // Prevents breaking inline scripts/Vite assets while maintaining HSTS & XSS protection
  }),
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server calls)
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS policy rejection: Origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
  }),
];
