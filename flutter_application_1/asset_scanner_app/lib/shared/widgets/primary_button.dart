import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// The primary action button. Full-width by default. Renders a spinner when
/// [isLoading] is true and disables interaction.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.icon,
    this.oversized = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;

  /// When true, uses the larger CTA height (Home "Scan asset QR").
  final bool oversized;

  @override
  Widget build(BuildContext context) {
    final height = oversized
        ? AppSpacing.primaryButtonHeightOversized
        : AppSpacing.primaryButtonHeight;
    final isEnabled = onPressed != null && !isLoading;

    return SizedBox(
      width: double.infinity,
      height: height,
      child: FilledButton(
        onPressed: isEnabled ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brand,
          disabledBackgroundColor: AppColors.borderStrong,
          foregroundColor: AppColors.textInverse,
          disabledForegroundColor: AppColors.textInverse,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.all12),
          textStyle: AppTypography.button.copyWith(
            fontSize: oversized ? 18 : 16,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: oversized ? AppSpacing.s24 : AppSpacing.s16,
          ),
          // Subtle tinted drop-shadow per docs/05.
          elevation: isEnabled ? 2 : 0,
          shadowColor: AppColors.brand.withOpacity(0.2),
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.textInverse,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  if (icon != null) ...<Widget>[
                    Icon(icon, size: oversized ? 24 : 20),
                    const SizedBox(width: AppSpacing.s8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
