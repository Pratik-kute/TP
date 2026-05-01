import { z } from 'zod';
import { Errors } from './errors.js';

/**
 * Run a Zod parse and convert any failure into our stable error shape.
 * Generic over the schema itself (not the inferred type) so `.default(...)`
 * folds into the output type and call sites don't see `T | undefined`.
 */
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  payload: unknown,
  label = 'body',
): z.output<S> {
  const r = schema.safeParse(payload);
  if (r.success) return r.data;
  const fieldErrors = r.error.issues.map(i => ({
    field: i.path.length > 0 ? i.path.join('.') : label,
    message: i.message,
  }));
  throw Errors.validation('Request validation failed', fieldErrors);
}
