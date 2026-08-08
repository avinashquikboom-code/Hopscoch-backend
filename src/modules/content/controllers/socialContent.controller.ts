import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { SocialContentService } from '../services/socialContent.service';

export class SocialContentController {
  /**
   * Admin: POST /api/admin/content
   * Upload media files and create Play, Post, or Story
   */
  static async createContentPost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      let mediaFiles: Express.Multer.File[] = [];
      let thumbnailFile: Express.Multer.File | undefined = undefined;

      if (Array.isArray(req.files)) {
        mediaFiles = req.files;
      } else if (req.files && typeof req.files === 'object') {
        const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
        mediaFiles = filesMap['media'] || [];
        if (filesMap['thumbnail'] && filesMap['thumbnail'].length > 0) {
          thumbnailFile = filesMap['thumbnail'][0];
        }
      }

      const { type, title, caption, productIds, sortOrder } = req.body;

      let parsedProductIds: number[] = [];
      if (typeof productIds === 'string') {
        try {
          parsedProductIds = JSON.parse(productIds);
        } catch {
          parsedProductIds = productIds.split(',').map((id) => Number(id.trim())).filter(Boolean);
        }
      } else if (Array.isArray(productIds)) {
        parsedProductIds = productIds.map((id) => Number(id));
      }

      const post = await SocialContentService.createContentPost(
        {
          type,
          title,
          caption,
          productIds: parsedProductIds,
          sortOrder: sortOrder ? Number(sortOrder) : 0,
        },
        mediaFiles,
        thumbnailFile
      );

      res.status(201).json({
        success: true,
        message: 'Content created successfully',
        data: post,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: GET /api/admin/content
   * List content posts with filtering & pagination
   */
  static async getAdminContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, isActive, page, limit } = req.query;

      const result = await SocialContentService.getAdminContent({
        type: type as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: PATCH /api/admin/content/:id
   * Update content post properties or tagged products
   */
  static async updateContentPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { title, caption, isActive, sortOrder, productIds, type } = req.body;

      let mediaFiles: Express.Multer.File[] = [];
      let thumbnailFile: Express.Multer.File | undefined = undefined;

      if (Array.isArray(req.files)) {
        mediaFiles = req.files;
      } else if (req.files && typeof req.files === 'object') {
        const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
        mediaFiles = filesMap['media'] || [];
        if (filesMap['thumbnail'] && filesMap['thumbnail'].length > 0) {
          thumbnailFile = filesMap['thumbnail'][0];
        }
      }

      let parsedProductIds: number[] | undefined = undefined;
      if (productIds !== undefined) {
        if (typeof productIds === 'string') {
          try {
            parsedProductIds = JSON.parse(productIds);
          } catch {
            parsedProductIds = productIds.split(',').map((pId) => Number(pId.trim())).filter(Boolean);
          }
        } else if (Array.isArray(productIds)) {
          parsedProductIds = productIds.map((pId) => Number(pId));
        }
      }

      const updated = await SocialContentService.updateContentPost(
        Number(id),
        {
          type,
          title,
          caption,
          isActive: isActive !== undefined ? (isActive === true || isActive === 'true') : undefined,
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
          productIds: parsedProductIds,
        },
        mediaFiles.length > 0 ? mediaFiles : undefined,
        thumbnailFile
      );

      res.status(200).json({
        success: true,
        message: 'Content post updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: DELETE /api/admin/content/:id
   */
  static async deleteContentPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await SocialContentService.deleteContentPost(Number(id));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: GET /api/v1/mobile/content/play
   */
  static async getPlayFeed(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, limit } = req.query;

      const items = await SocialContentService.getPlayFeed(
        userId,
        page ? Number(page) : 1,
        limit ? Number(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: GET /api/v1/mobile/content/posts
   */
  static async getPostsFeed(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page, limit } = req.query;

      const items = await SocialContentService.getPostsFeed(
        userId,
        page ? Number(page) : 1,
        limit ? Number(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: GET /api/v1/mobile/content/stories
   */
  static async getStories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const items = await SocialContentService.getStories(userId);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: POST /api/v1/mobile/content/:id/like
   */
  static async toggleLike(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { id } = req.params;

      const result = await SocialContentService.toggleLike(Number(id), userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: POST /api/v1/mobile/content/:id/view
   */
  static async incrementView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await SocialContentService.incrementView(Number(id));

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: POST /api/v1/mobile/content/:id/comment
   */
  static async addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { id } = req.params;
      const { comment } = req.body;

      const result = await SocialContentService.addComment(Number(id), userId, comment);

      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: GET /api/v1/mobile/content/:id/comments
   */
  static async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      const result = await SocialContentService.getComments(
        Number(id),
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mobile: DELETE /api/v1/mobile/content/comments/:commentId
   */
  static async deleteComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }
      const { commentId } = req.params;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      const result = await SocialContentService.deleteComment(Number(commentId), userId, isAdmin);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

