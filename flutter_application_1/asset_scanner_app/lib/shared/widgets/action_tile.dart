import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A large, square-ish action tile for the Asset Details screen action grid.
class ActionTile extends StatelessWidget {
  const ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badgeCount,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadius.all12,
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.all12,
        child: SizedBox(
          height: 88,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s12),
            child: Row(
              children: <Widget>[
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: AppRadius.all8,
                  ),
                  child: Icon(icon, color: AppColors.brand, size: 20),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Text(
                    label,
                    style: AppTypography.bodyStrong,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (badgeCount != null && badgeCount! > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s8,
                      vertical: 2,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.warningBg,
                      borderRadius: AppRadius.pill,
                    ),
                    child: Text(
                      '$badgeCount',
                      style: AppTypography.captionStrong.copyWith(
                        color: AppColors.warning,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Larger choice tile used on Audit Verification ("Verify match" / "Flag discrepancy").
class LargeChoiceTile extends StatelessWidget {
  const LargeChoiceTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.emphasis = ChoiceEmphasis.primary,
    super.key,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final ChoiceEmphasis emphasis;

  @override
  Widget build(BuildContext context) {
    final isPrimary = emphasis == ChoiceEmphasis.primary;
    final bg = isPrimary ? AppColors.brand : AppColors.surface;
    final fg = isPrimary ? AppColors.textInverse : AppColors.textPrimary;
    final iconColor = isPrimary ? AppColors.textInverse : AppColors.brand;
    final borderColor = isPrimary ? AppColors.brand : AppColors.border;

    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.all12,
        side: BorderSide(color: borderColor),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.all12,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Row(
            children: <Widget>[
              Icon(icon, color: iconColor, size: 24),
              const SizedBox(width: AppSpacing.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: AppTypography.subheading.copyWith(color: fg),
                    ),
                    if (subtitle != null) ...<Widget>[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        style: AppTypography.caption.copyWith(
                          color: isPrimary
                              ? AppColors.textInverse.withValues(alpha: 0.85)
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: fg.withValues(alpha: 0.7)),
            ],
          ),
        ),
      ),
    );
  }
}

enum ChoiceEmphasis { primary, secondary }
