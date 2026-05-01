import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/config/demo_config.dart';
import '../domain/maintenance.dart';


abstract class MaintenanceRepository {
  Future<List<MaintenanceTaskType>> taskTypes();
  Future<MaintenanceListResult> listForAsset(String assetId);
  Future<void> logMaintenance({
    required String assetId,
    required String taskTypeId,
    required String notes,
    String? scheduledItemId,
    bool hasPhoto = false,
  });
}

class FakeMaintenanceRepository implements MaintenanceRepository {
  final List<MaintenanceTaskType> _types = const <MaintenanceTaskType>[
    MaintenanceTaskType(id: 't-clean', name: 'Routine cleaning'),
    MaintenanceTaskType(id: 't-firmware', name: 'Firmware / OS update'),
    MaintenanceTaskType(id: 't-battery', name: 'Battery health check'),
    MaintenanceTaskType(id: 't-inspect', name: 'Physical inspection'),
    MaintenanceTaskType(id: 't-other', name: 'Other'),
  ];

  final Map<String, List<MaintenanceScheduleItem>> _due =
      <String, List<MaintenanceScheduleItem>>{};
  final Map<String, List<MaintenanceEntry>> _history =
      <String, List<MaintenanceEntry>>{};

  FakeMaintenanceRepository() {
    _due['a-001'] = <MaintenanceScheduleItem>[
      MaintenanceScheduleItem(
        id: 's-1',
        taskType: _types[0],
        dueAt: DateTime.now().subtract(const Duration(days: 3)),
      ),
    ];
    _history['a-001'] = <MaintenanceEntry>[
      MaintenanceEntry(
        id: 'e-1',
        taskType: _types[2],
        performedAt: DateTime.now().subtract(const Duration(days: 32)),
        performedByFullName: 'Anjali Rao',
        notes: 'Battery cycle count 412. Within healthy range.',
        hasPhoto: true,
      ),
      MaintenanceEntry(
        id: 'e-2',
        taskType: _types[0],
        performedAt: DateTime.now().subtract(const Duration(days: 92)),
        performedByFullName: 'Sameer Kulkarni',
      ),
    ];
    _due['a-002'] = const <MaintenanceScheduleItem>[];
    _history['a-002'] = const <MaintenanceEntry>[];
  }

  @override
  Future<List<MaintenanceTaskType>> taskTypes() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return _types;
  }

  @override
  Future<MaintenanceListResult> listForAsset(String assetId) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return MaintenanceListResult(
      due: _due[assetId] ?? const <MaintenanceScheduleItem>[],
      history: _history[assetId] ?? const <MaintenanceEntry>[],
    );
  }

  @override
  Future<void> logMaintenance({
    required String assetId,
    required String taskTypeId,
    required String notes,
    String? scheduledItemId,
    bool hasPhoto = false,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    final type = _types.firstWhere((t) => t.id == taskTypeId);
    final entry = MaintenanceEntry(
      id: 'e-${DateTime.now().millisecondsSinceEpoch}',
      taskType: type,
      performedAt: DateTime.now(),
      performedByFullName: 'You',
      notes: notes.isEmpty ? null : notes,
      hasPhoto: hasPhoto,
    );
    _history[assetId] = <MaintenanceEntry>[
      entry,
      ...(_history[assetId] ?? const <MaintenanceEntry>[]),
    ];
    if (scheduledItemId != null) {
      _due[assetId] = (_due[assetId] ?? const <MaintenanceScheduleItem>[])
          .where((i) => i.id != scheduledItemId)
          .toList(growable: false);
    }
  }
}

class RealMaintenanceRepository implements MaintenanceRepository {
  RealMaintenanceRepository(this._api);

  final ApiClient _api;

  @override
  Future<List<MaintenanceTaskType>> taskTypes() async {
    final response = await _api.getMap('/api/v1/maintenance/task-types');
    final items = response['items'];
    if (items is! List) {
      return const <MaintenanceTaskType>[];
    }
    return items
        .whereType<Map<String, dynamic>>()
        .map(
          (item) => MaintenanceTaskType(
            id: item['id']?.toString() ?? '',
            name: item['label']?.toString() ??
                item['name']?.toString() ??
                'Maintenance',
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<MaintenanceListResult> listForAsset(String assetId) async {
    final response = await _api.getMap(
      '/api/v1/assets/$assetId/maintenance',
    );
    final items = response['items'];
    if (items is! List) {
      return const MaintenanceListResult(
        due: <MaintenanceScheduleItem>[],
        history: <MaintenanceEntry>[],
      );
    }

    final due = <MaintenanceScheduleItem>[];
    final history = <MaintenanceEntry>[];
    for (final item in items.whereType<Map<String, dynamic>>()) {
      final status = item['status']?.toString();
      final taskType = _taskTypeFromItem(item);
      if (status == 'scheduled' ||
          status == 'in_progress' ||
          status == 'overdue') {
        due.add(
          MaintenanceScheduleItem(
            id: item['id']?.toString() ?? '',
            taskType: taskType,
            dueAt: _dateTime(item['scheduledDate']) ?? DateTime.now(),
          ),
        );
      } else {
        history.add(
          MaintenanceEntry(
            id: item['id']?.toString() ?? '',
            taskType: taskType,
            performedAt: _dateTime(item['completedDate']) ??
                _dateTime(item['scheduledDate']) ??
                _dateTime(item['createdAt']) ??
                DateTime.now(),
            performedByFullName:
                item['technicianId']?.toString() ?? 'Technician',
            notes: item['notes']?.toString(),
          ),
        );
      }
    }

    return MaintenanceListResult(due: due, history: history);
  }

  @override
  Future<void> logMaintenance({
    required String assetId,
    required String taskTypeId,
    required String notes,
    String? scheduledItemId,
    bool hasPhoto = false,
  }) async {
    final now = DateTime.now().toUtc().toIso8601String();
    await _api.postMap(
      '/api/v1/assets/$assetId/maintenance',
      body: <String, Object?>{
        'taskTypeId': taskTypeId,
        'type': 'preventive',
        'completedDate': now,
        'notes': notes,
        'checklist': const <String>[],
        'status': 'completed',
      },
      idempotent: true,
    );
  }

  MaintenanceTaskType _taskTypeFromItem(Map<String, dynamic> item) {
    final notes = item['notes']?.toString() ?? '';
    final taskMatch = RegExp(r'\[task:([^\]]+)\]').firstMatch(notes);
    final id = taskMatch?.group(1) ?? item['type']?.toString() ?? 'task';
    return MaintenanceTaskType(id: id, name: _labelForTask(id));
  }

  String _labelForTask(String id) {
    return id
        .replaceAll('_', ' ')
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase() + part.substring(1))
        .join(' ');
  }

  DateTime? _dateTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}

final maintenanceRepositoryProvider = Provider<MaintenanceRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeMaintenanceRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealMaintenanceRepository(ref.read(apiClientProvider));
  }
  return FakeMaintenanceRepository();
});

