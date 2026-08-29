import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';
import { TokenService } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    role: string;
  };
}

export class AuthService {
  private static cachedPasswordHash: string | null = null;

  private static async getAdminPasswordHash(): Promise<string> {
    if (env.ADMIN_PASSWORD_HASH) {
      return env.ADMIN_PASSWORD_HASH;
    }

    if (!AuthService.cachedPasswordHash) {
      // Hash initial admin password dynamically for local development
      AuthService.cachedPasswordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    }
    return AuthService.cachedPasswordHash;
  }

  public static async login(emailInput: string, passwordInput: string): Promise<AuthResult> {
    // Standardize email comparison
    const targetEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    const inputEmail = emailInput.toLowerCase().trim();

    if (inputEmail !== targetEmail) {
      logger.warn('Login failed: Email mismatch', { attemptedEmail: inputEmail });
      throw new UnauthorizedError('Invalid email or password');
    }

    const adminHash = await AuthService.getAdminPasswordHash();
    const isPasswordValid = await bcrypt.compare(passwordInput, adminHash);

    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password attempt', { email: targetEmail });
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = TokenService.generateAccessToken(targetEmail);
    const refreshToken = TokenService.generateRefreshToken(targetEmail);

    logger.info('Admin successfully authenticated', { email: targetEmail });

    return {
      accessToken,
      refreshToken,
      user: {
        email: targetEmail,
        role: 'admin',
      },
    };
  }

  public static refreshAccessToken(refreshToken: string): AuthResult {
    const payload = TokenService.verifyRefreshToken(refreshToken);

    if (!payload || payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
      throw new UnauthorizedError('Invalid or expired refresh session');
    }

    const newAccessToken = TokenService.generateAccessToken(payload.email);
    const newRefreshToken = TokenService.generateRefreshToken(payload.email);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        email: payload.email,
        role: 'admin',
      },
    };
  }
}
