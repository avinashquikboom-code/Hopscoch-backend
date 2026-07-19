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

  async findById(id: any): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    let firstName = data.firstName || '';
    let lastName = data.lastName || null;
    
    if (!firstName && data.name) {
      const nameParts = data.name.trim().split(/\s+/);
      firstName = nameParts[0] || 'User';
      lastName = nameParts.slice(1).join(' ') || null;
    }
    
    if (!firstName) {
      firstName = 'User';
    }

    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
      },
    });
  }

  async updatePassword(userId: any, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { passwordHash: hashedPassword },
    });
  }

  async verifyEmail(userId: any): Promise<User> {
    return prisma.user.update({
      where: { id: Number(userId) },
      data: {
        isEmailVerified: true,
      },
    });
  }

  async createRefreshToken(
    userId: any,
    token: string,
    expiresAt: Date,
    sessionId: any
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
    userId: any;
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

  async findActiveSession(userId: any, deviceId?: string): Promise<Session | null> {
    if (deviceId) {
      return prisma.session.findFirst({
        where: { userId, deviceId, isActive: true },
      });
    }
    return prisma.session.findFirst({
      where: { userId, isActive: true },
    });
  }

  async deactivateSession(sessionId: any): Promise<void> {
    await prisma.session.update({
      where: { id: Number(sessionId) },
      data: { isActive: false },
    });
  }

  async deactivateAllUserSessions(userId: any, excludeSessionId?: any): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId: Number(userId),
        isActive: true,
        ...(excludeSessionId && { id: { not: Number(excludeSessionId) } }),
      },
      data: { isActive: false },
    });
  }

  async updateSessionActivity(sessionId: any): Promise<void> {
    await prisma.session.update({
      where: { id: Number(sessionId) },
      data: { lastActivityAt: new Date() },
    });
  }

  async updateSessionAccessToken(sessionId: any, accessTokenHash: string): Promise<void> {
    await prisma.session.update({
      where: { id: Number(sessionId) },
      data: { accessTokenHash },
    });
  }

  async createAuditLog(data: {
    userId?: any;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        ...data,
        userId: data.userId ? Number(data.userId) : undefined,
      },
    });
  }

  async createActivityLog(data: {
    userId?: any;
    activity: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<ActivityLog> {
    return prisma.activityLog.create({
      data: {
        ...data,
        userId: data.userId ? Number(data.userId) : undefined,
      },
    });
  }

  async findRefreshToken(token: string): Promise<any> {
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

  async revokeAllUserTokens(userId: any): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  async deleteAccount(userId: any): Promise<void> {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { deletedAt: new Date() },
    });
  }

  async updateLastLogin(userId: any): Promise<void> {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { lastLoginAt: new Date() },
    });
  }
}

export default new AuthRepository();
