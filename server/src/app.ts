import express from 'express';
import cookieParser from 'cookie-parser';
import { securityMiddleware } from './middlewares/security.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { NotFoundError } from './utils/errors.js';

const app = express();

// Security Middlewares
app.use(securityMiddleware);

// Request Parsing & Cookies (Captures rawBody Buffer for HMAC SHA-256 webhook signature validation)
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(requestLogger);

// Serve Static Media Storage
app.use('/storage', express.static('storage'));

// API Routes
app.use('/api', apiRouter);

// 404 Route Handler
app.use((_req, _res, next) => {
  next(new NotFoundError('The requested endpoint does not exist'));
});

// Centralized Error Handling
app.use(errorHandler);

export default app;
