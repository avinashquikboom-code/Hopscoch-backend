import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';
import loyaltyRuleEngine from './loyalty_rule.engine';

export class RewardService {
  /**
   * Get user reward points summary
   */
  async getUserRewardSummary(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        rewardPointsBalance: true,
        referralCode: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Compute lifetime earned and redeemed
    const [earnedAgg, redeemedAgg] = await Promise.all([
      prisma.rewardPointsTransaction.aggregate({
        where: { userId, points: { gt: 0 } },
        _sum: { points: true },
      }),
      prisma.rewardPointsTransaction.aggregate({
        where: { userId, points: { lt: 0 } },
        _sum: { points: true },
      }),
    ]);

    const lifetimeEarned = earnedAgg._sum.points || 0;
    const lifetimeRedeemed = Math.abs(redeemedAgg._sum.points || 0);

    const globalRule = await loyaltyRuleEngine.getGlobalRule();

    return {
      balance: user.rewardPointsBalance,
      lifetimeEarned,
      lifetimeRedeemed,
      referralCode: user.referralCode,
      conversionRate: Number(globalRule.rewardConversionRate || 0.01),
      monetaryValue: Math.round(user.rewardPointsBalance * Number(globalRule.rewardConversionRate || 0.01) * 100) / 100,
    };
  }

  /**
   * Add reward points to user account
   */
  async addPoints(
    userId: number,
    points: number,
    type: any,
    reason?: string,
    orderId?: string,
    expiryDays?: number
  ) {
    if (points <= 0) return;

    const globalRule = await loyaltyRuleEngine.getGlobalRule();
    const days = expiryDays || globalRule.rewardExpiryDays || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          rewardPointsBalance: { increment: points },
        },
      });

      const txRecord = await tx.rewardPointsTransaction.create({
        data: {
          userId,
          type,
          points,
          reason: reason || `Reward Points Earned (${type})`,
          orderId,
          expiresAt,
        },
      });

      return { user: updatedUser, transaction: txRecord };
    });
  }

  /**
   * Redeem reward points for discount
   */
  async redeemPoints(userId: number, points: number, orderId: string) {
    if (points <= 0) return;

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.rewardPointsBalance < points) {
        throw new AppError(`Insufficient reward points balance (${user?.rewardPointsBalance || 0} available)`, 400);
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          rewardPointsBalance: { decrement: points },
        },
      });

      const txRecord = await tx.rewardPointsTransaction.create({
        data: {
          userId,
          type: 'REDEEMED',
          points: -points,
          reason: `Redeemed for Order #${orderId}`,
          orderId,
        },
      });

      return { user: updatedUser, transaction: txRecord };
    });
  }

  /**
   * Reverse points (on Order Cancellation or Return)
   */
  async reversePointsForOrder(userId: number, orderId: string) {
    const transactions = await prisma.rewardPointsTransaction.findMany({
      where: { userId, orderId },
    });

    if (!transactions.length) return;

    return await prisma.$transaction(async (tx) => {
      for (const t of transactions) {
        if (t.type === 'REDEEMED' && t.points < 0) {
          // Refund redeemed points back to customer
          const pointsToRefund = Math.abs(t.points);
          await tx.user.update({
            where: { id: userId },
            data: { rewardPointsBalance: { increment: pointsToRefund } },
          });

          await tx.rewardPointsTransaction.create({
            data: {
              userId,
              type: 'REVERSED',
              points: pointsToRefund,
              reason: `Reversed Redemption for Cancelled/Returned Order #${orderId}`,
              orderId,
            },
          });
        } else if ((t.type === 'EARNED' || t.type === 'PURCHASE') && t.points > 0) {
          // Revoke earned points from customer
          const pointsToClawback = t.points;
          await tx.user.update({
            where: { id: userId },
            data: { rewardPointsBalance: { decrement: pointsToClawback } },
          });

          await tx.rewardPointsTransaction.create({
            data: {
              userId,
              type: 'REVERSED',
              points: -pointsToClawback,
              reason: `Clawed Back Earned Points for Cancelled/Returned Order #${orderId}`,
              orderId,
            },
          });
        }
      }
    });
  }

  /**
   * Process daily login reward
   */
  async processDailyLoginReward(userId: number) {
    const globalRule = await loyaltyRuleEngine.getGlobalRule();
    if (!globalRule.enableRewardSystem || globalRule.dailyLoginReward <= 0) return null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingToday = await prisma.rewardPointsTransaction.findFirst({
      where: {
        userId,
        type: 'LOGIN',
        createdAt: { gte: startOfDay },
      },
    });

    if (existingToday) return null; // already claimed today

    return await this.addPoints(
      userId,
      globalRule.dailyLoginReward,
      'LOGIN',
      'Daily Login Reward'
    );
  }

  /**
   * Process review reward
   */
  async processReviewReward(userId: number, productId: number) {
    const globalRule = await loyaltyRuleEngine.getGlobalRule();
    if (!globalRule.enableRewardSystem || globalRule.reviewReward <= 0) return null;

    return await this.addPoints(
      userId,
      globalRule.reviewReward,
      'REVIEW',
      `Review Reward for Product #${productId}`
    );
  }

  /**
   * Process welcome reward for new user
   */
  async processWelcomeReward(userId: number) {
    const globalRule = await loyaltyRuleEngine.getGlobalRule();
    if (!globalRule.enableRewardSystem || globalRule.welcomeReward <= 0) return null;

    return await this.addPoints(
      userId,
      globalRule.welcomeReward,
      'WELCOME',
      'Welcome Bonus for Registration'
    );
  }

  /**
   * Get paginated transaction history
   */
  async getTransactionHistory(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.rewardPointsTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rewardPointsTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new RewardService();
