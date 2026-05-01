import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/asset_repository.dart';
import '../domain/asset.dart';

final assetListProvider = AsyncNotifierProvider.family<AssetListController,
    PaginatedAssets, ({int page, String? query, AssetStatus? status})>(
  AssetListController.new,
);

class AssetListController extends FamilyAsyncNotifier<PaginatedAssets,
    ({int page, String? query, AssetStatus? status})> {
  late final AssetRepository _repo;

  @override
  Future<PaginatedAssets> build(
      ({int page, String? query, AssetStatus? status}) arg) async {
    _repo = ref.read(assetRepositoryProvider);
    return _repo.listAssets(
      page: arg.page,
      query: arg.query,
      status: arg.status,
    );
  }

  Future<void> refresh() async {
    state = const AsyncLoading<PaginatedAssets>().copyWithPrevious(state);
    state = AsyncData<PaginatedAssets>(await _repo.listAssets(
      page: arg.page,
      query: arg.query,
      status: arg.status,
    ));
  }
}
