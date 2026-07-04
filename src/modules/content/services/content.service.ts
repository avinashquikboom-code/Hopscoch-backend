import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class ContentService {
  async createStaticContent(data: {
    key: string;
    type: 'PAGE' | 'FAQ' | 'BLOG' | 'POLICY';
    title: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    isActive: boolean;
  }) {
    const { key, type, title, content, metaTitle, metaDescription, isActive } = data;

    // Check if key already exists
    const existingContent = await prisma.staticContent.findUnique({
      where: { key },
    });

    if (existingContent) {
      throw new AppError('Content with this key already exists', 400);
    }

    const staticContent = await prisma.staticContent.create({
      data: {
        key,
        type,
        title,
        content,
        metaTitle,
        metaDescription,
        isActive,
      },
    });

    logger.info(`Static content created: ${staticContent.id} with key: ${key}`);
    return staticContent;
  }

  async getStaticContent(filters: {
    type?: string;
    key?: string;
    isActive?: boolean;
  }) {
    const { type, key, isActive } = filters;

    const where: any = {};
    if (type) {
      where.type = type;
    }

    if (key) {
      where.key = key;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const content = await prisma.staticContent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return content;
  }

  async getStaticContentById(contentId: string) {
    const content = await prisma.staticContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new AppError('Content not found', 404);
    }

    return content;
  }

  async updateStaticContent(contentId: string, data: {
    key?: string;
    type?: 'PAGE' | 'FAQ' | 'BLOG' | 'POLICY';
    title?: string;
    content?: string;
    metaTitle?: string;
    metaDescription?: string;
    isActive?: boolean;
  }) {
    const { key, type, title, content, metaTitle, metaDescription, isActive } = data;

    const existingContent = await prisma.staticContent.findUnique({
      where: { id: contentId },
    });

    if (!existingContent) {
      throw new AppError('Content not found', 404);
    }

    if (key && key !== existingContent.key) {
      const keyExists = await prisma.staticContent.findUnique({
        where: { key },
      });

      if (keyExists) {
        throw new AppError('Content with this key already exists', 400);
      }
    }

    const updatedContent = await prisma.staticContent.update({
      where: { id: contentId },
      data: {
        key,
        type,
        title,
        content,
        metaTitle,
        metaDescription,
        isActive,
      },
    });

    logger.info(`Static content updated: ${contentId}`);
    return updatedContent;
  }

  async deleteStaticContent(contentId: string) {
    const content = await prisma.staticContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new AppError('Content not found', 404);
    }

    await prisma.staticContent.update({
      where: { id: contentId },
      data: {
        isActive: false,
      },
    });

    logger.info(`Static content deleted: ${contentId}`);
    return { message: 'Content deleted successfully' };
  }

  async createContactRequest(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) {
    const { name, email, phone, subject, message } = data;

    const contactRequest = await prisma.contactRequest.create({
      data: {
        name,
        email,
        phone,
        subject,
        message,
      },
    });

    logger.info(`Contact request created: ${contactRequest.id} from ${email}`);
    return contactRequest;
  }

  async getContactRequests(filters: {
    page: number;
    limit: number;
    status?: string;
  }) {
    const { page, limit, status } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contactRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContactRequestById(requestId: string) {
    const request = await prisma.contactRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError('Contact request not found', 404);
    }

    return request;
  }

  async updateContactRequest(requestId: string, data: {
    status?: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
    response?: string;
  }) {
    const { status, response } = data;

    const request = await prisma.contactRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError('Contact request not found', 404);
    }

    const updatedRequest = await prisma.contactRequest.update({
      where: { id: requestId },
      data: {
        status,
        response,
      },
    });

    logger.info(`Contact request updated: ${requestId}`);
    return updatedRequest;
  }
}

export default new ContentService();
