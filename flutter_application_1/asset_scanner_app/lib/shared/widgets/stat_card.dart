import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.trend,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? trend;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.s16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.all12,
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.s8),
                decoration: BoxDecoration(
                  color: AppColors.brand.withOpacity(0.1),
                  borderRadius: AppRadius.all8,
                ),
                child: Icon(icon, color: AppColors.brand, size: 20),
              ),
              if (trend != null)
                Text(
                  trend!,
                  style: AppTypography.captionStrong.copyWith(
                    color: AppColors.success,
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.s12),
          Text(
            value,
            style: AppTypography.heading.copyWith(fontSize: 24),
          ),
          const SizedBox(height: AppSpacing.s4),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: AppColors.textSecondary,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
