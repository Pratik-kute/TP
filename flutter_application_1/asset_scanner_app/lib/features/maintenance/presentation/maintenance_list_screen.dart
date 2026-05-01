import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/relative_time.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/maintenance.dart';
import '../state/maintenance_controllers.dart';

class MaintenanceListScreen extends ConsumerWidget {
  const MaintenanceListScreen({required this.assetId, super.key});

  final String assetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(maintenanceListProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.brand),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Maintenance',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const <Widget>[
          ScreenIdLabel(id: '9', name: 'Maintenance List'),
        ],
      ),
      body: state.when(
        loading: () => const _Skeleton(),
        error: (e, _) => Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load maintenance',
            action: SecondaryButton(
              label: 'Retry',
              onPressed: () =>
                  ref.read(maintenanceListProvider(assetId).notifier).refresh(),
            ),
          ),
        ),
        data: (data) => _Loaded(assetId: assetId, data: data),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: PrimaryButton(
            label: 'Log maintenance',
            icon: Icons.add,
            onPressed: () => context.pushNamed(
              AppRoute.logMaintenance,
              pathParameters: <String, String>{'assetId': assetId},
            ),
          ),
        ),
      ),
    );
  }
}

class _Loaded extends ConsumerWidget {
  const _Loaded({required this.assetId, required this.data});

  final String assetId;
  final MaintenanceListResult data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasContent = data.due.isNotEmpty || data.history.isNotEmpty;
    if (!hasContent) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.s16),
        child: EmptyState(
          icon: Icons.task_alt,
          title: 'No maintenance yet',
          message: 'Log routine cleanings, firmware updates, and checks here.',
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(maintenanceListProvider(assetId).notifier).refresh(),
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: <Widget>[
          if (data.due
              .any((i) => i.dueAt.isBefore(DateTime.now()))) ...<Widget>[
            CalloutBlock(
              title: 'NEEDS ATTENTION',
              message:
                  '${data.due.where((i) => i.dueAt.isBefore(DateTime.now())).length} item overdue. Address it to keep the asset healthy.',
              type: CalloutType.danger,
            ),
            const SizedBox(height: AppSpacing.s24),
          ],
          if (data.due.isNotEmpty) ...<Widget>[
            const _SectionHeader('DUE'),
            for (final item in data.due) _DueRow(assetId: assetId, item: item),
            const SizedBox(height: AppSpacing.s24),
          ],
          if (data.history.isNotEmpty) ...<Widget>[
            const _SectionHeader('HISTORY'),
            for (final entry in data.history)
              _HistoryRow(assetId: assetId, entry: entry),
          ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s12),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.sectionLabel,
      ),
    );
  }
}

class _DueRow extends StatelessWidget {
  const _DueRow({required this.assetId, required this.item});
  final String assetId;
  final MaintenanceScheduleItem item;

  @override
  Widget build(BuildContext context) {
    final due = formatDue(item.dueAt);
    // The whole row navigates to the schedule detail; the "Complete" button
    // keeps its quick-path nav (its own GestureDetector consumes the tap).
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s12),
      child: InfoCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          onTap: () => context.pushNamed(
            AppRoute.maintenanceScheduleDetail,
            pathParameters: <String, String>{
              'assetId': assetId,
              'scheduleId': item.id,
            },
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: Row(
              children: <Widget>[
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.brandSoft,
                    borderRadius: AppRadius.all8,
                  ),
                  child: const Icon(
                    Icons.battery_charging_full,
                    size: 18,
                    color: AppColors.brand,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(item.taskType.name, style: AppTypography.bodyStrong),
                      const SizedBox(height: 4),
                      Text(
                        'Scheduled: ${DateFormat('MMM d, yyyy').format(item.dueAt)}',
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
                StatusBadge(
                  label: due.label,
                  tone: due.isOverdue ? BadgeTone.danger : BadgeTone.warning,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.assetId, required this.entry});
  final String assetId;
  final MaintenanceEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s8),
      child: InfoCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          onTap: () => context.pushNamed(
            AppRoute.maintenanceEntryDetail,
            pathParameters: <String, String>{
              'assetId': assetId,
              'entryId': entry.id,
            },
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: Row(
              children: <Widget>[
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: AppRadius.all8,
                  ),
                  child: Icon(
                    _iconFor(entry.taskType),
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(width: AppSpacing.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(entry.taskType.name, style: AppTypography.body),
                      Text(
                        DateFormat('MMM d, yyyy').format(entry.performedAt),
                        style: AppTypography.caption,
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  size: 20,
                  color: AppColors.border,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _iconFor(MaintenanceTaskType type) {
    // Mapping some icons for history items
    if (type.name.toLowerCase().contains('cleaning'))
      return Icons.cleaning_services_outlined;
    if (type.name.toLowerCase().contains('update'))
      return Icons.system_update_outlined;
    return Icons.build_outlined;
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.rect(height: 64, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 64, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 64, width: double.infinity),
      ],
    );
  }
}
