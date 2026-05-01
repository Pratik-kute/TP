import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

/// The primary vessel for data in the Asset Management design system.
/// Features a white surface, 14pt radius, and 0.5px border.
class InfoCard extends StatelessWidget {
  const InfoCard({
    required this.child,
    this.icon,
    this.iconBgColor,
    this.iconColor,
    this.label,
    this.padding = const EdgeInsets.all(AppSpacing.s16),
    this.margin,
    this.onTap,
    super.key,
  });

  final Widget child;
  final IconData? icon;
  final Color? iconBgColor;
  final Color? iconColor;
  final String? label;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    Widget content = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.all14,
        border: Border.all(color: AppColors.border, width: 0.5),
      ),
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (icon != null || label != null) ...<Widget>[
              Row(
                children: <Widget>[
                  if (icon != null) ...<Widget>[
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: iconBgColor ?? AppColors.brandSoft,
                        borderRadius: AppRadius.all8,
                      ),
                      child: Icon(
                        icon,
                        size: 18,
                        color: iconColor ?? AppColors.brand,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.s12),
                  ],
                  if (label != null)
                    Expanded(
                      child: Text(
                        label!.toUpperCase(),
                        style: AppTypography.sectionLabel,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.s12),
            ],
            child,
          ],
        ),
      ),
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.all14,
          child: content,
        ),
      );
    }

    return content;
  }
}
