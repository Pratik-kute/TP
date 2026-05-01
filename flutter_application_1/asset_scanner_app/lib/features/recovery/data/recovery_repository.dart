import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/network/api_client.dart';
import '../../../core/config/api_config.dart';
import '../../../core/config/demo_config.dart';
import '../domain/recovery.dart';


abstract class RecoveryRepository {
  Future<void> markRecovery({
    required String assetId,
    required String recoveredFromUserId,
    required String recoveredToLocationId,
    required RecoveryCondition condition,
    required String notes,
    required bool hasPhoto,
  });
}

class FakeRecoveryRepository implements RecoveryRepository {
  @override
  Future<void> markRecovery({
    required String assetId,
    required String recoveredFromUserId,
    required String recoveredToLocationId,
    required RecoveryCondition condition,
    required String notes,
    required bool hasPhoto,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
  }
}

class RealRecoveryRepository implements RecoveryRepository {
  RealRecoveryRepository(this._api);

  final ApiClient _api;

  @override
  Future<void> markRecovery({
    required String assetId,
    required String recoveredFromUserId,
    required String recoveredToLocationId,
    required RecoveryCondition condition,
    required String notes,
    required bool hasPhoto,
  }) async {
    // Mapping RecoveryCondition to the API's incident types/severities
    // Since the API uses lost/damaged/stolen/write_off, we'll map based on condition
    final incidentType = condition == RecoveryCondition.damaged ? 'damaged' : 'write_off';
    
    await _api.postMap(
      '/api/v1/assets/$assetId/recovery',
      body: <String, Object?>{
        'incidentType': incidentType,
        'severity': condition == RecoveryCondition.good ? 'low' : 'medium',
        'description': notes,
        'incidentDate': DateTime.now().toUtc().toIso8601String(),
        'markAssetDead': condition == RecoveryCondition.needsRepair,
      },
      idempotent: true,
    );
  }
}

final recoveryRepositoryProvider = Provider<RecoveryRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeRecoveryRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealRecoveryRepository(ref.read(apiClientProvider));
  }
  return FakeRecoveryRepository();
});


