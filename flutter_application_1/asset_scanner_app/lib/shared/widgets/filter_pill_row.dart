import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

class FilterPillRow<T> extends StatelessWidget {
  const FilterPillRow({
    required this.options,
    required this.value,
    required this.onChanged,
    required this.itemLabel,
    super.key,
  });

  final List<T> options;
  final T value;
  final ValueChanged<T> onChanged;
  final String Function(T) itemLabel;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      child: Row(
        children: <Widget>[
          for (final option in options) ...<Widget>[
            _Pill(
              label: itemLabel(option),
              selected: option == value,
              onTap: () => onChanged(option),
            ),
            const SizedBox(width: AppSpacing.s8),
          ],
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.brand : AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.pill,
        side: BorderSide(
          color: selected ? AppColors.brand : AppColors.border,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pill,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.s12,
            vertical: AppSpacing.s8,
          ),
          child: Text(
            label,
            style: AppTypography.captionStrong.copyWith(
              color: selected ? AppColors.textInverse : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
