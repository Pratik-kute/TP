import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/state/asset_details_controller.dart';
import '../data/audit_repository.dart';

/// Confirmation screen for "Verify match" — symmetry with the discrepancy
/// flag flow. Both audit outcomes capture equivalent evidence: a note (≥10
/// chars) and a required photo. Mirrors `_FlagSheet`'s validation rules
/// rather than being stricter — flagging a mismatch needs at least as much
/// justification as confirming a match.
class VerifyMatchScreen extends ConsumerStatefulWidget {
  const VerifyMatchScreen({required this.assetId, super.key});

  final String assetId;

  @override
  ConsumerState<VerifyMatchScreen> createState() => _VerifyMatchScreenState();
}

class _VerifyMatchScreenState extends ConsumerState<VerifyMatchScreen> {
  final _note = TextEditingController();
  bool _hasPhoto = false;
  bool _submitting = false;
  String? _noteError;
  String? _photoError;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final state = ref.read(assetDetailsControllerProvider(widget.assetId));
    final ctx = state.valueOrNull?.auditContext;
    if (ctx == null) {
      // Should never happen — the screen only gets navigated to from a
      // verification screen that already proved the cycle exists. Defensive.
      Navigator.of(context).pop();
      return;
    }

    final note = _note.text.trim();
    setState(() {
      _noteError = note.length < 10
          ? 'Add at least 10 characters confirming the verification'
          : null;
      _photoError = _hasPhoto ? null : 'Attach a photo';
    });
    if (_noteError != null || _photoError != null) return;

    setState(() => _submitting = true);
    try {
      await ref.read(auditRepositoryProvider).verifyMatch(
            assetId: widget.assetId,
            cycleId: ctx.cycleId,
            note: note,
            // photoId stays null until the bool hasPhoto → photoIds
            // migration lands; the fake just ignores both fields today.
            photoId: null,
            hasPhoto: _hasPhoto,
          );
      ref.invalidate(assetDetailsControllerProvider(widget.assetId));
      if (!mounted) return;
      showAppToast(context, 'Verified');
      // Pop twice: once to close this screen, once to leave the audit
      // verification screen (matches the existing flag flow).
      Navigator.of(context)
        ..pop()
        ..pop();
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
    final state = ref.watch(assetDetailsControllerProvider(widget.assetId));
    final ctx = state.valueOrNull?.auditContext;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Verify match'),
        actions: const <Widget>[
          ScreenIdLabel(id: 19, name: 'Verify Match'),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            InlineTip(
              ctx == null
                  ? 'Confirming this asset matches the audit record.'
                  : 'Cycle: ${ctx.cycleName}. Everything looks correct.',
            ),
            const SizedBox(height: AppSpacing.s16),
            AppTextArea(
              label: 'Notes',
              controller: _note,
              hint: 'Anything to record about this verification?',
              errorText: _noteError,
              minLines: 3,
              maxLines: 6,
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
              label: 'Confirm verification',
              onPressed: _submitting ? null : _submit,
              isLoading: _submitting,
            ),
          ],
        ),
      ),
    );
  }
}
