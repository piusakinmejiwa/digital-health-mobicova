import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error-handling middleware instead of crashing the process. Express 4 does not
 * catch async errors on its own, so without this a thrown DB error returns a 502
 * (process crash) rather than a clean 500 JSON response.
 */
export const asyncHandler = (fn: AsyncRouteHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
