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
router.get('/summary', authenticate, loyaltyController.getRewardSummary.bind(loyaltyController));
router.get('/referrals', authenticate, loyaltyController.getReferralStats.bind(loyaltyController));
router.post('/gift-cards/redeem', authenticate, loyaltyController.redeemGiftCard.bind(loyaltyController));
router.get('/transactions', authenticate, loyaltyController.getMasterTransactions.bind(loyaltyController));

// ==========================================
// ADMIN ROUTES
// ==========================================
router.put('/admin/rules', authenticate, authorize('ADMIN'), loyaltyController.updateGlobalRules.bind(loyaltyController));
router.post('/admin/wallet/adjust', authenticate, authorize('ADMIN'), loyaltyController.adminAdjustWallet.bind(loyaltyController));
router.post('/admin/points/adjust', authenticate, authorize('ADMIN'), loyaltyController.adminAdjustPoints.bind(loyaltyController));

router.get('/admin/category-rewards', authenticate, authorize('ADMIN'), loyaltyController.getCategoryRewards.bind(loyaltyController));
router.put('/admin/category-rewards/:id', authenticate, authorize('ADMIN'), loyaltyController.updateCategoryReward.bind(loyaltyController));

router.get('/admin/product-rewards', authenticate, authorize('ADMIN'), loyaltyController.getProductRewards.bind(loyaltyController));
router.put('/admin/product-rewards/:id', authenticate, authorize('ADMIN'), loyaltyController.updateProductReward.bind(loyaltyController));

router.post('/admin/campaigns', authenticate, authorize('ADMIN'), loyaltyController.createCampaign.bind(loyaltyController));
router.get('/admin/gift-cards', authenticate, authorize('ADMIN'), loyaltyController.listGiftCards.bind(loyaltyController));
router.post('/admin/gift-cards', authenticate, authorize('ADMIN'), loyaltyController.createGiftCard.bind(loyaltyController));
router.get('/admin/analytics', authenticate, authorize('ADMIN'), loyaltyController.getAnalytics.bind(loyaltyController));

export default router;
