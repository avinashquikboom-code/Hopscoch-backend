import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';
import rewardService from './reward.service';
import loyaltyRuleEngine from './loyalty_rule.engine';

export class ReferralService {
  /**
   * Generate or retrieve user unique referral code
   */
  async getOrCreateReferralCode(userId: number): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, firstName: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate clean unique code e.g. AVI1234
    const prefix = (user.firstName || 'REF').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'FCI');
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}${randomDigits}`;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    return updatedUser.referralCode!;
  }

  /**
   * Process a referral code during new user registration
   */
  async processReferralOnSignup(refereeUserId: number, referralCode: string) {
    if (!referralCode) return null;

    const globalRule = await loyaltyRuleEngine.getGlobalRule();
    if (!globalRule.enableReferral || !globalRule.enableRewardSystem) return null;

    const cleanCode = referralCode.trim().toUpperCase();
    const referrer = await prisma.user.findUnique({
      where: { referralCode: cleanCode },
    });

    if (!referrer) {
      throw new AppError('Invalid referral code', 400);
    }

    if (referrer.id === refereeUserId) {
      throw new AppError('Self-referral is not allowed', 400);
    }

    // Check duplicate referral
    const existing = await prisma.referral.findUnique({
      where: { refereeId: refereeUserId },
    });

    if (existing) {
      return existing; // referral already processed
    }

    const points = globalRule.referralReward || 100;

    return await prisma.$transaction(async (tx) => {
      const referralRecord = await tx.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: refereeUserId,
          referralCode: cleanCode,
          status: 'COMPLETED',
          pointsEarned: points,
          completedAt: new Date(),
        },
      });

      // Award referral bonus points to both Referrer & Referee
      await rewardService.addPoints(referrer.id, points, 'REFERRAL', `Referral Bonus for inviting user #${refereeUserId}`);
      await rewardService.addPoints(refereeUserId, points, 'REFERRAL', `Welcome Referral Bonus from code ${cleanCode}`);

      return referralRecord;
    });
  }

  /**
   * Get referral stats for user
   */
  async getReferralStats(userId: number) {
    const code = await this.getOrCreateReferralCode(userId);

    const [totalReferrals, referrals] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referee: {
            select: { id: true, firstName: true, lastName: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalEarnedPoints = referrals.reduce((acc, curr) => acc + (curr.pointsEarned || 0), 0);

    return {
      referralCode: code,
      totalReferrals,
      totalEarnedPoints,
      referrals,
    };
  }
}

export default new ReferralService();
