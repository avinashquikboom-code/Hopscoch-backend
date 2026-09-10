import { Request, Response, NextFunction } from 'express';
import policyService from '../services/policy.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';

export class PolicyController {
  // =========================================================================
  // PUBLIC / CUSTOMER ENDPOINTS
  // =========================================================================

  async getPolicyCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await policyService.getPublicCategories();
      return ResponseFormatter.success(res, 'Policy categories retrieved successfully', categories);
    } catch (error) {
      return next(error);
    }
  }

  async getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const policies = await policyService.getPublicPolicies();
      return ResponseFormatter.success(res, 'Policies retrieved successfully', policies);
    } catch (error) {
      return next(error);
    }
  }

  async getPolicyBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const policy = await policyService.getPublicPolicyBySlug(slug);
      if (!policy) {
        return ResponseFormatter.error(res, `Policy with slug '${slug}' not found`, 404);
      }
      return ResponseFormatter.success(res, 'Policy retrieved successfully', policy);
    } catch (error) {
      return next(error);
    }
  }

  // =========================================================================
  // ADMIN CATEGORY ENDPOINTS
  // =========================================================================

  async adminGetPolicyCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await policyService.adminGetCategories();
      return ResponseFormatter.success(res, 'Admin categories retrieved successfully', categories);
    } catch (error) {
      return next(error);
    }
  }

  async adminCreatePolicyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, slug, description, isActive, sortOrder } = req.body;
      if (!name || !name.trim()) {
        return ResponseFormatter.error(res, 'Category name is required', 400);
      }
      const category = await policyService.adminCreateCategory({
        name: name.trim(),
        slug,
        description,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      });
      return ResponseFormatter.success(res, 'Policy category created successfully', category, 201);
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdatePolicyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, slug, description, isActive, sortOrder } = req.body;
      const category = await policyService.adminUpdateCategory(Number(id), {
        name: name ? name.trim() : undefined,
        slug,
        description,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      });
      return ResponseFormatter.success(res, 'Policy category updated successfully', category);
    } catch (error) {
      return next(error);
    }
  }

  async adminDeletePolicyCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await policyService.adminDeleteCategory(Number(id));
      return ResponseFormatter.success(res, result.message, result);
    } catch (error) {
      return next(error);
    }
  }

  // =========================================================================
  // ADMIN POLICY ENDPOINTS
  // =========================================================================

  async adminGetPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const policies = await policyService.adminGetPolicies();
      return ResponseFormatter.success(res, 'Admin policies retrieved successfully', policies);
    } catch (error) {
      return next(error);
    }
  }

  async adminGetPolicyById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const policy = await policyService.adminGetPolicyById(Number(id));
      return ResponseFormatter.success(res, 'Policy retrieved successfully', policy);
    } catch (error) {
      return next(error);
    }
  }

  async adminCreatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryId, title, slug, content, metaTitle, metaDescription, isActive } = req.body;
      if (!categoryId) {
        return ResponseFormatter.error(res, 'Category ID is required', 400);
      }
      if (!title || !title.trim()) {
        return ResponseFormatter.error(res, 'Policy title is required', 400);
      }
      if (!content || !content.trim()) {
        return ResponseFormatter.error(res, 'Policy content is required', 400);
      }

      const policy = await policyService.adminCreatePolicy({
        categoryId: Number(categoryId),
        title: title.trim(),
        slug,
        content: content.trim(),
        metaTitle,
        metaDescription,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });
      return ResponseFormatter.success(res, 'Policy created successfully', policy, 201);
    } catch (error) {
      return next(error);
    }
  }

  async adminUpdatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { categoryId, title, slug, content, metaTitle, metaDescription, isActive } = req.body;

      const policy = await policyService.adminUpdatePolicy(Number(id), {
        categoryId: categoryId !== undefined ? Number(categoryId) : undefined,
        title: title ? title.trim() : undefined,
        slug,
        content: content ? content.trim() : undefined,
        metaTitle,
        metaDescription,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      });
      return ResponseFormatter.success(res, 'Policy updated successfully', policy);
    } catch (error) {
      return next(error);
    }
  }

  async adminDeletePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await policyService.adminDeletePolicy(Number(id));
      return ResponseFormatter.success(res, result.message, result);
    } catch (error) {
      return next(error);
    }
  }
}

export default new PolicyController();
