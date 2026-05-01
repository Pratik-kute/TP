import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import 'primary_button.dart';
import 'secondary_button.dart';

/// Standard confirm dialog. Returns true if the user confirmed.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title, style: AppTypography.subheading),
      content: Text(message, style: AppTypography.body),
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.s16,
        0,
        AppSpacing.s16,
        AppSpacing.s12,
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelLabel),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: TextButton.styleFrom(
            foregroundColor: destructive ? AppColors.danger : AppColors.brand,
          ),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

/// A bottom sheet that presents a result + 1–2 actions. Used for hard
/// interrupts (no internet, scan returned forbidden, submit failed).
Future<T?> showResultSheet<T>(
  BuildContext context, {
  required String title,
  required String message,
  required List<ResultSheetAction<T>> actions,
  IconData? icon,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isDismissible: false,
    enableDrag: false,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              Icon(icon, size: 32, color: AppColors.textSecondary),
              const SizedBox(height: AppSpacing.s12),
            ],
            Text(title, style: AppTypography.subheading),
            const SizedBox(height: AppSpacing.s8),
            Text(message, style: AppTypography.body),
            const SizedBox(height: AppSpacing.s24),
            for (int i = 0; i < actions.length; i++) ...<Widget>[
              if (i == 0)
                PrimaryButton(
                  label: actions[i].label,
                  onPressed: () => Navigator.of(context).pop(actions[i].value),
                )
              else
                SecondaryButton(
                  label: actions[i].label,
                  onPressed: () => Navigator.of(context).pop(actions[i].value),
                ),
              if (i < actions.length - 1) const SizedBox(height: AppSpacing.s8),
            ],
          ],
        ),
      ),
    ),
  );
}

class ResultSheetAction<T> {
  const ResultSheetAction({required this.label, required this.value});
  final String label;
  final T value;
}
