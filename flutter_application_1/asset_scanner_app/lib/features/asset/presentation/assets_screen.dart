import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/asset.dart';
import '../state/asset_list_controller.dart';

class AssetsScreen extends ConsumerStatefulWidget {
  const AssetsScreen({super.key});

  @override
  ConsumerState<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends ConsumerState<AssetsScreen> {
  int _currentPage = 1;
  String? _searchQuery;
  AssetStatus? _selectedStatus;

  final List<({AssetStatus? status, String label})> _filters = [
    (status: null, label: 'All'),
    (status: AssetStatus.available, label: 'Available'),
    (status: AssetStatus.allocated, label: 'Allocated'),
    (status: AssetStatus.inUse, label: 'In Use (Shared)'),
    (status: AssetStatus.underMaintenance, label: 'Under Maintenance'),
    (status: AssetStatus.retired, label: 'Retired'),
    (status: AssetStatus.disposed, label: 'Disposed'),
    (status: AssetStatus.dead, label: 'Dead'),
  ];

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(assetListProvider((
      page: _currentPage,
      query: _searchQuery,
      status: _selectedStatus,
    )));

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Assets',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const [
          ScreenIdLabel(id: 23, name: 'Assets'),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: AppTextField(
              label: 'SEARCH',
              hint: 'Search assets...',
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                  _currentPage = 1;
                });
              },
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.s8),
              itemBuilder: (context, index) {
                final filter = _filters[index];
                final isSelected = _selectedStatus == filter.status;
                return FilterChip(
                  label: Text(filter.label),
                  selected: isSelected,
                  onSelected: (selected) {
                    setState(() {
                      _selectedStatus = filter.status;
                      _currentPage = 1;
                    });
                  },
                  backgroundColor: AppColors.surface,
                  selectedColor: AppColors.brand.withOpacity(0.2),
                  labelStyle: AppTypography.captionStrong.copyWith(
                    color:
                        isSelected ? AppColors.brand : AppColors.textSecondary,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.pill,
                    side: BorderSide(
                      color: isSelected ? AppColors.brand : AppColors.border,
                    ),
                  ),
                  showCheckmark: false,
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.s16),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref
                  .read(assetListProvider((
                    page: _currentPage,
                    query: _searchQuery,
                    status: _selectedStatus,
                  )).notifier)
                  .refresh(),
              child: state.when(
                loading: () => const _Skeleton(),
                error: (_, __) => EmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn\'t load assets',
                  action: SecondaryButton(
                    label: 'Retry',
                    onPressed: () => ref
                        .read(assetListProvider((
                          page: _currentPage,
                          query: _searchQuery,
                          status: _selectedStatus,
                        )).notifier)
                        .refresh(),
                  ),
                ),
                data: (paginated) {
                  if (paginated.assets.isEmpty) {
                    return ListView(
                      children: const [
                        SizedBox(height: AppSpacing.s48),
                        EmptyState(
                          icon: Icons.inventory_2_outlined,
                          title: 'No assets found',
                        ),
                      ],
                    );
                  }
                  return Column(
                    children: [
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.s16),
                          itemCount: paginated.assets.length,
                          itemBuilder: (context, index) {
                            final asset = paginated.assets[index];
                            return _AssetCard(asset: asset);
                          },
                        ),
                      ),
                      PaginationControl(
                        currentPage: paginated.currentPage,
                        totalPages: paginated.totalPages,
                        onNext: paginated.currentPage < paginated.totalPages
                            ? () => setState(() => _currentPage++)
                            : null,
                        onPrevious: paginated.currentPage > 1
                            ? () => setState(() => _currentPage--)
                            : null,
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssetCard extends StatelessWidget {
  const _AssetCard({required this.asset});

  final Asset asset;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.s12),
      onTap: () => context.pushNamed(
        AppRoute.assetDetails,
        pathParameters: {'assetId': asset.id},
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: AppRadius.all8,
              ),
              child: Icon(
                _getCategoryIcon(asset.category.name),
                color: AppColors.brand,
              ),
            ),
            const SizedBox(width: AppSpacing.s16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    asset.name,
                    style: AppTypography.bodyStrong,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    asset.assetCode,
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.s8),
            StatusBadge(
              label: _getStatusLabel(asset.status),
              tone: _getStatusTone(asset.status),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    if (category.toLowerCase().contains('laptop')) return Icons.laptop;
    if (category.toLowerCase().contains('monitor')) return Icons.monitor;
    return Icons.inventory_2_outlined;
  }

  String _getStatusLabel(AssetStatus status) => switch (status) {
        AssetStatus.available => 'Available',
        AssetStatus.allocated => 'Allocated',
        AssetStatus.inUse => 'In Use',
        AssetStatus.underMaintenance => 'Maintenance',
        AssetStatus.retired => 'Retired',
        AssetStatus.disposed => 'Disposed',
        AssetStatus.dead => 'Dead',
      };

  BadgeTone _getStatusTone(AssetStatus status) => switch (status) {
        AssetStatus.available => BadgeTone.success,
        AssetStatus.allocated => BadgeTone.retired,
        AssetStatus.inUse => BadgeTone.info,
        AssetStatus.underMaintenance => BadgeTone.warning,
        AssetStatus.retired => BadgeTone.neutral,
        AssetStatus.disposed => BadgeTone.danger,
        AssetStatus.dead => BadgeTone.danger,
      };
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.s16),
      itemCount: 5,
      itemBuilder: (context, index) => const Padding(
        padding: EdgeInsets.only(bottom: AppSpacing.s12),
        child: Skeleton.rect(height: 80, width: double.infinity),
      ),
    );
  }
}
