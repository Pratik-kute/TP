import 'package:freezed_annotation/freezed_annotation.dart';

enum RecoveryCondition {
  @JsonValue('good')
  good,
  @JsonValue('damaged')
  damaged,
  @JsonValue('needs_repair')
  needsRepair,
}
