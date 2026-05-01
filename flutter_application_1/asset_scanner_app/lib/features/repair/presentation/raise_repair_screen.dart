import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/state/asset_details_controller.dart';
import '../data/repair_repository.dart';
import '../domain/repair.dart';
import '../state/repair_controllers.dart';

class RaiseRepairScreen extends ConsumerStatefulWidget {
  const RaiseRepairScreen({required this.assetId, super.key});

  final String assetId;

  @override
  ConsumerState<RaiseRepairScreen> createState() => _RaiseRepairScreenState();
}

class _RaiseRepairScreenState extends ConsumerState<RaiseRepairScreen> {
  final _description = TextEditingController();
  RepairSeverity? _severity = RepairSeverity.medium;
  bool _hasPhoto = false;
  bool _submitting = false;
  String? _descriptionError;
  String? _photoError;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final desc = _description.text.trim();
    setState(() {
      _descriptionError = desc.length < 10
          ? 'Describe the issue in at least 10 characters.'
          : null;
      _photoError = _hasPhoto ? null : 'Attach a photo of the issue.';
    });
    if (_descriptionError != null || _photoError != null) return;

    setState(() => _submitting = true);
    try {
      final ticket = await ref.read(repairRepositoryProvider).raise(
            assetId: widget.assetId,
            description: desc,
            severity: _severity!,
            hasPhoto: _hasPhoto,
          );
      ref.invalidate(repairsListProvider(widget.assetId));
      ref.invalidate(assetDetailsControllerProvider(widget.assetId));
      if (!mounted) return;
      showAppToast(context, 'Repair raised');
      context.pushReplacementNamed(
        AppRoute.repairDetail,
        pathParameters: <String, String>{'repairId': ticket.id},
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t raise repair. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _label(RepairSeverity s) => switch (s) {
        RepairSeverity.low => 'Low',
        RepairSeverity.medium => 'Medium',
        RepairSeverity.high => 'High',
        RepairSeverity.critical => 'Critical',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Raise repair'),
        actions: const <Widget>[
          ScreenIdLabel(id: '15', name: 'Raise Repair'),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppTextArea(
              label: 'What\'s the issue?',
              controller: _description,
              hint: 'E.g. "Battery drains in under 2 hours when idle."',
              errorText: _descriptionError,
              minLines: 3,
              maxLines: 6,
            ),
            const SizedBox(height: AppSpacing.s16),
            AppSegmentedControl<RepairSeverity>(
              label: 'Severity',
              options: const <RepairSeverity>[
                RepairSeverity.low,
                RepairSeverity.medium,
                RepairSeverity.high,
                RepairSeverity.critical,
              ],
              value: _severity,
              onChanged: (v) => setState(() => _severity = v),
              itemLabel: _label,
            ),
            const SizedBox(height: AppSpacing.s16),
            PhotoAttachmentRow(
              label: 'Photo of the issue',
              attached: _hasPhoto,
              required: true,
              onAdd: () async {
                final taken = await context.pushNamed<bool>(
                  AppRoute.photoCapture,
                  pathParameters: <String, String>{'assetId': widget.assetId},
                  queryParameters: const <String, String>{
                    'context': 'repair',
                  },
                );
                if (taken == true && mounted) {
                  setState(() {
                    _hasPhoto = true;
                    _photoError = null;
                  });
                }
              },
              onRemove: () => setState(() => _hasPhoto = false),
              errorText: _photoError,
            ),
            const SizedBox(height: AppSpacing.s24),
            PrimaryButton(
              label: 'Raise repair',
              onPressed: _submitting ? null : _submit,
              isLoading: _submitting,
            ),
          ],
        ),
      ),
    );
  }
}
