import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class UserService {
  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateCurrentUser(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
  }) {
    const user = await prisma.user.update({
      where: { id: userId, deletedAt: null },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phone && { phone: data.phone }),
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`User profile updated: ${userId}`);
    return user;
  }

  async deleteCurrentUser(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    logger.info(`User account deleted: ${userId}`);
  }
}

export default new UserService();
