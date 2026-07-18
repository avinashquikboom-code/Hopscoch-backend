import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export interface ApiKeyRequest extends Request {
  appType?: 'admin' | 'mobile' | 'web';
}

// Helper to get API key based on app type
const getApiKeyByAppType = (appType: 'admin' | 'mobile' | 'web'): string => {
  switch (appType) {
    case 'admin':
      return process.env.ADMIN_API_KEY || 'hopscotch-admin-api-key';
    case 'mobile':
      return process.env.MOBILE_API_KEY || 'hopscotch-mobile-api-key';
    case 'web':
      return process.env.WEBSITE_API_KEY || 'hopscotch-website-api-key';
    default:
      return '';
  }
};

// Helper to determine app type from request
const getAppTypeFromRequest = (req: Request): 'admin' | 'mobile' | 'web' => {
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers.referer || '';
  const apiKey = req.headers['x-api-key'] as string;
  
  // Check for admin panel
  if (referer.includes('/admin') || userAgent.includes('admin') || apiKey === getApiKeyByAppType('admin')) {
    return 'admin';
  }
  
  // Check for mobile app
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone') || userAgent.includes('iPad') || apiKey === getApiKeyByAppType('mobile')) {
    return 'mobile';
  }
  
  // Default to web
  return 'web';
};

export const validateApiKey = (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const appType = getAppTypeFromRequest(req);
  
  const expectedApiKey = getApiKeyByAppType(appType);
  
  // If API key is provided, validate it
  if (apiKey) {
    if (apiKey !== expectedApiKey) {
      throw new AppError('Invalid API key for this application type', 403);
    }
  }
  
  // Set app type on request for use in other middleware
  req.appType = appType;
  
  next();
};

// Middleware to require specific app type
export const requireAppType = (...allowedTypes: ('admin' | 'mobile' | 'web')[]) => {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    const appType = req.appType || getAppTypeFromRequest(req);
    
    if (!allowedTypes.includes(appType)) {
      throw new AppError(`This endpoint is not accessible from ${appType} application`, 403);
    }
    
    next();
  };
};

export default { validateApiKey, requireAppType };
