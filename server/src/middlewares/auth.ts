import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenPayload } from '../utils/tokens.js';
import { UnauthorizedError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Fallback to HTTP-only cookie if header not present
  if (!token && req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(new UnauthorizedError('Authentication token missing or invalid'));
  }

  const payload = TokenService.verifyAccessToken(token);
  if (!payload) {
    return next(new UnauthorizedError('Authentication token expired or invalid'));
  }

  req.user = payload;
  next();
}
