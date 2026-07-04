import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import authRepository from '../repositories/auth.repository';
import { AppError } from '../../../middleware/errorHandler';
import { AuthResponse, TokenPayload } from '../dto/auth.dto';
import { logger } from '../../../utils/logger';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key';
    this.refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
  }

  async register(data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Create user
    const user = await authRepository.create(data);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await authRepository.createRefreshToken(user.id, refreshToken, refreshExpiresAt);

    logger.info(`New user registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        phone: user.phone,
        avatar: user.avatarUrl,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    // Find user
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive || user.deletedAt) {
      throw new AppError('Account is inactive or deleted', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await authRepository.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await authRepository.createRefreshToken(user.id, refreshToken, refreshExpiresAt);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        phone: user.phone,
        avatar: user.avatarUrl,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Find refresh token
    const tokenRecord = await authRepository.findRefreshToken(refreshToken);
    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, this.refreshSecret) as TokenPayload;

    // Revoke old refresh token
    await authRepository.revokeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = await this.generateTokens(decoded.userId, decoded.email, decoded.role);

    // Save new refresh token
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await authRepository.createRefreshToken(decoded.userId, tokens.refreshToken, refreshExpiresAt);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await authRepository.revokeRefreshToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await authRepository.revokeAllUserTokens(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const userWithPassword = await authRepository.findByEmail(user.email);
    if (!userWithPassword) {
      throw new AppError('User not found', 404);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    await authRepository.updatePassword(userId, newPassword);

    // Revoke all refresh tokens
    await authRepository.revokeAllUserTokens(userId);

    logger.info(`Password changed for user: ${user.email}`);
  }

  async forgotPassword(email: string): Promise<string> {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return '';
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // In production, save this to database with expiry
    // For now, return the token (in production, send via email)
    logger.info(`Password reset requested for: ${email}`);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // In production, verify token from database
    // For now, just log it
    logger.info(`Password reset with token: ${token}`);
  }

  async deleteAccount(userId: string): Promise<void> {
    await authRepository.deleteAccount(userId);
    logger.info(`Account deleted for user: ${userId}`);
  }

  async getUserById(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(userId: string, email: string, role: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: TokenPayload = { userId, email, role };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn as any,
    });

    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn as any,
    });

    return { accessToken, refreshToken };
  }
}

export default new AuthService();
