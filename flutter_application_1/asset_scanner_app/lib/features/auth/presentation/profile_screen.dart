import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../state/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const [
          ScreenIdLabel(id: 22, name: 'Profile'),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.s24),
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 50,
                    backgroundColor: AppColors.brandSoft,
                    child: Text(
                      user?.fullName
                              .split(' ')
                              .map((s) => s[0])
                              .take(2)
                              .join() ??
                          '??',
                      style: const TextStyle(
                        color: AppColors.brand,
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.s16),
                  Text(
                    user?.fullName ?? 'User Name',
                    style: AppTypography.heading,
                  ),
                  Text(
                    user?.id ?? 'User ID',
                    style: AppTypography.caption,
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.s32),
            _ProfileItem(
              icon: Icons.settings_outlined,
              label: 'Settings',
              onTap: () => context.pushNamed(AppRoute.settings),
            ),
            const SizedBox(height: AppSpacing.s12),
            _ProfileItem(
              icon: Icons.help_outline,
              label: 'Help & Support',
              onTap: () {},
            ),
            const SizedBox(height: AppSpacing.s12),
            _ProfileItem(
              icon: Icons.info_outline,
              label: 'About',
              onTap: () {},
            ),
            const SizedBox(height: AppSpacing.s32),
            PrimaryButton(
              label: 'Logout',
              icon: Icons.logout,
              onPressed: () {
                ref.read(authControllerProvider.notifier).logout();
                context.goNamed(AppRoute.login);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileItem extends StatelessWidget {
  const _ProfileItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Row(
          children: [
            Icon(icon, color: AppColors.brand),
            const SizedBox(width: AppSpacing.s16),
            Expanded(
              child: Text(label, style: AppTypography.bodyStrong),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}
