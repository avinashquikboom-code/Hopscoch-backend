import { Request, Response, NextFunction } from 'express';
import { ContentService } from '../services/content.service';
import policyService from '../services/policy.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const contentService = new ContentService();

export class ContentController {
  async getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      let policies: any[] = [];
      try {
        policies = await contentService.getStaticContent({ type: 'POLICY' });
      } catch {
        policies = [];
      }

      if (!policies || policies.length === 0) {
        const dynamicPolicies = await policyService.getPublicPolicies();
        policies = dynamicPolicies.map((p) => ({
          id: p.id,
          key: p.slug,
          type: 'POLICY',
          title: p.title,
          content: p.content,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
      }

      return ResponseFormatter.success(res, 'Policies retrieved successfully', policies);
    } catch (error) {
      return next(error);
    }
  }

  async getPolicyByKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      let content: any = null;
      try {
        const contentList = await contentService.getStaticContent({ key });
        content = contentList[0];
      } catch {
        content = null;
      }

      if (!content) {
        const dynamicPolicy = await policyService.getPublicPolicyBySlug(key);
        if (dynamicPolicy) {
          content = {
            id: dynamicPolicy.id,
            key: dynamicPolicy.slug,
            type: 'POLICY',
            title: dynamicPolicy.title,
            content: dynamicPolicy.content,
            metaTitle: dynamicPolicy.metaTitle,
            metaDescription: dynamicPolicy.metaDescription,
            isActive: dynamicPolicy.isActive,
            createdAt: dynamicPolicy.createdAt,
            updatedAt: dynamicPolicy.updatedAt,
          };
        }
      }

      if (!content) {
        return ResponseFormatter.error(res, 'Policy not found', 404);
      }
      return ResponseFormatter.success(res, 'Policy retrieved successfully', content);
    } catch (error) {
      return next(error);
    }
  }

  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const { title, content, metaTitle, metaDescription, isActive } = req.body;

      // Update in policyService
      const existingPolicy = await policyService.getPublicPolicyBySlug(key);
      let dynamicResult;
      if (existingPolicy) {
        dynamicResult = await policyService.adminUpdatePolicy(existingPolicy.id, {
          title,
          content,
          metaTitle,
          metaDescription,
          isActive,
        });
      } else {
        const categories = await policyService.adminGetCategories();
        const defaultCategory = categories[0] || await policyService.adminCreateCategory({
          name: 'General Policies',
          slug: 'general-policies',
        });
        dynamicResult = await policyService.adminCreatePolicy({
          categoryId: defaultCategory.id,
          title: title || key,
          slug: key,
          content: content || '',
          metaTitle,
          metaDescription,
          isActive,
        });
      }

      // Also try updating legacy static content if DB is available
      try {
        const existingList = await contentService.getStaticContent({ key });
        if (existingList.length > 0) {
          await contentService.updateStaticContent(existingList[0].id, {
            title,
            content,
            metaTitle,
            metaDescription,
            isActive: isActive !== undefined ? isActive : true,
            type: 'POLICY',
          });
        } else {
          await contentService.createStaticContent({
            key,
            type: 'POLICY',
            title: title || key,
            content: content || '',
            metaTitle,
            metaDescription,
            isActive: isActive !== undefined ? isActive : true,
          });
        }
      } catch {
        // Ignore staticContent errors if not present
      }

      return ResponseFormatter.success(res, 'Policy updated successfully', dynamicResult);
    } catch (error) {
      return next(error);
    }
  }
}

export default new ContentController();
