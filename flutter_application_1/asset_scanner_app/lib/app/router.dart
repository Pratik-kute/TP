import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/activity/presentation/activity_log_screen.dart';
import '../features/asset/presentation/asset_details_screen.dart';
import '../features/audit/presentation/audit_verification_screen.dart';
import '../features/audit/presentation/verify_match_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/session_expired_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/maintenance/presentation/log_maintenance_screen.dart';
import '../features/maintenance/presentation/maintenance_entry_detail_screen.dart';
import '../features/maintenance/presentation/maintenance_list_screen.dart';
import '../features/maintenance/presentation/maintenance_schedule_detail_screen.dart';
import '../features/permission/presentation/camera_permission_screen.dart';
import '../features/photo/presentation/photo_capture_screen.dart';
import '../features/photo/presentation/photo_gallery_screen.dart';
import '../features/photo/presentation/photo_preview_screen.dart';
import '../features/recovery/presentation/mark_recovery_screen.dart';
import '../features/repair/presentation/raise_repair_screen.dart';
import '../features/repair/presentation/repair_detail_screen.dart';
import '../features/repair/presentation/repairs_list_screen.dart';
import '../features/scan/presentation/scanner_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/home/presentation/main_shell.dart';
import '../features/asset/presentation/assets_screen.dart';
import '../features/auth/presentation/profile_screen.dart';

/// Centralised route names — referenced from every navigation site so a
/// rename is one place.
class AppRoute {
  AppRoute._();

  static const String login = 'login';
  static const String sessionExpired = 'session-expired';
  static const String home = 'home';
  static const String scanner = 'scanner';
  static const String assetDetails = 'asset-details';
  static const String photoCapture = 'photo-capture';
  static const String photoPreview = 'photo-preview';
  static const String maintenanceList = 'maintenance-list';
  static const String logMaintenance = 'log-maintenance';
  static const String maintenanceScheduleDetail = 'maintenance-schedule-detail';
  static const String maintenanceEntryDetail = 'maintenance-entry-detail';
  static const String repairsList = 'repairs-list';
  static const String repairDetail = 'repair-detail';
  static const String raiseRepair = 'raise-repair';
  static const String markRecovery = 'mark-recovery';
  static const String auditVerification = 'audit-verification';
  static const String verifyMatch = 'verify-match';
  static const String activityLog = 'activity-log';
  static const String settings = 'settings';
  static const String cameraPermission = 'camera-permission';
  static const String photoGallery = 'photo-gallery';
}

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        name: AppRoute.login,
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/session-expired',
        name: AppRoute.sessionExpired,
        builder: (_, __) => const SessionExpiredScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return MainShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: AppRoute.home,
                builder: (_, __) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/assets',
                builder: (_, __) => const AssetsScreen(),
                routes: [
                  GoRoute(
                    path: ':assetId',
                    name: AppRoute.assetDetails,
                    builder: (_, state) => AssetDetailsScreen(
                      assetId: state.pathParameters['assetId']!,
                    ),
                    routes: [
                      // Sub-routes for asset details (maintenance, repairs, etc.)
                      GoRoute(
                        path: 'maintenance',
                        name: AppRoute.maintenanceList,
                        builder: (_, state) => MaintenanceListScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                        routes: [
                          GoRoute(
                            path: 'log',
                            name: AppRoute.logMaintenance,
                            builder: (_, state) => LogMaintenanceScreen(
                              assetId: state.pathParameters['assetId']!,
                              scheduledItemId:
                                  state.uri.queryParameters['scheduledItemId'],
                            ),
                          ),
                          GoRoute(
                            path: 'scheduled/:scheduleId',
                            name: AppRoute.maintenanceScheduleDetail,
                            builder: (_, state) =>
                                MaintenanceScheduleDetailScreen(
                              assetId: state.pathParameters['assetId']!,
                              scheduleId: state.pathParameters['scheduleId']!,
                            ),
                          ),
                          GoRoute(
                            path: 'entries/:entryId',
                            name: AppRoute.maintenanceEntryDetail,
                            builder: (_, state) => MaintenanceEntryDetailScreen(
                              assetId: state.pathParameters['assetId']!,
                              entryId: state.pathParameters['entryId']!,
                            ),
                          ),
                        ],
                      ),
                      GoRoute(
                        path: 'repairs',
                        name: AppRoute.repairsList,
                        builder: (_, state) => RepairsListScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                        routes: [
                          GoRoute(
                            path: 'raise',
                            name: AppRoute.raiseRepair,
                            builder: (_, state) => RaiseRepairScreen(
                              assetId: state.pathParameters['assetId']!,
                            ),
                          ),
                        ],
                      ),
                      GoRoute(
                        path: 'recovery',
                        name: AppRoute.markRecovery,
                        builder: (_, state) => MarkRecoveryScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                      ),
                      GoRoute(
                        path: 'audit',
                        name: AppRoute.auditVerification,
                        builder: (_, state) => AuditVerificationScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                        routes: [
                          GoRoute(
                            path: 'verify-match',
                            name: AppRoute.verifyMatch,
                            builder: (_, state) => VerifyMatchScreen(
                              assetId: state.pathParameters['assetId']!,
                            ),
                          ),
                        ],
                      ),
                      GoRoute(
                        path: 'photo',
                        name: AppRoute.photoCapture,
                        builder: (_, state) => PhotoCaptureScreen(
                          assetId: state.pathParameters['assetId']!,
                          flowContext: state.uri.queryParameters['context'] ??
                              'standalone',
                        ),
                        routes: [
                          GoRoute(
                            path: 'preview',
                            name: AppRoute.photoPreview,
                            builder: (_, state) => PhotoPreviewScreen(
                              assetId: state.pathParameters['assetId']!,
                              flowContext:
                                  state.uri.queryParameters['context'] ??
                                      'standalone',
                              localPath: state.uri.queryParameters['localPath'],
                            ),
                          ),
                        ],
                      ),
                      GoRoute(
                        path: 'photos',
                        name: AppRoute.photoGallery,
                        builder: (_, state) => PhotoGalleryScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                      ),
                      GoRoute(
                        path: 'activity',
                        name:
                            'asset-activity-log', // Keep per-asset log reachable
                        builder: (_, state) => ActivityLogScreen(
                          assetId: state.pathParameters['assetId']!,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/scan',
                name: AppRoute.scanner,
                builder: (_, __) => const ScannerScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/activity',
                name: AppRoute.activityLog,
                builder: (_, __) => const ActivityLogScreen(assetId: null),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, __) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/repairs/:repairId',
        name: AppRoute.repairDetail,
        builder: (_, state) => RepairDetailScreen(
          repairId: state.pathParameters['repairId']!,
        ),
      ),
      GoRoute(
        path: '/settings',
        name: AppRoute.settings,
        builder: (_, __) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/camera-permission',
        name: AppRoute.cameraPermission,
        builder: (_, __) => const CameraPermissionScreen(),
      ),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Route not found: ${state.uri}'),
        ),
      ),
    ),
  );
});
