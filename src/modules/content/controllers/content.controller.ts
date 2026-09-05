import { Request, Response, NextFunction } from 'express';
import { ContentService } from '../services/content.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';

const contentService = new ContentService();

export class ContentController {
  async getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const policies = await contentService.getStaticContent({ type: 'POLICY' });
      return ResponseFormatter.success(res, 'Policies retrieved successfully', policies);
    } catch (error) {
      return next(error);
    }
  }

  async getPolicyByKey(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const contentList = await contentService.getStaticContent({ key });
      const content = contentList[0];
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
      const existingList = await contentService.getStaticContent({ key });
      let result;
      if (existingList.length > 0) {
        result = await contentService.updateStaticContent(existingList[0].id, {
          title,
          content,
          metaTitle,
          metaDescription,
          isActive: isActive !== undefined ? isActive : true,
          type: 'POLICY',
        });
      } else {
        result = await contentService.createStaticContent({
          key,
          type: 'POLICY',
          title: title || key,
          content: content || '',
          metaTitle,
          metaDescription,
          isActive: isActive !== undefined ? isActive : true,
        });
      }
      return ResponseFormatter.success(res, 'Policy updated successfully', result);
    } catch (error) {
      return next(error);
    }
  }
}

export default new ContentController();
