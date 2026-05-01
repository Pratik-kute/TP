import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Typography tokens.
///
/// Names follow the web design system (see `docs/05-visual-design-system.md`):
/// displayTitle (32) / pageTitle (24) / heading (20) / subheading (17)
/// / body (15) / caption (13). Monospaced variants for asset codes and
/// ticket IDs use [TextStyle] with `fontFamilyFallback` so the platform
/// monospaced face (Menlo on iOS, Roboto Mono on Android) is picked up.
class AppTypography {
  AppTypography._();

  static const String _monoFamilyFallback = 'monospace';

  static const TextStyle displayTitle = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.15,
    color: AppColors.textPrimary,
  );

  static const TextStyle pageTitle = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    height: 1.33, // 32/24
    letterSpacing: -0.48, // -0.02em * 24
    color: AppColors.textPrimary,
  );

  /// Deprecated alias of [pageTitle]. Existing call sites compile with the
  /// new 24pt size (intentional — matches web). Remove on the V1.1 cleanup.
  @Deprecated('Use pageTitle (24pt). Will be removed in V1.1.')
  static const TextStyle title = pageTitle;

  static const TextStyle heading = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    height: 1.3, // 26/20
    letterSpacing: -0.2, // -0.01em * 20
    color: AppColors.textPrimary,
  );

  static const TextStyle subheading = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: AppColors.textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.33, // 20/15
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    height: 1.45,
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyMuted = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: AppColors.textSecondary,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.38, // 18/13
    color: AppColors.textSecondary,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.27, // 14/11
    letterSpacing: 0.6,
    color: AppColors.textSecondary,
  );

  static const TextStyle button = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.2,
    letterSpacing: 0.1,
  );

  static const TextStyle monoBody = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: AppColors.textSecondary,
    fontFamilyFallback: <String>[_monoFamilyFallback],
  );

  static const TextStyle monoCaption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: AppColors.textSecondary,
    fontFamilyFallback: <String>[_monoFamilyFallback],
  );

  static const TextStyle captionStrong = sectionLabel;
}
