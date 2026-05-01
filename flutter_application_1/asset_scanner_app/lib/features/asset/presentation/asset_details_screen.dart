import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/asset.dart';
import '../state/asset_details_controller.dart';

class AssetDetailsScreen extends ConsumerWidget {
  const AssetDetailsScreen({required this.assetId, super.key});

  final String assetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assetDetailsControllerProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Asset'),
        actions: const <Widget>[
          ScreenIdLabel(id: 5, name: 'Asset Details'),
        ],
      ),
      body: state.when(
        loading: () => const _LoadingSkeleton(),
        error: (err, _) => Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load this asset',
            message: err.toString(),
            action: PrimaryButton(
              label: 'Retry',
              onPressed: () => ref
                  .read(assetDetailsControllerProvider(assetId).notifier)
                  .refresh(),
            ),
          ),
        ),
        data: (result) => _Loaded(assetId: assetId, result: result),
      ),
    );
  }
}

class _Loaded extends ConsumerWidget {
  const _Loaded({required this.assetId, required this.result});

  final String assetId;
  final AssetLookupResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asset = result.asset;

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(assetDetailsControllerProvider(assetId).notifier).refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          0,
          0,
          0,
          AppSpacing.s24,
        ),
        children: <Widget>[
          _HeroPhoto(assetId: assetId, photoCount: asset.recentPhotos.length),
          const SizedBox(height: AppSpacing.s16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                IdentityHeader(
                  title: asset.name,
                  code: asset.assetCode,
                  onCopyCode: () {
                    Clipboard.setData(ClipboardData(text: asset.assetCode));
                    showAppToast(context, 'Asset code copied');
                  },
                  belowCode: StatusBadge(
                    label: _statusLabel(asset.status),
                    tone: _statusTone(asset.status),
                  ),
                ),
                if (result.overdueMaintenanceCount > 0) ...<Widget>[
                  const SizedBox(height: AppSpacing.s16),
                  CalloutBlock(
                    title: 'NEEDS ATTENTION',
                    message:
                        '${result.overdueMaintenanceCount} maintenance item${result.overdueMaintenanceCount > 1 ? 's' : ''} overdue',
                    type: CalloutType.warning,
                  ),
                ],
                const SizedBox(height: AppSpacing.s16),
                InfoCard(
                  label: 'Location',
                  icon: Icons.location_on_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(asset.currentLocation?.name ?? 'Unknown',
                          style: AppTypography.body),
                      if (asset.lastVerifiedAt != null) ...<Widget>[
                        const SizedBox(height: 4),
                        Text(
                          'Last verified ${DateFormat('d MMM yyyy').format(asset.lastVerifiedAt!)}',
                          style: AppTypography.caption,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.s12),
                InfoCard(
                  label: 'Assigned To',
                  icon: Icons.person_outline,
                  child: asset.assignedToUser == null
                      ? const Text('Unassigned', style: AppTypography.body)
                      : Row(
                          children: <Widget>[
                            CircleAvatar(
                              radius: 20,
                              backgroundColor: AppColors.brandSoft,
                              child: Text(
                                asset.assignedToUser!.fullName
                                    .split(' ')
                                    .map((s) => s[0])
                                    .take(2)
                                    .join(),
                                style: const TextStyle(
                                  color: AppColors.brand,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.s12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(asset.assignedToUser!.fullName,
                                      style: AppTypography.bodyStrong),
                                  Text('User ID: ${asset.assignedToUser!.id}',
                                      style: AppTypography.caption),
                                ],
                              ),
                            ),
                          ],
                        ),
                ),
                const SizedBox(height: AppSpacing.s12),
                InfoCard(
                  label: 'Recent Photos',
                  icon: Icons.photo_camera_outlined,
                  child: PhotoThumbStrip(
                    photoIds: asset.recentPhotos
                        .map((p) => p.id)
                        .toList(growable: false),
                    maxVisible: 4,
                    onViewAllTap: () => context.pushNamed(
                      AppRoute.photoGallery,
                      pathParameters: <String, String>{'assetId': assetId},
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.s24),
                const Text(
                  'ACTIONS',
                  style: AppTypography.sectionLabel,
                ),
                const SizedBox(height: AppSpacing.s12),
                _ActionGrid(
                  assetId: assetId,
                  permittedActions: result.permittedActions,
                  auditContext: result.auditContext,
                  overdueCount: result.overdueMaintenanceCount,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _statusLabel(AssetStatus s) {
    switch (s) {
      case AssetStatus.available:
        return 'Available';
      case AssetStatus.allocated:
        return 'Allocated';
      case AssetStatus.inUse:
        return 'In use';
      case AssetStatus.underMaintenance:
        return 'Under maintenance';
      case AssetStatus.retired:
        return 'Retired';
      case AssetStatus.disposed:
        return 'Disposed';
      case AssetStatus.dead:
        return 'Dead';
    }
  }

  BadgeTone _statusTone(AssetStatus s) {
    switch (s) {
      case AssetStatus.available:
        return BadgeTone.available;
      case AssetStatus.allocated:
        return BadgeTone.assigned;
      case AssetStatus.inUse:
        return BadgeTone.info;
      case AssetStatus.underMaintenance:
        return BadgeTone.repair;
      case AssetStatus.retired:
        return BadgeTone.retired;
      case AssetStatus.disposed:
        return BadgeTone.lost;
      case AssetStatus.dead:
        return BadgeTone.lost;
    }
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.line(height: 24, width: 240),
        SizedBox(height: AppSpacing.s8),
        Skeleton.line(height: 14, width: 160),
        SizedBox(height: AppSpacing.s24),
        Skeleton.line(height: 14, width: 120),
        SizedBox(height: AppSpacing.s8),
        Skeleton.line(height: 14, width: 200),
        SizedBox(height: AppSpacing.s8),
        Skeleton.line(height: 14, width: 180),
        SizedBox(height: AppSpacing.s24),
        Skeleton.rect(height: 88, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 88, width: double.infinity),
      ],
    );
  }
}

class _HeroPhoto extends StatelessWidget {
  const _HeroPhoto({required this.assetId, required this.photoCount});

  final String assetId;
  final int photoCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      child: Container(
        height: 240,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: AppRadius.all16 * 1.5,
          image: const DecorationImage(
            image: NetworkImage(
              'https://lh3.googleusercontent.com/aida-public/AB6AXuCTuwATh-FuTgiQNRSl3dK12a9urWWiqw24t8JLN5SGCuAmIxQ4a2SnCxA7VqjE3mXy1N76UqfQuXRGS1qNfjfvKJGe6bEWN8WLI3Vn8Yx6YlyFV0Hva8t4QCEQNS6rQusw2DDQuJ1IcdSgz8q_ixu6raJC1rCiFA07CetopKrvGC-Cmzc5676HI0pj3pWvWlM1fGGGdOld6r_a0Rt9UqCwo11kBwVKvTh3rIA3EcAFEGuF5P7Y2Q_q9X14j4OLQn_twxS-6MQ64JAF',
            ),
            fit: BoxFit.cover,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: <Widget>[
            Positioned(
              bottom: 16,
              left: 16,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.4),
                  borderRadius: AppRadius.pill,
                ),
                child: Row(
                  children: <Widget>[
                    const Icon(Icons.photo_library,
                        color: Colors.white, size: 14),
                    const SizedBox(width: 8),
                    Text(
                      '$photoCount photos',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionGrid extends StatelessWidget {
  const _ActionGrid({
    required this.assetId,
    required this.permittedActions,
    required this.auditContext,
    required this.overdueCount,
  });

  final String assetId;
  final List<PermittedAction> permittedActions;
  final AuditContext? auditContext;
  final int overdueCount;

  bool _has(PermittedAction a) => permittedActions.contains(a);

  @override
  Widget build(BuildContext context) {
    final actions = <ActionCard>[];

    if (_has(PermittedAction.addPhoto)) {
      actions.add(ActionCard(
        label: 'Add photo',
        icon: Icons.add_a_photo_outlined,
        onTap: () => context.pushNamed(
          AppRoute.photoCapture,
          pathParameters: {'assetId': assetId},
          queryParameters: {'context': 'standalone'},
        ),
      ));
    }

    if (_has(PermittedAction.logMaintenance)) {
      actions.add(ActionCard(
        label: 'Maintenance',
        icon: Icons.build_outlined,
        onTap: () => context.pushNamed(
          AppRoute.maintenanceList,
          pathParameters: {'assetId': assetId},
        ),
      ));
    }

    if (_has(PermittedAction.raiseRepair) ||
        _has(PermittedAction.updateRepair)) {
      actions.add(ActionCard(
        label: 'Repairs',
        icon: Icons.construction_outlined,
        onTap: () => context.pushNamed(
          AppRoute.repairsList,
          pathParameters: {'assetId': assetId},
        ),
      ));
    }

    if (_has(PermittedAction.markRecovery)) {
      actions.add(ActionCard(
        label: 'Recovery',
        icon: Icons.replay_outlined,
        onTap: () => context.pushNamed(
          AppRoute.markRecovery,
          pathParameters: {'assetId': assetId},
        ),
      ));
    }

    if (_has(PermittedAction.verifyAudit) && auditContext != null) {
      actions.add(ActionCard(
        label: 'Audit',
        icon: Icons.fact_check_outlined,
        onTap: () => context.pushNamed(
          AppRoute.auditVerification,
          pathParameters: {'assetId': assetId},
        ),
      ));
    }

    actions.add(ActionCard(
      label: 'Activity Log',
      icon: Icons.history_edu_outlined,
      onTap: () => context.pushNamed(
        'asset-activity-log', // Use the new specific route name
        pathParameters: {'assetId': assetId},
      ),
    ));

    return ActionGrid(actions: actions);
  }
}
