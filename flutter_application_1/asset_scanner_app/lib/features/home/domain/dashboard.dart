import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard.freezed.dart';
part 'dashboard.g.dart';

@freezed
class DashboardData with _$DashboardData {
  const factory DashboardData({
    required int totalAssets,
    required double utilizationRate,
    required double maintenanceCompliance,
    required int activeRepairs,
    required int activeUsers,
  }) = _DashboardData;

  factory DashboardData.fromJson(Map<String, dynamic> json) =>
      _$DashboardDataFromJson(json);
}
