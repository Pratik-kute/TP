import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

enum CalloutType {
  info,
  warning,
  danger,
}

/// A card used for alerts or emphasis.
/// Features a tinted background and a solid accent strip on the left edge.
class CalloutBlock extends StatelessWidget {
  const CalloutBlock({
    required this.title,
    required this.message,
    this.type = CalloutType.info,
    this.icon,
    super.key,
  });

  final String title;
  final String message;
  final CalloutType type;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = _colors();

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: AppRadius.all12,
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Container(
              width: 4,
              color: colors.accent,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.s16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(
                      icon ?? _defaultIcon(),
                      color: colors.accent,
                      size: 20,
                    ),
                    const SizedBox(width: AppSpacing.s12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            title.toUpperCase(),
                            style: AppTypography.sectionLabel.copyWith(
                              color: colors.accent,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            message,
                            style: AppTypography.body.copyWith(
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _defaultIcon() {
    switch (type) {
      case CalloutType.info:
        return Icons.info_outline;
      case CalloutType.warning:
        return Icons.priority_high;
      case CalloutType.danger:
        return Icons.warning_amber_rounded;
    }
  }

  ({Color bg, Color accent}) _colors() {
    switch (type) {
      case CalloutType.info:
        return (bg: AppColors.infoBg, accent: AppColors.info);
      case CalloutType.warning:
        return (bg: AppColors.warningBg, accent: AppColors.warning);
      case CalloutType.danger:
        return (bg: AppColors.dangerBg, accent: AppColors.danger);
    }
  }
}
