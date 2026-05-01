import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// Horizontal strip of photo thumbnails. Tap → opens [Lightbox].
///
/// In this UI scaffold, photos are placeholder grey boxes. When the camera
/// plugin is wired in, replace [_ThumbPlaceholder] with a real image widget.
///
/// When [maxVisible] is set and there are more photos than that, the strip
/// renders `maxVisible` thumbs followed by a "View all (N)" tile (where
/// N = total photos). Tapping the tile invokes [onViewAllTap]. If
/// [onViewAllTap] is null, the overflow tile is suppressed (the strip caps
/// at `maxVisible`).
class PhotoThumbStrip extends StatelessWidget {
  const PhotoThumbStrip({
    required this.photoIds,
    this.size = 88,
    this.maxVisible,
    this.onViewAllTap,
    super.key,
  });

  final List<String> photoIds;
  final double size;
  final int? maxVisible;
  final VoidCallback? onViewAllTap;

  @override
  Widget build(BuildContext context) {
    if (photoIds.isEmpty) {
      return Container(
        height: size,
        alignment: Alignment.centerLeft,
        child: const Text(
          'No photos yet',
          style: AppTypography.bodyMuted,
        ),
      );
    }

    final cap = maxVisible;
    final showOverflow =
        cap != null && photoIds.length > cap && onViewAllTap != null;
    final visibleCount = cap == null
        ? photoIds.length
        : (photoIds.length < cap ? photoIds.length : cap);
    final itemCount = visibleCount + (showOverflow ? 1 : 0);

    return SizedBox(
      height: size,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s8),
        itemBuilder: (_, i) {
          if (showOverflow && i == visibleCount) {
            return _ViewAllTile(
              size: size,
              total: photoIds.length,
              onTap: onViewAllTap!,
            );
          }
          return _ThumbPlaceholder(
            size: size,
            onTap: () => Lightbox.open(context, photoIds[i]),
          );
        },
      ),
    );
  }
}

class _ThumbPlaceholder extends StatelessWidget {
  const _ThumbPlaceholder({required this.size, required this.onTap});
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.all8,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: AppRadius.all8,
          border: Border.all(color: AppColors.border),
        ),
        alignment: Alignment.center,
        child: const Icon(
          Icons.image_outlined,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _ViewAllTile extends StatelessWidget {
  const _ViewAllTile({
    required this.size,
    required this.total,
    required this.onTap,
  });

  final double size;
  final int total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.all8,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: AppRadius.all8,
          border: Border.all(color: AppColors.border),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            const Icon(
              Icons.photo_library_outlined,
              color: AppColors.brand,
              size: 22,
            ),
            const SizedBox(height: 4),
            Text(
              'View all ($total)',
              style: AppTypography.captionStrong.copyWith(
                color: AppColors.brand,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Read-only fullscreen photo viewer. Pinch-zoom + swipe to dismiss.
class Lightbox extends StatelessWidget {
  const Lightbox({required this.photoId, super.key});

  final String photoId;

  static Future<void> open(BuildContext context, String photoId) {
    return Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => Lightbox(photoId: photoId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: <Widget>[
            Center(
              child: InteractiveViewer(
                maxScale: 4,
                child: Container(
                  width: 320,
                  height: 320,
                  color: AppColors.textPrimary,
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.image_outlined,
                    color: AppColors.textInverse,
                    size: 64,
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
