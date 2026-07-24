import { Request, Response, NextFunction } from 'express';
import { taxService, TaxService } from '../services/tax.service';
import { ResponseFormatter } from '../../../utils/responseFormatter';

export class TaxController {
  constructor(private service: TaxService = taxService) {}

  createTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const taxRule = await this.service.createTaxRule(req.body);
      ResponseFormatter.created(res, 'Tax rule created successfully', taxRule);
    } catch (error) {
      next(error);
    }
  };

  updateTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const taxRule = await this.service.updateTaxRule(id, req.body);
      ResponseFormatter.success(res, 'Tax rule updated successfully', taxRule);
    } catch (error) {
      next(error);
    }
  };

  deleteTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      await this.service.deleteTaxRule(id);
      ResponseFormatter.success(res, 'Tax rule deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  getTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const taxRule = await this.service.getTaxRuleById(id);
      ResponseFormatter.success(res, 'Tax rule retrieved successfully', taxRule);
    } catch (error) {
      next(error);
    }
  };

  getTaxList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        search: req.query.search ? String(req.query.search) : undefined,
        taxType: req.query.taxType ? String(req.query.taxType) : undefined,
        country: req.query.country ? String(req.query.country) : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        sortBy: req.query.sortBy ? (String(req.query.sortBy) as any) : 'createdAt',
        sortOrder: req.query.sortOrder ? (String(req.query.sortOrder) as any) : 'desc',
      };

      const result = await this.service.getTaxRules(query);
      res.status(200).json({
        success: true,
        message: 'Tax rules retrieved successfully',
        data: result.rules,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  bulkAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { action, taxRuleIds } = req.body;
      await this.service.bulkTaxAction({ action, taxRuleIds });
      ResponseFormatter.success(res, `Bulk ${action.toLowerCase()} completed successfully`);
    } catch (error) {
      next(error);
    }
  };

  assignProductTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assignment = await this.service.assignProductTax(req.body);
      ResponseFormatter.success(res, 'Tax assigned to product successfully', assignment);
    } catch (error) {
      next(error);
    }
  };

  removeProductTax = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, country } = req.body;
      await this.service.removeProductTax(Number(productId), country);
      ResponseFormatter.success(res, 'Tax removed from product successfully');
    } catch (error) {
      next(error);
    }
  };
}

export const taxController = new TaxController();
