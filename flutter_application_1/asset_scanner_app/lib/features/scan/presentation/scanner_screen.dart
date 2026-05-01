import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../app/router.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../data/scan_repository.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  late final MobileScannerController _scannerController =
      MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const <BarcodeFormat>[BarcodeFormat.qrCode],
  );

  bool _resolving = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_resolving) return;
    String? payload;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        payload = value.trim();
        break;
      }
    }
    if (payload == null) return;
    await _scannerController.stop();
    await _resolve(payload);
    if (mounted && !_resolving) {
      await _scannerController.start();
    }
  }

  Future<void> _resolve(String qrPayload) async {
    if (_resolving) return;
    setState(() => _resolving = true);
    try {
      final result = await ref.read(scanRepositoryProvider).resolve(qrPayload);
      if (!mounted) return;
      context.pushReplacementNamed(
        AppRoute.assetDetails,
        pathParameters: <String, String>{'assetId': result.asset.id},
      );
    } on AppError catch (e) {
      if (!mounted) return;
      await showResultSheet<void>(
        context,
        icon: e.code == AppErrorCode.invalidQrPayload
            ? Icons.qr_code_2_outlined
            : Icons.error_outline,
        title: e.code == AppErrorCode.invalidQrPayload
            ? 'Not an asset QR'
            : 'Couldn\'t resolve QR',
        message: e.userMessage,
        actions: <ResultSheetAction<void>>[
          const ResultSheetAction<void>(label: 'Try again', value: null),
        ],
      );
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Scan QR'),
        actions: const <Widget>[
          ScreenIdLabel(id: '4', name: 'Scanner'),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: <Widget>[
          MobileScanner(
            controller: _scannerController,
            fit: BoxFit.cover,
            onDetect: _onDetect,
          ),
          const _ScanReticle(),
          Positioned(
            left: 0,
            right: 0,
            bottom: AppSpacing.s32,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s24),
              child: Column(
                children: <Widget>[
                  const HintPill('Hold steady — auto-detects'),
                  const SizedBox(height: AppSpacing.s16),
                  if (_resolving)
                    const Padding(
                      padding: EdgeInsets.all(AppSpacing.s16),
                      child: CircularProgressIndicator(
                        color: Colors.white,
                      ),
                    )
                  else
                    const Icon(
                      Icons.qr_code_scanner,
                      color: Colors.white,
                      size: 28,
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

class _ScanReticle extends StatelessWidget {
  const _ScanReticle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 240,
        height: 240,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white, width: 2),
          borderRadius: AppRadius.all16,
        ),
      ),
    );
  }
}
