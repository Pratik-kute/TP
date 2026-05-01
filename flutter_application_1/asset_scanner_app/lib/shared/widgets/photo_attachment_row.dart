import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import 'secondary_button.dart';

/// "Add photo" → captured thumb → remove pattern. Single photo per slot.
class PhotoAttachmentRow extends StatelessWidget {
  const PhotoAttachmentRow({
    required this.label,
    required this.attached,
    required this.onAdd,
    required this.onRemove,
    this.required = false,
    this.errorText,
    super.key,
  });

  final String label;
  final bool attached;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final bool required;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(label, style: AppTypography.captionStrong),
            if (required) ...<Widget>[
              const SizedBox(width: 4),
              const Text(
                '*',
                style: TextStyle(
                  color: AppColors.danger,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 6),
        if (!attached)
          SecondaryButton(
            label: 'Add photo',
            icon: Icons.camera_alt_outlined,
            onPressed: onAdd,
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: AppRadius.all8,
              color: AppColors.surface,
            ),
            padding: const EdgeInsets.all(AppSpacing.s8),
            child: Row(
              children: <Widget>[
                Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: AppRadius.all8,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.image_outlined,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                const Expanded(
                  child: Text(
                    'Photo attached',
                    style: AppTypography.body,
                  ),
                ),
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.close),
                  color: AppColors.textSecondary,
                  tooltip: 'Remove',
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

/// Multi-photo variant. Capped at [max] photos. V1 caps at 1; the layout
/// is multi-ready so V2 (multi-photo per upload) is a one-line change.
class PhotoListRow extends StatelessWidget {
  const PhotoListRow({
    required this.label,
    required this.count,
    required this.onAdd,
    required this.onRemoveAt,
    this.max = 1,
    this.required = false,
    this.errorText,
    super.key,
  });

  final String label;
  final int count;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemoveAt;
  final int max;
  final bool required;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(label, style: AppTypography.captionStrong),
            if (required) ...<Widget>[
              const SizedBox(width: 4),
              const Text(
                '*',
                style: TextStyle(
                  color: AppColors.danger,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const Spacer(),
            Text(
              '$count of $max',
              style: AppTypography.caption,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: AppSpacing.s8,
          runSpacing: AppSpacing.s8,
          children: <Widget>[
            for (int i = 0; i < count; i++)
              _Thumb(onRemove: () => onRemoveAt(i)),
            if (count < max)
              InkWell(
                onTap: onAdd,
                borderRadius: AppRadius.all8,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppRadius.all8,
                    border: Border.all(
                      color: AppColors.border,
                      style: BorderStyle.solid,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.add_a_photo_outlined,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
          ],
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

class _Thumb extends StatelessWidget {
  const _Thumb({required this.onRemove});
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 80,
      height: 80,
      child: Stack(
        children: <Widget>[
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: AppColors.surface2,
              borderRadius: AppRadius.all8,
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.image_outlined,
              color: AppColors.textSecondary,
            ),
          ),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: const BoxDecoration(
                  color: AppColors.overlay,
                  borderRadius: AppRadius.pill,
                ),
                child: const Icon(
                  Icons.close,
                  size: 14,
                  color: AppColors.textInverse,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
