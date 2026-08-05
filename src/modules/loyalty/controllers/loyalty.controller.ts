import { Request, Response } from 'express';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import loyaltyRuleEngine from '../services/loyalty_rule.engine';
import walletService from '../services/wallet.service';
import rewardService from '../services/reward.service';
import referralService from '../services/referral.service';
import campaignService from '../services/campaign.service';
import loyaltyAnalyticsService from '../services/loyalty_analytics.service';
import prisma from '../../../utils/prisma';

import razorpayClient from '../../payments/services/razorpay.client';
import { AppError } from '../../../middleware/errorHandler';
import { PaymentStatus } from '@prisma/client';

export class LoyaltyController {
  // 1. Global Settings & Rules
  async getGlobalRules(req: Request, res: Response) {
    const rules = await loyaltyRuleEngine.getGlobalRule();
    return ResponseFormatter.success(res, 'Global reward rules retrieved', rules);
  }

  async updateGlobalRules(req: Request, res: Response) {
    const body = req.body;
    const rule = await prisma.rewardRule.upsert({
      where: { id: 1 },
      update: {
        enableRewardSystem: body.enableRewardSystem,
        enableWallet: body.enableWallet,
        enableCashback: body.enableCashback,
        enableReferral: body.enableReferral,
        defaultRewardPoints: Number(body.defaultRewardPoints || 10),
        pointsPer100: Number(body.pointsPer100 || 10),
        rewardConversionRate: Number(body.rewardConversionRate || 0.01),
        maxRedeemablePointsPerOrder: Number(body.maxRedeemablePointsPerOrder || 1000),
        maxRedeemablePercentPerOrder: Number(body.maxRedeemablePercentPerOrder || 50),
        minOrderAmount: Number(body.minOrderAmount || 100),
        rewardExpiryDays: Number(body.rewardExpiryDays || 365),
        dailyLoginReward: Number(body.dailyLoginReward || 5),
        birthdayReward: Number(body.birthdayReward || 100),
        welcomeReward: Number(body.welcomeReward || 50),
        referralReward: Number(body.referralReward || 100),
        reviewReward: Number(body.reviewReward || 20),
        firstOrderReward: Number(body.firstOrderReward || 100),
      },
      create: {
        id: 1,
        enableRewardSystem: body.enableRewardSystem !== false,
        enableWallet: body.enableWallet !== false,
        enableCashback: body.enableCashback !== false,
        enableReferral: body.enableReferral !== false,
        defaultRewardPoints: Number(body.defaultRewardPoints || 10),
        pointsPer100: Number(body.pointsPer100 || 10),
        rewardConversionRate: Number(body.rewardConversionRate || 0.01),
        maxRedeemablePointsPerOrder: Number(body.maxRedeemablePointsPerOrder || 1000),
        maxRedeemablePercentPerOrder: Number(body.maxRedeemablePercentPerOrder || 50),
        minOrderAmount: Number(body.minOrderAmount || 100),
        rewardExpiryDays: Number(body.rewardExpiryDays || 365),
        dailyLoginReward: Number(body.dailyLoginReward || 5),
        birthdayReward: Number(body.birthdayReward || 100),
        welcomeReward: Number(body.welcomeReward || 50),
        referralReward: Number(body.referralReward || 100),
        reviewReward: Number(body.reviewReward || 20),
        firstOrderReward: Number(body.firstOrderReward || 100),
      },
    });
    return ResponseFormatter.success(res, 'Global reward rules updated successfully', rule);
  }

  // 2. Wallet APIs
  async getWallet(req: any, res: Response) {
    const userId = req.user.id;
    const wallet = await walletService.getOrCreateWallet(userId);
    return ResponseFormatter.success(res, 'Wallet details retrieved', wallet);
  }

  async createWalletLoadOrder(req: any, res: Response) {
    const userId = req.user.id;
    const { amount } = req.body;
    const numericAmount = Number(amount);

    if (![100, 500, 1000].includes(numericAmount)) {
      throw new AppError('Invalid top-up amount. Allowed amounts: ₹100, ₹500, ₹1000', 400);
    }

    const rzpOrder = await razorpayClient.createOrder(
      numericAmount,
      'INR',
      `wallet_load_${userId}_${Date.now()}`
    );

    const payment = await prisma.payment.create({
      data: {
        method: 'RAZORPAY',
        status: 'PENDING',
        amount: numericAmount,
        razorpayOrderId: rzpOrder.id,
      },
    });

    let keyId = process.env.RAZORPAY_KEY_ID || '';
    try {
      const settingsService = (await import('../../settings/services/settings.service')).default;
      const fetchedKey = await settingsService.getIntegrationKey('razorpay', 'key_id');
      if (fetchedKey && !fetchedKey.startsWith('YOUR_') && fetchedKey !== 'your-razorpay-key-id') {
        keyId = fetchedKey;
      }
    } catch (_) {}

    return ResponseFormatter.success(res, 'Wallet load order created', {
      orderId: rzpOrder.id,
      amount: numericAmount,
      currency: 'INR',
      keyId,
      paymentId: payment.id,
    });
  }

  async verifyWalletLoad(req: any, res: Response) {
    const userId = req.user.id;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError('Missing required payment verification parameters', 400);
    }

    const isValid = await razorpayClient.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      throw new AppError('Razorpay payment signature verification failed', 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId, method: 'RAZORPAY' },
    });

    const amount = payment ? Number(payment.amount) : 0;

    const updatedWallet = await walletService.creditWalletRazorpay(
      userId,
      amount,
      razorpayOrderId,
      razorpayPaymentId
    );

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          razorpayPaymentId,
          razorpaySignature,
        },
      });
    }

    return ResponseFormatter.success(res, 'Wallet loaded successfully', updatedWallet);
  }

  async topupWallet(req: any, res: Response) {
    const userId = req.user.id;
    const { amount, referenceId, description } = req.body;
    const wallet = await walletService.topupWallet(userId, Number(amount), referenceId, description);
    return ResponseFormatter.success(res, 'Wallet topup successful', wallet);
  }

  async adminAdjustWallet(req: Request, res: Response) {
    const { userId, amount, type, description } = req.body; // type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT'
    if (type === 'ADMIN_CREDIT') {
      const wallet = await walletService.creditWallet(Number(userId), Number(amount), 'ADMIN_CREDIT', undefined, description);
      return ResponseFormatter.success(res, 'Wallet credited by admin', wallet);
    } else {
      const wallet = await walletService.debitWallet(Number(userId), Number(amount), 'ADMIN_DEBIT', undefined, description);
      return ResponseFormatter.success(res, 'Wallet debited by admin', wallet);
    }
  }

  // 3. Reward Points APIs
  async getRewardSummary(req: any, res: Response) {
    const userId = req.user.id;
    // Process daily login check silently
    await rewardService.processDailyLoginReward(userId);
    const summary = await rewardService.getUserRewardSummary(userId);
    return ResponseFormatter.success(res, 'Reward points summary retrieved', summary);
  }

  async adminAdjustPoints(req: Request, res: Response) {
    const { userId, points, type, reason } = req.body;
    if (points > 0) {
      const result = await rewardService.addPoints(Number(userId), Number(points), type || 'ADJUSTED', reason || 'Admin Credit');
      return ResponseFormatter.success(res, 'Reward points credited by admin', result);
    } else {
      const absPoints = Math.abs(Number(points));
      const result = await rewardService.redeemPoints(Number(userId), absPoints, 'ADMIN_DEBIT');
      return ResponseFormatter.success(res, 'Reward points debited by admin', result);
    }
  }

  // 4. Cart & Checkout Reward Calculation
  async calculateCartRewards(req: Request, res: Response) {
    const { items } = req.body; // Array of { productId, quantity }
    if (!Array.isArray(items) || items.length === 0) {
      return ResponseFormatter.success(res, 'Cart empty', {
        subtotal: 0,
        totalEarnPoints: 0,
        maxRedeemablePoints: 0,
        maxDiscountAmount: 0,
        conversionRate: 0.01,
        itemBreakdown: [],
      });
    }

    const productIds = items.map((i) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const preparedItems = items.map((i) => ({
      product: productMap.get(Number(i.productId)),
      quantity: Number(i.quantity || 1),
    })).filter((i) => i.product);

    const calculation = await loyaltyRuleEngine.calculateCartRewards(preparedItems);
    return ResponseFormatter.success(res, 'Cart rewards calculated successfully', calculation);
  }

  // 5. Category Rewards Configuration
  async getCategoryRewards(req: Request, res: Response) {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        overrideGlobalReward: true,
        rewardPointsEarned: true,
        maxRedeemablePoints: true,
        rewardMultiplier: true,
        allowRewardRedemption: true,
        allowRewardEarning: true,
      },
      orderBy: { name: 'asc' },
    });
    return ResponseFormatter.success(res, 'Category rewards retrieved', categories);
  }

  async updateCategoryReward(req: Request, res: Response) {
    const id = Number(req.params.id);
    const body = req.body;
    const category = await prisma.category.update({
      where: { id },
      data: {
        overrideGlobalReward: body.overrideGlobalReward,
        rewardPointsEarned: Number(body.rewardPointsEarned || 0),
        maxRedeemablePoints: Number(body.maxRedeemablePoints || 0),
        rewardMultiplier: Number(body.rewardMultiplier || 1.0),
        allowRewardRedemption: body.allowRewardRedemption !== false,
        allowRewardEarning: body.allowRewardEarning !== false,
      },
    });
    return ResponseFormatter.success(res, 'Category reward updated successfully', category);
  }

  // 6. Product Rewards Configuration
  async getProductRewards(req: Request, res: Response) {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = req.query.search ? String(req.query.search) : '';

    const where: any = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          basePrice: true,
          thumbnailUrl: true,
          enableReward: true,
          rewardPoints: true,
          maxRedeemablePoints: true,
          allowRewardRedemption: true,
          allowRewardEarning: true,
          rewardMultiplier: true,
          overrideGlobalReward: true,
          overrideCategoryReward: true,
          campaignReward: true,
          rewardExpiryDate: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return ResponseFormatter.success(res, 'Product rewards retrieved', {
      products,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  }

  async updateProductReward(req: Request, res: Response) {
    const id = Number(req.params.id);
    const body = req.body;
    const product = await prisma.product.update({
      where: { id },
      data: {
        enableReward: body.enableReward !== false,
        rewardPoints: Number(body.rewardPoints || 0),
        maxRedeemablePoints: Number(body.maxRedeemablePoints || 0),
        allowRewardRedemption: body.allowRewardRedemption !== false,
        allowRewardEarning: body.allowRewardEarning !== false,
        rewardMultiplier: Number(body.rewardMultiplier || 1.0),
        overrideGlobalReward: Boolean(body.overrideGlobalReward),
        overrideCategoryReward: Boolean(body.overrideCategoryReward),
        campaignReward: Number(body.campaignReward || 0),
        rewardExpiryDate: body.rewardExpiryDate ? new Date(body.rewardExpiryDate) : null,
      },
    });
    return ResponseFormatter.success(res, 'Product reward updated successfully', product);
  }

  // 7. Referral APIs
  async getReferralStats(req: any, res: Response) {
    const userId = req.user.id;
    const stats = await referralService.getReferralStats(userId);
    return ResponseFormatter.success(res, 'Referral stats retrieved', stats);
  }

  // 8. Campaigns & Gift Cards
  async getCampaigns(req: Request, res: Response) {
    const campaigns = await campaignService.getActiveCampaigns();
    return ResponseFormatter.success(res, 'Active campaigns retrieved', campaigns);
  }

  async createCampaign(req: Request, res: Response) {
    const campaign = await campaignService.upsertCampaign(req.body);
    return ResponseFormatter.success(res, 'Campaign saved successfully', campaign);
  }

  async listGiftCards(req: Request, res: Response) {
    const cards = await campaignService.listGiftCards();
    return ResponseFormatter.success(res, 'Gift cards retrieved', cards);
  }

  async createGiftCard(req: Request, res: Response) {
    const card = await campaignService.createGiftCard(req.body);
    return ResponseFormatter.success(res, 'Gift card generated successfully', card);
  }

  async redeemGiftCard(req: any, res: Response) {
    const userId = req.user.id;
    const { code } = req.body;
    const result = await campaignService.redeemGiftCard(code, userId);
    return ResponseFormatter.success(res, 'Gift card redeemed to wallet successfully', result);
  }

  // 9. Additional Customer Loyalty Endpoints
  async getRewardHistory(req: any, res: Response) {
    const userId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const filter = String(req.query.filter || 'all').toLowerCase();
    const result = await rewardService.getTransactionHistory(userId, page, limit);
    let items = result.transactions || [];
    if (filter !== 'all') {
      items = items.filter((item: any) => String(item.type || '').toLowerCase() === filter);
    }
    return ResponseFormatter.success(res, 'Reward points history retrieved', items);
  }

  async getCashbackData(req: any, res: Response) {
    const userId = req.user.id;
    const summary = await rewardService.getUserRewardSummary(userId);
    const walletHistory = await walletService.getTransactionHistory(userId, 1, 50);
    const cashbackTxs = (walletHistory.transactions || []).filter((tx: any) => String(tx.category || '').toLowerCase() === 'cashback');
    return ResponseFormatter.success(res, 'Cashback data retrieved', {
      totalCashback: summary.lifetimeEarned || 0,
      transactions: cashbackTxs,
    });
  }

  async getUserGiftCards(req: any, res: Response) {
    const cards = await campaignService.listGiftCards();
    return ResponseFormatter.success(res, 'User gift cards retrieved', cards);
  }

  async claimDailyReward(req: any, res: Response) {
    const userId = req.user.id;
    const result = await rewardService.processDailyLoginReward(userId);
    return ResponseFormatter.success(res, 'Daily reward processed', result);
  }

  // 10. Master Transactions History
  async getMasterTransactions(req: any, res: Response) {
    const userId = req.user.role === 'ADMIN' ? (req.query.userId ? Number(req.query.userId) : undefined) : req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const [walletHistory, rewardHistory] = await Promise.all([
      walletService.getTransactionHistory(userId || req.user.id, page, limit),
      rewardService.getTransactionHistory(userId || req.user.id, page, limit),
    ]);

    return ResponseFormatter.success(res, 'Transactions history retrieved', {
      wallet: walletHistory,
      rewardPoints: rewardHistory,
    });
  }

  // 11. Admin Loyalty Analytics & Reports
  async getAnalytics(req: Request, res: Response) {
    const data = await loyaltyAnalyticsService.getDashboardAnalytics();
    return ResponseFormatter.success(res, 'Loyalty analytics retrieved', data);
  }
}

export default new LoyaltyController();
