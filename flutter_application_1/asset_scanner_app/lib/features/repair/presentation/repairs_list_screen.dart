import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../core/utils/relative_time.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/repair.dart';
import '../state/repair_controllers.dart';

enum _Filter { open, resolved, all }

class RepairsListScreen extends ConsumerStatefulWidget {
  const RepairsListScreen({required this.assetId, super.key});

  final String assetId;

  @override
  ConsumerState<RepairsListScreen> createState() => _RepairsListScreenState();
}

class _RepairsListScreenState extends ConsumerState<RepairsListScreen> {
  _Filter _filter = _Filter.open;

  bool _matches(RepairTicket t) {
    switch (_filter) {
      case _Filter.open:
        return t.status == RepairStatus.reported ||
            t.status == RepairStatus.inProgress;
      case _Filter.resolved:
        return t.status == RepairStatus.resolved ||
            t.status == RepairStatus.cancelled;
      case _Filter.all:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(repairsListProvider(widget.assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Repairs'),
        actions: const <Widget>[
          ScreenIdLabel(id: '13', name: 'Repairs List'),
        ],
      ),
      body: Column(
        children: <Widget>[
          const SizedBox(height: AppSpacing.s8),
          FilterPillRow<_Filter>(
            options: const <_Filter>[
              _Filter.open,
              _Filter.resolved,
              _Filter.all
            ],
            value: _filter,
            onChanged: (v) => setState(() => _filter = v),
            itemLabel: (f) => switch (f) {
              _Filter.open => 'Open',
              _Filter.resolved => 'Resolved',
              _Filter.all => 'All',
            },
          ),
          const SizedBox(height: AppSpacing.s8),
          Expanded(
            child: state.when(
              loading: () => const _Skeleton(),
              error: (_, __) => Padding(
                padding: const EdgeInsets.all(AppSpacing.s16),
                child: EmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn\'t load repairs',
                  action: SecondaryButton(
                    label: 'Retry',
                    onPressed: () => ref
                        .read(repairsListProvider(widget.assetId).notifier)
                        .refresh(),
                  ),
                ),
              ),
              data: (tickets) {
                final filtered =
                    tickets.where(_matches).toList(growable: false);
                if (filtered.isEmpty) {
                  return EmptyState(
                    icon: Icons.handyman_outlined,
                    title: _filter == _Filter.open
                        ? 'No open repairs'
                        : 'No repairs',
                    message:
                        'Raise one if this asset has an issue that needs work.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref
                      .read(repairsListProvider(widget.assetId).notifier)
                      .refresh(),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.s16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.s8),
                    itemBuilder: (_, i) => _TicketCard(ticket: filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: PrimaryButton(
            label: 'Raise repair',
            icon: Icons.add,
            onPressed: () => context.pushNamed(
              AppRoute.raiseRepair,
              pathParameters: <String, String>{'assetId': widget.assetId},
            ),
          ),
        ),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});
  final RepairTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadius.all8,
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: () => context.pushNamed(
          AppRoute.repairDetail,
          pathParameters: <String, String>{'repairId': ticket.id},
        ),
        borderRadius: AppRadius.all8,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      ticket.description,
                      style: AppTypography.bodyStrong,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.s8),
                  StatusBadge(
                    label: _statusLabel(ticket.status),
                    tone: _statusTone(ticket.status),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.s8),
              Row(
                children: <Widget>[
                  StatusBadge(
                    label: _severityLabel(ticket.severity),
                    tone: _severityTone(ticket.severity),
                  ),
                  const Spacer(),
                  Text(
                    formatRelative(ticket.createdAt),
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ],
          ),
        ),
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

  BadgeTone _severityTone(RepairSeverity s) => switch (s) {
        RepairSeverity.low => BadgeTone.neutral,
        RepairSeverity.medium => BadgeTone.warning,
        RepairSeverity.high => BadgeTone.danger,
        RepairSeverity.critical => BadgeTone.danger,
      };
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.rect(height: 80, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 80, width: double.infinity),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 80, width: double.infinity),
      ],
    );
  }
}
