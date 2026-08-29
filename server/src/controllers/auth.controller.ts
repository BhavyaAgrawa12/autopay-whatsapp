import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { TokenService } from '../utils/tokens.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const result = await AuthService.login(email, password);

    // Set secure HTTP-only cookies for token survival across refreshes
    TokenService.setAuthCookies(res, result.accessToken, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function logout(_req: Request, res: Response): void {
  TokenService.clearAuthCookies(res);
  res.status(200).json({
    success: true,
    data: {
      message: 'Logged out successfully',
    },
  });
}

export function me(req: Request, res: Response, next: NextFunction): void {
  try {
    // If request passed requireAuth, req.user exists or we check cookies
    if (!req.user && req.cookies?.refreshToken) {
      // Attempt refresh
      const refreshed = AuthService.refreshAccessToken(req.cookies.refreshToken);
      TokenService.setAuthCookies(res, refreshed.accessToken, refreshed.refreshToken);
      res.status(200).json({
        success: true,
        data: {
          user: refreshed.user,
          accessToken: refreshed.accessToken,
        },
      });
      return;
    }

    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
