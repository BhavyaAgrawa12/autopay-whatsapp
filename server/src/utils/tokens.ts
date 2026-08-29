import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env.js';

export interface TokenPayload {
  email: string;
  role: 'admin';
}

const ACCESS_TOKEN_EXPIRATION = '15m';
const REFRESH_TOKEN_EXPIRATION = '7d';

export class TokenService {
  public static generateAccessToken(email: string): string {
    const payload: TokenPayload = { email, role: 'admin' };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRATION });
  }

  public static generateRefreshToken(email: string): string {
    const payload: TokenPayload = { email, role: 'admin' };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });
  }

  public static verifyAccessToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  public static verifyRefreshToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  public static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = env.NODE_ENV === 'production';
    const sameSiteSetting = isProduction ? 'none' : 'lax';

    // Set Access Token HTTP-only Cookie (15 min)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteSetting,
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Set Refresh Token HTTP-only Cookie (7 days)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteSetting,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });
  }

  public static clearAuthCookies(res: Response): void {
    const isProduction = env.NODE_ENV === 'production';
    const sameSiteSetting = isProduction ? 'none' : 'lax';

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteSetting,
      path: '/',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteSetting,
      path: '/api/auth',
    });
  }
}
