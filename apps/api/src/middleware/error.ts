import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from '../env';
import { ApiError } from '../lib/http';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    // Flatten into { field: message } so forms can highlight the exact input.
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(422).json({
      error: { code: 'validation_error', message: 'Please check the highlighted fields.', fields: fieldErrors },
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'duplicate', message: 'That record already exists.' },
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
    }
  }

  // Anything reaching here is a bug. Log it in full, tell the client nothing.
  console.error('[api] unhandled error', error);
  return res.status(500).json({
    error: {
      code: 'server_error',
      message: 'Something went wrong on our side. Please try again.',
      ...(env.isProduction ? {} : { debug: error instanceof Error ? error.message : String(error) }),
    },
  });
}
