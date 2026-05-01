import 'package:flutter/material.dart';
import '../../core/theme/theme.dart';
import 'secondary_button.dart';

class PaginationControl extends StatelessWidget {
  const PaginationControl({
    required this.currentPage,
    required this.totalPages,
    required this.onNext,
    required this.onPrevious,
    super.key,
  });

  final int currentPage;
  final int totalPages;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s16),
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          SizedBox(
            width: 100,
            child: onPrevious != null
                ? SecondaryButton(
                    label: 'Previous',
                    onPressed: onPrevious,
                  )
                : null,
          ),
          Text(
            'Page $currentPage of $totalPages',
            style: AppTypography.captionStrong,
          ),
          SizedBox(
            width: 100,
            child: onNext != null
                ? SecondaryButton(
                    label: 'Next',
                    onPressed: onNext,
                  )
                : null,
          ),
        ],
      ),
    );
  }
}
