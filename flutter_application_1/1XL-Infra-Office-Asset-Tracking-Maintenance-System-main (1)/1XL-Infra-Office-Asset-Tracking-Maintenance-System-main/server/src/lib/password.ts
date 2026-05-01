import bcrypt from 'bcrypt';
import { config } from '../config.js';

export const hashPassword = (plain: string) => bcrypt.hash(plain, config.BCRYPT_COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Constant-time-ish equality for plaintext strings — used during the
 * one-time migration from the legacy plaintext `password` column to
 * the new `password_hash` column. Never compare hashes with this.
 */
export function plaintextEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
