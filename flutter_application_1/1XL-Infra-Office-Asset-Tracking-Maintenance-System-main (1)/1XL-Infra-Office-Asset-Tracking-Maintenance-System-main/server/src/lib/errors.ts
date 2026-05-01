/**
 * Stable error codes mirrored to mobile (Section 6.1).
 * If you add a code here, also document it in OpenAPI and questionnaire.md.
 */
export const ErrorCodes = {
  UNAUTHENTICATED:     { status: 401 },
  TOKEN_EXPIRED:       { status: 401 },
  INVALID_API_KEY:     { status: 401 },
  FORBIDDEN:           { status: 403 },
  INSUFFICIENT_SCOPE:  { status: 403 },
  NOT_FOUND:           { status: 404 },
  ASSET_NOT_FOUND:     { status: 404 },
  REPAIR_NOT_FOUND:    { status: 404 },
  PHOTO_NOT_FOUND:     { status: 404 },
  CYCLE_NOT_FOUND:     { status: 404 },
  INVALID_QR_PAYLOAD:  { status: 400 },
  VALIDATION_FAILED:   { status: 422 },
  CONFLICT:            { status: 409 },
  RATE_LIMITED:        { status: 429 },
  IDEMPOTENCY_REPLAY:  { status: 200 },        // not really an error — handler returns cached body
  INTERNAL_ERROR:      { status: 500 },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly fieldErrors?: FieldError[];
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, opts?: { fieldErrors?: FieldError[]; details?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ErrorCodes[code].status;
    this.fieldErrors = opts?.fieldErrors;
    this.details = opts?.details;
  }
}

/** Thin helpers so call sites read naturally. */
export const Errors = {
  unauthenticated: (msg = 'Authentication required')        => new AppError('UNAUTHENTICATED', msg),
  tokenExpired:    (msg = 'Token expired')                  => new AppError('TOKEN_EXPIRED', msg),
  invalidApiKey:   (msg = 'Invalid or revoked API key')     => new AppError('INVALID_API_KEY', msg),
  forbidden:       (msg = 'Not allowed')                    => new AppError('FORBIDDEN', msg),
  insufficientScope: (scope: string)                        => new AppError('INSUFFICIENT_SCOPE', `API key missing required scope: ${scope}`),
  notFound:        (what: string)                           => new AppError('NOT_FOUND', `${what} not found`),
  assetNotFound:   ()                                       => new AppError('ASSET_NOT_FOUND', 'Asset not found'),
  repairNotFound:  ()                                       => new AppError('REPAIR_NOT_FOUND', 'Repair ticket not found'),
  photoNotFound:   ()                                       => new AppError('PHOTO_NOT_FOUND', 'Photo not found'),
  cycleNotFound:   ()                                       => new AppError('CYCLE_NOT_FOUND', 'No active audit cycle'),
  invalidQr:       (msg = 'QR payload could not be parsed') => new AppError('INVALID_QR_PAYLOAD', msg),
  validation:      (msg: string, fieldErrors?: FieldError[]) => new AppError('VALIDATION_FAILED', msg, { fieldErrors }),
  conflict:        (msg: string)                            => new AppError('CONFLICT', msg),
  rateLimited:     (msg = 'Too many requests')              => new AppError('RATE_LIMITED', msg),
  internal:        (msg = 'Internal server error')          => new AppError('INTERNAL_ERROR', msg),
};
