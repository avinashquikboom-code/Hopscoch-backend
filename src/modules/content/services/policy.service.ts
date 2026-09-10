import prisma from '../../../utils/prisma';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';

export interface PolicyCategoryData {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  policies?: PolicyData[];
}

export interface PolicyData {
  id: number;
  categoryId: number;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  title: string;
  slug: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Default Seed Categories
const INITIAL_CATEGORIES: Array<{
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}> = [
  { id: 1, name: 'Privacy Policy', slug: 'privacy-policy', description: 'User data protection, privacy terms and disclosures', sortOrder: 1, isActive: true },
  { id: 2, name: 'Terms & Conditions', slug: 'terms-and-conditions', description: 'General terms of website and mobile app usage', sortOrder: 2, isActive: true },
  { id: 3, name: 'Return & Refund Policy', slug: 'return-refund-policy', description: 'Product returns, inspection, replacements, and refund terms', sortOrder: 3, isActive: true },
  { id: 4, name: 'Shipping Policy', slug: 'shipping-policy', description: 'Dispatch timelines, courier partners, and delivery guidelines', sortOrder: 4, isActive: true },
  { id: 5, name: 'Cancellation Policy', slug: 'cancellation-policy', description: 'Order cancellation rules before and after dispatch', sortOrder: 5, isActive: true },
  { id: 6, name: 'Payment Policy', slug: 'payment-policy', description: 'Accepted payment methods, COD terms, and transaction security', sortOrder: 6, isActive: true },
  { id: 7, name: 'About Us', slug: 'about-us', description: 'Company history, mission, values, and seller information', sortOrder: 7, isActive: true },
];

// Default Seed Policies with verified company information
const INITIAL_POLICIES: Array<{
  id: number;
  categoryId: number;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
}> = [
  {
    id: 1,
    categoryId: 1,
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    content: `<h3>1. Introduction</h3>
<p>Fashion City India Ltd ("we", "our", or "us") is dedicated to safeguarding your privacy and ensuring your personal information is protected. This Privacy Policy details how we collect, use, disclose, and secure your information when you access or make a purchase from our website or mobile application.</p>

<h3>2. Information We Collect</h3>
<ul>
  <li><strong>Personal Identification:</strong> Name, delivery address, billing address, email address, phone number, and account credentials.</li>
  <li><strong>Transaction Details:</strong> Payment transaction references, order history, and saved delivery preferences.</li>
  <li><strong>Device and Usage:</strong> IP address, device identifier, browser type, and navigation activity.</li>
</ul>

<h3>3. How We Use Your Data</h3>
<p>We process your personal information to fulfill orders, process payments, coordinate shipments, communicate order tracking, prevent fraudulent transactions, and comply with statutory obligations under Indian law.</p>

<h3>4. Data Security & Storage</h3>
<p>We implement industry-standard encryption, SSL protocols, and restricted-access servers to protect your data. We do not sell or lease your personal information to third parties for marketing purposes.</p>

<h3>5. Contact Information & Grievance Redressal</h3>
<p>For inquiries, updates, or grievances regarding your personal data, please contact:<br/>
<strong>Company:</strong> Fashion City India Ltd<br/>
<strong>Address:</strong> F/7 Jethabhai Park, Narayan Nagar Road, Paldi, Ahmedabad, Gujarat - 380007, India<br/>
<strong>Email:</strong> fashioncityinidia18@gmail.com<br/>
<strong>Phone:</strong> +91 96015 11596</p>`,
    isActive: true,
  },
  {
    id: 2,
    categoryId: 2,
    title: 'Terms & Conditions',
    slug: 'terms-and-conditions',
    content: `<h3>1. Acceptance of Terms</h3>
<p>By browsing, accessing, or placing an order on our platform, you confirm your acceptance of these Terms and Conditions established by Fashion City India Ltd.</p>

<h3>2. User Eligibility & Account Responsibility</h3>
<p>You must be at least 18 years of age or using the service under parental supervision. You are solely responsible for maintaining the confidentiality of your account credentials and password.</p>

<h3>3. Pricing, Orders, and Availability</h3>
<p>All prices listed on our platform are in Indian Rupees (INR) and inclusive of all applicable Goods and Services Tax (GST: 24GUKPS9446A1ZA). We reserve the right to modify prices or cancel orders in cases of pricing typographical errors or unexpected inventory depletion.</p>

<h3>4. Intellectual Property</h3>
<p>All trademarks, graphics, logos, product imagery, and software code remain the exclusive property of Fashion City India Ltd.</p>

<h3>5. Governing Law & Jurisdiction</h3>
<p>These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of these terms shall be subject to the exclusive jurisdiction of the courts in Ahmedabad, Gujarat, India.</p>`,
    isActive: true,
  },
  {
    id: 3,
    categoryId: 3,
    title: 'Return & Refund Policy',
    slug: 'return-refund-policy',
    content: `<h3>1. Return Eligibility Window</h3>
<p>Customers can request a return within <strong>7 calendar days</strong> of receiving the delivery for eligible clothing and fashion accessories.</p>

<h3>2. Condition Requirements</h3>
<p>Returned items must be unused, unwashed, unaltered, and returned in their original packaging with all brand tags and barcodes intact.</p>

<h3>3. Return Process</h3>
<ul>
  <li>Submit a return request via the <em>My Orders</em> section on our mobile app or website.</li>
  <li>Our authorized courier partner will schedule a reverse pickup from your registered address within 24 to 48 hours.</li>
  <li>Upon receipt at our central warehouse, our quality control team will inspect the item.</li>
</ul>

<h3>4. Refund Timelines</h3>
<p>Upon quality approval, refunds are processed within <strong>5 to 7 business days</strong> to the original payment method (UPI, Card, Net Banking) or credited immediately to your app wallet.</p>`,
    isActive: true,
  },
  {
    id: 4,
    categoryId: 4,
    title: 'Shipping Policy',
    slug: 'shipping-policy',
    content: `<h3>1. Order Processing & Dispatch</h3>
<p>Orders placed on Fashion City India Ltd are verified, packaged, and dispatched from our warehouse within <strong>24 to 48 business hours</strong>.</p>

<h3>2. Courier Partners & Tracking</h3>
<p>We partner with premier logistics providers (Delhivery, Blue Dart, DTDC, India Post) to ensure fast and reliable delivery. Once shipped, customers receive an SMS, email, and mobile push notification with an active AWB tracking number.</p>

<h3>3. Delivery Estimates</h3>
<ul>
  <li><strong>Metro Cities:</strong> 2 to 4 business days</li>
  <li><strong>Tier 2 & 3 Cities:</strong> 3 to 6 business days</li>
  <li><strong>Remote Locations:</strong> 5 to 8 business days</li>
</ul>

<h3>4. Shipping Charges</h3>
<p>Standard delivery is free on all prepaid orders exceeding the minimum cart threshold. Flat shipping fees apply to smaller orders as displayed during checkout.</p>`,
    isActive: true,
  },
  {
    id: 5,
    categoryId: 5,
    title: 'Cancellation Policy',
    slug: 'cancellation-policy',
    content: `<h3>1. Cancellation Before Dispatch</h3>
<p>Orders can be cancelled free of charge at any time prior to warehouse packaging and dispatch directly through the <em>My Orders</em> screen or by contacting customer support.</p>

<h3>2. Cancellation After Dispatch</h3>
<p>Once an order has been handed over to the courier partner, it cannot be cancelled online. In such cases, customers may refuse delivery at their doorstep or initiate a standard return after delivery.</p>

<h3>3. Refund for Cancelled Orders</h3>
<p>For prepaid orders cancelled before dispatch, a full 100% refund is initiated automatically within 24 hours to the original payment source.</p>`,
    isActive: true,
  },
  {
    id: 6,
    categoryId: 6,
    title: 'Payment Policy',
    slug: 'payment-policy',
    content: `<h3>1. Accepted Payment Methods</h3>
<ul>
  <li>UPI (Google Pay, PhonePe, Paytm, BHIM)</li>
  <li>Credit and Debit Cards (Visa, Mastercard, RuPay)</li>
  <li>Net Banking across all major Indian banks</li>
  <li>Digital Wallets</li>
  <li>Cash on Delivery (COD) for eligible pincodes</li>
</ul>

<h3>2. Payment Security</h3>
<p>All online transactions are securely encrypted and processed via RBI-authorized payment gateways featuring PCI-DSS compliance and mandatory 3D-Secure / OTP verification.</p>`,
    isActive: true,
  },
  {
    id: 7,
    categoryId: 7,
    title: 'About Us',
    slug: 'about-us',
    content: `<h3>About Fashion City India Ltd</h3>
<p>Fashion City India Ltd is a premier fashion and lifestyle destination bringing contemporary trends, luxury craftsmanship, and everyday essentials directly to your doorstep across India.</p>

<p>Headquartered in Ahmedabad, Gujarat, we curate curated collections designed with comfort, sustainability, and elegance in mind.</p>

<h3>Corporate Headquarters</h3>
<p><strong>Fashion City India Ltd</strong><br/>
F/7 Jethabhai Park, Narayan Nagar Road,<br/>
Paldi, Ahmedabad, Gujarat - 380007, India<br/>
<strong>GSTIN:</strong> 24GUKPS9446A1ZA<br/>
<strong>Email:</strong> fashioncityinidia18@gmail.com<br/>
<strong>Phone:</strong> +91 96015 11596</p>`,
    isActive: true,
  },
];

export class PolicyService {
  // In-memory runtime cache for resilience
  private memoryCategories: Map<number, PolicyCategoryData> = new Map();
  private memoryPolicies: Map<number, PolicyData> = new Map();
  private isInitialized = false;

  constructor() {
    this.initMemoryStore();
  }

  private initMemoryStore() {
    if (this.isInitialized) return;
    const now = new Date();
    for (const cat of INITIAL_CATEGORIES) {
      this.memoryCategories.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const pol of INITIAL_POLICIES) {
      const cat = this.memoryCategories.get(pol.categoryId);
      this.memoryPolicies.set(pol.id, {
        id: pol.id,
        categoryId: pol.categoryId,
        category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : undefined,
        title: pol.title,
        slug: pol.slug,
        content: pol.content,
        isActive: pol.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.isInitialized = true;
  }

  /**
   * Basic sanitizer to strip script/iframe/event handlers
   */
  public sanitizeContent(raw: string): string {
    if (!raw) return '';
    return raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // =========================================================================
  // PUBLIC / CUSTOMER METHODS
  // =========================================================================

  /**
   * Get all active policy categories with their active policies
   */
  async getPublicCategories(): Promise<PolicyCategoryData[]> {
    try {
      // Attempt DB fetch
      const categories = await (prisma as any).policyCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          policies: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (categories && categories.length > 0) {
        return categories;
      }
    } catch (dbErr) {
      logger.warn(`PolicyCategory DB query failed or unseeded; falling back to memory store: ${(dbErr as Error).message}`);
    }

    // Fallback to memory store
    const result: PolicyCategoryData[] = [];
    const sortedCategories = Array.from(this.memoryCategories.values())
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    for (const cat of sortedCategories) {
      const activePolicies = Array.from(this.memoryPolicies.values()).filter(
        (p) => p.categoryId === cat.id && p.isActive
      );
      result.push({
        ...cat,
        policies: activePolicies,
      });
    }
    return result;
  }

  /**
   * Get all active policies
   */
  async getPublicPolicies(): Promise<PolicyData[]> {
    try {
      const policies = await (prisma as any).policy.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (policies && policies.length > 0) {
        return policies;
      }
    } catch (dbErr) {
      logger.warn(`Policy DB query failed; falling back to memory store: ${(dbErr as Error).message}`);
    }

    return Array.from(this.memoryPolicies.values()).filter((p) => p.isActive);
  }

  /**
   * Get a single active policy by slug
   */
  async getPublicPolicyBySlug(slug: string): Promise<PolicyData | null> {
    try {
      const policy = await (prisma as any).policy.findFirst({
        where: { slug, isActive: true },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (policy) return policy;
    } catch (dbErr) {
      logger.warn(`Policy find slug failed; falling back to memory store: ${(dbErr as Error).message}`);
    }

    const found = Array.from(this.memoryPolicies.values()).find(
      (p) => p.slug === slug && p.isActive
    );
    return found || null;
  }

  // =========================================================================
  // ADMIN CATEGORY METHODS
  // =========================================================================

  async adminGetCategories(): Promise<PolicyCategoryData[]> {
    try {
      const categories = await (prisma as any).policyCategory.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          policies: true,
        },
      });

      if (categories && categories.length > 0) {
        return categories;
      }
    } catch (dbErr) {
      logger.warn(`Admin categories DB query fallback: ${(dbErr as Error).message}`);
    }

    // Return all from memory
    const result: PolicyCategoryData[] = [];
    const sorted = Array.from(this.memoryCategories.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    for (const cat of sorted) {
      const pols = Array.from(this.memoryPolicies.values()).filter(
        (p) => p.categoryId === cat.id
      );
      result.push({
        ...cat,
        policies: pols,
      });
    }
    return result;
  }

  async adminCreateCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<PolicyCategoryData> {
    const slug = data.slug?.trim() ? this.generateSlug(data.slug) : this.generateSlug(data.name);
    const now = new Date();

    try {
      const created = await (prisma as any).policyCategory.create({
        data: {
          name: data.name,
          slug,
          description: data.description || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          sortOrder: data.sortOrder || 0,
        },
      });
      return created;
    } catch (dbErr) {
      logger.warn(`DB create category fallback: ${(dbErr as Error).message}`);
      const newId = Math.max(0, ...Array.from(this.memoryCategories.keys())) + 1;
      const newCat: PolicyCategoryData = {
        id: newId,
        name: data.name,
        slug,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0,
        createdAt: now,
        updatedAt: now,
        policies: [],
      };
      this.memoryCategories.set(newId, newCat);
      return newCat;
    }
  }

  async adminUpdateCategory(
    id: number,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      isActive?: boolean;
      sortOrder?: number;
    }
  ): Promise<PolicyCategoryData> {
    const slug = data.slug?.trim() ? this.generateSlug(data.slug) : (data.name ? this.generateSlug(data.name) : undefined);

    try {
      const updated = await (prisma as any).policyCategory.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(slug && { slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });
      return updated;
    } catch (dbErr) {
      logger.warn(`DB update category fallback: ${(dbErr as Error).message}`);
      const existing = this.memoryCategories.get(id);
      if (!existing) throw new AppError('Category not found', 404);

      const updated: PolicyCategoryData = {
        ...existing,
        name: data.name ?? existing.name,
        slug: slug ?? existing.slug,
        description: data.description !== undefined ? data.description : existing.description,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        sortOrder: data.sortOrder !== undefined ? data.sortOrder : existing.sortOrder,
        updatedAt: new Date(),
      };
      this.memoryCategories.set(id, updated);
      return updated;
    }
  }

  async adminDeleteCategory(id: number): Promise<{ success: boolean; message: string }> {
    try {
      await (prisma as any).policyCategory.delete({
        where: { id },
      });
      return { success: true, message: 'Category deleted successfully' };
    } catch (dbErr) {
      logger.warn(`DB delete category fallback: ${(dbErr as Error).message}`);
      if (!this.memoryCategories.has(id)) throw new AppError('Category not found', 404);
      this.memoryCategories.delete(id);
      // Remove related policies
      for (const [pId, p] of this.memoryPolicies.entries()) {
        if (p.categoryId === id) {
          this.memoryPolicies.delete(pId);
        }
      }
      return { success: true, message: 'Category deleted successfully' };
    }
  }

  // =========================================================================
  // ADMIN POLICY METHODS
  // =========================================================================

  async adminGetPolicies(): Promise<PolicyData[]> {
    try {
      const policies = await (prisma as any).policy.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (policies && policies.length > 0) {
        return policies;
      }
    } catch (dbErr) {
      logger.warn(`Admin policies DB query fallback: ${(dbErr as Error).message}`);
    }

    return Array.from(this.memoryPolicies.values());
  }

  async adminGetPolicyById(id: number): Promise<PolicyData> {
    try {
      const policy = await (prisma as any).policy.findUnique({
        where: { id },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
      if (policy) return policy;
    } catch (dbErr) {
      logger.warn(`Admin policy find by id fallback: ${(dbErr as Error).message}`);
    }

    const found = this.memoryPolicies.get(id);
    if (!found) throw new AppError('Policy not found', 404);
    return found;
  }

  async adminCreatePolicy(data: {
    categoryId: number;
    title: string;
    slug?: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    isActive?: boolean;
  }): Promise<PolicyData> {
    const slug = data.slug?.trim() ? this.generateSlug(data.slug) : this.generateSlug(data.title);
    const sanitizedContent = this.sanitizeContent(data.content);
    const now = new Date();

    try {
      const created = await (prisma as any).policy.create({
        data: {
          categoryId: Number(data.categoryId),
          title: data.title,
          slug,
          content: sanitizedContent,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
      return created;
    } catch (dbErr) {
      logger.warn(`DB create policy fallback: ${(dbErr as Error).message}`);
      const newId = Math.max(0, ...Array.from(this.memoryPolicies.keys())) + 1;
      const cat = this.memoryCategories.get(Number(data.categoryId));
      const newPolicy: PolicyData = {
        id: newId,
        categoryId: Number(data.categoryId),
        category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : undefined,
        title: data.title,
        slug,
        content: sanitizedContent,
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryPolicies.set(newId, newPolicy);
      return newPolicy;
    }
  }

  async adminUpdatePolicy(
    id: number,
    data: {
      categoryId?: number;
      title?: string;
      slug?: string;
      content?: string;
      metaTitle?: string;
      metaDescription?: string;
      isActive?: boolean;
    }
  ): Promise<PolicyData> {
    const slug = data.slug?.trim() ? this.generateSlug(data.slug) : (data.title ? this.generateSlug(data.title) : undefined);
    const sanitizedContent = data.content !== undefined ? this.sanitizeContent(data.content) : undefined;

    try {
      const updated = await (prisma as any).policy.update({
        where: { id },
        data: {
          ...(data.categoryId !== undefined && { categoryId: Number(data.categoryId) }),
          ...(data.title && { title: data.title }),
          ...(slug && { slug }),
          ...(sanitizedContent !== undefined && { content: sanitizedContent }),
          ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
          ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
      return updated;
    } catch (dbErr) {
      logger.warn(`DB update policy fallback: ${(dbErr as Error).message}`);
      const existing = this.memoryPolicies.get(id);
      if (!existing) throw new AppError('Policy not found', 404);

      const categoryId = data.categoryId !== undefined ? Number(data.categoryId) : existing.categoryId;
      const cat = this.memoryCategories.get(categoryId);

      const updated: PolicyData = {
        ...existing,
        categoryId,
        category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : existing.category,
        title: data.title ?? existing.title,
        slug: slug ?? existing.slug,
        content: sanitizedContent ?? existing.content,
        metaTitle: data.metaTitle !== undefined ? data.metaTitle : existing.metaTitle,
        metaDescription: data.metaDescription !== undefined ? data.metaDescription : existing.metaDescription,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        updatedAt: new Date(),
      };
      this.memoryPolicies.set(id, updated);
      return updated;
    }
  }

  async adminDeletePolicy(id: number): Promise<{ success: boolean; message: string }> {
    try {
      await (prisma as any).policy.delete({
        where: { id },
      });
      return { success: true, message: 'Policy deleted successfully' };
    } catch (dbErr) {
      logger.warn(`DB delete policy fallback: ${(dbErr as Error).message}`);
      if (!this.memoryPolicies.has(id)) throw new AppError('Policy not found', 404);
      this.memoryPolicies.delete(id);
      return { success: true, message: 'Policy deleted successfully' };
    }
  }
}

export default new PolicyService();
