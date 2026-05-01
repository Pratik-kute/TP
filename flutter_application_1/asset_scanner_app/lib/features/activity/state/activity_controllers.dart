import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/activity_repository.dart';
import '../domain/activity_entry.dart';

/// One controller instance per asset id, family-style — same pattern as
/// every other list feature (maintenance, repairs).
final activityListProvider = AsyncNotifierProvider.family<
    ActivityListController, List<ActivityEntry>, String>(
  ActivityListController.new,
);

class ActivityListController
    extends FamilyAsyncNotifier<List<ActivityEntry>, String> {
  late final ActivityRepository _repo;

  @override
  Future<List<ActivityEntry>> build(String assetId) async {
    _repo = ref.read(activityRepositoryProvider);
    return _repo.listForAsset(assetId);
  }

  Future<void> refresh() async {
    state = const AsyncLoading<List<ActivityEntry>>().copyWithPrevious(state);
    state = AsyncData<List<ActivityEntry>>(await _repo.listForAsset(arg));
  }
}

final globalActivityProvider = AsyncNotifierProvider.family<
    GlobalActivityController,
    PaginatedActivity,
    ({int page, String? query, ActivityModule? module})>(
  GlobalActivityController.new,
);

class GlobalActivityController extends FamilyAsyncNotifier<PaginatedActivity,
    ({int page, String? query, ActivityModule? module})> {
  late final ActivityRepository _repo;

  @override
  Future<PaginatedActivity> build(
      ({int page, String? query, ActivityModule? module}) arg) async {
    _repo = ref.read(activityRepositoryProvider);
    return _repo.listGlobal(
      page: arg.page,
      query: arg.query,
      module: arg.module,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading<PaginatedActivity>().copyWithPrevious(state);
    state = AsyncData<PaginatedActivity>(await _repo.listGlobal(
      page: arg.page,
      query: arg.query,
      module: arg.module,
    ));
  }
}
