import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/domain/asset.dart';
import '../../asset/state/asset_details_controller.dart';
import '../data/audit_repository.dart';

class AuditVerificationScreen extends ConsumerWidget {
  const AuditVerificationScreen({required this.assetId, super.key});

  final String assetId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assetDetailsControllerProvider(assetId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Audit verification'),
        actions: const <Widget>[
          ScreenIdLabel(id: '18', name: 'Audit Verification'),
        ],
      ),
      body: state.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: Skeleton.rect(height: 200, width: double.infinity),
        ),
        error: (_, __) => const Padding(
          padding: EdgeInsets.all(AppSpacing.s16),
          child: EmptyState(
            icon: Icons.error_outline,
            title: 'Couldn\'t load audit context',
          ),
        ),
        data: (result) {
          final auditCtx = result.auditContext;
          if (auditCtx == null) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.s16),
              child: EmptyState(
                icon: Icons.verified_outlined,
                title: 'No active audit cycle',
                message:
                    'This asset isn\'t part of any audit you can act on right now.',
              ),
            );
          }
          if (auditCtx.existingVerificationResult != null) {
            return const Padding(
              padding: EdgeInsets.all(AppSpacing.s16),
              child: EmptyState(
                icon: Icons.check_circle_outline,
                title: 'Already verified',
                message:
                    'This asset has already been verified in this audit cycle.',
              ),
            );
          }
          return _Loaded(assetId: assetId, asset: result.asset, ctx: auditCtx);
        },
      ),
    );
  }
}

class _Loaded extends ConsumerStatefulWidget {
  const _Loaded({
    required this.assetId,
    required this.asset,
    required this.ctx,
  });

  final String assetId;
  final Asset asset;
  final AuditContext ctx;

  @override
  ConsumerState<_Loaded> createState() => _LoadedState();
}

class _LoadedState extends ConsumerState<_Loaded> {
  bool get _locationMatches =>
      widget.ctx.expectedLocation?.id == widget.asset.currentLocation?.id;

  bool get _assigneeMatches =>
      widget.ctx.expectedAssignee?.id == widget.asset.assignedToUser?.id;

  void _verifyMatch() {
    // Navigates to the confirmation screen rather than submitting inline —
    // verify-match now captures the same evidence (note + photo) as the
    // discrepancy flow, for symmetry. Submission happens on that screen.
    context.pushNamed(
      AppRoute.verifyMatch,
      pathParameters: <String, String>{'assetId': widget.assetId},
    );
  }

  Future<void> _flag() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FlagSheet(
        assetId: widget.assetId,
        cycleId: widget.ctx.cycleId,
      ),
    );
    if (ok == true) {
      ref.invalidate(assetDetailsControllerProvider(widget.assetId));
      if (mounted) {
        showAppToast(context, 'Flagged for review');
        Navigator.of(context).pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          InlineTip('Cycle: ${widget.ctx.cycleName}'),
          const SizedBox(height: AppSpacing.s16),
          _ExpectedCard(
            label: 'Expected location',
            expected: widget.ctx.expectedLocation?.name ?? '—',
            actual: widget.asset.currentLocation?.name ?? '—',
            matches: _locationMatches,
          ),
          const SizedBox(height: AppSpacing.s8),
          _ExpectedCard(
            label: 'Expected assignee',
            expected: widget.ctx.expectedAssignee?.fullName ?? 'Unassigned',
            actual: widget.asset.assignedToUser?.fullName ?? 'Unassigned',
            matches: _assigneeMatches,
          ),
          const SizedBox(height: AppSpacing.s24),
          LargeChoiceTile(
            icon: Icons.check_circle_outline,
            label: 'Verify match',
            subtitle: 'Everything looks correct',
            emphasis: ChoiceEmphasis.primary,
            onTap: _verifyMatch,
          ),
          const SizedBox(height: AppSpacing.s8),
          LargeChoiceTile(
            icon: Icons.flag_outlined,
            label: 'Flag discrepancy',
            subtitle: 'Something is off — wrong location, missing, etc.',
            emphasis: ChoiceEmphasis.secondary,
            onTap: _flag,
          ),
        ],
      ),
    );
  }
}

class _ExpectedCard extends StatelessWidget {
  const _ExpectedCard({
    required this.label,
    required this.expected,
    required this.actual,
    required this.matches,
  });

  final String label;
  final String expected;
  final String actual;
  final bool matches;

  @override
  Widget build(BuildContext context) {
    final tone = matches ? BadgeTone.success : BadgeTone.warning;
    final indicator =
        matches ? Icons.check_circle : Icons.warning_amber_rounded;
    final indicatorColor = matches ? AppColors.success : AppColors.warning;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.all8,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(label, style: AppTypography.captionStrong),
              ),
              StatusBadge(
                label: matches ? 'Match' : 'Mismatch',
                tone: tone,
                icon: indicator,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s8),
          Text('Expected: $expected', style: AppTypography.body),
          const SizedBox(height: 2),
          Text(
            'Found: $actual',
            style: AppTypography.body.copyWith(
              color: matches ? AppColors.textSecondary : indicatorColor,
              fontWeight: matches ? FontWeight.w400 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _FlagSheet extends ConsumerStatefulWidget {
  const _FlagSheet({required this.assetId, required this.cycleId});
  final String assetId;
  final String cycleId;

  @override
  ConsumerState<_FlagSheet> createState() => _FlagSheetState();
}

class _FlagSheetState extends ConsumerState<_FlagSheet> {
  static const List<({String code, String label})> _reasons =
      <({String code, String label})>[
    (code: 'wrong_location', label: 'Wrong location'),
    (code: 'wrong_assignee', label: 'Wrong assignee'),
    (code: 'missing', label: 'Missing / not found'),
    (code: 'damaged', label: 'Damaged'),
    (code: 'duplicate_tag', label: 'Duplicate / wrong tag'),
    (code: 'other', label: 'Other'),
  ];

  ({String code, String label})? _reason;
  bool _hasPhoto = false;
  bool _submitting = false;
  String? _reasonError;
  String? _noteError;
  String? _photoError;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final note = _note.text.trim();
    setState(() {
      _reasonError = _reason == null ? 'Pick a reason' : null;
      _noteError = note.length < 10
          ? 'Add at least 10 characters explaining the discrepancy'
          : null;
      _photoError = _hasPhoto ? null : 'Attach a photo';
    });
    if (_reasonError != null || _noteError != null || _photoError != null) {
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(auditRepositoryProvider).flagDiscrepancy(
            assetId: widget.assetId,
            cycleId: widget.cycleId,
            reasonCode: _reason!.code,
            note: note,
            hasPhoto: _hasPhoto,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t submit. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
              const Center(
                child: SizedBox(
                  width: 40,
                  height: 4,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.all(Radius.circular(2)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.s12),
              const Text('Flag discrepancy', style: AppTypography.subheading),
              const SizedBox(height: AppSpacing.s16),
              AppPicker<({String code, String label})>(
                label: 'Reason',
                options: _reasons,
                value: _reason,
                onChanged: (v) => setState(() {
                  _reason = v;
                  _reasonError = null;
                }),
                itemLabel: (r) => r.label,
                searchable: false,
                errorText: _reasonError,
              ),
              const SizedBox(height: AppSpacing.s16),
              AppTextArea(
                label: 'What\'s the discrepancy?',
                controller: _note,
                hint: 'Be specific — this is what auditors will read.',
                errorText: _noteError,
              ),
              const SizedBox(height: AppSpacing.s16),
              PhotoAttachmentRow(
                label: 'Photo',
                attached: _hasPhoto,
                required: true,
                onAdd: () async {
                  final taken = await context.pushNamed<bool>(
                    AppRoute.photoCapture,
                    pathParameters: <String, String>{'assetId': widget.assetId},
                    queryParameters: const <String, String>{
                      'context': 'audit',
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
                label: 'Submit',
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
