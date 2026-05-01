import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/dashboard.dart';
import '../../asset/data/asset_repository.dart';
import '../../asset/domain/asset.dart';
import '../../activity/data/activity_repository.dart';
import '../../dashboard/data/dashboard_repository.dart';

final dashboardProvider =
    AsyncNotifierProvider<DashboardController, DashboardData>(
  DashboardController.new,
);

class DashboardController extends AsyncNotifier<DashboardData> {
  @override
  Future<DashboardData> build() async {
    final dashboardRepo = ref.read(dashboardRepositoryProvider);
    final stats = await dashboardRepo.getStats();

    return DashboardData(
      totalAssets: stats.totalAssets,
      utilizationRate: stats.utilization / 100, // API returns 0-100, UI expects 0-1
      maintenanceCompliance: stats.compliance / 100,
      activeRepairs: stats.activeRepairs,
      activeUsers: stats.activeUsers,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading<DashboardData>().copyWithPrevious(state);
    state = await AsyncValue.guard(() => build());
  }
}
