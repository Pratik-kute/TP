import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/theme.dart';
import '../../../core/utils/relative_time.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/activity_entry.dart';
import '../state/activity_controllers.dart';

class ActivityLogScreen extends ConsumerStatefulWidget {
  const ActivityLogScreen({this.assetId, super.key});

  final String? assetId;

  @override
  ConsumerState<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends ConsumerState<ActivityLogScreen> {
  int _currentPage = 1;
  String? _searchQuery;
  ActivityModule? _selectedModule;

  @override
  Widget build(BuildContext context) {
    if (widget.assetId != null) {
      return _buildAssetLog(context, widget.assetId!);
    } else {
      return _buildGlobalLog(context);
    }
  }

  Widget _buildAssetLog(BuildContext context, String assetId) {
    final state = ref.watch(activityListProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.brand),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Activity Log',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const [
          ScreenIdLabel(id: 16, name: 'Activity Log'),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(activityListProvider(assetId).notifier).refresh(),
        child: state.when(
          loading: () => const _Skeleton(),
          error: (_, __) => Padding(
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: EmptyState(
              icon: Icons.error_outline,
              title: 'Couldn\'t load activity',
              action: SecondaryButton(
                label: 'Retry',
                onPressed: () => ref.read(activityListProvider(assetId).notifier).refresh(),
              ),
            ),
          ),
          data: (entries) {
            if (entries.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: AppSpacing.s48),
                  EmptyState(
                    icon: Icons.history,
                    title: 'No activity yet',
                    message: 'Actions on this asset will show up here as they happen.',
                  ),
                ],
              );
            }
            return _Loaded(entries: entries);
          },
        ),
      ),
    );
  }

  Widget _buildGlobalLog(BuildContext context) {
    final state = ref.watch(globalActivityProvider((
      page: _currentPage,
      query: _searchQuery,
      module: _selectedModule,
    )));

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Activity Log',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const [
          ScreenIdLabel(id: 20, name: 'Global Activity'),
        ],
      ),
      body: Column(
        children: [
          state.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (paginated) => Padding(
              padding: const EdgeInsets.all(AppSpacing.s16),
              child: Row(
                children: [
                  Expanded(
                    child: StatCard(
                      label: 'Total Entries',
                      value: paginated.totalEntries.toString(),
                      icon: Icons.analytics_outlined,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: StatCard(
                      label: 'Today',
                      value: paginated.todayCount.toString(),
                      icon: Icons.today_outlined,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
            child: AppTextField(
              label: 'SEARCH',
              hint: 'Search logs...',
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                  _currentPage = 1;
                });
              },
            ),
          ),
          const SizedBox(height: AppSpacing.s8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(globalActivityProvider((
                page: _currentPage,
                query: _searchQuery,
                module: _selectedModule,
              )).notifier).refresh(),
              child: state.when(
                loading: () => const _Skeleton(),
                error: (_, __) => EmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn\'t load activity',
                  action: SecondaryButton(
                    label: 'Retry',
                    onPressed: () => ref.read(globalActivityProvider((
                      page: _currentPage,
                      query: _searchQuery,
                      module: _selectedModule,
                    )).notifier).refresh(),
                  ),
                ),
                data: (paginated) {
                  if (paginated.entries.isEmpty) {
                    return ListView(
                      children: const [
                        SizedBox(height: AppSpacing.s48),
                        EmptyState(
                          icon: Icons.history,
                          title: 'No matches found',
                        ),
                      ],
                    );
                  }
                  return Column(
                    children: [
                      Expanded(child: _Loaded(entries: paginated.entries)),
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

class _Loaded extends StatelessWidget {
  const _Loaded({required this.entries});

  final List<ActivityEntry> entries;

  Map<String, List<ActivityEntry>> _groupByDay() {
    final groups = <String, List<ActivityEntry>>{};
    for (final entry in entries) {
      final key = formatDateGroupHeader(entry.timestamp);
      groups.putIfAbsent(key, () => <ActivityEntry>[]).add(entry);
    }
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupByDay();
    final children = <Widget>[];
    var firstGroup = true;
    for (final groupEntry in groups.entries) {
      children.add(
        Padding(
          padding: EdgeInsets.only(
            top: firstGroup ? AppSpacing.s8 : AppSpacing.s24,
            bottom: AppSpacing.s12,
            left: AppSpacing.s4,
          ),
          child: Text(
            groupEntry.key.toUpperCase(),
            style: AppTypography.sectionLabel,
          ),
        ),
      );
      for (final entry in groupEntry.value) {
        children.add(_EntryCard(entry: entry));
        children.add(const SizedBox(height: AppSpacing.s8));
      }
      firstGroup = false;
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s16),
      children: children,
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.entry});

  final ActivityEntry entry;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      margin: const EdgeInsets.only(bottom: AppSpacing.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              StatusBadge(
                label: _badgeLabel(entry.actionType),
                tone: _badgeTone(entry.actionType),
              ),
              const Spacer(),
              Text(
                formatRelative(entry.timestamp),
                style: AppTypography.caption,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s12),
          Text(entry.summary, style: AppTypography.bodyStrong),
          const SizedBox(height: AppSpacing.s4),
          Text(
            '${entry.actorFullName} · ${_moduleLabel(entry.module)}',
            style: AppTypography.caption,
          ),
        ],
      ),
    );
  }

  String _badgeLabel(ActivityActionType type) => switch (type) {
        ActivityActionType.quickUpdate => 'Updated',
        ActivityActionType.create => 'Created',
        ActivityActionType.unassign => 'Unassigned',
        ActivityActionType.assign => 'Assigned',
        ActivityActionType.qrScanned => 'QR scan',
        ActivityActionType.delete => 'Deleted',
        ActivityActionType.other => 'Activity',
      };

  BadgeTone _badgeTone(ActivityActionType type) => switch (type) {
        ActivityActionType.quickUpdate => BadgeTone.info,
        ActivityActionType.create => BadgeTone.warning,
        ActivityActionType.unassign => BadgeTone.retired,
        ActivityActionType.assign => BadgeTone.retired,
        ActivityActionType.qrScanned => BadgeTone.success,
        ActivityActionType.delete => BadgeTone.danger,
        ActivityActionType.other => BadgeTone.neutral,
      };

  String _moduleLabel(ActivityModule m) => switch (m) {
        ActivityModule.assets => 'Assets',
        ActivityModule.maintenance => 'Maintenance',
        ActivityModule.repairs => 'Repairs',
        ActivityModule.recovery => 'Recovery',
        ActivityModule.audits => 'Audits',
        ActivityModule.photos => 'Photos',
        ActivityModule.allocations => 'Allocations',
      };
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.line(height: 12, width: 80),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 80, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 80, width: double.infinity),
        SizedBox(height: AppSpacing.s16),
        Skeleton.line(height: 12, width: 100),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 80, width: double.infinity),
      ],
    );
  }
}
