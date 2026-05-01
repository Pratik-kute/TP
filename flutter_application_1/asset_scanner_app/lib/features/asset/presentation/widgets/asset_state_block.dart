import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/theme.dart';
import '../../../../shared/widgets/widgets.dart';

class AssetStateBlock extends StatelessWidget {
  const AssetStateBlock({
    this.location,
    this.assignedTo,
    this.lastVerifiedAt,
    this.serialNumber,
    super.key,
  });

  final String? location;
  final String? assignedTo;
  final DateTime? lastVerifiedAt;
  final String? serialNumber;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s8),
      child: Column(
        children: <Widget>[
          KeyValueRow(label: 'Location', value: location),
          KeyValueRow(label: 'Assigned to', value: assignedTo),
          KeyValueRow(label: 'Serial number', value: serialNumber),
          KeyValueRow(
            label: 'Last verified',
            value: lastVerifiedAt == null
                ? null
                : DateFormat('d MMM yyyy').format(lastVerifiedAt!),
          ),
        ],
      ),
    );
  }
}
