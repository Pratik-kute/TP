import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../domain/repair.dart';

typedef RepairUpdateSubmitter = Future<void> Function({
  required RepairStatus newStatus,
  String? note,
  bool hasPhoto,
});

Future<void> showAddRepairUpdateSheet(
  BuildContext context, {
  required RepairTicket ticket,
  required RepairUpdateSubmitter onSubmitted,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _Sheet(ticket: ticket, onSubmitted: onSubmitted),
  );
}

class _Sheet extends StatefulWidget {
  const _Sheet({required this.ticket, required this.onSubmitted});

  final RepairTicket ticket;
  final RepairUpdateSubmitter onSubmitted;

  @override
  State<_Sheet> createState() => _SheetState();
}

class _SheetState extends State<_Sheet> {
  RepairStatus? _newStatus;
  bool _hasPhoto = false;
  bool _submitting = false;
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    _newStatus = _allowedTransitions(widget.ticket.status).firstOrNull;
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  List<RepairStatus> _allowedTransitions(RepairStatus current) {
    switch (current) {
      case RepairStatus.reported:
        return const <RepairStatus>[
          RepairStatus.inProgress,
          RepairStatus.cancelled,
        ];
      case RepairStatus.inProgress:
        return const <RepairStatus>[
          RepairStatus.inProgress,
          RepairStatus.resolved,
        ];
      case RepairStatus.resolved:
      case RepairStatus.cancelled:
        return const <RepairStatus>[];
    }
  }

  Future<void> _submit() async {
    if (_newStatus == null) return;
    setState(() => _submitting = true);
    try {
      await widget.onSubmitted(
        newStatus: _newStatus!,
        note: _note.text.trim().isEmpty ? null : _note.text.trim(),
        hasPhoto: _hasPhoto,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t add update. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _statusLabel(RepairStatus s) => switch (s) {
        RepairStatus.reported => 'Reported',
        RepairStatus.inProgress => 'In progress',
        RepairStatus.resolved => 'Resolved',
        RepairStatus.cancelled => 'Cancelled',
      };

  @override
  Widget build(BuildContext context) {
    final transitions = _allowedTransitions(widget.ticket.status);
    final viewInsets = MediaQuery.viewInsetsOf(context);
    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  SizedBox(width: 48), // Spacer to center the handle
                  SizedBox(
                    width: 40,
                    height: 4,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.all(Radius.circular(2)),
                      ),
                    ),
                  ),
                  ScreenIdLabel(id: 16, name: 'Add repair update'),
                ],
              ),
              const SizedBox(height: AppSpacing.s12),
              const Text('Add update', style: AppTypography.subheading),
              const SizedBox(height: AppSpacing.s16),
              AppPicker<RepairStatus>(
                label: 'New status',
                options: transitions,
                value: _newStatus,
                onChanged: (v) => setState(() => _newStatus = v),
                itemLabel: _statusLabel,
                searchable: false,
                emptyLabel: 'No transitions available',
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextArea(
                label: 'Note (optional)',
                controller: _note,
                hint: 'Diagnosis, vendor name, parts ordered…',
              ),
              const SizedBox(height: AppSpacing.s16),
              PhotoAttachmentRow(
                label: 'Photo (optional)',
                attached: _hasPhoto,
                onAdd: () async {
                  final taken = await context.pushNamed<bool>(
                    AppRoute.photoCapture,
                    pathParameters: <String, String>{
                      'assetId': widget.ticket.assetId,
                    },
                    queryParameters: const <String, String>{
                      'context': 'repair',
                    },
                  );
                  if (taken == true && mounted) {
                    setState(() => _hasPhoto = true);
                  }
                },
                onRemove: () => setState(() => _hasPhoto = false),
              ),
              const SizedBox(height: AppSpacing.s24),
              PrimaryButton(
                label: 'Submit update',
                onPressed: _submitting ? null : _submit,
                isLoading: _submitting,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
