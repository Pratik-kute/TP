import 'package:freezed_annotation/freezed_annotation.dart';

part 'maintenance.freezed.dart';
part 'maintenance.g.dart';

@freezed
class MaintenanceTaskType with _$MaintenanceTaskType {
  const factory MaintenanceTaskType({
    required String id,
    required String name,
  }) = _MaintenanceTaskType;

  factory MaintenanceTaskType.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceTaskTypeFromJson(json);
}

/// A scheduled item due for the asset. The maintenance list shows these in
/// the "Due" section.
@freezed
class MaintenanceScheduleItem with _$MaintenanceScheduleItem {
  const factory MaintenanceScheduleItem({
    required String id,
    required MaintenanceTaskType taskType,
    required DateTime dueAt,
  }) = _MaintenanceScheduleItem;

  factory MaintenanceScheduleItem.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceScheduleItemFromJson(json);
}

/// A logged maintenance entry. Shown in the "History" section.
@freezed
class MaintenanceEntry with _$MaintenanceEntry {
  const factory MaintenanceEntry({
    required String id,
    required MaintenanceTaskType taskType,
    required DateTime performedAt,
    required String performedByFullName,
    String? notes,
    @Default(false) bool hasPhoto,
  }) = _MaintenanceEntry;

  factory MaintenanceEntry.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceEntryFromJson(json);
}

@freezed
class MaintenanceListResult with _$MaintenanceListResult {
  const factory MaintenanceListResult({
    required List<MaintenanceScheduleItem> due,
    required List<MaintenanceEntry> history,
  }) = _MaintenanceListResult;

  factory MaintenanceListResult.fromJson(Map<String, dynamic> json) =>
      _$MaintenanceListResultFromJson(json);
}
