import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../core/utils/relative_time.dart';
import 'photo_thumb_strip.dart';

/// A single entry in a vertical update timeline (Repair Detail).
///
/// Photo handling is mid-migration: [hasPhoto] is the legacy flag, [photoId]
/// is the new field. Pass either; when [photoId] is non-null the thumb is
/// tappable and opens the [Lightbox]. Both stay in sync (truth-derived from
/// `photoId`) until the broader `bool hasPhoto` → `List<String> photoIds`
/// migration lands.
class UpdateEntry extends StatelessWidget {
  const UpdateEntry({
    required this.actor,
    required this.timestamp,
    this.note,
    this.statusBefore,
    this.statusAfter,
    this.hasPhoto = false,
    this.photoId,
    this.isFirst = false,
    this.isLast = false,
    super.key,
  });

  final String actor;
  final DateTime timestamp;
  final String? note;
  final String? statusBefore;
  final String? statusAfter;
  final bool hasPhoto;
  final String? photoId;
  final bool isFirst;
  final bool isLast;

  bool get _showPhoto => photoId != null || hasPhoto;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 24,
            child: Column(
              children: <Widget>[
                Container(
                  width: 2,
                  height: 12,
                  color: isFirst ? Colors.transparent : AppColors.border,
                ),
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: AppColors.brand,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: AppColors.border),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.s12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(actor, style: AppTypography.bodyStrong),
                      ),
                      Text(
                        formatRelative(timestamp),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                  if (statusBefore != null && statusAfter != null) ...<Widget>[
                    const SizedBox(height: AppSpacing.s4),
                    Text(
                      'Status: $statusBefore → $statusAfter',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.brand,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (note != null && note!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: AppSpacing.s8),
                    Text(note!, style: AppTypography.body),
                  ],
                  if (_showPhoto) ...<Widget>[
                    const SizedBox(height: AppSpacing.s8),
                    _PhotoThumb(photoId: photoId),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({required this.photoId});

  final String? photoId;

  @override
  Widget build(BuildContext context) {
    final thumb = Container(
      width: 64,
      height: 64,
      decoration: const BoxDecoration(
        color: AppColors.surface2,
        borderRadius: AppRadius.all8,
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.image_outlined,
        color: AppColors.textSecondary,
      ),
    );
    final id = photoId;
    if (id == null) return thumb;
    return InkWell(
      onTap: () => Lightbox.open(context, id),
      borderRadius: AppRadius.all8,
      child: thumb,
    );
  }
}
