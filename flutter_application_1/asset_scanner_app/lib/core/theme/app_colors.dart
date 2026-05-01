import 'package:flutter/material.dart';

/// Color tokens.
///
/// Widgets must reference these (or [Theme.of(context).colorScheme]) and never
/// hard-code hex values. Adding a new colour starts with adding a token here.
///
/// Values match the 1XL Asset Tracker web platform (see
/// `docs/05-visual-design-system.md` and `docs/visual-references/`).
class AppColors {
  AppColors._();

  // Brand
  static const Color brand = Color(0xFF00694E); // primary
  static const Color brandPressed =
      Color(0xFF00513B); // on-primary-fixed-variant
  static const Color brandSoft = Color(0xFFE9EFEA); // surface-container

  // Surfaces
  static const Color background = Color(0xFFF5FBF5); // background
  static const Color surface = Color(0xFFFFFFFF); // surface-container-lowest
  static const Color surface2 = Color(0xFFEFF5F0); // surface-container-low
  static const Color overlay = Color(0xCC000000); // 80% black

  // Text
  static const Color textPrimary = Color(0xFF0F1115);
  static const Color textSecondary = Color(0xFF5C6470);
  static const Color textMuted = Color(0xFF8B92A0);
  static const Color textInverse = Color(0xFFFFFFFF);

  // Borders / dividers
  static const Color border = Color(0xFFBCCAC1); // outline-variant
  static const Color borderStrong = Color(0xFF6D7A73); // outline

  // Status / semantic
  static const Color success = Color(0xFF0D8A68);
  static const Color successBg = Color(0xFFE8F5EF);
  static const Color warning = Color(0xFFA86404);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFC42424);
  static const Color dangerBg = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF1E5BC8);
  static const Color infoBg = Color(0xFFE5EFFE);
  static const Color tertiary = Color(0xFF9B3D37);

  // Severity (repairs)
  static const Color severityLow = Color(0xFF605C72);
  static const Color severityMedium = Color(0xFFA86404);
  static const Color severityHigh = Color(0xFFC42424);

  // Asset status backgrounds (paired with text colour)
  static const Color statusAvailableBg = Color(0xFFE8F5EF);
  static const Color statusAvailableFg = Color(0xFF0D8A68);
  static const Color statusAssignedBg = Color(0xFFE5EFFE);
  static const Color statusAssignedFg = Color(0xFF1E5BC8);
  static const Color statusRepairBg = Color(0xFFFFF1E0);
  static const Color statusRepairFg = Color(0xFFB35900);
  static const Color statusRetiredBg = Color(0xFFEEEDF5);
  static const Color statusRetiredFg = Color(0xFF605C72);
  static const Color statusLostBg = Color(0xFFFEE2E2);
  static const Color statusLostFg = Color(0xFFC42424);

  // Stat-card icon tints (categorical-decorative, not severity).
  // See `StatTint` enum on `StatCard` (Stage B) — paired bg/fg per row.
  static const Color statTintMintBg = Color(0xFFD7F0E1);
  static const Color statTintMintFg = Color(0xFF0D8A68);
  static const Color statTintTealBg = Color(0xFFD8EEF2);
  static const Color statTintTealFg = Color(0xFF1A7A8C);
  static const Color statTintLavenderBg = Color(0xFFEAE5F6);
  static const Color statTintLavenderFg = Color(0xFF5B4FB0);
  static const Color statTintCreamBg = Color(0xFFFAEFD0);
  static const Color statTintCreamFg = Color(0xFF9B7510);
  static const Color statTintRoseBg = Color(0xFFFBE0E0);
  static const Color statTintRoseFg = Color(0xFFB23A3A);
}
