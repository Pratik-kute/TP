import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/theme.dart';
import '../../../core/utils/relative_time.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/maintenance.dart';
import '../state/maintenance_controllers.dart';

/// Read-only detail of a logged maintenance entry. Reads from the existing
/// [maintenanceListProvider] — same scope as the list screen.
///
/// `MaintenanceEntry` carries `hasPhoto: bool` but no `photoId` field today
/// (parallel to `RepairUpdate`'s deferred migration). The thumb opens the
/// existing `Lightbox` keyed on `entry.id` as a stable placeholder; when the
/// `photoIds` migration lands, swap to the real id.
class MaintenanceEntryDetailScreen extends ConsumerWidget {
  const MaintenanceEntryDetailScreen({
    required this.assetId,
    required this.entryId,
    super.key,
  });

  final String assetId;
  final String entryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(maintenanceListProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Maintenance entry'),
        actions: const <Widget>[
          ScreenIdLabel(id: 12, name: 'Maintenance Entry Detail'),
        ],
      ),
      body: state.when(
        loading: () => const _Skeleton(),
        error: (_, __) => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load this entry',
          ),
        ),
        data: (data) {
          final MaintenanceEntry? entry = data.history
              .where((e) => e.id == entryId)
              .cast<MaintenanceEntry?>()
              .firstWhere((_) => true, orElse: () => null);
          if (entry == null) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.s16),
              child: EmptyState(
                icon: Icons.history,
                title: 'Entry not found',
              ),
            );
          }
          return _Loaded(entry: entry);
        },
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.entry});

  final MaintenanceEntry entry;

  @override
  Widget build(BuildContext context) {
    final performedDate = DateFormat('d MMM yyyy').format(entry.performedAt);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: <Widget>[
        Text(entry.taskType.name, style: AppTypography.pageTitle),
        const SizedBox(height: AppSpacing.s24),
        _Card(
          children: <Widget>[
            const Text('When & who', style: AppTypography.captionStrong),
            const SizedBox(height: AppSpacing.s8),
            KeyValueRow(label: 'Performed on', value: performedDate),
            KeyValueRow(
              label: 'Relative',
              value: formatRelative(entry.performedAt),
            ),
            KeyValueRow(label: 'By', value: entry.performedByFullName),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        _Card(
          children: <Widget>[
            const Text('Notes', style: AppTypography.captionStrong),
            const SizedBox(height: AppSpacing.s8),
            if (entry.notes == null || entry.notes!.isEmpty)
              const Text('No notes', style: AppTypography.bodyMuted)
            else
              Text(entry.notes!, style: AppTypography.body),
          ],
        ),
        if (entry.hasPhoto) ...<Widget>[
          const SizedBox(height: AppSpacing.s12),
          _Card(
            children: <Widget>[
              const Text('Photo', style: AppTypography.captionStrong),
              const SizedBox(height: AppSpacing.s8),
              InkWell(
                onTap: () => Lightbox.open(context, entry.id),
                borderRadius: AppRadius.all8,
                child: Container(
                  width: 96,
                  height: 96,
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
              ),
            ],
          ),
        ],
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
        SizedBox(height: AppSpacing.s24),
        Skeleton.rect(height: 120, width: double.infinity),
        SizedBox(height: AppSpacing.s12),
        Skeleton.rect(height: 80, width: double.infinity),
      ],
    );
  }
}
