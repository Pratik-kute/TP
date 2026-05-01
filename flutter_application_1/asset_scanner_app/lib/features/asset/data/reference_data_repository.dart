import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/config/demo_config.dart';
import '../domain/asset.dart';


/// Lookups for pickers (Recovery, future Audit reassignment).
abstract class ReferenceDataRepository {
  Future<List<AssetUser>> users();
  Future<List<AssetLocation>> locations();
}

class FakeReferenceDataRepository implements ReferenceDataRepository {
  static const List<AssetUser> _users = <AssetUser>[
    AssetUser(id: '91', fullName: 'Anjali Rao'),
    AssetUser(id: '102', fullName: 'Sameer Kulkarni'),
    AssetUser(id: '113', fullName: 'Priya Iyer'),
    AssetUser(id: '124', fullName: 'Rohan Mehta'),
    AssetUser(id: '135', fullName: 'Neha Sharma'),
  ];

  static const List<AssetLocation> _locations = <AssetLocation>[
    AssetLocation(id: '12', name: 'BLR-HQ / Floor 3 / IT Bay'),
    AssetLocation(id: '13', name: 'BLR-HQ / Floor 5 / Storage'),
    AssetLocation(id: '14', name: 'PUN-Office / Floor 1'),
    AssetLocation(id: '15', name: 'PUN-Office / Floor 2'),
    AssetLocation(id: '16', name: 'MUM-Branch / Reception'),
    AssetLocation(id: '17', name: 'IT Stockroom'),
  ];

  @override
  Future<List<AssetUser>> users() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return _users;
  }

  @override
  Future<List<AssetLocation>> locations() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return _locations;
  }
}

class RealReferenceDataRepository implements ReferenceDataRepository {
  RealReferenceDataRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<AssetUser>> users() async {
    final response = await _api.getMap(
      '/api/v1/reference/users',
      query: const <String, String?>{'limit': '100'},
    );
    final items = response['items'];
    if (items is! List) {
      return const <AssetUser>[];
    }
    return items
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => AssetUser(
            id: item['id']?.toString() ?? '',
            fullName: item['name']?.toString() ?? 'User',
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<List<AssetLocation>> locations() async {
    final response = await _api.getMap(
      '/api/v1/reference/locations',
      query: const <String, String?>{'limit': '100'},
    );
    final items = response['items'];
    if (items is! List) {
      return const <AssetLocation>[];
    }
    return items
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => AssetLocation(
            id: item['id']?.toString() ?? '',
            name: item['name']?.toString() ?? 'Location',
          ),
        )
        .toList(growable: false);
  }
}

final referenceDataRepositoryProvider =
    Provider<ReferenceDataRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeReferenceDataRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealReferenceDataRepository(ref.read(apiClientProvider));
  }
  return FakeReferenceDataRepository();
});


final usersProvider = FutureProvider<List<AssetUser>>((ref) {
  return ref.read(referenceDataRepositoryProvider).users();
});

final locationsProvider = FutureProvider<List<AssetLocation>>((ref) {
  return ref.read(referenceDataRepositoryProvider).locations();
});
