import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';

class CameraPermissionScreen extends StatelessWidget {
  const CameraPermissionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Camera permission'),
        actions: const <Widget>[
          ScreenIdLabel(id: 22, name: 'Camera Permission Rationale'),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const Spacer(),
              const Icon(
                Icons.camera_alt_outlined,
                size: 48,
                color: AppColors.textSecondary,
              ),
              const SizedBox(height: AppSpacing.s16),
              const Text(
                'Camera access is needed',
                style: AppTypography.heading,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.s8),
              const HintText(
                'The Asset Scanner uses your camera to scan asset QR codes and to take maintenance, repair, recovery, and audit photos. Without it, none of these actions can be completed.',
                align: TextAlign.center,
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Open settings',
                icon: Icons.settings,
                onPressed: () => openAppSettings(),
              ),
              const SizedBox(height: AppSpacing.s8),
              SecondaryButton(
                label: 'Not now',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
