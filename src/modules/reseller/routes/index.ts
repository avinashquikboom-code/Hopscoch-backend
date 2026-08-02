import { Router } from 'express';
import { ResellerController } from '../controllers/reseller.controller';
import { authenticate, optionalAuth } from '../../../middleware/auth';

const router = Router();
const resellerController = new ResellerController();

// Create share link (requires user auth)
router.post('/share', authenticate, (req, res, next) => resellerController.createShareLink(req, res, next));

// List reseller's own links (requires user auth)
router.get('/my-links', authenticate, (req, res, next) => resellerController.getMyResellerLinks(req, res, next));

// Resolve share link by code (public/optional auth)
router.get('/share/:shareCode', optionalAuth, (req, res, next) => resellerController.getShareLinkDetails(req, res, next));

export default router;
