import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/network/api_client.dart';
import '../../../core/config/demo_config.dart';
import '../domain/repair.dart';


abstract class RepairRepository {
  Future<List<RepairTicket>> listForAsset(String assetId);
  Future<RepairTicket> getById(String repairId);
  Future<RepairTicket> raise({
    required String assetId,
    required String description,
    required RepairSeverity severity,
    required bool hasPhoto,
  });
  Future<RepairTicket> addUpdate({
    required String repairId,
    required RepairStatus newStatus,
    String? note,
    bool hasPhoto = false,
  });
}

class FakeRepairRepository implements RepairRepository {
  final Map<String, RepairTicket> _byId = <String, RepairTicket>{};

  FakeRepairRepository() {
    final t1 = RepairTicket(
      id: 'r-001',
      assetId: 'a-003',
      assetCode: 'AST-OFFICE-0058',
      assetName: 'ThinkPad T14 — Pool 58',
      description: 'Battery drains within 2 hours even when idle.',
      severity: RepairSeverity.medium,
      status: RepairStatus.inProgress,
      createdAt: DateTime.now().subtract(const Duration(days: 4)),
      reportedByFullName: 'Sameer Kulkarni',
      updates: <RepairUpdate>[
        RepairUpdate(
          id: 'u-1',
          createdAt: DateTime.now().subtract(const Duration(days: 4)),
          actorFullName: 'Sameer Kulkarni',
          statusBefore: RepairStatus.reported,
          statusAfter: RepairStatus.reported,
          note: 'Created repair ticket.',
        ),
        RepairUpdate(
          id: 'u-2',
          createdAt: DateTime.now().subtract(const Duration(days: 2)),
          actorFullName: 'Vendor Tech',
          statusBefore: RepairStatus.reported,
          statusAfter: RepairStatus.inProgress,
          note: 'Diagnosed: battery at 38% health. Ordering replacement.',
          // hasPhoto is the truth-derived-from-photoId — both stay in sync
          // until the bool hasPhoto → List<String> photoIds migration lands.
          hasPhoto: true,
          photoId: 'p-9991',
        ),
      ],
    );
    _byId['r-001'] = t1;
  }

  @override
  Future<List<RepairTicket>> listForAsset(String assetId) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    return _byId.values
        .where((t) => t.assetId == assetId)
        .toList(growable: false);
  }

  @override
  Future<RepairTicket> getById(String repairId) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final t = _byId[repairId];
    if (t == null) throw const AppError(code: AppErrorCode.notFound);
    return t;
  }

  @override
  Future<RepairTicket> raise({
    required String assetId,
    required String description,
    required RepairSeverity severity,
    required bool hasPhoto,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final id = 'r-${DateTime.now().millisecondsSinceEpoch}';
    final ticket = RepairTicket(
      id: id,
      assetId: assetId,
      assetCode: 'AST-DEMO-${assetId.split('-').last}',
      assetName: 'Asset $assetId',
      description: description,
      severity: severity,
      status: RepairStatus.reported,
      createdAt: DateTime.now(),
      reportedByFullName: 'You',
      updates: <RepairUpdate>[
        RepairUpdate(
          id: 'u-${DateTime.now().millisecondsSinceEpoch}',
          createdAt: DateTime.now(),
          actorFullName: 'You',
          statusBefore: RepairStatus.reported,
          statusAfter: RepairStatus.reported,
          note: description,
          hasPhoto: hasPhoto,
        ),
      ],
    );
    _byId[id] = ticket;
    return ticket;
  }

  @override
  Future<RepairTicket> addUpdate({
    required String repairId,
    required RepairStatus newStatus,
    String? note,
    bool hasPhoto = false,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final ticket = _byId[repairId];
    if (ticket == null) throw const AppError(code: AppErrorCode.notFound);
    final update = RepairUpdate(
      id: 'u-${DateTime.now().millisecondsSinceEpoch}',
      createdAt: DateTime.now(),
      actorFullName: 'You',
      statusBefore: ticket.status,
      statusAfter: newStatus,
      note: note,
      hasPhoto: hasPhoto,
    );
    final updated = ticket.copyWith(
      status: newStatus,
      updates: <RepairUpdate>[...ticket.updates, update],
    );
    _byId[repairId] = updated;
    return updated;
  }
}

class RealRepairRepository implements RepairRepository {
  RealRepairRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<RepairTicket>> listForAsset(String assetId) async {
    final response = await _api.getMap('/api/v1/assets/$assetId/repairs');
    final items = response['items'];
    if (items is! List) {
      return const <RepairTicket>[];
    }
    return items
        .whereType<Map<String, dynamic>>()
        .map((item) => _ticketFromRepair(item, assetId: assetId))
        .toList(growable: false);
  }

  @override
  Future<RepairTicket> getById(String repairId) async {
    final response = await _api.getMap('/api/v1/repairs/$repairId');
    final repair = response['repair'];
    if (repair is! Map<String, dynamic>) {
      throw const AppError(code: AppErrorCode.repairNotFound);
    }
    final updates = response['updates'] is List
        ? (response['updates'] as List)
            .whereType<Map<String, dynamic>>()
            .map(_updateFromJson)
            .toList(growable: false)
        : const <RepairUpdate>[];
    return _ticketFromRepair(repair, updates: updates);
  }

  @override
  Future<RepairTicket> raise({
    required String assetId,
    required String description,
    required RepairSeverity severity,
    required bool hasPhoto,
  }) async {
    final response = await _api.postMap(
      '/api/v1/assets/$assetId/repairs',
      body: <String, Object?>{
        'issue': description,
        'priority': _priorityToWire(severity),
        'notes': description,
      },
      idempotent: true,
    );
    final repair = response['repair'] is Map<String, dynamic>
        ? response['repair'] as Map<String, dynamic>
        : response;
    return _ticketFromRepair(repair, assetId: assetId);
  }

  @override
  Future<RepairTicket> addUpdate({
    required String repairId,
    required RepairStatus newStatus,
    String? note,
    bool hasPhoto = false,
  }) async {
    final safeNote = note == null || note.trim().isEmpty
        ? 'Status updated from mobile.'
        : note.trim();
    final response = await _api.postMap(
      '/api/v1/repairs/$repairId/updates',
      body: <String, Object?>{
        'statusTo': _statusToWire(newStatus),
        'note': safeNote,
      },
      idempotent: true,
    );
    if (response['repair'] is Map<String, dynamic>) {
      final updates = response['updates'] is List
          ? (response['updates'] as List)
              .whereType<Map<String, dynamic>>()
              .map(_updateFromJson)
              .toList(growable: false)
          : const <RepairUpdate>[];
      return _ticketFromRepair(
        response['repair'] as Map<String, dynamic>,
        updates: updates,
      );
    }
    return getById(repairId);
  }

  RepairTicket _ticketFromRepair(
    Map<String, dynamic> json, {
    String? assetId,
    List<RepairUpdate> updates = const <RepairUpdate>[],
  }) {
    final resolvedAssetId = json['assetId']?.toString() ?? assetId ?? '';
    return RepairTicket(
      id: json['id']?.toString() ?? '',
      assetId: resolvedAssetId,
      assetCode: json['assetTag']?.toString() ?? 'Asset $resolvedAssetId',
      assetName: json['assetName']?.toString() ?? 'Asset $resolvedAssetId',
      description:
          json['issue']?.toString() ?? json['description']?.toString() ?? '',
      severity: _severity(json['priority']?.toString()),
      status: _status(json['status']?.toString()),
      createdAt: _dateTime(json['createdAt']) ?? DateTime.now(),
      reportedByFullName:
          json['reportedByFullName']?.toString() ?? 'Reporter',
      updates: updates,
    );
  }

  RepairUpdate _updateFromJson(Map<String, dynamic> json) {
    return RepairUpdate(
      id: json['id']?.toString() ?? '',
      createdAt: _dateTime(json['createdAt']) ?? DateTime.now(),
      actorFullName: json['actorFullName']?.toString() ??
          json['actorName']?.toString() ??
          'User',
      statusBefore: _status(json['statusFrom']?.toString()),
      statusAfter: _status(json['statusTo']?.toString()),
      note: json['note']?.toString(),
    );
  }

  RepairSeverity _severity(String? value) {
    return switch (value) {
      'low' => RepairSeverity.low,
      'high' => RepairSeverity.high,
      'critical' => RepairSeverity.critical,
      _ => RepairSeverity.medium,
    };
  }

  RepairStatus _status(String? value) {
    return switch (value) {
      'pending' => RepairStatus.reported,
      'assigned' => RepairStatus.inProgress,
      'in_progress' => RepairStatus.inProgress,
      'completed' => RepairStatus.resolved,
      'cancelled' => RepairStatus.cancelled,
      'reported' => RepairStatus.reported,
      'resolved' => RepairStatus.resolved,
      _ => RepairStatus.reported,
    };
  }

  String _priorityToWire(RepairSeverity severity) {
    return switch (severity) {
      RepairSeverity.low => 'low',
      RepairSeverity.medium => 'medium',
      RepairSeverity.high => 'high',
      RepairSeverity.critical => 'critical',
    };
  }

  String _statusToWire(RepairStatus status) {
    return switch (status) {
      RepairStatus.reported => 'pending',
      RepairStatus.inProgress => 'in_progress',
      RepairStatus.resolved => 'completed',
      RepairStatus.cancelled => 'cancelled',
    };
  }

  DateTime? _dateTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}

final repairRepositoryProvider = Provider<RepairRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeRepairRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealRepairRepository(ref.read(apiClientProvider));
  }
  return FakeRepairRepository();
});

