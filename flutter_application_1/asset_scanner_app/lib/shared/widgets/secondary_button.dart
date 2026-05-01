import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.fullWidth = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.brand,
        side: const BorderSide(color: AppColors.border, width: 0.5),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.all12),
        textStyle: AppTypography.button,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
        minimumSize: const Size(0, AppSpacing.primaryButtonHeight),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 18),
            const SizedBox(width: AppSpacing.s8),
          ],
          Flexible(
            child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );

    return fullWidth
        ? SizedBox(
            width: double.infinity,
            height: AppSpacing.primaryButtonHeight,
            child: button,
          )
        : button;
  }
}

class DestructiveButton extends StatelessWidget {
  const DestructiveButton({
    required this.label,
    required this.onPressed,
    this.fullWidth = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.danger,
        backgroundColor: AppColors.dangerBg,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.all12),
        textStyle: AppTypography.button,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
        minimumSize: const Size(0, AppSpacing.primaryButtonHeight),
      ),
      child: Text(label),
    );
    return fullWidth
        ? SizedBox(
            width: double.infinity,
            height: AppSpacing.primaryButtonHeight,
            child: button,
          )
        : button;
  }
}
