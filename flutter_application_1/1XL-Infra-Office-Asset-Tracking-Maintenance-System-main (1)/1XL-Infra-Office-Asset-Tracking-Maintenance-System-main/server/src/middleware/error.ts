import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { log } from '../lib/log.js';
import type { AuthedRequest } from './types.js';

/**
 * Error envelope (Section 6.1):
 *   { error: { code, message, requestId, fieldErrors? } }
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as AuthedRequest).requestId;

  if (err instanceof AppError) {
    res.locals.errorCode = err.code;
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // express.json() body-parse failure
  if (err && (err as any).type === 'entity.parse.failed') {
    res.locals.errorCode = 'VALIDATION_FAILED';
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Malformed JSON body',
        requestId,
      },
    });
    return;
  }

  log.error({ err, requestId, url: req.originalUrl, method: req.method }, 'unhandled error');
  res.locals.errorCode = 'INTERNAL_ERROR';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    },
  });
};

export const notFound: RequestHandler = (req, res) => {
  const requestId = (req as AuthedRequest).requestId;
  res.locals.errorCode = 'NOT_FOUND';
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route for ${req.method} ${req.originalUrl}`,
      requestId,
    },
  });
};
