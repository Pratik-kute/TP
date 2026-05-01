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

/// Read-only detail of a scheduled maintenance item. Reads from the existing
/// [maintenanceListProvider] — no separate controller, since the list
/// controller already loads all due items for the asset.
///
/// `MaintenanceScheduleItem` does not yet carry a description field; the
/// description card is intentionally omitted rather than rendering a
/// placeholder. See `docs/known-issues.md`.
class MaintenanceScheduleDetailScreen extends ConsumerWidget {
  const MaintenanceScheduleDetailScreen({
    required this.assetId,
    required this.scheduleId,
    super.key,
  });

  final String assetId;
  final String scheduleId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(maintenanceListProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scheduled'),
        actions: const <Widget>[
          ScreenIdLabel(id: 11, name: 'Maintenance Schedule Detail'),
        ],
      ),
      body: state.when(
        loading: () => const _Skeleton(),
        error: (_, __) => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load this scheduled item',
          ),
        ),
        data: (data) {
          final MaintenanceScheduleItem? item = data.due
              .where((i) => i.id == scheduleId)
              .cast<MaintenanceScheduleItem?>()
              .firstWhere((_) => true, orElse: () => null);
          if (item == null) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.s16),
              child: EmptyState(
                icon: Icons.task_alt,
                title: 'Already completed',
                message: 'This scheduled item is no longer in the due list.',
              ),
            );
          }
          return _Loaded(item: item);
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: PrimaryButton(
            label: 'Log completion',
            icon: Icons.add,
            onPressed: () => context.pushNamed(
              AppRoute.logMaintenance,
              pathParameters: <String, String>{'assetId': assetId},
              queryParameters: <String, String>{
                'scheduledItemId': scheduleId,
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.item});

  final MaintenanceScheduleItem item;

  @override
  Widget build(BuildContext context) {
    final due = formatDue(item.dueAt);
    final dueDate = DateFormat('d MMM yyyy').format(item.dueAt);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: <Widget>[
        Text(item.taskType.name, style: AppTypography.pageTitle),
        const SizedBox(height: AppSpacing.s4),
        StatusBadge(
          label: due.label,
          tone: due.isOverdue ? BadgeTone.danger : BadgeTone.warning,
        ),
        const SizedBox(height: AppSpacing.s24),
        _Card(
          children: <Widget>[
            const Text('When', style: AppTypography.captionStrong),
            const SizedBox(height: AppSpacing.s8),
            KeyValueRow(label: 'Due date', value: dueDate),
            KeyValueRow(label: 'Status', value: due.label),
          ],
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.all8,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.line(height: 24, width: 200),
        SizedBox(height: AppSpacing.s8),
        Skeleton.line(height: 14, width: 120),
        SizedBox(height: AppSpacing.s24),
        Skeleton.rect(height: 120, width: double.infinity),
      ],
    );
  }
}
