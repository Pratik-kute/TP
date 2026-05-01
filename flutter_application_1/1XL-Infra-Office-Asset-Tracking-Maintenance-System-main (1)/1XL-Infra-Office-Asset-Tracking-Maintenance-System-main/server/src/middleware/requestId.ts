import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import type { AuthedRequest } from './types.js';

/**
 * Honour client-supplied X-Request-Id (Section 6.3) and mirror it back on
 * every response. Generate a UUID if absent. Header is preserved verbatim
 * (sanitized to ASCII-printable to avoid header injection).
 */
const VALID = /^[A-Za-z0-9._:\-]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && VALID.test(incoming) ? incoming : crypto.randomUUID();
  (req as AuthedRequest).requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
