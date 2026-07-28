import prisma from '../../../utils/prisma';

export class LoyaltyAnalyticsService {
  /**
   * Get Loyalty Dashboard metrics & reports
   */
  async getDashboardAnalytics() {
    const [
      pointsIssuedAgg,
      pointsRedeemedAgg,
      totalWalletBalanceAgg,
      cashbackIssuedAgg,
      activeWalletsCount,
      totalReferralsCount,
    ] = await Promise.all([
      prisma.rewardPointsTransaction.aggregate({
        where: { points: { gt: 0 } },
        _sum: { points: true },
      }),
      prisma.rewardPointsTransaction.aggregate({
        where: { points: { lt: 0 } },
        _sum: { points: true },
      }),
      prisma.wallet.aggregate({
        where: { isActive: true },
        _sum: { balance: true },
      }),
      prisma.cashbackTransaction.aggregate({
        where: { status: 'CREDITED' },
        _sum: { amount: true },
      }),
      prisma.wallet.count({ where: { isActive: true } }),
      prisma.referral.count({ where: { status: 'COMPLETED' } }),
    ]);

    const totalPointsIssued = pointsIssuedAgg._sum.points || 0;
    const totalPointsRedeemed = Math.abs(pointsRedeemedAgg._sum.points || 0);
    const totalWalletBalance = Number(totalWalletBalanceAgg._sum.balance || 0);
    const totalCashbackIssued = Number(cashbackIssuedAgg._sum.amount || 0);

    // Top Reward Products
    const topRewardProducts = await prisma.product.findMany({
      where: { enableReward: true, rewardPoints: { gt: 0 } },
      select: {
        id: true,
        name: true,
        rewardPoints: true,
        maxRedeemablePoints: true,
        thumbnailUrl: true,
        basePrice: true,
      },
      orderBy: { rewardPoints: 'desc' },
      take: 5,
    });

    // Top Reward Categories
    const topRewardCategories = await prisma.category.findMany({
      where: { overrideGlobalReward: true },
      select: {
        id: true,
        name: true,
        rewardPointsEarned: true,
        maxRedeemablePoints: true,
      },
      orderBy: { rewardPointsEarned: 'desc' },
      take: 5,
    });

    // Top Customers by Reward Points Balance
    const topCustomers = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        rewardPointsBalance: true,
        wallet: { select: { balance: true } },
      },
      orderBy: { rewardPointsBalance: 'desc' },
      take: 5,
    });

    return {
      totalPointsIssued,
      totalPointsRedeemed,
      totalWalletBalance,
      totalCashbackIssued,
      activeWalletsCount,
      totalReferralsCount,
      topRewardProducts,
      topRewardCategories,
      topCustomers: topCustomers.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName || ''}`.trim(),
        email: c.email,
        rewardPointsBalance: c.rewardPointsBalance,
        walletBalance: Number(c.wallet?.balance || 0),
      })),
    };
  }
}

export default new LoyaltyAnalyticsService();
