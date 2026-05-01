import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../data/maintenance_repository.dart';
import '../domain/maintenance.dart';
import '../state/maintenance_controllers.dart';

class LogMaintenanceScreen extends ConsumerStatefulWidget {
  const LogMaintenanceScreen({
    required this.assetId,
    this.scheduledItemId,
    super.key,
  });

  final String assetId;
  final String? scheduledItemId;

  @override
  ConsumerState<LogMaintenanceScreen> createState() =>
      _LogMaintenanceScreenState();
}

class _LogMaintenanceScreenState extends ConsumerState<LogMaintenanceScreen> {
  MaintenanceTaskType? _taskType;
  bool _completeScheduled = true;
  bool _hasPhoto = false;
  bool _submitting = false;
  String? _typeError;
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_taskType == null) {
      setState(() => _typeError = 'Pick a task type');
      return;
    }
    setState(() {
      _submitting = true;
      _typeError = null;
    });
    try {
      await ref.read(maintenanceRepositoryProvider).logMaintenance(
            assetId: widget.assetId,
            taskTypeId: _taskType!.id,
            notes: _notes.text.trim(),
            scheduledItemId: _completeScheduled ? widget.scheduledItemId : null,
            hasPhoto: _hasPhoto,
          );
      ref.invalidate(maintenanceListProvider(widget.assetId));
      if (!mounted) return;
      showAppToast(context, 'Maintenance logged');
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t log maintenance. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final typesAsync = ref.watch(maintenanceTaskTypesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Log maintenance'),
        actions: const <Widget>[
          ScreenIdLabel(id: '10', name: 'Log Maintenance'),
        ],
      ),
      body: typesAsync.when(
        loading: () => const _Skeleton(),
        error: (_, __) => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load task types',
          ),
        ),
        data: (types) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              AppPicker<MaintenanceTaskType>(
                label: 'Task type',
                options: types,
                value: _taskType,
                onChanged: (v) => setState(() {
                  _taskType = v;
                  _typeError = null;
                }),
                itemLabel: (t) => t.name,
                errorText: _typeError,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextArea(
                label: 'Notes (optional)',
                controller: _notes,
                hint: 'What was done? Any observations?',
              ),
              const SizedBox(height: AppSpacing.s16),
              PhotoAttachmentRow(
                label: 'Photo (optional)',
                attached: _hasPhoto,
                onAdd: () async {
                  final taken = await context.pushNamed<bool>(
                    AppRoute.photoCapture,
                    pathParameters: <String, String>{'assetId': widget.assetId},
                    queryParameters: const <String, String>{
                      'context': 'maintenance',
                    },
                  );
                  if (taken == true && mounted) {
                    setState(() => _hasPhoto = true);
                  }
                },
                onRemove: () => setState(() => _hasPhoto = false),
              ),
              if (widget.scheduledItemId != null) ...<Widget>[
                const SizedBox(height: AppSpacing.s16),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  value: _completeScheduled,
                  onChanged: (v) => setState(() => _completeScheduled = v),
                  title: const Text(
                    'Mark scheduled item as complete',
                    style: AppTypography.body,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.s24),
              PrimaryButton(
                label: 'Save',
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

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: const <Widget>[
        Skeleton.line(height: 14, width: 100),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 48, width: double.infinity),
        SizedBox(height: AppSpacing.s16),
        Skeleton.line(height: 14, width: 100),
        SizedBox(height: AppSpacing.s8),
        Skeleton.rect(height: 96, width: double.infinity),
      ],
    );
  }
}
