import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

/// A standardized 44pt height list item for touch-target optimization.
class ActionListItem extends StatelessWidget {
  const ActionListItem({
    required this.label,
    required this.onTap,
    this.icon,
    this.iconColor,
    this.trailing,
    this.showDivider = true,
    super.key,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final Color? iconColor;
  final Widget? trailing;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: <Widget>[
          SizedBox(
            height: 44,
            child: Row(
              children: <Widget>[
                if (icon != null) ...<Widget>[
                  Icon(
                    icon,
                    size: 20,
                    color: iconColor ?? AppColors.brand,
                  ),
                  const SizedBox(width: AppSpacing.s12),
                ],
                Expanded(
                  child: Text(
                    label,
                    style: AppTypography.body,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (trailing != null) ...<Widget>[
                  trailing!,
                  const SizedBox(width: 8),
                ],
                const Icon(
                  Icons.chevron_right,
                  size: 20,
                  color: AppColors.border,
                ),
              ],
            ),
          ),
          if (showDivider)
            const Divider(
              height: 0.5,
              thickness: 0.5,
              color: AppColors.border,
            ),
        ],
      ),
    );
  }
}
