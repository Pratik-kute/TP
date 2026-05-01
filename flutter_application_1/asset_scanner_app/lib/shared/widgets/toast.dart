import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// Shows a brief 2s toast at the bottom. Per UX spec §5.5 — used for normal
/// completion ("Photo added", "Maintenance logged").
void showAppToast(BuildContext context, String message) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger.clearSnackBars();
  messenger.showSnackBar(
    SnackBar(
      content: Text(
        message,
        style: AppTypography.body.copyWith(
          color: AppColors.textInverse,
        ),
      ),
      duration: const Duration(seconds: 2),
      margin: const EdgeInsets.all(AppSpacing.s16),
    ),
  );
}
