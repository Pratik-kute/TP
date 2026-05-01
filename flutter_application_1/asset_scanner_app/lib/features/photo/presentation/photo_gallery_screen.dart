import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/state/asset_details_controller.dart';

/// Read-only 3-column photo grid for an asset. Reads from
/// [assetDetailsControllerProvider] — no separate controller, the asset is
/// the same scope.
class PhotoGalleryScreen extends ConsumerWidget {
  const PhotoGalleryScreen({required this.assetId, super.key});

  final String assetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assetDetailsControllerProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Photos'),
        actions: const <Widget>[
          ScreenIdLabel(id: '8', name: 'Photo Gallery'),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref
            .read(assetDetailsControllerProvider(assetId).notifier)
            .refresh(),
        child: state.when(
          loading: () => const _Skeleton(),
          error: (_, __) => const Padding(
            padding: EdgeInsets.all(AppSpacing.s16),
            child: EmptyState(
              icon: Icons.error_outline,
              title: 'Couldn\'t load photos',
            ),
          ),
          data: (result) {
            final photos = result.asset.recentPhotos;
            if (photos.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const <Widget>[
                  SizedBox(height: AppSpacing.s48),
                  EmptyState(
                    icon: Icons.image_outlined,
                    title: 'No photos yet',
                    message: 'Add a photo from the asset details screen.',
                  ),
                ],
              );
            }
            return GridView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.s16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: AppSpacing.s8,
                mainAxisSpacing: AppSpacing.s8,
              ),
              itemCount: photos.length,
              itemBuilder: (_, i) {
                final photo = photos[i];
                return InkWell(
                  onTap: () => Lightbox.open(context, photo.id),
                  borderRadius: AppRadius.all8,
                  child: Container(
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
              },
            );
          },
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      padding: const EdgeInsets.all(AppSpacing.s16),
      crossAxisCount: 3,
      crossAxisSpacing: AppSpacing.s8,
      mainAxisSpacing: AppSpacing.s8,
      children: List<Widget>.generate(
        9,
        (_) => const Skeleton.rect(height: 100, width: 100),
      ),
    );
  }
}
