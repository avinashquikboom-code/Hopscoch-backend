import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: any[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export class ResponseFormatter {
  static success<T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = 200,
    meta?: any
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    error?: string,
    errors?: any[]
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
    };

    if (error) {
      response.error = error;
    }

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    message: string,
    data?: T
  ): Response {
    return this.success(res, message, data, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }
}

export default ResponseFormatter;
