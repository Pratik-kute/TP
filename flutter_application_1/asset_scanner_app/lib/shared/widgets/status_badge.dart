import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A small label with a paired background colour. Status is always conveyed by
/// colour AND text — see UX spec §1 (accessibility).
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    required this.label,
    required this.tone,
    this.icon,
    super.key,
  });

  final String label;
  final BadgeTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = _palette(tone);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s8,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: AppRadius.pill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 12, color: colors.fg),
            const SizedBox(width: 4),
          ],
          Text(
            label.toUpperCase(),
            style: AppTypography.sectionLabel.copyWith(color: colors.fg),
          ),
        ],
      ),
    );
  }

  ({Color bg, Color fg}) _palette(BadgeTone tone) {
    switch (tone) {
      case BadgeTone.available:
        return (
          bg: AppColors.statusAvailableBg,
          fg: AppColors.statusAvailableFg
        );
      case BadgeTone.assigned:
        return (bg: AppColors.statusAssignedBg, fg: AppColors.statusAssignedFg);
      case BadgeTone.repair:
        return (bg: AppColors.statusRepairBg, fg: AppColors.statusRepairFg);
      case BadgeTone.retired:
      case BadgeTone.neutral:
        // Per docs/05, "Retired / Neutral" share one pill palette.
        return (bg: AppColors.statusRetiredBg, fg: AppColors.statusRetiredFg);
      case BadgeTone.lost:
        return (bg: AppColors.statusLostBg, fg: AppColors.statusLostFg);
      case BadgeTone.success:
        return (bg: AppColors.successBg, fg: AppColors.success);
      case BadgeTone.warning:
        return (bg: AppColors.warningBg, fg: AppColors.warning);
      case BadgeTone.danger:
        return (bg: AppColors.dangerBg, fg: AppColors.danger);
      case BadgeTone.info:
        return (bg: AppColors.infoBg, fg: AppColors.info);
    }
  }
}

enum BadgeTone {
  available,
  assigned,
  repair,
  retired,
  lost,
  success,
  warning,
  danger,
  info,
  neutral,
}
