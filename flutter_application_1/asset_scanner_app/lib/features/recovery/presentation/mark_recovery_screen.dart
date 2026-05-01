import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/data/reference_data_repository.dart';
import '../../asset/domain/asset.dart';
import '../../asset/state/asset_details_controller.dart';
import '../data/recovery_repository.dart';
import '../domain/recovery.dart';

class MarkRecoveryScreen extends ConsumerStatefulWidget {
  const MarkRecoveryScreen({required this.assetId, super.key});

  final String assetId;

  @override
  ConsumerState<MarkRecoveryScreen> createState() => _MarkRecoveryScreenState();
}

class _MarkRecoveryScreenState extends ConsumerState<MarkRecoveryScreen> {
  AssetUser? _from;
  AssetLocation? _to;
  RecoveryCondition? _condition = RecoveryCondition.good;
  bool _hasPhoto = false;
  bool _submitting = false;
  String? _fromError;
  String? _toError;
  String? _photoError;
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _fromError = _from == null ? 'Pick who you recovered it from' : null;
      _toError = _to == null ? 'Pick where it\'s being placed' : null;
      _photoError = _hasPhoto ? null : 'Attach a recovery photo';
    });
    if (_fromError != null || _toError != null || _photoError != null) return;

    setState(() => _submitting = true);
    try {
      await ref.read(recoveryRepositoryProvider).markRecovery(
            assetId: widget.assetId,
            recoveredFromUserId: _from!.id,
            recoveredToLocationId: _to!.id,
            condition: _condition!,
            notes: _notes.text.trim(),
            hasPhoto: _hasPhoto,
          );
      ref.invalidate(assetDetailsControllerProvider(widget.assetId));
      if (!mounted) return;

      if (_condition == RecoveryCondition.needsRepair) {
        final raise = await showResultSheet<bool>(
          context,
          icon: Icons.handyman_outlined,
          title: 'Asset recovered',
          message:
              'You marked it as "needs repair." Would you like to raise a repair ticket now?',
          actions: const <ResultSheetAction<bool>>[
            ResultSheetAction<bool>(label: 'Raise repair', value: true),
            ResultSheetAction<bool>(label: 'Not now', value: false),
          ],
        );
        if (!mounted) return;
        if (raise == true) {
          context.pushReplacementNamed(
            AppRoute.raiseRepair,
            pathParameters: <String, String>{'assetId': widget.assetId},
          );
          return;
        }
      } else {
        showAppToast(context, 'Asset recovered');
      }
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t mark recovery. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _conditionLabel(RecoveryCondition c) => switch (c) {
        RecoveryCondition.good => 'Good',
        RecoveryCondition.damaged => 'Damaged',
        RecoveryCondition.needsRepair => 'Needs repair',
      };

  @override
  Widget build(BuildContext context) {
    final asset = ref.watch(assetDetailsControllerProvider(widget.assetId));
    final users = ref.watch(usersProvider);
    final locations = ref.watch(locationsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.brand),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Mark Recovery',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const <Widget>[
          ScreenIdLabel(id: '17', name: 'Mark Recovery'),
        ],
      ),
      body: asset.when(
        loading: () => const _Skeleton(),
        error: (_, __) => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load asset',
          ),
        ),
        data: (result) {
          if (result.asset.assignedToUser == null) {
            return Column(
              children: <Widget>[
                const BannerError(
                  tone: BannerTone.warning,
                  message:
                      'This asset isn\'t currently assigned to anyone. Recovery isn\'t available.',
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: SecondaryButton(
                    label: 'Back to asset',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ],
            );
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'RECOVERY DETAILS',
                  style: AppTypography.sectionLabel,
                ),
                const SizedBox(height: AppSpacing.s12),
                InfoCard(
                  padding: const EdgeInsets.all(AppSpacing.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      InlineTip(
                        'Currently assigned to ${result.asset.assignedToUser!.fullName}.',
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppPicker<AssetUser>(
                        label: 'Recovered from',
                        options: users.valueOrNull ?? const <AssetUser>[],
                        value: _from,
                        onChanged: (v) => setState(() {
                          _from = v;
                          _fromError = null;
                        }),
                        itemLabel: (u) => u.fullName,
                        errorText: _fromError,
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppPicker<AssetLocation>(
                        label: 'Placed at',
                        options:
                            locations.valueOrNull ?? const <AssetLocation>[],
                        value: _to,
                        onChanged: (v) => setState(() {
                          _to = v;
                          _toError = null;
                        }),
                        itemLabel: (l) => l.name,
                        errorText: _toError,
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppSegmentedControl<RecoveryCondition>(
                        label: 'Condition',
                        options: const <RecoveryCondition>[
                          RecoveryCondition.good,
                          RecoveryCondition.damaged,
                          RecoveryCondition.needsRepair,
                        ],
                        value: _condition,
                        onChanged: (v) => setState(() => _condition = v),
                        itemLabel: _conditionLabel,
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      AppTextArea(
                        label: 'Notes (optional)',
                        controller: _notes,
                        hint: 'Anything worth recording about the recovery?',
                      ),
                      const SizedBox(height: AppSpacing.s16),
                      PhotoAttachmentRow(
                        label: 'Recovery photo',
                        attached: _hasPhoto,
                        required: true,
                        onAdd: () async {
                          final taken = await context.pushNamed<bool>(
                            AppRoute.photoCapture,
                            pathParameters: <String, String>{
                              'assetId': widget.assetId,
                            },
                            queryParameters: const <String, String>{
                              'context': 'recovery',
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
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.s24),
                PrimaryButton(
                  label: 'Confirm recovery',
                  onPressed: _submitting ? null : _submit,
                  isLoading: _submitting,
                ),
              ],
            ),
          );
        },
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
        Skeleton.rect(height: 60, width: double.infinity),
        SizedBox(height: AppSpacing.s16),
        Skeleton.rect(height: 60, width: double.infinity),
        SizedBox(height: AppSpacing.s16),
        Skeleton.rect(height: 60, width: double.infinity),
      ],
    );
  }
}
