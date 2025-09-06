import { NextFunction, Request, Response } from "express";
import { checkRateLimit } from "../services/rateLimiter";
import { logWarn } from "../utils/logger";
import { ResponseHelper } from "../utils/response";

export const rateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { allowed, info } = checkRateLimit(req);

    // Add rate limit headers to response
    res.set({
      "X-RateLimit-Limit": info.limit.toString(),
      "X-RateLimit-Remaining": info.remaining.toString(),
      "X-RateLimit-Reset": info.resetTime.toString(),
    });

    if (!allowed) {
      logWarn(`Rate limit exceeded for IP: ${req.ip}`, {
        limit: info.limit,
        remaining: info.remaining,
        resetTime: new Date(info.resetTime * 1000).toISOString(),
      });

      ResponseHelper.rateLimitExceeded(
        res,
        `Rate limit exceeded. Try again after ${new Date(
          info.resetTime * 1000
        ).toISOString()}`
      );
      return;
    }

    next();
  } catch (error) {
    logWarn("Error in rate limit middleware", error);
    // If rate limiting fails, allow the request to proceed
    next();
  }
};
