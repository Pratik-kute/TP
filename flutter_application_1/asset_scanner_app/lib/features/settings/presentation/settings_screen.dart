import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/state/auth_controller.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: const <Widget>[
          ScreenIdLabel(id: 21, name: 'Settings'),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: <Widget>[
          const Text('Profile', style: AppTypography.captionStrong),
          const SizedBox(height: AppSpacing.s8),
          Container(
            padding: const EdgeInsets.all(AppSpacing.s16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: AppRadius.all8,
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                KeyValueRow(label: 'Name', value: user?.fullName),
                KeyValueRow(label: 'Email', value: user?.email),
                KeyValueRow(
                  label: 'Organisation',
                  value: user?.organisationName ?? '',
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s24),
          const Text('App', style: AppTypography.captionStrong),
          const SizedBox(height: AppSpacing.s8),
          Container(
            padding: const EdgeInsets.all(AppSpacing.s16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: AppRadius.all8,
              border: Border.all(color: AppColors.border),
            ),
            child: const Column(
              children: <Widget>[
                KeyValueRow(label: 'Version', value: '0.1.0 (1)'),
                KeyValueRow(label: 'Build', value: 'UI scaffold'),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.s32),
          DestructiveButton(
            label: 'Sign out',
            onPressed: () async {
              final confirmed = await showConfirmDialog(
                context,
                title: 'Sign out',
                message: 'You\'ll need to sign in again to use the app.',
                confirmLabel: 'Sign out',
                destructive: true,
              );
              if (!confirmed) return;
              await ref.read(authControllerProvider.notifier).logout();
              if (!context.mounted) return;
              context.goNamed(AppRoute.login);
            },
          ),
        ],
      ),
    );
  }
}
