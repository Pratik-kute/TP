import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';

/// Camera capture screen.
///
/// Lifecycle: initialise the [CameraController] in [initState] (after the
/// runtime permission check), dispose on [dispose], and pause/resume around
/// [AppLifecycleState] transitions to release the OS camera handle when the
/// app backgrounds. The preview is full-screen black until init completes,
/// then [CameraPreview] takes over.
///
/// Permission flow:
/// - `granted` → init the camera, show preview.
/// - `denied` → request once; on grant, init; on deny, route to
///   [AppRoute.cameraPermission].
/// - `permanentlyDenied` / `restricted` → straight to
///   [AppRoute.cameraPermission]; the user enables it in OS settings.
class PhotoCaptureScreen extends ConsumerStatefulWidget {
  const PhotoCaptureScreen({
    required this.assetId,
    required this.flowContext,
    super.key,
  });

  final String assetId;

  /// Where the photo is being captured from: 'standalone' / 'maintenance' /
  /// 'repair' / 'recovery' / 'audit'. Drives the screen title and how the
  /// preview screen attaches the result.
  final String flowContext;

  @override
  ConsumerState<PhotoCaptureScreen> createState() => _PhotoCaptureScreenState();
}

class _PhotoCaptureScreenState extends ConsumerState<PhotoCaptureScreen>
    with WidgetsBindingObserver {
  CameraController? _controller;
  Future<void>? _initFuture;
  bool _capturing = false;
  String? _initError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      controller.dispose();
      _controller = null;
    } else if (state == AppLifecycleState.resumed) {
      _bootstrap();
    }
  }

  Future<void> _bootstrap() async {
    final status = await Permission.camera.status;
    if (status.isGranted) {
      await _initCamera();
      return;
    }
    if (status.isPermanentlyDenied || status.isRestricted) {
      _toPermissionScreen();
      return;
    }
    final result = await Permission.camera.request();
    if (result.isGranted) {
      await _initCamera();
    } else {
      _toPermissionScreen();
    }
  }

  void _toPermissionScreen() {
    if (!mounted) return;
    context.pushReplacementNamed(AppRoute.cameraPermission);
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _initError = 'No camera available.');
        return;
      }
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        back,
        ResolutionPreset.high,
        enableAudio: false,
      );
      _initFuture = controller.initialize();
      await _initFuture;
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _controller = controller;
        _initError = null;
      });
    } on CameraException catch (e) {
      if (mounted) setState(() => _initError = e.description ?? e.code);
    }
  }

  Future<void> _capture() async {
    final controller = _controller;
    if (_capturing || controller == null || !controller.value.isInitialized) {
      return;
    }
    setState(() => _capturing = true);
    try {
      final XFile file = await controller.takePicture();
      if (!mounted) return;
      context.pushReplacementNamed(
        AppRoute.photoPreview,
        pathParameters: <String, String>{'assetId': widget.assetId},
        queryParameters: <String, String>{
          'context': widget.flowContext,
          'localPath': file.path,
        },
      );
    } on CameraException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Couldn\'t take photo. Try again.')),
      );
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(_titleFor(widget.flowContext)),
        actions: const <Widget>[
          ScreenIdLabel(id: '6', name: 'Photo Capture'),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          _PreviewSurface(controller: _controller, error: _initError),
          const Positioned(
            top: kToolbarHeight + AppSpacing.s32,
            left: 0,
            right: 0,
            child: Center(
              child: HintPill('Frame the asset and tap capture'),
            ),
          ),
          Positioned(
            bottom: AppSpacing.s48,
            child: _ShutterButton(
              enabled: _controller != null &&
                  _controller!.value.isInitialized &&
                  !_capturing,
              capturing: _capturing,
              onPressed: _capture,
            ),
          ),
        ],
      ),
    );
  }

  String _titleFor(String flowContext) {
    switch (flowContext) {
      case 'maintenance':
        return 'Maintenance photo';
      case 'repair':
        return 'Repair photo';
      case 'recovery':
        return 'Recovery photo';
      case 'audit':
        return 'Audit photo';
      default:
        return 'Add photo';
    }
  }
}

class _PreviewSurface extends StatelessWidget {
  const _PreviewSurface({required this.controller, required this.error});

  final CameraController? controller;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Container(
        width: double.infinity,
        height: double.infinity,
        color: Colors.black,
        alignment: Alignment.center,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s24),
          child: Text(
            error!,
            style: const TextStyle(color: Colors.white70),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    if (controller == null || !controller!.value.isInitialized) {
      return Container(
        width: double.infinity,
        height: double.infinity,
        color: Colors.black,
        alignment: Alignment.center,
        child: const SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: Colors.white,
          ),
        ),
      );
    }
    return Positioned.fill(child: CameraPreview(controller!));
  }
}

class _ShutterButton extends StatelessWidget {
  const _ShutterButton({
    required this.enabled,
    required this.capturing,
    required this.onPressed,
  });

  final bool enabled;
  final bool capturing;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onPressed : null,
      child: Container(
        width: 76,
        height: 76,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 4),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: capturing
            ? const Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.brand,
                ),
              )
            : Container(
                margin: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: enabled ? Colors.white : Colors.white60,
                  shape: BoxShape.circle,
                ),
              ),
      ),
    );
  }
}
