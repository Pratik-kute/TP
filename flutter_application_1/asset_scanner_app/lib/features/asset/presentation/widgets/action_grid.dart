import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router.dart';
import '../../../../core/theme/theme.dart';
import '../../../../shared/widgets/widgets.dart' hide ActionGrid;
import '../../domain/asset.dart';

/// Renders ActionTiles only for actions present in [permittedActions].
/// Tiles are hidden, never disabled (UX spec §5.4).
class ActionGrid extends StatelessWidget {
  const ActionGrid({
    required this.assetId,
    required this.permittedActions,
    required this.auditContext,
    super.key,
  });

  final String assetId;
  final List<PermittedAction> permittedActions;
  final AuditContext? auditContext;

  bool _has(PermittedAction a) => permittedActions.contains(a);

  @override
  Widget build(BuildContext context) {
    final tiles = <Widget>[];

    if (_has(PermittedAction.addPhoto)) {
      tiles.add(
        _tile(
          icon: Icons.add_a_photo_outlined,
          label: 'Add photo',
          onTap: () => context.pushNamed(
            AppRoute.photoCapture,
            pathParameters: <String, String>{'assetId': assetId},
            queryParameters: const <String, String>{'context': 'standalone'},
          ),
        ),
      );
    }
    if (_has(PermittedAction.logMaintenance)) {
      tiles.add(
        _tile(
          icon: Icons.build_outlined,
          label: 'Maintenance',
          onTap: () => context.pushNamed(
            AppRoute.maintenanceList,
            pathParameters: <String, String>{'assetId': assetId},
          ),
        ),
      );
    }
    if (_has(PermittedAction.raiseRepair) ||
        _has(PermittedAction.updateRepair)) {
      tiles.add(
        _tile(
          icon: Icons.handyman_outlined,
          label: 'Repairs',
          onTap: () => context.pushNamed(
            AppRoute.repairsList,
            pathParameters: <String, String>{'assetId': assetId},
          ),
        ),
      );
    }
    if (_has(PermittedAction.markRecovery)) {
      tiles.add(
        _tile(
          icon: Icons.assignment_return_outlined,
          label: 'Recovery',
          onTap: () => context.pushNamed(
            AppRoute.markRecovery,
            pathParameters: <String, String>{'assetId': assetId},
          ),
        ),
      );
    }
    if (_has(PermittedAction.verifyAudit) && auditContext != null) {
      tiles.add(
        _tile(
          icon: Icons.verified_outlined,
          label: 'Audit',
          onTap: () => context.pushNamed(
            AppRoute.auditVerification,
            pathParameters: <String, String>{'assetId': assetId},
          ),
        ),
      );
    }

    // Activity Log is always shown — reading activity is universal. The
    // server has no `view_activity` PermittedAction yet (see
    // `docs/known-issues.md` — diverges from the dumb-defensive-renderer
    // pattern; resolves when backend adds the value).
    tiles.add(
      _tile(
        icon: Icons.history,
        label: 'Activity Log',
        onTap: () => context.pushNamed(
          'asset-activity-log',
          pathParameters: <String, String>{'assetId': assetId},
        ),
      ),
    );

    if (tiles.isEmpty) return const SizedBox.shrink();

    return GridView.count(
      crossAxisCount: 2,
      childAspectRatio: 2.4,
      crossAxisSpacing: AppSpacing.s8,
      mainAxisSpacing: AppSpacing.s8,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: tiles,
    );
  }

  Widget _tile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return ActionTile(icon: icon, label: label, onTap: onTap);
  }
}
