import 'package:freezed_annotation/freezed_annotation.dart';

part 'activity_entry.freezed.dart';
part 'activity_entry.g.dart';

/// What kind of action an activity entry represents. Each variety maps to a
/// pill colour on the Activity Log row (see `ActivityLogScreen`'s tone
/// mapping). The action types mirror the web platform's Activity Log
/// (see `docs/visual-references/web-activity-log.png` once attached).
enum ActivityActionType {
  @JsonValue('quick_update')
  quickUpdate,
  @JsonValue('create')
  create,
  @JsonValue('unassign')
  unassign,
  @JsonValue('assign')
  assign,
  @JsonValue('qr_scanned')
  qrScanned,
  @JsonValue('delete')
  delete,
  @JsonValue('other')
  other,
}

/// Which feature module the action originated in. The web Activity Log
/// shows this as the small caption next to the actor; mobile mirrors it.
enum ActivityModule {
  @JsonValue('assets')
  assets,
  @JsonValue('maintenance')
  maintenance,
  @JsonValue('repairs')
  repairs,
  @JsonValue('recovery')
  recovery,
  @JsonValue('audits')
  audits,
  @JsonValue('photos')
  photos,
  @JsonValue('allocations')
  allocations,
}

@freezed
class ActivityEntry with _$ActivityEntry {
  const factory ActivityEntry({
    required String id,
    required DateTime timestamp,
    required String actorFullName,
    required ActivityActionType actionType,
    required ActivityModule module,
    required String summary,
    Map<String, String>? metadata,
  }) = _ActivityEntry;

  factory ActivityEntry.fromJson(Map<String, dynamic> json) =>
      _$ActivityEntryFromJson(json);
}

@freezed
class PaginatedActivity with _$PaginatedActivity {
  const factory PaginatedActivity({
    required List<ActivityEntry> entries,
    required int totalEntries,
    required int todayCount,
    required int activeUsers,
    required int currentPage,
    required int totalPages,
  }) = _PaginatedActivity;

  factory PaginatedActivity.fromJson(Map<String, dynamic> json) =>
      _$PaginatedActivityFromJson(json);
}
