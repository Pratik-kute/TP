import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repair_repository.dart';
import '../domain/repair.dart';

final repairsListProvider = AsyncNotifierProvider.family<RepairsListController,
    List<RepairTicket>, String>(
  RepairsListController.new,
);

class RepairsListController
    extends FamilyAsyncNotifier<List<RepairTicket>, String> {
  late final RepairRepository _repo;

  @override
  Future<List<RepairTicket>> build(String assetId) async {
    _repo = ref.read(repairRepositoryProvider);
    return _repo.listForAsset(assetId);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<RepairTicket>>().copyWithPrevious(state);
    state = AsyncData<List<RepairTicket>>(await _repo.listForAsset(arg));
  }
}

final repairDetailProvider =
    AsyncNotifierProvider.family<RepairDetailController, RepairTicket, String>(
  RepairDetailController.new,
);

class RepairDetailController extends FamilyAsyncNotifier<RepairTicket, String> {
  late final RepairRepository _repo;

  @override
  Future<RepairTicket> build(String repairId) async {
    _repo = ref.read(repairRepositoryProvider);
    return _repo.getById(repairId);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<RepairTicket>().copyWithPrevious(state);
    state = AsyncData<RepairTicket>(await _repo.getById(arg));
  }

  Future<void> addUpdate({
    required RepairStatus newStatus,
    String? note,
    bool hasPhoto = false,
  }) async {
    final updated = await _repo.addUpdate(
      repairId: arg,
      newStatus: newStatus,
      note: note,
      hasPhoto: hasPhoto,
    );
    state = AsyncData<RepairTicket>(updated);
  }
}
