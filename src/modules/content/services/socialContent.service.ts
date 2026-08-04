import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import { uploadToS3 } from '../../../services/s3.service';

export interface CreateContentPostInput {
  type: 'PLAY' | 'POST' | 'STORY';
  title?: string;
  caption?: string;
  productIds?: number[];
  sortOrder?: number;
  thumbnailUrl?: string;
}

export class SocialContentService {
  /**
   * Admin: Upload and create a new content post (PLAY, POST, or STORY)
   */
  static async createContentPost(
    input: CreateContentPostInput,
    files: Array<{
      buffer?: Buffer;
      originalname?: string;
      mimetype?: string;
      size?: number;
    }>
  ) {
    const { type, title, caption, productIds = [], sortOrder = 0 } = input;

    if (!type || !['PLAY', 'POST', 'STORY'].includes(type)) {
      throw new AppError('Invalid content type. Must be PLAY, POST, or STORY', 400);
    }

    if (!files || files.length === 0) {
      throw new AppError('At least one media file is required', 400);
    }

    // Type-specific validations
    if (type === 'PLAY') {
      if (files.length > 1) {
        throw new AppError('PLAY content accepts only a single video file', 400);
      }
      const file = files[0];
      if (!file.mimetype?.startsWith('video/')) {
        throw new AppError('PLAY content must be a video file', 400);
      }
      if (file.size && file.size > 50 * 1024 * 1024) {
        throw new AppError('PLAY video size must not exceed 50MB', 400);
      }
    } else if (type === 'STORY') {
      if (files.length > 1) {
        throw new AppError('STORY content accepts only a single image or video file', 400);
      }
      const file = files[0];
      const isVideo = file.mimetype?.startsWith('video/');
      const isImage = file.mimetype?.startsWith('image/');
      if (!isVideo && !isImage) {
        throw new AppError('STORY content must be an image or video file', 400);
      }
      if (isImage && file.size && file.size > 5 * 1024 * 1024) {
        throw new AppError('STORY image size must not exceed 5MB', 400);
      }
      if (isVideo && file.size && file.size > 20 * 1024 * 1024) {
        throw new AppError('STORY video size must not exceed 20MB', 400);
      }
    } else if (type === 'POST') {
      if (files.length > 10) {
        throw new AppError('POST carousel accepts a maximum of 10 images', 400);
      }
      for (const file of files) {
        if (!file.mimetype?.startsWith('image/')) {
          throw new AppError('POST content must consist of image files', 400);
        }
        if (file.size && file.size > 5 * 1024 * 1024) {
          throw new AppError('Each POST image must not exceed 5MB', 400);
        }
      }
    }

    // Upload files to S3
    const mediaUrls: string[] = [];
    for (const file of files) {
      const url = await uploadToS3(file, `content/${type.toLowerCase()}`);
      mediaUrls.push(url);
    }

    const firstFile = files[0];
    const mediaType = firstFile.mimetype?.startsWith('video/') ? 'VIDEO' : 'IMAGE';

    // STORY expires after 24 hours
    let expiresAt: Date | null = null;
    if (type === 'STORY') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Create record in database
    const contentPost = await prisma.contentPost.create({
      data: {
        type,
        title: title || null,
        caption: caption || null,
        mediaUrls,
        mediaType,
        thumbnailUrl: input.thumbnailUrl || (mediaType === 'IMAGE' ? mediaUrls[0] : null),
        sortOrder: Number(sortOrder) || 0,
        expiresAt,
        products: {
          create: productIds.map((pId) => ({
            productId: Number(pId),
          })),
        },
      },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                basePrice: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        },
      },
    });

    logger.info(`Created ContentPost ID ${contentPost.id} [${type}]`);
    return this.formatPostResponse(contentPost, null);
  }

  /**
   * Admin: List all content posts with filters
   */
  static async getAdminContent(params: {
    type?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.type && ['PLAY', 'POST', 'STORY'].includes(params.type)) {
      where.type = params.type;
    }
    if (params.isActive !== undefined) {
      where.isActive = Boolean(params.isActive);
    }

    const [items, total] = await Promise.all([
      prisma.contentPost.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true,
                  basePrice: true,
                  discountType: true,
                  discountValue: true,
                },
              },
            },
          },
        },
      }),
      prisma.contentPost.count({ where }),
    ]);

    return {
      items: items.map((item) => this.formatPostResponse(item, null)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Update content post details (active status, sort order, caption, products)
   */
  static async updateContentPost(
    id: number,
    data: {
      title?: string;
      caption?: string;
      isActive?: boolean;
      sortOrder?: number;
      productIds?: number[];
    }
  ) {
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError('Content post not found', 404);
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.caption !== undefined) updateData.caption = data.caption;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);

    // If productIds provided, update tagged products
    if (Array.isArray(data.productIds)) {
      await prisma.contentPostProduct.deleteMany({ where: { contentPostId: id } });
      updateData.products = {
        create: data.productIds.map((pId) => ({
          productId: Number(pId),
        })),
      };
    }

    const updated = await prisma.contentPost.update({
      where: { id },
      data: updateData,
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                basePrice: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        },
      },
    });

    return this.formatPostResponse(updated, null);
  }

  /**
   * Admin: Delete a content post
   */
  static async deleteContentPost(id: number) {
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError('Content post not found', 404);
    }

    await prisma.contentPost.delete({ where: { id } });
    return { success: true, message: 'Content post deleted successfully' };
  }

  /**
   * Mobile: Get PLAY vertical video feed (paginated)
   */
  static async getPlayFeed(userId?: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const items = await prisma.contentPost.findMany({
      where: {
        type: 'PLAY',
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                basePrice: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        },
        likes: userId ? { where: { userId } } : false,
        _count: { select: { comments: true } },

      },
    });

    return items.map((item) => this.formatPostResponse(item, userId));
  }

  /**
   * Mobile: Get POSTS image/carousel feed (paginated)
   */
  static async getPostsFeed(userId?: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const items = await prisma.contentPost.findMany({
      where: {
        type: { in: ['POST', 'PLAY'] },
        isActive: true,
      },

      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                basePrice: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        },
        likes: userId ? { where: { userId } } : false,
        _count: { select: { comments: true } },

      },
    });

    return items.map((item) => this.formatPostResponse(item, userId));
  }

  /**
   * Mobile: Get active non-expired STORIES for top avatar bar
   */
  static async getStories(userId?: number) {
    const now = new Date();

    let items = await prisma.contentPost.findMany({
      where: {
        type: 'STORY',
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnailUrl: true,
                basePrice: true,
                discountType: true,
                discountValue: true,
              },
            },
          },
        },
        likes: userId ? { where: { userId } } : false,
        _count: { select: { comments: true } },
      },
    });

    if (items.length < 10) {
      const existingIds = items.map((i) => i.id);
      const fillerItems = await prisma.contentPost.findMany({
        where: {
          id: { notIn: existingIds },
          type: { in: ['PLAY', 'POST'] },
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 10 - items.length,
        include: {
          products: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  thumbnailUrl: true,
                  basePrice: true,
                  discountType: true,
                  discountValue: true,
                },
              },
            },
          },
          likes: userId ? { where: { userId } } : false,
          _count: { select: { comments: true } },
        },
      });

      items = [...items, ...fillerItems];
    }

    return items.map((item) => this.formatPostResponse(item, userId));
  }


  /**
   * Mobile: Toggle like for a content post
   */
  static async toggleLike(contentPostId: number, userId: number) {
    const post = await prisma.contentPost.findUnique({ where: { id: contentPostId } });
    if (!post) {
      throw new AppError('Content post not found', 404);
    }

    const existingLike = await prisma.contentPostLike.findUnique({
      where: {
        contentPostId_userId: {
          contentPostId,
          userId,
        },
      },
    });

    let isLiked = false;
    let newLikeCount = post.likeCount;

    if (existingLike) {
      await prisma.contentPostLike.delete({
        where: { id: existingLike.id },
      });
      newLikeCount = Math.max(0, post.likeCount - 1);
      await prisma.contentPost.update({
        where: { id: contentPostId },
        data: { likeCount: newLikeCount },
      });
      isLiked = false;
    } else {
      await prisma.contentPostLike.create({
        data: {
          contentPostId,
          userId,
        },
      });
      newLikeCount = post.likeCount + 1;
      await prisma.contentPost.update({
        where: { id: contentPostId },
        data: { likeCount: newLikeCount },
      });
      isLiked = true;
    }

    return { isLiked, likeCount: newLikeCount };
  }

  /**
   * Mobile: Increment view count for a content post
   */
  static async incrementView(contentPostId: number) {
    const post = await prisma.contentPost.update({
      where: { id: contentPostId },
      data: {
        viewCount: { increment: 1 },
      },
      select: { id: true, viewCount: true },
    });

    return post;
  }

  /**
   * Helper method to format post response consistently with tagged products, like status, and comment count
   */
  private static formatPostResponse(item: any, userId?: number | null) {
    const isLiked = Array.isArray(item.likes) ? item.likes.length > 0 : false;
    const commentCount = item._count?.comments ?? (Array.isArray(item.comments) ? item.comments.length : 0);
    const taggedProducts = (item.products || []).map((cpProduct: any) => {
      const p = cpProduct.product;
      let finalPrice = Number(p.basePrice || 0);
      if (p.discountType === 'PERCENTAGE' && p.discountValue) {
        finalPrice = finalPrice - (finalPrice * Number(p.discountValue)) / 100;
      } else if (p.discountType === 'FLAT' && p.discountValue) {
        finalPrice = Math.max(0, finalPrice - Number(p.discountValue));
      }

      return {
        id: p.id,
        name: p.name,
        thumbnailUrl: p.thumbnailUrl,
        basePrice: Number(p.basePrice),
        price: finalPrice,
      };
    });

    return {
      id: item.id,
      type: item.type,
      title: item.title,
      caption: item.caption,
      mediaUrls: item.mediaUrls,
      mediaType: item.mediaType,
      thumbnailUrl: item.thumbnailUrl || (item.mediaUrls && item.mediaUrls[0]) || null,
      uploadedBy: item.uploadedBy,
      isActive: item.isActive,
      viewCount: item.viewCount,
      likeCount: item.likeCount,
      commentCount,
      sortOrder: item.sortOrder,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      isLiked,
      taggedProducts,
    };
  }

  /**
   * Mobile: Add a comment to a content post
   */
  static async addComment(contentPostId: number, userId: number, commentText: string) {
    if (!commentText || !commentText.trim()) {
      throw new AppError('Comment text cannot be empty', 400);
    }

    const post = await prisma.contentPost.findUnique({ where: { id: contentPostId } });
    if (!post) {
      throw new AppError('Content post not found', 404);
    }

    const comment = await prisma.contentPostComment.create({
      data: {
        contentPostId,
        userId,
        comment: commentText.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const commentCount = await prisma.contentPostComment.count({ where: { contentPostId } });

    return {
      id: comment.id,
      contentPostId: comment.contentPostId,
      userId: comment.userId,
      userName: `${comment.user.firstName || 'User'} ${comment.user.lastName || ''}`.trim(),
      userAvatar: comment.user.avatarUrl || null,
      comment: comment.comment,
      createdAt: comment.createdAt,
      commentCount,
    };
  }

  /**
   * Mobile: Get paginated comments for a content post
   */
  static async getComments(contentPostId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const comments = await prisma.contentPostComment.findMany({
      where: { contentPostId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const totalCount = await prisma.contentPostComment.count({ where: { contentPostId } });

    return {
      totalCount,
      page,
      limit,
      comments: comments.map((c) => ({
        id: c.id,
        contentPostId: c.contentPostId,
        userId: c.userId,
        userName: `${c.user.firstName || 'User'} ${c.user.lastName || ''}`.trim(),
        userAvatar: c.user.avatarUrl || null,
        comment: c.comment,
        createdAt: c.createdAt,
      })),
    };
  }

  /**
   * Mobile/Admin: Delete a comment
   */
  static async deleteComment(commentId: number, userId: number, isAdmin: boolean = false) {
    const comment = await prisma.contentPostComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    if (!isAdmin && comment.userId !== userId) {
      throw new AppError('Not authorized to delete this comment', 403);
    }

    await prisma.contentPostComment.delete({ where: { id: commentId } });
    const commentCount = await prisma.contentPostComment.count({ where: { contentPostId: comment.contentPostId } });

    return { success: true, message: 'Comment deleted successfully', commentCount };
  }
}

