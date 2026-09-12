import type { NextFunction, Request, Response } from 'express';

/** An error with an HTTP status the error middleware can render verbatim. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'You need to sign in to do that.') {
    return new ApiError(401, message, 'unauthorized');
  }
  static forbidden(message = 'You do not have access to this.') {
    return new ApiError(403, message, 'forbidden');
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message, 'not_found');
  }
  static conflict(message: string, code = 'conflict') {
    return new ApiError(409, message, code);
  }
  static unprocessable(message: string, code = 'unprocessable') {
    return new ApiError(422, message, code);
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps an async route so rejected promises reach the error middleware. */
export function route(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function pageParams(query: Record<string, unknown>, defaultSize = 12, maxSize = 60): PageParams {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize ?? defaultSize) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginated<T>(items: T[], total: number, params: PageParams) {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
