import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A horizontal label/value row used in the State block (Asset Details) and
/// the Profile block (Settings).
///
/// If [value] is null/empty, renders a muted "—" so the layout never collapses.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    required this.label,
    this.value,
    this.valueWidget,
    super.key,
  });

  final String label;
  final String? value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 120,
            child: Text(label, style: AppTypography.bodyMuted),
          ),
          const SizedBox(width: AppSpacing.s12),
          Expanded(
            child: valueWidget ??
                Text(
                  (value == null || value!.isEmpty) ? '—' : value!,
                  style: AppTypography.body.copyWith(
                    color: (value == null || value!.isEmpty)
                        ? AppColors.textMuted
                        : AppColors.textPrimary,
                  ),
                ),
          ),
        ],
      ),
    );
  }
}
