import { Router } from 'express';
import { z } from 'zod';
import { login, logout, me } from '../controllers/auth.controller.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

router.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  login
);

router.post('/logout', logout);

router.get('/me', requireAuth, me);

export const authRoutes = router;
