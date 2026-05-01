import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/theme.dart';
import '../../../core/utils/relative_time.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/repair.dart';
import '../state/repair_controllers.dart';
import 'add_repair_update_sheet.dart';

class RepairDetailScreen extends ConsumerWidget {
  const RepairDetailScreen({required this.repairId, super.key});

  final String repairId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(repairDetailProvider(repairId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.brand),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Repair Detail',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const <Widget>[
          ScreenIdLabel(id: '14', name: 'Repair Detail'),
        ],
      ),
      body: state.when(
        loading: () => const _Skeleton(),
        error: (_, __) => Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load repair',
            action: SecondaryButton(
              label: 'Retry',
              onPressed: () =>
                  ref.read(repairDetailProvider(repairId).notifier).refresh(),
            ),
          ),
        ),
        data: (ticket) => RefreshIndicator(
          onRefresh: () =>
              ref.read(repairDetailProvider(repairId).notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.s16),
            children: <Widget>[
              _HeaderCard(ticket: ticket),
              const SizedBox(height: AppSpacing.s24),
              const Text(
                'UPDATES',
                style: AppTypography.sectionLabel,
              ),
              const SizedBox(height: AppSpacing.s12),
              for (int i = 0; i < ticket.updates.length; i++)
                UpdateEntry(
                  actor: ticket.updates[i].actorFullName,
                  timestamp: ticket.updates[i].createdAt,
                  note: ticket.updates[i].note,
                  statusBefore: ticket.updates[i].statusBefore !=
                          ticket.updates[i].statusAfter
                      ? _statusLabel(ticket.updates[i].statusBefore)
                      : null,
                  statusAfter: ticket.updates[i].statusBefore !=
                          ticket.updates[i].statusAfter
                      ? _statusLabel(ticket.updates[i].statusAfter)
                      : null,
                  photoId: ticket.updates[i].photoId,
                  hasPhoto: ticket.updates[i].hasPhoto,
                  isFirst: i == 0,
                  isLast: i == ticket.updates.length - 1,
                ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: state.maybeWhen(
        data: (ticket) => _isClosed(ticket.status)
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: PrimaryButton(
                    label: 'Add update',
                    icon: Icons.add,
                    onPressed: () => showAddRepairUpdateSheet(
                      context,
                      ticket: ticket,
                      onSubmitted: ({
                        required RepairStatus newStatus,
                        String? note,
                        bool hasPhoto = false,
                      }) async {
                        await ref
                            .read(repairDetailProvider(repairId).notifier)
                            .addUpdate(
                              newStatus: newStatus,
                              note: note,
                              hasPhoto: hasPhoto,
                            );
                        if (context.mounted) {
                          showAppToast(context, 'Update added');
                        }
                      },
                    ),
                  ),
                ),
              ),
        orElse: () => null,
      ),
    );
  }

  bool _isClosed(RepairStatus s) =>
      s == RepairStatus.resolved || s == RepairStatus.cancelled;

  String _statusLabel(RepairStatus s) => switch (s) {
        RepairStatus.reported => 'Reported',
        RepairStatus.inProgress => 'In progress',
        RepairStatus.resolved => 'Resolved',
        RepairStatus.cancelled => 'Cancelled',
      };
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.ticket});
  final RepairTicket ticket;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  ticket.assetName,
                  style: AppTypography.heading,
                ),
              ),
              StatusBadge(
                label: _statusLabel(ticket.status),
                tone: _statusTone(ticket.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            ticket.assetCode,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: AppSpacing.s16),
          Text(ticket.description, style: AppTypography.body),
          const SizedBox(height: AppSpacing.s16),
          const Divider(height: 1, thickness: 0.5, color: AppColors.border),
          const SizedBox(height: AppSpacing.s16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              _StatItem(
                label: 'SEVERITY',
                value: _severityLabel(ticket.severity),
                valueColor: _severityColor(ticket.severity),
              ),
              _StatItem(
                label: 'REPORTED',
                value: formatRelative(ticket.createdAt),
              ),
              const _StatItem(
                label: 'COST',
                value: r'Est. $450', // Mocking based on design pack
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _statusLabel(RepairStatus s) => switch (s) {
        RepairStatus.reported => 'Reported',
        RepairStatus.inProgress => 'In progress',
        RepairStatus.resolved => 'Resolved',
        RepairStatus.cancelled => 'Cancelled',
      };
  BadgeTone _statusTone(RepairStatus s) => switch (s) {
        RepairStatus.reported => BadgeTone.warning,
        RepairStatus.inProgress => BadgeTone.info,
        RepairStatus.resolved => BadgeTone.success,
        RepairStatus.cancelled => BadgeTone.neutral,
      };
  String _severityLabel(RepairSeverity s) => switch (s) {
        RepairSeverity.low => 'Low',
        RepairSeverity.medium => 'Medium',
        RepairSeverity.high => 'High',
        RepairSeverity.critical => 'Critical',
      };
  Color _severityColor(RepairSeverity s) => switch (s) {
        RepairSeverity.low => AppColors.textSecondary,
        RepairSeverity.medium => AppColors.warning,
        RepairSeverity.high => AppColors.danger,
        RepairSeverity.critical => AppColors.danger,
      };
}

class _StatItem extends StatelessWidget {
  const _StatItem({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: AppTypography.sectionLabel.copyWith(fontSize: 9),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTypography.bodyStrong.copyWith(
            color: valueColor ?? AppColors.textPrimary,
            fontSize: 14,
          ),
        ),
      ],
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
        Skeleton.rect(height: 140, width: double.infinity),
        SizedBox(height: AppSpacing.s24),
        Skeleton.line(height: 14, width: 80),
        SizedBox(height: AppSpacing.s12),
        Skeleton.rect(height: 60, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 60, width: double.infinity),
      ],
    );
  }
}
