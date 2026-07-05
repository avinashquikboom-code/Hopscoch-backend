import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { ResponseFormatter } from '../../../utils/responseFormatter';
import AuthService from '../services/auth.service';
import { authRateLimiter } from '../../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from '../validators/auth.validator';

export class AuthController {
  async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      const deviceInfo = {
        deviceType: validatedData.deviceType,
        platform: validatedData.platform,
        browser: validatedData.browser,
        os: validatedData.os,
        deviceId: validatedData.deviceId,
        deviceName: validatedData.deviceName,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
        fcmToken: validatedData.fcmToken,
      };
      const result = await AuthService.register({ ...validatedData, ...deviceInfo });
      res.cookie('accessToken', result.accessToken, {
        httpOnly: false,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      ResponseFormatter.created(res, 'Registration successful', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      const deviceInfo = {
        deviceType: validatedData.deviceType,
        platform: validatedData.platform,
        browser: validatedData.browser,
        os: validatedData.os,
        deviceId: validatedData.deviceId,
        deviceName: validatedData.deviceName,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
        fcmToken: validatedData.fcmToken,
      };
      const result = await AuthService.login(validatedData.email, validatedData.password, deviceInfo);
      res.cookie('accessToken', result.accessToken, {
        httpOnly: false,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      ResponseFormatter.success(res, 'Login successful', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async refreshToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = refreshTokenSchema.parse(req.body);
      const deviceType = req.body.deviceType || 'web';
      const result = await AuthService.refreshAccessToken(validatedData.refreshToken, deviceType);
      res.cookie('accessToken', result.accessToken, {
        httpOnly: false,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      ResponseFormatter.success(res, 'Token refreshed successfully', result);
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      ResponseFormatter.success(res, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      await AuthService.logoutAll(req.user.id);
      ResponseFormatter.success(res, 'Logged out from all devices successfully');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const validatedData = changePasswordSchema.parse(req.body);
      await AuthService.changePassword(req.user.id, validatedData.currentPassword, validatedData.newPassword);
      ResponseFormatter.success(res, 'Password changed successfully');
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async forgotPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      const resetToken = await AuthService.forgotPassword(validatedData.email);
      // In production, send email with reset token
      ResponseFormatter.success(res, 'If the email exists, a password reset link has been sent');
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async resetPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      await AuthService.resetPassword(validatedData.token, validatedData.password);
      ResponseFormatter.success(res, 'Password reset successfully');
    } catch (error) {
      if (error instanceof ZodError) {
        ResponseFormatter.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      } else {
        next(error);
      }
    }
  }

  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      await AuthService.deleteAccount(req.user.id);
      ResponseFormatter.success(res, 'Account deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ResponseFormatter.error(res, 'Authentication required', 401);
        return;
      }
      const user = await AuthService.getUserById(req.user.id);
      ResponseFormatter.success(res, 'User profile retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
