/// Spacing tokens. Multiples of 4, anchored on an 8pt grid.
///
/// The UX spec defines six step values: 4 / 8 / 12 / 16 / 24 / 32.
/// Edge padding for screens is [s16].
class AppSpacing {
  AppSpacing._();

  static const double s4 = 4;
  static const double s8 = 8;
  static const double s12 = 12;
  static const double s16 = 16;
  static const double s24 = 24;
  static const double s32 = 32;
  static const double s48 = 48;

  /// Standard screen edge padding.
  static const double screenEdge = s16;

  /// Standard tap-target minimum height.
  static const double touchTarget = 44;

  /// Primary CTA height.
  static const double primaryButtonHeight = 48;

  /// Oversized CTA height (e.g. Home "Scan asset QR").
  static const double primaryButtonHeightOversized = 64;
}
