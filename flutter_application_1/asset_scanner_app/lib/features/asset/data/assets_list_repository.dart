import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class AssetSummary {
  const AssetSummary({
    required this.id,
    required this.assetTag,
    required this.name,
    required this.status,
    required this.category,
    this.imageUrl,
  });

  final String id;
  final String assetTag;
  final String name;
  final String status;
  final String category;
  final String? imageUrl;

  factory AssetSummary.fromJson(Map<String, dynamic> json) {
    return AssetSummary(
      id: json['id'] as String? ?? '',
      assetTag: json['assetTag'] as String? ?? '',
      name: json['name'] as String? ?? 'Unnamed Asset',
      status: json['status'] as String? ?? 'unknown',
      category: json['category'] as String? ?? 'Asset',
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class AssetListResult {
  const AssetListResult({
    required this.items,
    required this.total,
  });

  final List<AssetSummary> items;
  final int total;

  factory AssetListResult.fromJson(Map<String, dynamic> json) {
    final list = json['items'] as List? ?? [];
    return AssetListResult(
      items: list.map((i) => AssetSummary.fromJson(i as Map<String, dynamic>)).toList(),
      total: json['total'] as int? ?? 0,
    );
  }
}

abstract class AssetsListRepository {
  Future<AssetListResult> getAssets({String? q, String? status});
}

class RealAssetsListRepository implements AssetsListRepository {
  RealAssetsListRepository(this._api);
  final ApiClient _api;

  @override
  Future<AssetListResult> getAssets({String? q, String? status}) async {
    final query = <String, String>{};
    if (q != null && q.isNotEmpty) query['q'] = q;
    if (status != null && status.isNotEmpty) query['status'] = status;

    final response = await _api.getMap('/api/v1/assets', query: query);
    return AssetListResult.fromJson(response);
  }
}

final assetsListRepositoryProvider = Provider<AssetsListRepository>((ref) {
  return RealAssetsListRepository(ref.read(apiClientProvider));
});
