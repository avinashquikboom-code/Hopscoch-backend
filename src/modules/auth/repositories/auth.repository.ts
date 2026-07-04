import { Prisma, User, RefreshToken, Session, AuditLog, ActivityLog } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../../../utils/prisma';

export class AuthRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    const nameParts = (data.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || null;

    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phone: data.phone,
      },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  async verifyEmail(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
      },
    });
  }

  async createRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    sessionId: string
  ): Promise<RefreshToken> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    return prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        sessionId,
        expiresAt,
      },
    });
  }

  async createSession(data: {
    userId: string;
    deviceId?: string;
    deviceType?: string;
    platform?: string;
    browser?: string;
    os?: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    fcmToken?: string;
  }): Promise<Session> {
    return prisma.session.create({
      data: {
        userId: data.userId,
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        platform: data.platform,
        browser: data.browser,
        os: data.os,
        deviceName: data.deviceName,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        fcmToken: data.fcmToken,
        isActive: true,
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async findActiveSession(userId: string, deviceId?: string): Promise<Session | null> {
    if (deviceId) {
      return prisma.session.findFirst({
        where: { userId, deviceId, isActive: true },
      });
    }
    return prisma.session.findFirst({
      where: { userId, isActive: true },
    });
  }

  async deactivateSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  async deactivateAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(excludeSessionId && { id: { not: excludeSessionId } }),
      },
      data: { isActive: false },
    });
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  async updateSessionAccessToken(sessionId: string, accessTokenHash: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { accessTokenHash },
    });
  }

  async createAuditLog(data: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data,
    });
  }

  async createActivityLog(data: {
    userId?: string;
    activity: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<ActivityLog> {
    return prisma.activityLog.create({
      data,
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash: token },
      include: { user: true, session: true },
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { tokenHash: token },
      data: { revoked: true },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}

export default new AuthRepository();
