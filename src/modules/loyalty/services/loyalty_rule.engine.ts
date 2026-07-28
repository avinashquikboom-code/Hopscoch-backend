import prisma from '../../../utils/prisma';

export interface CalculatedProductReward {
  productId: number;
  earnPoints: number;
  maxRedeemablePoints: number;
  allowRedemption: boolean;
  allowEarning: boolean;
  appliedRuleType: 'PRODUCT' | 'CATEGORY' | 'GLOBAL';
}

export interface CalculatedCartRewards {
  subtotal: number;
  totalEarnPoints: number;
  maxRedeemablePoints: number;
  maxDiscountAmount: number;
  conversionRate: number; // e.g. 0.01 (100 pts = ₹1)
  itemBreakdown: CalculatedProductReward[];
}

export class LoyaltyRuleEngine {
  /**
   * Fetch or initialize global reward rule singleton
   */
  async getGlobalRule() {
    let rule = await prisma.rewardRule.findFirst();
    if (!rule) {
      rule = await prisma.rewardRule.create({
        data: {
          id: 1,
          enableRewardSystem: true,
          enableWallet: true,
          enableCashback: true,
          enableReferral: true,
          defaultRewardPoints: 10,
          pointsPer100: 10,
          rewardConversionRate: 0.01,
          maxRedeemablePointsPerOrder: 1000,
          maxRedeemablePercentPerOrder: 50,
          minOrderAmount: 100,
          rewardExpiryDays: 365,
          dailyLoginReward: 5,
          birthdayReward: 100,
          welcomeReward: 50,
          referralReward: 100,
          reviewReward: 20,
          firstOrderReward: 100,
        },
      });
    }
    return rule;
  }

  /**
   * Calculate reward points earned and max redeemable for a single product
   * Priority: Product Rule -> Category Rule -> Global Rule
   */
  async calculateProductReward(product: any): Promise<CalculatedProductReward> {
    const globalRule = await this.getGlobalRule();

    if (!globalRule.enableRewardSystem || product.enableReward === false) {
      return {
        productId: product.id,
        earnPoints: 0,
        maxRedeemablePoints: 0,
        allowRedemption: false,
        allowEarning: false,
        appliedRuleType: 'PRODUCT',
      };
    }

    const basePrice = Number(product.basePrice || 0);

    // 1. PRODUCT RULE PRIORITY
    if (
      product.overrideGlobalReward ||
      product.overrideCategoryReward ||
      (product.rewardPoints !== undefined && product.rewardPoints > 0) ||
      (product.maxRedeemablePoints !== undefined && product.maxRedeemablePoints > 0)
    ) {
      const multiplier = Number(product.rewardMultiplier || 1.0);
      const points = Math.round(Number(product.rewardPoints || 0) * multiplier);
      return {
        productId: product.id,
        earnPoints: product.allowRewardEarning !== false ? points : 0,
        maxRedeemablePoints: product.allowRewardRedemption !== false ? Number(product.maxRedeemablePoints || 0) : 0,
        allowRedemption: product.allowRewardRedemption !== false,
        allowEarning: product.allowRewardEarning !== false,
        appliedRuleType: 'PRODUCT',
      };
    }

    // 2. CATEGORY RULE PRIORITY
    const category = product.category;
    if (category && category.overrideGlobalReward) {
      const catMultiplier = Number(category.rewardMultiplier || 1.0);
      const points = Math.round(Number(category.rewardPointsEarned || 0) * catMultiplier);
      return {
        productId: product.id,
        earnPoints: category.allowRewardEarning !== false ? points : 0,
        maxRedeemablePoints: category.allowRewardRedemption !== false ? Number(category.maxRedeemablePoints || 0) : 0,
        allowRedemption: category.allowRewardRedemption !== false,
        allowEarning: category.allowRewardEarning !== false,
        appliedRuleType: 'CATEGORY',
      };
    }

    // 3. GLOBAL RULE PRIORITY
    const pointsPer100 = Number(globalRule.pointsPer100 || 10);
    const globalPoints = Math.round((basePrice / 100) * pointsPer100);
    const globalMaxRedeem = Math.round(
      (basePrice * Number(globalRule.maxRedeemablePercentPerOrder || 50)) / 100 / Number(globalRule.rewardConversionRate || 0.01)
    );

    return {
      productId: product.id,
      earnPoints: globalPoints,
      maxRedeemablePoints: globalMaxRedeem,
      allowRedemption: true,
      allowEarning: true,
      appliedRuleType: 'GLOBAL',
    };
  }

  /**
   * Calculate rewards for an entire list of cart items
   */
  async calculateCartRewards(items: Array<{ product: any; quantity: number }>): Promise<CalculatedCartRewards> {
    const globalRule = await this.getGlobalRule();
    const conversionRate = Number(globalRule.rewardConversionRate || 0.01);

    let subtotal = 0;
    let totalEarnPoints = 0;
    let maxRedeemablePoints = 0;
    const itemBreakdown: CalculatedProductReward[] = [];

    for (const item of items) {
      const qty = item.quantity || 1;
      const price = Number(item.product?.basePrice || 0);
      subtotal += price * qty;

      const calc = await this.calculateProductReward(item.product);
      itemBreakdown.push(calc);

      if (calc.allowEarning) {
        totalEarnPoints += calc.earnPoints * qty;
      }
      if (calc.allowRedemption) {
        maxRedeemablePoints += calc.maxRedeemablePoints * qty;
      }
    }

    // Cap max redeemable points according to global rule limits
    const globalMaxPoints = Number(globalRule.maxRedeemablePointsPerOrder || 1000);
    const maxPercentAmount = (subtotal * Number(globalRule.maxRedeemablePercentPerOrder || 50)) / 100;
    const maxPercentPoints = Math.floor(maxPercentAmount / conversionRate);

    const finalMaxRedeemablePoints = Math.min(
      maxRedeemablePoints,
      globalMaxPoints,
      maxPercentPoints
    );

    const maxDiscountAmount = finalMaxRedeemablePoints * conversionRate;

    return {
      subtotal,
      totalEarnPoints,
      maxRedeemablePoints: Math.max(0, finalMaxRedeemablePoints),
      maxDiscountAmount,
      conversionRate,
      itemBreakdown,
    };
  }
}

export default new LoyaltyRuleEngine();
