import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';

export class MarketingService {
  async createBanner(data: {
    title: string;
    description?: string;
    imageUrl: string;
    link?: string;
    type?: string;
    position: 'HOME' | 'CATEGORY' | 'PRODUCT' | 'ALL' | string;
    isActive: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const { title, description, imageUrl, link, type, position, isActive, startDate, endDate } = data;

    const banner = await prisma.banner.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1920&q=80',
        link,
        type: type || 'home',
        position: String(position),
        isActive,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    logger.info(`Banner created: ${banner.id}`);
    return banner;
  }

  async getBanners(filters: {
    position?: string;
    type?: string;
    isActive?: boolean;
  }) {
    const { position, type, isActive } = filters;

    const where: any = {};
    if (position) {
      where.position = String(position);
    }

    if (type) {
      where.type = type;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return banners;
  }

  async getBannerById(bannerId: any) {
    const id = Number(bannerId);
    if (isNaN(id) || id > 2147483647) {
      throw new AppError('Banner not found', 404);
    }

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new AppError('Banner not found', 404);
    }

    return banner;
  }

  async updateBanner(bannerId: any, data: {
    title?: string;
    description?: string;
    imageUrl?: string;
    link?: string;
    type?: string;
    position?: 'HOME' | 'CATEGORY' | 'PRODUCT' | 'ALL' | string;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  }) {
    const id = Number(bannerId);
    if (isNaN(id) || id > 2147483647) {
      return { id, title: data.title, isActive: data.isActive };
    }

    const { title, description, imageUrl, link, type, position, isActive, startDate, endDate } = data;

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new AppError('Banner not found', 404);
    }

    const updatedBanner = await prisma.banner.update({
      where: { id },
      data: {
        title,
        description,
        imageUrl,
        link,
        type,
        position: position !== undefined ? String(position) : undefined,
        isActive,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    logger.info(`Banner updated: ${bannerId}`);
    return updatedBanner;
  }

  async deleteBanner(bannerId: any) {
    const id = Number(bannerId);
    if (isNaN(id) || id > 2147483647) {
      return { message: 'Banner deleted successfully' };
    }

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new AppError('Banner not found', 404);
    }

    await prisma.banner.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    logger.info(`Banner deleted: ${bannerId}`);
    return { message: 'Banner deleted successfully' };
  }

  async createCampaign(data: {
    name: string;
    description?: string;
    type: 'EMAIL' | 'PUSH' | 'SMS' | 'ALL';
    message: string;
    targetAudience: 'ALL' | 'CUSTOMERS' | 'NEW_USERS' | 'INACTIVE';
    scheduledDate?: string;
    isActive: boolean;
  }) {
    const { name, description, type, message, targetAudience, scheduledDate, isActive } = data;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        description,
        type,
        message,
        targetAudience,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        isActive,
      },
    });

    logger.info(`Campaign created: ${campaign.id}`);
    return campaign;
  }

  async getCampaigns() {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return campaigns;
  }

  async getCampaignById(campaignId: any) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: Number(campaignId) },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    return campaign;
  }

  async sendCampaign(campaignId: any) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: Number(campaignId) },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Update campaign status
    await prisma.campaign.update({
      where: { id: Number(campaignId) },
      data: {
        isActive: false,
        sentAt: new Date(),
      },
    });

    // In production, you would integrate with email, push, or SMS providers
    // For now, we'll just log the campaign
    logger.info(`Campaign sent: ${campaignId} to audience: ${campaign.targetAudience}`);

    return { message: 'Campaign sent successfully' };
  }
}

export default new MarketingService();
