import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';

export class CampaignService {
  /**
   * List active campaigns
   */
  async getActiveCampaigns() {
    const now = new Date();
    return await prisma.campaignReward.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create or update campaign (Admin)
   */
  async upsertCampaign(data: any) {
    if (data.id) {
      return await prisma.campaignReward.update({
        where: { id: Number(data.id) },
        data: {
          title: data.title,
          description: data.description,
          code: data.code,
          bonusPoints: Number(data.bonusPoints || 0),
          multiplier: Number(data.multiplier || 1.0),
          minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : null,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
          isActive: data.isActive !== false,
        },
      });
    }

    return await prisma.campaignReward.create({
      data: {
        title: data.title,
        description: data.description,
        code: data.code,
        bonusPoints: Number(data.bonusPoints || 0),
        multiplier: Number(data.multiplier || 1.0),
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : null,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        isActive: data.isActive !== false,
      },
    });
  }

  /**
   * Issue digital gift card
   */
  async createGiftCard(data: { code?: string; amount: number; expiryDays?: number; userId?: number }) {
    if (data.amount <= 0) {
      throw new AppError('Gift card amount must be greater than zero', 400);
    }

    const code = data.code || `GC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + (data.expiryDays || 365));

    return await prisma.giftCard.create({
      data: {
        code,
        initialBalance: data.amount,
        currentBalance: data.amount,
        issuedToUserId: data.userId || null,
        expiryDate,
        isActive: true,
      },
    });
  }

  /**
   * Redeem gift card to user wallet
   */
  async redeemGiftCard(code: string, userId: number) {
    const card = await prisma.giftCard.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!card || !card.isActive) {
      throw new AppError('Invalid or inactive gift card', 400);
    }

    if (card.expiryDate && new Date() > card.expiryDate) {
      throw new AppError('Gift card has expired', 400);
    }

    const balance = Number(card.currentBalance);
    if (balance <= 0) {
      throw new AppError('Gift card has zero remaining balance', 400);
    }

    const walletService = (await import('./wallet.service')).default;

    return await prisma.$transaction(async (tx) => {
      await tx.giftCard.update({
        where: { id: card.id },
        data: { currentBalance: 0, isActive: false },
      });

      const updatedWallet = await walletService.creditWallet(
        userId,
        balance,
        'TOPUP',
        `GC-${card.code}`,
        `Redeemed Gift Card ${card.code}`
      );

      return { giftCard: card, wallet: updatedWallet };
    });
  }

  /**
   * List all gift cards (Admin)
   */
  async listGiftCards() {
    return await prisma.giftCard.findMany({
      include: {
        issuedToUser: { select: { id: true, firstName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export default new CampaignService();
