import { Router } from 'express';
import policyController from '../controllers/policy.controller';
import { authenticate, authorize } from '../../../middleware/auth';

const router = Router();

// =========================================================================
// PUBLIC / CUSTOMER ROUTES
// =========================================================================

// Categories
router.get('/policy-categories', policyController.getPolicyCategories.bind(policyController));

// Policies
router.get('/policies', policyController.getPolicies.bind(policyController));
router.get('/policies/:slug', policyController.getPolicyBySlug.bind(policyController));

// =========================================================================
// ADMIN ROUTES
// =========================================================================

// Admin Categories
router.get(
  '/admin/policy-categories',
  authenticate,
  authorize('ADMIN'),
  policyController.adminGetPolicyCategories.bind(policyController)
);
router.post(
  '/admin/policy-categories',
  authenticate,
  authorize('ADMIN'),
  policyController.adminCreatePolicyCategory.bind(policyController)
);
router.put(
  '/admin/policy-categories/:id',
  authenticate,
  authorize('ADMIN'),
  policyController.adminUpdatePolicyCategory.bind(policyController)
);
router.delete(
  '/admin/policy-categories/:id',
  authenticate,
  authorize('ADMIN'),
  policyController.adminDeletePolicyCategory.bind(policyController)
);

// Admin Policies
router.get(
  '/admin/policies',
  authenticate,
  authorize('ADMIN'),
  policyController.adminGetPolicies.bind(policyController)
);
router.get(
  '/admin/policies/:id',
  authenticate,
  authorize('ADMIN'),
  policyController.adminGetPolicyById.bind(policyController)
);
router.post(
  '/admin/policies',
  authenticate,
  authorize('ADMIN'),
  policyController.adminCreatePolicy.bind(policyController)
);
router.put(
  '/admin/policies/:id',
  authenticate,
  authorize('ADMIN'),
  policyController.adminUpdatePolicy.bind(policyController)
);
router.delete(
  '/admin/policies/:id',
  authenticate,
  authorize('ADMIN'),
  policyController.adminDeletePolicy.bind(policyController)
);

export default router;
