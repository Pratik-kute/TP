import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { Errors } from './errors.js';

export interface AccessTokenPayload {
  sub: string;                  // user id
  org: string | null;           // organization id
  role: string;                 // user role
  type: 'access';
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  const opts: SignOptions = {
    expiresIn: config.JWT_ACCESS_TTL_SECONDS,
    issuer: '1xl-asset-api',
    audience: 'mobile',
  };
  return jwt.sign({ ...payload, type: 'access' }, config.JWT_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      issuer: '1xl-asset-api',
      audience: 'mobile',
    }) as AccessTokenPayload;
    if (decoded.type !== 'access') throw Errors.unauthenticated('Wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw Errors.tokenExpired();
    if (err instanceof jwt.JsonWebTokenError)  throw Errors.unauthenticated('Invalid token');
    throw err;
  }
}

/**
 * Refresh tokens are opaque — we generate raw bytes, store a SHA-256 hash
 * in the DB, and hand the raw value to the client. JWT isn't needed for
 * refresh tokens (no claims need to be self-contained).
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
