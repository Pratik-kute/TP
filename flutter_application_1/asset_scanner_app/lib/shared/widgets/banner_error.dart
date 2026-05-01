import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A slim, dismissible banner for recoverable per-screen errors (refresh
/// failed, partial outage). Per UX spec §5.3: error severity → UI choice.
class BannerError extends StatelessWidget {
  const BannerError({
    required this.message,
    this.onDismiss,
    this.onRetry,
    this.tone = BannerTone.danger,
    super.key,
  });

  final String message;
  final VoidCallback? onDismiss;
  final VoidCallback? onRetry;
  final BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = _palette(tone);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.s12,
        vertical: AppSpacing.s8,
      ),
      decoration: BoxDecoration(
        color: palette.bg,
        border: Border(
          top: BorderSide(color: palette.fg.withValues(alpha: 0.2)),
          bottom: BorderSide(color: palette.fg.withValues(alpha: 0.2)),
        ),
      ),
      child: Row(
        children: <Widget>[
          Icon(palette.icon, size: 18, color: palette.fg),
          const SizedBox(width: AppSpacing.s8),
          Expanded(
            child: Text(
              message,
              style: AppTypography.body.copyWith(color: palette.fg),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: palette.fg,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s8),
              ),
              child: const Text('Retry'),
            ),
          if (onDismiss != null)
            IconButton(
              onPressed: onDismiss,
              icon: Icon(Icons.close, size: 18, color: palette.fg),
              splashRadius: 18,
            ),
        ],
      ),
    );
  }

  ({Color bg, Color fg, IconData icon}) _palette(BannerTone tone) {
    switch (tone) {
      case BannerTone.danger:
        return (
          bg: AppColors.dangerBg,
          fg: AppColors.danger,
          icon: Icons.error_outline,
        );
      case BannerTone.warning:
        return (
          bg: AppColors.warningBg,
          fg: AppColors.warning,
          icon: Icons.warning_amber_rounded,
        );
      case BannerTone.info:
        return (
          bg: AppColors.infoBg,
          fg: AppColors.info,
          icon: Icons.info_outline,
        );
    }
  }
}

enum BannerTone { danger, warning, info }
