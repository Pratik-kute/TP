import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/network/api_client.dart';
import '../../../core/config/demo_config.dart';
import '../domain/asset.dart';



/// Repository contract. Real implementation lives wherever the API client
/// gets wired in (TRD §3 mobile network layer). Screens depend on this
/// interface, never on the concrete impl.
abstract class AssetRepository {
  Future<AssetLookupResult> lookupByQr(String qrPayload);
  Future<AssetLookupResult> getById(String assetId);

  /// Uploads a single asset photo from a local file path.
  ///
  /// In V1 the fake repo just appends a placeholder photo to the asset's
  /// `recentPhotos` list and ignores the bytes. The real impl will execute
  /// the two-step presigned-PUT flow described in TRD §photo-upload —
  /// `localPath` → request upload-url → PUT bytes → finalize.
  Future<void> uploadStandalonePhoto({
    required String assetId,
    required String localPath,
  });

  Future<PaginatedAssets> listAssets({
    String? query,
    AssetStatus? status,
    int page = 1,
    int pageSize = 10,
  });
}

class FakeAssetRepository implements AssetRepository {
  final Map<String, AssetLookupResult> _byId = <String, AssetLookupResult>{};
  final Map<String, String> _qrToId = <String, String>{};

  FakeAssetRepository() {
    _seed();
  }

  void _seed() {
    const laptopCategory = AssetCategory(id: '7', name: 'Laptop');
    const monitorCategory = AssetCategory(id: '11', name: 'Monitor');
    const accessoryCategory = AssetCategory(id: '15', name: 'Accessory');

    const blr = AssetLocation(id: '12', name: 'BLR-HQ / Floor 3 / IT Bay');
    const pune = AssetLocation(id: '15', name: 'PUN-Office / Floor 2');
    const delhi = AssetLocation(id: '18', name: 'DEL-Office / Ground Floor');

    const anjali = AssetUser(id: '91', fullName: 'Anjali Rao');
    const sameer = AssetUser(id: '102', fullName: 'Sameer Kulkarni');
    const rahul = AssetUser(id: '105', fullName: 'Rahul Jadhav');

    const statuses = AssetStatus.values;
    final locations = [blr, pune, delhi, null];
    final assignees = [anjali, sameer, rahul, null];
    final categories = [laptopCategory, monitorCategory, accessoryCategory];

    // Seed 50 assets
    for (int i = 1; i <= 64; i++) {
      final id = 'a-${i.toString().padLeft(3, '0')}';
      final code = 'AST-OFFICE-${i.toString().padLeft(4, '0')}';
      final status = statuses[i % statuses.length];
      final location = locations[i % locations.length];
      final assignee = status == AssetStatus.available
          ? null
          : assignees[i % assignees.length];
      final category = categories[i % categories.length];

      final asset = Asset(
        id: id,
        assetCode: code,
        name: '${category.name} ${i.toString().padLeft(3, '0')}',
        category: category,
        serialNumber: 'SN-$i-${DateTime.now().millisecondsSinceEpoch % 10000}',
        status: status,
        currentLocation: location,
        assignedToUser: assignee,
        lastVerifiedAt: DateTime.now().subtract(Duration(days: i * 2)),
        recentPhotos: const <AssetPhoto>[],
      );

      _byId[id] = AssetLookupResult(
        asset: asset,
        permittedActions: _getPermittedActions(status),
        openRepairCount: status == AssetStatus.underMaintenance ? 1 : 0,
        overdueMaintenanceCount: i % 10 == 0 ? 1 : 0,
        auditContext: i == 1
            ? const AuditContext(
                cycleId: 'c-2026q2',
                cycleName: 'Q2 2026 Audit',
                expectedLocation: blr,
                expectedAssignee: anjali,
              )
            : null,
      );

      _qrToId['QR-$code'] = id;
    }
  }

  List<PermittedAction> _getPermittedActions(AssetStatus status) {
    final actions = <PermittedAction>[
      PermittedAction.addPhoto,
      PermittedAction.logMaintenance,
      PermittedAction.raiseRepair,
    ];
    if (status == AssetStatus.underMaintenance) {
      actions.add(PermittedAction.updateRepair);
    }
    if (status == AssetStatus.allocated || status == AssetStatus.inUse) {
      actions.add(PermittedAction.markRecovery);
    }
    return actions;
  }

  @override
  Future<PaginatedAssets> listAssets({
    String? query,
    AssetStatus? status,
    int page = 1,
    int pageSize = 10,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var filtered = _byId.values.map((e) => e.asset).toList();

    if (query != null && query.isNotEmpty) {
      final q = query.toLowerCase();
      filtered = filtered
          .where(
            (a) =>
                a.name.toLowerCase().contains(q) ||
                a.assetCode.toLowerCase().contains(q) ||
                (a.serialNumber?.toLowerCase().contains(q) ?? false),
          )
          .toList();
    }

    if (status != null) {
      filtered = filtered.where((a) => a.status == status).toList();
    }

    // Sort by name for stability
    filtered.sort((a, b) => a.name.compareTo(b.name));

    final totalCount = filtered.length;
    final totalPages = (totalCount / pageSize).ceil();
    final start = (page - 1) * pageSize;
    final end = start + pageSize;

    final pagedAssets = filtered.sublist(
      start.clamp(0, totalCount),
      end.clamp(0, totalCount),
    );

    return PaginatedAssets(
      assets: pagedAssets,
      totalCount: totalCount,
      currentPage: page,
      totalPages: totalPages,
    );
  }

  @override
  Future<AssetLookupResult> lookupByQr(String qrPayload) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final id = _qrToId[qrPayload];
    if (id == null) {
      throw const AppError(code: AppErrorCode.invalidQrPayload);
    }
    return _byId[id]!;
  }

  @override
  Future<AssetLookupResult> getById(String assetId) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final result = _byId[assetId];
    if (result == null) {
      throw const AppError(code: AppErrorCode.assetNotFound);
    }
    return result;
  }

  @override
  Future<void> uploadStandalonePhoto({
    required String assetId,
    required String localPath,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final existing = _byId[assetId];
    if (existing == null) {
      throw const AppError(code: AppErrorCode.assetNotFound);
    }
    // Real impl will read bytes from `localPath` and PUT to a presigned URL.
    // Fake just stores the path as the photo URL so the gallery sees something.
    final newPhoto = AssetPhoto(
      id: 'p-${DateTime.now().millisecondsSinceEpoch}',
      url: 'file://$localPath',
      uploadedAt: DateTime.now(),
    );
    _byId[assetId] = existing.copyWith(
      asset: existing.asset.copyWith(
        recentPhotos: <AssetPhoto>[newPhoto, ...existing.asset.recentPhotos],
      ),
    );
  }
}

class RealAssetRepository implements AssetRepository {
  RealAssetRepository(this._api);

  final ApiClient _api;

  @override
  Future<AssetLookupResult> lookupByQr(String qrPayload) async {
    final response = await _api.postMap(
      '/api/v1/assets/lookup-by-qr',
      body: <String, Object?>{'qrPayload': qrPayload},
    );
    return _mapEnvelope(response);
  }

  @override
  Future<AssetLookupResult> getById(String assetId) async {
    final response = await _api.getMap('/api/v1/assets/$assetId');
    return _mapEnvelope(response);
  }

  @override
  Future<PaginatedAssets> listAssets({
    String? query,
    AssetStatus? status,
    int page = 1,
    int pageSize = 10,
  }) async {
    final response = await _api.getMap(
      '/api/v1/assets',
      query: <String, String?>{
        'q': query?.trim().isEmpty ?? true ? null : query!.trim(),
        'status': _wireStatus(status),
        'page': page.toString(),
        'limit': pageSize.toString(),
      },
    );
    final items = response['items'];
    if (items is! List) {
      return PaginatedAssets(
        assets: const <Asset>[],
        totalCount: _intValue(response['total']),
        currentPage: page,
        totalPages: 0,
      );
    }
    final assets = items
        .whereType<Map<String, dynamic>>()
        .map((item) {
          if (item['asset'] is Map<String, dynamic>) {
            return _mapEnvelope(item).asset;
          }
          return _mapEnvelope(<String, dynamic>{
            'asset': item,
            'location': item['location'],
            'currentAssignee':
                item['currentAssignee'] ?? item['assignedToUser'],
          }).asset;
        })
        .toList(growable: false);
    final totalCount = _intValue(response['total']);
    return PaginatedAssets(
      assets: assets,
      totalCount: totalCount,
      currentPage: page,
      totalPages: totalCount == 0 ? 0 : (totalCount / pageSize).ceil(),
    );
  }

  @override
  Future<void> uploadStandalonePhoto({
    required String assetId,
    required String localPath,
  }) async {
    final filePath = localPath.startsWith('file://')
        ? Uri.parse(localPath).toFilePath()
        : localPath;
    final file = File(filePath);
    final bytes = await file.readAsBytes();
    if (bytes.length > 10485760) {
      throw const AppError(
        code: AppErrorCode.validationFailed,
        message: 'Photo exceeds the 10 MB API limit.',
      );
    }

    final filename = file.uri.pathSegments.isEmpty
        ? 'asset-photo.jpg'
        : file.uri.pathSegments.last;
    final upload = await _api.postMap(
      '/api/v1/assets/$assetId/photos/upload-url',
      body: <String, Object?>{
        'filename': filename,
        'mimeType': _mimeType(filename),
        'sizeBytes': bytes.length,
      },
      idempotent: true,
    );

    final uploadUrl = upload['uploadUrl']?.toString();
    final photoId = upload['photoId']?.toString();
    if (uploadUrl == null || photoId == null) {
      throw AppError.unknown('Photo upload response was incomplete.');
    }

    await _api.putAbsolute(
      Uri.parse(uploadUrl),
      bytes: bytes,
      headers: _stringMap(upload['uploadHeaders']),
    );

    await _api.postMap(
      '/api/v1/assets/$assetId/photos/$photoId/finalize',
      body: const <String, Object?>{},
      idempotent: true,
    );
  }

  AssetLookupResult _mapEnvelope(Map<String, dynamic> json) {
    final assetJson = _map(json['asset']) ?? <String, dynamic>{};
    final locationJson = _map(json['location']);
    final assigneeJson = _map(json['currentAssignee']);
    final auditJson = _map(json['auditContext']);
    final assetId = assetJson['id']?.toString() ?? '';

    final asset = Asset(
      id: assetId,
      assetCode: assetJson['assetTag']?.toString() ??
          assetJson['assetCode']?.toString() ??
          assetId,
      name: assetJson['name']?.toString() ?? 'Asset',
      category: AssetCategory(
        id: assetJson['category']?.toString() ??
            assetJson['type']?.toString() ??
            'asset',
        name: assetJson['category']?.toString() ??
            assetJson['type']?.toString() ??
            'Asset',
      ),
      serialNumber: assetJson['serialNumber']?.toString(),
      status: _assetStatus(assetJson['status']?.toString()),
      currentLocation: locationJson == null
          ? null
          : AssetLocation(
              id: locationJson['id']?.toString() ?? '',
              name: locationJson['name']?.toString() ?? 'Location',
            ),
      assignedToUser: assigneeJson == null
          ? null
          : AssetUser(
              id: assigneeJson['id']?.toString() ?? '',
              fullName: assigneeJson['name']?.toString() ??
                  assigneeJson['fullName']?.toString() ??
                  'User',
            ),
      lastVerifiedAt: _dateTime(
        auditJson?['currentVerification'] is Map<String, dynamic>
            ? (auditJson?['currentVerification']
                as Map<String, dynamic>)['createdAt']
            : assetJson['updatedAt'],
      ),
      recentPhotos: _photos(assetJson),
    );

    return AssetLookupResult(
      asset: asset,
      permittedActions: _permittedActions(json['permittedActions']),
      auditContext: auditJson == null ? null : _auditContext(auditJson),
      openRepairCount: _intValue(json['openRepairCount']),
      overdueMaintenanceCount: _intValue(json['overdueMaintenanceCount']),
    );
  }

  AuditContext _auditContext(Map<String, dynamic> json) {
    return AuditContext(
      cycleId: json['cycleId']?.toString() ?? '',
      cycleName: json['cycleName']?.toString() ?? 'Audit cycle',
      expectedLocation: json['expectedLocationId'] == null
          ? null
          : AssetLocation(
              id: json['expectedLocationId'].toString(),
              name: 'Expected location',
            ),
      expectedAssignee: json['expectedAssigneeId'] == null
          ? null
          : AssetUser(
              id: json['expectedAssigneeId'].toString(),
              fullName: 'Expected assignee',
            ),
      existingVerificationResult:
          _map(json['currentVerification'])?['result']?.toString(),
    );
  }

  List<AssetPhoto> _photos(Map<String, dynamic> assetJson) {
    final urls = assetJson['imageUrls'];
    if (urls is! List) {
      final imageUrl = assetJson['imageUrl']?.toString();
      if (imageUrl == null || imageUrl.isEmpty) {
        return const <AssetPhoto>[];
      }
      return <AssetPhoto>[
        AssetPhoto(id: imageUrl, url: imageUrl, uploadedAt: DateTime.now()),
      ];
    }
    return urls
        .whereType<Object>()
        .map((url) => url.toString())
        .where((url) => url.isNotEmpty)
        .map(
          (url) => AssetPhoto(
            id: url,
            url: url,
            uploadedAt: DateTime.now(),
          ),
        )
        .toList(growable: false);
  }

  List<PermittedAction> _permittedActions(dynamic raw) {
    if (raw is! List) {
      return const <PermittedAction>[];
    }
    return raw
        .map((value) => switch (value.toString()) {
              'add_photo' => PermittedAction.addPhoto,
              'log_maintenance' => PermittedAction.logMaintenance,
              'raise_repair' => PermittedAction.raiseRepair,
              'update_repair' => PermittedAction.updateRepair,
              'mark_recovery' => PermittedAction.markRecovery,
              'verify_audit' => PermittedAction.verifyAudit,
              _ => null,
            })
        .whereType<PermittedAction>()
        .toList(growable: false);
  }

  AssetStatus _assetStatus(String? value) {
    return switch (value) {
      'available' => AssetStatus.available,
      'allocated' => AssetStatus.allocated,
      'in_use' => AssetStatus.inUse,
      'in_use_shared' => AssetStatus.inUse,
      'under_maintenance' => AssetStatus.underMaintenance,
      'retired' => AssetStatus.retired,
      'disposed' => AssetStatus.disposed,
      'dead' => AssetStatus.dead,
      'assigned' => AssetStatus.allocated,
      'lost' => AssetStatus.dead,
      _ => AssetStatus.available,
    };
  }

  Map<String, dynamic>? _map(dynamic value) {
    return value is Map<String, dynamic> ? value : null;
  }

  DateTime? _dateTime(dynamic value) {
    if (value == null) {
      return null;
    }
    return DateTime.tryParse(value.toString());
  }

  int _intValue(dynamic value) {
    return value is num ? value.toInt() : 0;
  }

  Map<String, String> _stringMap(dynamic value) {
    if (value is! Map<String, dynamic>) {
      return const <String, String>{};
    }
    return value.map((key, val) => MapEntry(key, val.toString()));
  }

  String _mimeType(String filename) {
    final lower = filename.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  String? _wireStatus(AssetStatus? status) {
    return switch (status) {
      null => null,
      AssetStatus.available => 'available',
      AssetStatus.allocated => 'allocated',
      AssetStatus.inUse => 'in_use',
      AssetStatus.underMaintenance => 'under_maintenance',
      AssetStatus.retired => 'retired',
      AssetStatus.disposed => 'disposed',
      AssetStatus.dead => 'dead',
    };
  }
}

final assetRepositoryProvider = Provider<AssetRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeAssetRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealAssetRepository(ref.read(apiClientProvider));
  }
  return FakeAssetRepository();
});

