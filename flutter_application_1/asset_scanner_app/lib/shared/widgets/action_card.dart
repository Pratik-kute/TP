import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';

class ActionCard extends StatelessWidget {
  const ActionCard({
    required this.label,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.all12,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.s12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: AppRadius.all12,
            border: Border.all(color: AppColors.border, width: 0.5),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.background, // Pale/off-white tile
                  borderRadius: AppRadius.all8,
                ),
                child: Icon(
                  icon,
                  color: AppColors.brand, // Green line icon
                  size: 24,
                ),
              ),
              const SizedBox(width: AppSpacing.s16),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.bodyStrong.copyWith(
                    fontSize: 16,
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ActionGrid extends StatelessWidget {
  const ActionGrid({required this.actions, super.key});

  final List<ActionCard> actions;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppSpacing.s12,
        mainAxisSpacing: AppSpacing.s12,
        mainAxisExtent: 72,
      ),
      itemCount: actions.length,
      itemBuilder: (context, index) => actions[index],
    );
  }
}
