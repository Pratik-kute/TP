import 'package:freezed_annotation/freezed_annotation.dart';

part 'app_error.freezed.dart';

/// Stable, machine-readable error codes returned by the backend.
///
/// Mobile uses these to drive UI; user-facing copy is mapped at the
/// presentation layer via [AppError.userMessage].
enum AppErrorCode {
  unauthenticated,
  tokenExpired,
  invalidApiKey,
  forbidden,
  insufficientScope,
  assetNotFound,
  repairNotFound,
  photoNotFound,
  cycleNotFound,
  invalidQrPayload,
  validationFailed,
  rateLimited,
  notFound,
  conflict,
  network,
  internal,
  unknown;

  static AppErrorCode fromString(String? raw) {
    switch (raw) {
      case 'UNAUTHENTICATED':
        return AppErrorCode.unauthenticated;
      case 'TOKEN_EXPIRED':
        return AppErrorCode.tokenExpired;
      case 'INVALID_API_KEY':
        return AppErrorCode.invalidApiKey;
      case 'FORBIDDEN':
        return AppErrorCode.forbidden;
      case 'INSUFFICIENT_SCOPE':
        return AppErrorCode.insufficientScope;
      case 'ASSET_NOT_FOUND':
        return AppErrorCode.assetNotFound;
      case 'REPAIR_NOT_FOUND':
        return AppErrorCode.repairNotFound;
      case 'PHOTO_NOT_FOUND':
        return AppErrorCode.photoNotFound;
      case 'CYCLE_NOT_FOUND':
        return AppErrorCode.cycleNotFound;
      case 'INVALID_QR_PAYLOAD':
        return AppErrorCode.invalidQrPayload;
      case 'VALIDATION_FAILED':
        return AppErrorCode.validationFailed;
      case 'RATE_LIMITED':
        return AppErrorCode.rateLimited;
      case 'NOT_FOUND':
        return AppErrorCode.notFound;
      case 'CONFLICT':
        return AppErrorCode.conflict;
      case 'INTERNAL_ERROR':
        return AppErrorCode.internal;
      default:
        return AppErrorCode.unknown;
    }
  }
}

/// Typed app error. The single error type used across repositories,
/// controllers, and the presentation layer.
@freezed
class AppError with _$AppError {
  const AppError._();

  const factory AppError({
    required AppErrorCode code,
    String? message,
    String? requestId,
  }) = _AppError;

  factory AppError.network([String? message]) => 
      AppError(code: AppErrorCode.network, message: message);
  factory AppError.unknown([String? message]) =>
      AppError(code: AppErrorCode.unknown, message: message);

  /// User-facing copy. Never expose [code] strings to users.
  String get userMessage {
    if (message != null) return message!;
    
    switch (code) {
      case AppErrorCode.unauthenticated:

        return 'Sign in to continue.';
      case AppErrorCode.tokenExpired:
        return 'Your session expired. Please sign in again.';
      case AppErrorCode.invalidApiKey:
        return 'This app is not configured for API access.';
      case AppErrorCode.forbidden:
      case AppErrorCode.insufficientScope:
        return 'You do not have access to this.';
      case AppErrorCode.assetNotFound:
        return 'This asset is no longer active.';
      case AppErrorCode.repairNotFound:
        return 'This repair ticket is no longer available.';
      case AppErrorCode.photoNotFound:
        return 'This photo is no longer available.';
      case AppErrorCode.cycleNotFound:
        return 'No active audit cycle was found.';
      case AppErrorCode.invalidQrPayload:
        return 'This QR is not an asset code.';
      case AppErrorCode.validationFailed:
        return 'Some details look incorrect. Please check the form.';
      case AppErrorCode.rateLimited:
        return 'Too many requests. Try again shortly.';
      case AppErrorCode.notFound:
        return 'We couldn\'t find what you were looking for.';
      case AppErrorCode.conflict:
        return 'That action conflicts with the current state.';
      case AppErrorCode.network:
        return 'No internet connection.';
      case AppErrorCode.internal:
      case AppErrorCode.unknown:
        return 'Something went wrong. Please try again.';
    }
  }
}
