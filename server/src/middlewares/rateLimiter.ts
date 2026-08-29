import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const windowSeconds = Math.ceil(env.AUTH_RATE_LIMIT_WINDOW_MS / 1000);

export const loginRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  skipSuccessfulRequests: true, // Successful login resets/does not penalize IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(windowSeconds));
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: `Too many failed login attempts. Please try again in ${windowSeconds} seconds.`,
      },
    });
  },
});
