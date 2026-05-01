import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// Designed empty state. Centered icon, headline, sub-headline.
///
/// Per UX spec §5.2: never use blame language. State the situation neutrally
/// and point to the next action.
class EmptyState extends StatelessWidget {
  const EmptyState({
    required this.icon,
    required this.title,
    this.message,
    this.action,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.s32,
          vertical: AppSpacing.s24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 48, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.s16),
            Text(
              title,
              style: AppTypography.subheading,
              textAlign: TextAlign.center,
            ),
            if (message != null) ...<Widget>[
              const SizedBox(height: AppSpacing.s8),
              Text(
                message!,
                style: AppTypography.bodyMuted,
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...<Widget>[
              const SizedBox(height: AppSpacing.s24),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
