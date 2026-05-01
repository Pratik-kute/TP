import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../data/asset_repository.dart';
import '../domain/asset.dart';

/// One controller per asset id, family-style.
final assetDetailsControllerProvider = AsyncNotifierProvider.family<
    AssetDetailsController, AssetLookupResult, String>(
  AssetDetailsController.new,
);

class AssetDetailsController
    extends FamilyAsyncNotifier<AssetLookupResult, String> {
  late final AssetRepository _repo;

  @override
  Future<AssetLookupResult> build(String assetId) async {
    _repo = ref.read(assetRepositoryProvider);
    return _repo.getById(assetId);
  }

  Future<void> refresh() async {
    final assetId = arg;
    state = const AsyncLoading<AssetLookupResult>().copyWithPrevious(state);
    try {
      final fresh = await _repo.getById(assetId);
      state = AsyncData<AssetLookupResult>(fresh);
    } on AppError catch (e, st) {
      state = AsyncError<AssetLookupResult>(e, st).copyWithPrevious(state);
    } catch (e, st) {
      state = AsyncError<AssetLookupResult>(AppError.unknown(), st)
          .copyWithPrevious(state);
    }
  }
}
