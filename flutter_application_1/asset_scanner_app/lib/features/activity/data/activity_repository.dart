import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/activity_entry.dart';

abstract class ActivityRepository {
  Future<List<ActivityEntry>> listForAsset(String assetId);
  Future<PaginatedActivity> listGlobal({
    int page = 1,
    int pageSize = 10,
    String? query,
    ActivityModule? module,
  });
}

class RealActivityRepository implements ActivityRepository {
  RealActivityRepository(this._api);
  final ApiClient _api;

  @override
  Future<List<ActivityEntry>> listForAsset(String assetId) async {
    final response = await _api.getMap('/api/v1/activity', query: {'assetId': assetId});
    final items = response['items'] as List? ?? [];
    return items.map((i) => _mapEntry(i as Map<String, dynamic>)).toList();
  }

  @override
  Future<PaginatedActivity> listGlobal({
    int page = 1,
    int pageSize = 10,
    String? query,
    ActivityModule? module,
  }) async {
    final response = await _api.getMap(
      '/api/v1/activity',
      query: <String, String?>{
        'page': page.toString(),
        'limit': pageSize.toString(),
        if (query != null && query.isNotEmpty) 'q': query,
        if (module != null) 'module': module.name,
      },
    );

    final items = response['items'] as List? ?? [];
    final entries = items.map((i) => _mapEntry(i as Map<String, dynamic>)).toList();
    final totalCount = response['total'] as int? ?? entries.length;

    return PaginatedActivity(
      entries: entries,
      totalEntries: totalCount,
      todayCount: response['todayCount'] as int? ?? 0,
      activeUsers: response['activeUsers'] as int? ?? 0,
      currentPage: page,
      totalPages: totalCount == 0 ? 0 : (totalCount / pageSize).ceil(),
    );
  }

  ActivityEntry _mapEntry(Map<String, dynamic> json) {
    return ActivityEntry(
      id: json['id']?.toString() ?? '',
      timestamp: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      actorFullName: json['userName']?.toString() ?? json['actorName']?.toString() ?? 'System',
      actionType: _mapActionType(json['action']?.toString()),
      module: _mapModule(json['module']?.toString()),
      summary: json['description']?.toString() ?? json['summary']?.toString() ?? '',
    );
  }

  ActivityActionType _mapActionType(String? action) {
    switch (action?.toLowerCase()) {
      case 'qr_scanned': return ActivityActionType.qrScanned;
      case 'create': return ActivityActionType.create;
      case 'assign': return ActivityActionType.assign;
      case 'unassign': return ActivityActionType.unassign;
      case 'update': return ActivityActionType.quickUpdate;
      case 'delete': return ActivityActionType.delete;
      default: return ActivityActionType.other;
    }
  }

  ActivityModule _mapModule(String? module) {
    switch (module?.toLowerCase()) {
      case 'assets': return ActivityModule.assets;
      case 'maintenance': return ActivityModule.maintenance;
      case 'repairs': return ActivityModule.repairs;
      case 'recovery': return ActivityModule.recovery;
      case 'audits': return ActivityModule.audits;
      case 'photos': return ActivityModule.photos;
      case 'allocations': return ActivityModule.allocations;
      default: return ActivityModule.assets;
    }
  }
}

final activityRepositoryProvider = Provider<ActivityRepository>((ref) {
  return RealActivityRepository(ref.read(apiClientProvider));
});
