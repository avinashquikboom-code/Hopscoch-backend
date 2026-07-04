import { Prisma, User, RefreshToken } from '@prisma/client';
import bcrypt from 'bcrypt';
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
    expiresAt: Date
  ): Promise<RefreshToken> {
    let session = await prisma.session.findFirst({
      where: { userId, isActive: true },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          userId,
          deviceName: 'Web App',
          isActive: true,
        },
      });
    }

    return prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: token,
        sessionId: session.id,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash: token },
      include: { user: true },
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
