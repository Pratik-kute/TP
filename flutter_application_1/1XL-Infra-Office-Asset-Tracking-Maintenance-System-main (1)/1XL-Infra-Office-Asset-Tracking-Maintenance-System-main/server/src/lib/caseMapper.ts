/**
 * Mirror of `src/lib/caseMapper.ts` from the React app — kept in sync so the
 * server speaks the same wire format (camelCase JSON ↔ snake_case Postgres).
 *
 * Recursive: handles nested objects, arrays of objects, and Date passthrough.
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

export function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
}

export function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

export function objectToSnake(input: any): any {
  if (Array.isArray(input)) return input.map(objectToSnake);
  if (!isPlainObject(input)) return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[toSnake(k)] = objectToSnake(v);
  }
  return out;
}

export function objectToCamel<T = any>(input: any): T {
  if (Array.isArray(input)) return input.map(objectToCamel) as unknown as T;
  if (!isPlainObject(input)) return input as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[toCamel(k)] = objectToCamel(v);
  }
  return out as T;
}

export function arrayToCamel<T = any>(arr: any[]): T[] {
  return arr.map(o => objectToCamel<T>(o));
}
