import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../../middleware/auth';
import loyaltyController from '../controllers/loyalty.controller';

const router = Router();

// ==========================================
// PUBLIC & CALCULATOR ROUTES
// ==========================================
router.get('/rules', loyaltyController.getGlobalRules.bind(loyaltyController));
router.post('/calculate-cart', loyaltyController.calculateCartRewards.bind(loyaltyController));
router.get('/campaigns', loyaltyController.getCampaigns.bind(loyaltyController));

// ==========================================
// CUSTOMER / AUTHENTICATED ROUTES
// ==========================================
router.get('/wallet', authenticate, loyaltyController.getWallet.bind(loyaltyController));
router.post('/wallet/topup', authenticate, loyaltyController.topupWallet.bind(loyaltyController));
router.post('/wallet/load-order', authenticate, loyaltyController.createWalletLoadOrder.bind(loyaltyController));
router.post('/wallet/verify', authenticate, loyaltyController.verifyWalletLoad.bind(loyaltyController));
router.post('/wallet/withdraw', authenticate, loyaltyController.requestWithdrawal.bind(loyaltyController));
router.get('/wallet/withdrawals', authenticate, loyaltyController.getWithdrawals.bind(loyaltyController));
router.get('/summary', authenticate, loyaltyController.getRewardSummary.bind(loyaltyController));
router.get('/referrals', authenticate, loyaltyController.getReferralStats.bind(loyaltyController));
router.get('/rewards/history', authenticate, loyaltyController.getRewardHistory.bind(loyaltyController));
router.get('/cashback', authenticate, loyaltyController.getCashbackData.bind(loyaltyController));
router.get('/gift-cards', authenticate, loyaltyController.getUserGiftCards.bind(loyaltyController));
router.post('/gift-cards/redeem', authenticate, loyaltyController.redeemGiftCard.bind(loyaltyController));
router.post('/daily-reward/claim', authenticate, loyaltyController.claimDailyReward.bind(loyaltyController));
router.get('/transactions', authenticate, loyaltyController.getMasterTransactions.bind(loyaltyController));

// ==========================================
// ADMIN ROUTES
// ==========================================
router.put('/admin/rules', authenticate, authorize('ADMIN'), loyaltyController.updateGlobalRules.bind(loyaltyController));
router.post('/admin/wallet/adjust', authenticate, authorize('ADMIN'), loyaltyController.adminAdjustWallet.bind(loyaltyController));
router.post('/admin/points/adjust', authenticate, authorize('ADMIN'), loyaltyController.adminAdjustPoints.bind(loyaltyController));

// Admin withdrawal management
router.get('/admin/wallet-withdrawals', authenticate, authorize('ADMIN'), loyaltyController.adminListWithdrawals.bind(loyaltyController));
router.patch('/admin/wallet-withdrawals/:id/approve', authenticate, authorize('ADMIN'), loyaltyController.adminApproveWithdrawal.bind(loyaltyController));
router.patch('/admin/wallet-withdrawals/:id/complete', authenticate, authorize('ADMIN'), loyaltyController.adminCompleteWithdrawal.bind(loyaltyController));
router.patch('/admin/wallet-withdrawals/:id/reject', authenticate, authorize('ADMIN'), loyaltyController.adminRejectWithdrawal.bind(loyaltyController));

// Category Rewards Configuration & Reward Rules
router.get(
  ['/admin/category-rewards', '/admin/reward/category-rules', '/admin/rewards/category-rules', '/category-rewards', '/category-rules'],
  authenticate,
  authorize('ADMIN'),
  loyaltyController.getCategoryRewards.bind(loyaltyController)
);
router.post(
  ['/admin/category-rewards', '/admin/reward/category-rules', '/admin/rewards/category-rules', '/category-rewards', '/category-rules'],
  authenticate,
  authorize('ADMIN'),
  loyaltyController.createCategoryReward.bind(loyaltyController)
);
router.put(
  ['/admin/category-rewards/:id', '/admin/reward/category-rules/:id', '/admin/rewards/category-rules/:id', '/category-rewards/:id', '/category-rules/:id'],
  authenticate,
  authorize('ADMIN'),
  loyaltyController.updateCategoryReward.bind(loyaltyController)
);
router.patch(
  ['/admin/category-rewards/:id/status', '/admin/category-rewards/:id/toggle', '/admin/reward/category-rules/:id/status', '/admin/rewards/category-rules/:id/status', '/category-rewards/:id/status'],
  authenticate,
  authorize('ADMIN'),
  loyaltyController.toggleCategoryRewardStatus.bind(loyaltyController)
);
router.delete(
  ['/admin/category-rewards/:id', '/admin/reward/category-rules/:id', '/admin/rewards/category-rules/:id', '/category-rewards/:id', '/category-rules/:id'],
  authenticate,
  authorize('ADMIN'),
  loyaltyController.deleteCategoryReward.bind(loyaltyController)
);

router.get('/admin/product-rewards', authenticate, authorize('ADMIN'), loyaltyController.getProductRewards.bind(loyaltyController));
router.put('/admin/product-rewards/:id', authenticate, authorize('ADMIN'), loyaltyController.updateProductReward.bind(loyaltyController));

router.post('/admin/campaigns', authenticate, authorize('ADMIN'), loyaltyController.createCampaign.bind(loyaltyController));
router.get('/admin/gift-cards', authenticate, authorize('ADMIN'), loyaltyController.listGiftCards.bind(loyaltyController));
router.post('/admin/gift-cards', authenticate, authorize('ADMIN'), loyaltyController.createGiftCard.bind(loyaltyController));
router.get('/admin/analytics', authenticate, authorize('ADMIN'), loyaltyController.getAnalytics.bind(loyaltyController));

export default router;
