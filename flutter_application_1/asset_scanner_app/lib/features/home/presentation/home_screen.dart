import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/state/auth_controller.dart';
import '../state/dashboard_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final dashboardState = ref.watch(dashboardProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Dashboard',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: const [
          ScreenIdLabel(id: 3, name: 'Home'),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(dashboardProvider.notifier).refresh(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                user == null
                    ? 'Welcome back'
                    : 'Welcome back, ${user.fullName.split(' ').first}',
                style: AppTypography.heading,
              ),
              const SizedBox(height: AppSpacing.s4),
              Text(
                'Here\'s your asset operations overview',
                style: AppTypography.caption
                    .copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.s24),
              dashboardState.when(
                loading: () => const _DashboardSkeleton(),
                error: (_, __) => EmptyState(
                  icon: Icons.error_outline,
                  title: 'Couldn\'t load dashboard',
                  action: SecondaryButton(
                    label: 'Retry',
                    onPressed: () =>
                        ref.read(dashboardProvider.notifier).refresh(),
                  ),
                ),
                data: (data) => Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            label: 'Total Assets',
                            value: data.totalAssets.toString(),
                            icon: Icons.inventory_2_outlined,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.s12),
                        Expanded(
                          child: StatCard(
                            label: 'Utilization',
                            value: '${(data.utilizationRate * 100).toInt()}%',
                            icon: Icons.track_changes_outlined,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s12),
                    Row(
                      children: [
                        Expanded(
                          child: StatCard(
                            label: 'Compliance',
                            value:
                                '${(data.maintenanceCompliance * 100).toInt()}%',
                            icon: Icons.verified_outlined,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.s12),
                        Expanded(
                          child: StatCard(
                            label: 'Active Repairs',
                            value: data.activeRepairs.toString(),
                            icon: Icons.build_circle_outlined,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.s12),
                    StatCard(
                      label: 'Active Users',
                      value: data.activeUsers.toString(),
                      icon: Icons.people_outline,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.s24),
              // Optional: Quick actions section if needed, but not requested
            ],
          ),
        ),
      ),
    );
  }
}

class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: const [
            Expanded(child: Skeleton.rect(height: 120, width: double.infinity)),
            SizedBox(width: AppSpacing.s12),
            Expanded(child: Skeleton.rect(height: 120, width: double.infinity)),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        Row(
          children: const [
            Expanded(child: Skeleton.rect(height: 120, width: double.infinity)),
            SizedBox(width: AppSpacing.s12),
            Expanded(child: Skeleton.rect(height: 120, width: double.infinity)),
          ],
        ),
        const SizedBox(height: AppSpacing.s12),
        const Skeleton.rect(height: 120, width: double.infinity),
      ],
    );
  }
}
