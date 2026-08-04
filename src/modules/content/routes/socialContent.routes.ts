import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../../middleware/auth';
import { upload } from '../../../middleware/upload';
import { SocialContentController } from '../controllers/socialContent.controller';

const router = Router();

// =====================================================================
// ADMIN CONTENT MANAGEMENT ROUTES
// =====================================================================

router.post(
  '/admin/content',
  authenticate,
  authorize('ADMIN'),
  upload.array('media', 10),
  SocialContentController.createContentPost
);

router.get(
  '/admin/content',
  authenticate,
  authorize('ADMIN'),
  SocialContentController.getAdminContent
);

router.patch(
  '/admin/content/:id',
  authenticate,
  authorize('ADMIN'),
  SocialContentController.updateContentPost
);

router.delete(
  '/admin/content/:id',
  authenticate,
  authorize('ADMIN'),
  SocialContentController.deleteContentPost
);

// =====================================================================
// MOBILE USER CONTENT ROUTES
// =====================================================================

router.get(
  '/v1/mobile/content/play',
  optionalAuth,
  SocialContentController.getPlayFeed
);

router.get(
  '/v1/mobile/content/posts',
  optionalAuth,
  SocialContentController.getPostsFeed
);

router.get(
  '/v1/mobile/content/stories',
  optionalAuth,
  SocialContentController.getStories
);

router.post(
  '/v1/mobile/content/:id/like',
  authenticate,
  SocialContentController.toggleLike
);

router.post(
  '/v1/mobile/content/:id/view',
  SocialContentController.incrementView
);

router.post(
  '/v1/mobile/content/:id/comment',
  authenticate,
  SocialContentController.addComment
);

router.get(
  '/v1/mobile/content/:id/comments',
  SocialContentController.getComments
);

router.delete(
  '/v1/mobile/content/comments/:commentId',
  authenticate,
  SocialContentController.deleteComment
);

export default router;

