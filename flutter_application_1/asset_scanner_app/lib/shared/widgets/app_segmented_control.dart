import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A small segmented control. Used for severity (Low/Medium/High) and
/// recovery condition (Good/Damaged/Needs repair).
class AppSegmentedControl<T> extends StatelessWidget {
  const AppSegmentedControl({
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    required this.itemLabel,
    this.errorText,
    super.key,
  });

  final String label;
  final List<T> options;
  final T? value;
  final ValueChanged<T> onChanged;
  final String Function(T) itemLabel;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: AppTypography.captionStrong),
        const SizedBox(height: 6),
        Container(
          height: 44,
          decoration: const BoxDecoration(
            color: AppColors.surface2,
            borderRadius: AppRadius.all8,
          ),
          padding: const EdgeInsets.all(2),
          child: Row(
            children: <Widget>[
              for (final option in options)
                Expanded(
                  child: _Segment<T>(
                    label: itemLabel(option),
                    selected: option == value,
                    onTap: () => onChanged(option),
                  ),
                ),
            ],
          ),
        ),
        if (errorText != null) ...<Widget>[
          const SizedBox(height: 4),
          Text(
            errorText!,
            style: AppTypography.caption.copyWith(color: AppColors.danger),
          ),
        ],
      ],
    );
  }
}

class _Segment<T> extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.symmetric(horizontal: 1),
        decoration: BoxDecoration(
          color: selected ? AppColors.surface : Colors.transparent,
          borderRadius: AppRadius.all8,
          boxShadow: selected
              ? <BoxShadow>[
                  BoxShadow(
                    color: AppColors.textPrimary.withValues(alpha: 0.06),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTypography.captionStrong.copyWith(
            color: selected ? AppColors.textPrimary : AppColors.textSecondary,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
