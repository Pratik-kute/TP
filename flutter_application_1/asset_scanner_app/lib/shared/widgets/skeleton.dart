import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';

/// A loading placeholder. Three variants: line, rectangle, circle.
///
/// Uses a subtle pulsing opacity animation rather than a shimmer to keep
/// the visual quiet (per UX spec §1: no animations longer than 200ms;
/// the pulse here is purposeful loading affordance, not decoration).
class Skeleton extends StatefulWidget {
  const Skeleton.rect({
    required this.width,
    required this.height,
    this.borderRadius = AppRadius.all8,
    super.key,
  });

  const Skeleton.line({
    this.width = double.infinity,
    this.height = 14,
    this.borderRadius = AppRadius.all8,
    super.key,
  });

  const Skeleton.circle({
    required double size,
    super.key,
  })  : width = size,
        height = size,
        borderRadius = const BorderRadius.all(Radius.circular(999));

  final double width;
  final double height;
  final BorderRadius borderRadius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) {
        final t = Curves.easeInOut.transform(_controller.value);
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(
              AppColors.surface2,
              AppColors.border,
              t,
            ),
            borderRadius: widget.borderRadius,
          ),
        );
      },
    );
  }
}
