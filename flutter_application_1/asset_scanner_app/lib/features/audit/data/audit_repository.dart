import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/config/demo_config.dart';



abstract class AuditRepository {
  /// Confirms a match in the active audit cycle. Mobile gates this behind a
  /// confirmation screen that requires both [note] (≥10 chars) and [photoId]
  /// — symmetry with [flagDiscrepancy], so both audit outcomes capture
  /// equivalent evidence.
  Future<void> verifyMatch({
    required String assetId,
    required String cycleId,
    required String note,
    String? photoId,
    bool hasPhoto = false,
  });

  Future<void> flagDiscrepancy({
    required String assetId,
    required String cycleId,
    required String reasonCode,
    required String note,
    required bool hasPhoto,
  });
}

class FakeAuditRepository implements AuditRepository {
  @override
  Future<void> verifyMatch({
    required String assetId,
    required String cycleId,
    required String note,
    String? photoId,
    bool hasPhoto = false,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    // Real impl: write the verification record with note + linked photoId.
  }

  @override
  Future<void> flagDiscrepancy({
    required String assetId,
    required String cycleId,
    required String reasonCode,
    required String note,
    required bool hasPhoto,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
  }
}

class RealAuditRepository implements AuditRepository {
  RealAuditRepository(this._api);

  final ApiClient _api;

  @override
  Future<void> verifyMatch({
    required String assetId,
    required String cycleId,
    required String note,
    String? photoId,
    bool hasPhoto = false,
  }) async {
    await _api.postMap(
      '/api/v1/assets/$assetId/audit/verify',
      body: <String, Object?>{
        'cycleId': cycleId.isEmpty ? null : cycleId,
        'notes': note,
      },
      idempotent: true,
    );
  }

  @override
  Future<void> flagDiscrepancy({
    required String assetId,
    required String cycleId,
    required String reasonCode,
    required String note,
    required bool hasPhoto,
  }) async {
    await _api.postMap(
      '/api/v1/assets/$assetId/audit/flag',
      body: <String, Object?>{
        'cycleId': cycleId.isEmpty ? null : cycleId,
        'flagReason': _reason(reasonCode),
        'notes': note,
      },
      idempotent: true,
    );
  }

  String _reason(String reasonCode) {
    return switch (reasonCode) {
      'wrong_location' => 'wrong_location',
      'wrong_assignee' => 'wrong_assignee',
      'damaged' => 'damaged',
      'missing' => 'missing',
      _ => 'other',
    };
  }
}

final auditRepositoryProvider = Provider<AuditRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeAuditRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealAuditRepository(ref.read(apiClientProvider));
  }
  return FakeAuditRepository();
});

