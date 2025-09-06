import { Response } from "express";
import { ApiResponse } from "../types";

export class ResponseHelper {
  public static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  public static error(
    res: Response,
    error: string,
    statusCode: number = 500,
    data?: unknown
  ): void {
    const response: ApiResponse = {
      success: false,
      error,
      data,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  public static notFound(
    res: Response,
    message: string = "Resource not found"
  ): void {
    this.error(res, message, 404);
  }

  public static badRequest(
    res: Response,
    message: string = "Bad request"
  ): void {
    this.error(res, message, 400);
  }

  public static rateLimitExceeded(
    res: Response,
    message: string = "Rate limit exceeded"
  ): void {
    this.error(res, message, 429);
  }

  public static internalError(
    res: Response,
    message: string = "Internal server error"
  ): void {
    this.error(res, message, 500);
  }
}
