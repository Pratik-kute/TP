import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Public API-key format: `<orgslug>_<env>_<24-char-base62>`
 *
 *   - orgslug : organization.short_name, sanitized to [a-z0-9], capped at 16 chars
 *   - env     : `live` in production, `test` otherwise — lets ops grep for prod keys
 *   - 24-char body = ~143 bits of entropy
 *
 * Examples:
 *   1xl_live_K8j3pQrX9bR2sN7wHzVc1qLm
 *   demo_test_K8j3pQrX9bR2sN7wHzVc1qLm
 *   acmecorp_live_K8j3pQrX9bR2sN7wHzVc
 *
 * The full key is shown once on creation. The DB stores:
 *   - key_prefix : everything up to and including 3 chars of the body
 *                  (variable length — long enough for fast lookup, short enough
 *                  to fit in the admin UI). Used for indexed prefix lookup.
 *   - key_hash   : bcrypt(full_key)
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const KEY_REGEX = /^([a-z0-9]{1,16})_(live|test)_[A-Za-z0-9]{24}$/;
const PREFIX_REGEX = /^([a-z0-9]{1,16})_(live|test)_[A-Za-z0-9]{3}/;

function randomBase62(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Sanitize an org short name for use as a key prefix. */
export function orgSlugForKey(rawShortName: string): string {
  const cleaned = (rawShortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) return 'org';        // safety fallback — never empty
  return cleaned.slice(0, 16);
}

export interface GeneratedApiKey {
  fullKey: string;          // hand to client, never stored
  prefix: string;           // displayed in admin UI; stored in DB for lookup
  hash: string;             // stored in api_keys.key_hash
}

export async function generateApiKey(orgShortName: string): Promise<GeneratedApiKey> {
  const slug = orgSlugForKey(orgShortName);
  const env = config.isProd ? 'live' : 'test';
  const body = randomBase62(24);
  const fullKey = `${slug}_${env}_${body}`;
  const prefix = `${slug}_${env}_${body.slice(0, 3)}`;
  const hash = await bcrypt.hash(fullKey, config.BCRYPT_COST);
  return { fullKey, prefix, hash };
}

export const verifyApiKey = (raw: string, hash: string) => bcrypt.compare(raw, hash);

/** Cheap shape check before hitting the DB. */
export function looksLikeApiKey(raw: string): boolean {
  return KEY_REGEX.test(raw);
}

export function prefixFromRawKey(raw: string): string | null {
  const m = raw.match(PREFIX_REGEX);
  return m ? m[0] : null;
}
