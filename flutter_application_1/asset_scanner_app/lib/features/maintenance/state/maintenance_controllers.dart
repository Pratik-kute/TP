import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/maintenance_repository.dart';
import '../domain/maintenance.dart';

final maintenanceTaskTypesProvider =
    FutureProvider<List<MaintenanceTaskType>>((ref) {
  return ref.read(maintenanceRepositoryProvider).taskTypes();
});

final maintenanceListProvider = AsyncNotifierProvider.family<
    MaintenanceListController, MaintenanceListResult, String>(
  MaintenanceListController.new,
);

class MaintenanceListController
    extends FamilyAsyncNotifier<MaintenanceListResult, String> {
  late final MaintenanceRepository _repo;

  @override
  Future<MaintenanceListResult> build(String assetId) async {
    _repo = ref.read(maintenanceRepositoryProvider);
    return _repo.listForAsset(assetId);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<MaintenanceListResult>().copyWithPrevious(state);
    final fresh = await _repo.listForAsset(arg);
    state = AsyncData<MaintenanceListResult>(fresh);
  }
}
