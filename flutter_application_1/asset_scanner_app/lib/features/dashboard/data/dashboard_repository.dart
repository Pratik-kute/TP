import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class DashboardStats {
  const DashboardStats({
    required this.totalAssets,
    required this.utilization,
    required this.compliance,
    required this.activeRepairs,
    required this.activeUsers,
  });

  final int totalAssets;
  final double utilization;
  final double compliance;
  final int activeRepairs;
  final int activeUsers;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      totalAssets: json['totalAssets'] as int? ?? 0,
      utilization: (json['utilization'] as num? ?? 0.0).toDouble(),
      compliance: (json['compliance'] as num? ?? 0.0).toDouble(),
      activeRepairs: json['activeRepairs'] as int? ?? 0,
      activeUsers: json['activeUsers'] as int? ?? 0,
    );
  }
}

abstract class DashboardRepository {
  Future<DashboardStats> getStats();
}

class RealDashboardRepository implements DashboardRepository {
  RealDashboardRepository(this._api);
  final ApiClient _api;

  @override
  Future<DashboardStats> getStats() async {
    final response = await _api.getMap('/api/v1/dashboard/stats');
    return DashboardStats.fromJson(response);
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return RealDashboardRepository(ref.read(apiClientProvider));
});
