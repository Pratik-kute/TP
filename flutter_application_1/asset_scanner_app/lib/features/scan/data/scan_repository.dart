import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../asset/data/asset_repository.dart';
import '../../asset/domain/asset.dart';

abstract class ScanRepository {
  /// Resolves a raw QR payload to an [AssetLookupResult]. Throws an [AppError]
  /// with code [AppErrorCode.invalidQrPayload] if the payload doesn't look like
  /// an asset QR; throws [AppErrorCode.assetNotFound] if the asset has been
  /// retired or deleted.
  Future<AssetLookupResult> resolve(String qrPayload);
}

class AssetScanRepository implements ScanRepository {
  AssetScanRepository(this._assetRepo);

  final AssetRepository _assetRepo;

  @override
  Future<AssetLookupResult> resolve(String qrPayload) {
    if (qrPayload.isEmpty) {
      throw const AppError(code: AppErrorCode.invalidQrPayload);
    }
    return _assetRepo.lookupByQr(qrPayload);
  }
}

final scanRepositoryProvider = Provider<ScanRepository>((ref) {
  return AssetScanRepository(ref.read(assetRepositoryProvider));
});
