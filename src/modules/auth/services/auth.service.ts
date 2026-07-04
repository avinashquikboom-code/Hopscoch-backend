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

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'your-super-secret-refresh-token-key';
  }

  private getRefreshTokenExpiry(deviceType?: string): number {
    // Mobile App: 30 days
    if (deviceType === 'mobile') {
      return 30 * 24 * 60 * 60 * 1000;
    }
    // Website: 30 days
    if (deviceType === 'web') {
      return 30 * 24 * 60 * 60 * 1000;
    }
    // Admin Panel: 12 hours
    if (deviceType === 'admin') {
      return 12 * 60 * 60 * 1000;
    }
    // Default: 7 days
    return 7 * 24 * 60 * 60 * 1000;
  }

  async register(data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
    deviceType?: string;
    platform?: string;
    browser?: string;
    os?: string;
    deviceId?: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    fcmToken?: string;
  }): Promise<AuthResponse> {
    // Check if user exists
    const existingUser = await authRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Create user
    const user = await authRepository.create(data);

    // Create session
    const session = await authRepository.createSession({
      userId: user.id,
      deviceId: data.deviceId,
      deviceType: data.deviceType || 'web',
      platform: data.platform,
      browser: data.browser,
      os: data.os,
      deviceName: data.deviceName || 'Web App',
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      fcmToken: data.fcmToken,
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Hash access token and store in session
    const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    await authRepository.updateSessionAccessToken(session.id, accessTokenHash);

    // Save refresh token
    const refreshExpiresAt = new Date(Date.now() + this.getRefreshTokenExpiry(data.deviceType));
    await authRepository.createRefreshToken(user.id, refreshToken, refreshExpiresAt, session.id);

    // Log audit event
    await authRepository.createAuditLog({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: { deviceType: data.deviceType, deviceId: data.deviceId },
    });

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

  async login(email: string, password: string, deviceInfo?: {
    deviceType?: string;
    platform?: string;
    browser?: string;
    os?: string;
    deviceId?: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    fcmToken?: string;
  }): Promise<AuthResponse> {
    // Find user
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.isActive || user.deletedAt) {
      throw new AppError('Account is inactive or deleted', 401, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login
    await authRepository.updateLastLogin(user.id);

    // Single device login: revoke all previous sessions
    await authRepository.deactivateAllUserSessions(user.id);

    // Create new session
    const session = await authRepository.createSession({
      userId: user.id,
      deviceId: deviceInfo?.deviceId,
      deviceType: deviceInfo?.deviceType || 'web',
      platform: deviceInfo?.platform,
      browser: deviceInfo?.browser,
      os: deviceInfo?.os,
      deviceName: deviceInfo?.deviceName || 'Web App',
      userAgent: deviceInfo?.userAgent,
      ipAddress: deviceInfo?.ipAddress,
      fcmToken: deviceInfo?.fcmToken,
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);

    // Hash access token and store in session
    const accessTokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    await authRepository.updateSessionAccessToken(session.id, accessTokenHash);

    // Save refresh token
    const refreshExpiresAt = new Date(Date.now() + this.getRefreshTokenExpiry(deviceInfo?.deviceType));
    await authRepository.createRefreshToken(user.id, refreshToken, refreshExpiresAt, session.id);

    // Log audit event
    await authRepository.createAuditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'SESSION',
      entityId: session.id,
      ipAddress: deviceInfo?.ipAddress,
      userAgent: deviceInfo?.userAgent,
      metadata: { deviceType: deviceInfo?.deviceType, deviceId: deviceInfo?.deviceId },
    });

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
    if (!tokenRecord) {
      throw new AppError('Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
    }

    if (tokenRecord.revoked) {
      throw new AppError('Refresh token has been revoked', 401, 'SESSION_REVOKED');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError('Refresh token has expired', 401, 'TOKEN_EXPIRED');
    }

    // Check if session is still active
    if (!tokenRecord.session.isActive) {
      throw new AppError('Session has been revoked', 401, 'SESSION_REVOKED');
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, this.refreshSecret) as TokenPayload;

    // Check if user is still active
    const user = await authRepository.findById(decoded.userId);
    if (!user || !user.isActive || user.deletedAt) {
      throw new AppError('Account is inactive or deleted', 401, 'ACCOUNT_DISABLED');
    }

    // Revoke old refresh token
    await authRepository.revokeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = await this.generateTokens(decoded.userId, decoded.email, decoded.role);

    // Hash new access token and update session
    const accessTokenHash = crypto.createHash('sha256').update(tokens.accessToken).digest('hex');
    await authRepository.updateSessionAccessToken(tokenRecord.sessionId, accessTokenHash);

    // Update session activity
    await authRepository.updateSessionActivity(tokenRecord.sessionId);

    // Save new refresh token with same expiry as old token
    await authRepository.createRefreshToken(decoded.userId, tokens.refreshToken, tokenRecord.expiresAt, tokenRecord.sessionId);

    // Log audit event
    await authRepository.createAuditLog({
      userId: decoded.userId,
      action: 'TOKEN_REFRESH',
      entityType: 'SESSION',
      entityId: tokenRecord.sessionId,
      metadata: { previousTokenRevoked: true },
    });

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    // Find refresh token
    const tokenRecord = await authRepository.findRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw new AppError('Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
    }

    // Revoke refresh token
    await authRepository.revokeRefreshToken(refreshToken);

    // Deactivate session
    await authRepository.deactivateSession(tokenRecord.sessionId);

    // Log audit event
    await authRepository.createAuditLog({
      userId: tokenRecord.userId,
      action: 'LOGOUT',
      entityType: 'SESSION',
      entityId: tokenRecord.sessionId,
    });

    logger.info(`User logged out: ${tokenRecord.userId}`);
  }

  async logoutAll(userId: string): Promise<void> {
    // Revoke all refresh tokens
    await authRepository.revokeAllUserTokens(userId);

    // Deactivate all sessions
    await authRepository.deactivateAllUserSessions(userId);

    // Log audit event
    await authRepository.createAuditLog({
      userId,
      action: 'LOGOUT_ALL',
      entityType: 'USER',
      entityId: userId,
    });

    logger.info(`User logged out from all devices: ${userId}`);
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
      throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
    }

    // Update password
    await authRepository.updatePassword(userId, newPassword);

    // Revoke all refresh tokens
    await authRepository.revokeAllUserTokens(userId);

    // Deactivate all sessions
    await authRepository.deactivateAllUserSessions(userId);

    // Log audit event
    await authRepository.createAuditLog({
      userId,
      action: 'PASSWORD_CHANGE',
      entityType: 'USER',
      entityId: userId,
    });

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

    // Log audit event
    await authRepository.createAuditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      entityType: 'USER',
      entityId: user.id,
    });

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
    // Revoke all refresh tokens
    await authRepository.revokeAllUserTokens(userId);

    // Deactivate all sessions
    await authRepository.deactivateAllUserSessions(userId);

    // Soft delete account
    await authRepository.deleteAccount(userId);

    // Log audit event
    await authRepository.createAuditLog({
      userId,
      action: 'ACCOUNT_DELETE',
      entityType: 'USER',
      entityId: userId,
    });

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
      expiresIn: '30d', // Default 30 days, actual expiry handled by database
    });

    return { accessToken, refreshToken };
  }
}

export default new AuthService();
