import 'package:freezed_annotation/freezed_annotation.dart';

part 'repair.freezed.dart';
part 'repair.g.dart';

enum RepairSeverity {
  @JsonValue('low')
  low,
  @JsonValue('medium')
  medium,
  @JsonValue('high')
  high,
  @JsonValue('critical')
  critical,
}

enum RepairStatus {
  @JsonValue('reported')
  reported,
  @JsonValue('in_progress')
  inProgress,
  @JsonValue('resolved')
  resolved,
  @JsonValue('cancelled')
  cancelled,
}

@freezed
class RepairUpdate with _$RepairUpdate {
  const factory RepairUpdate({
    required String id,
    required DateTime createdAt,
    required String actorFullName,
    required RepairStatus statusBefore,
    required RepairStatus statusAfter,
    String? note,
    @Default(false) bool hasPhoto,
    String? photoId,
  }) = _RepairUpdate;

  factory RepairUpdate.fromJson(Map<String, dynamic> json) =>
      _$RepairUpdateFromJson(json);
}

@freezed
class RepairTicket with _$RepairTicket {
  const factory RepairTicket({
    required String id,
    required String assetId,
    required String assetCode,
    required String assetName,
    required String description,
    required RepairSeverity severity,
    required RepairStatus status,
    required DateTime createdAt,
    required String reportedByFullName,
    @Default(<RepairUpdate>[]) List<RepairUpdate> updates,
  }) = _RepairTicket;

  factory RepairTicket.fromJson(Map<String, dynamic> json) =>
      _$RepairTicketFromJson(json);
}
