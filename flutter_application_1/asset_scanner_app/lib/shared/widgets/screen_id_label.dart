import 'package:flutter/material.dart';

/// A small, consistent label for referencing screens by ID.
/// Usually placed in the AppBar's actions.
class ScreenIdLabel extends StatelessWidget {
  const ScreenIdLabel({
    required this.id,
    this.name,
    super.key,
  });

  final Object id;
  final String? name;

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}
