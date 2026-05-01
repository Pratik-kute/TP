import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../asset/data/asset_repository.dart';
import '../../asset/state/asset_details_controller.dart';

class PhotoPreviewScreen extends ConsumerStatefulWidget {
  const PhotoPreviewScreen({
    required this.assetId,
    required this.flowContext,
    this.localPath,
    super.key,
  });

  final String assetId;
  final String flowContext;

  /// Path to the captured photo on local disk. Null only if the user
  /// somehow lands here without going through capture (defensive fallback —
  /// normal flow always passes a real path from `PhotoCaptureScreen`).
  final String? localPath;

  @override
  ConsumerState<PhotoPreviewScreen> createState() => _PhotoPreviewScreenState();
}

class _PhotoPreviewScreenState extends ConsumerState<PhotoPreviewScreen> {
  bool _saving = false;

  Future<void> _save() async {
    final path = widget.localPath;
    if (path == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No photo captured. Retake.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      // Standalone uploads write directly. Other flows return the photo to
      // their parent form; this scaffold pops twice (preview + capture) and
      // lets the parent screen's local "_hasPhoto" toggle flip.
      if (widget.flowContext == 'standalone') {
        await ref.read(assetRepositoryProvider).uploadStandalonePhoto(
              assetId: widget.assetId,
              localPath: path,
            );
        ref.invalidate(assetDetailsControllerProvider(widget.assetId));
      }
      if (!mounted) return;
      showAppToast(context, 'Photo added');
      Navigator.of(context).pop<bool>(true);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t save photo. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final path = widget.localPath;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Preview'),
        actions: const <Widget>[
          ScreenIdLabel(id: '7', name: 'Photo Preview'),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Column(
        children: <Widget>[
          Expanded(
            child: Container(
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: Color(0xFF1A1A1F)),
              child: path == null
                  ? Container(
                      width: 280,
                      height: 280,
                      color: AppColors.textSecondary,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.image_outlined,
                        color: Colors.white54,
                        size: 96,
                      ),
                    )
                  : InteractiveViewer(
                      maxScale: 4,
                      child: Image.file(
                        File(path),
                        fit: BoxFit.contain,
                      ),
                    ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(AppSpacing.s16),
            color: Colors.black,
            child: SafeArea(
              top: false,
              child: Column(
                children: <Widget>[
                  PrimaryButton(
                    label: 'Save photo',
                    onPressed: _saving ? null : _save,
                    isLoading: _saving,
                  ),
                  const SizedBox(height: AppSpacing.s8),
                  TextButton(
                    onPressed:
                        _saving ? null : () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white,
                      minimumSize: const Size(
                        double.infinity,
                        AppSpacing.primaryButtonHeight,
                      ),
                    ),
                    child: const Text('Retake'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
