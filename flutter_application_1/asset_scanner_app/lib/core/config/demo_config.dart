import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the app is currently running in Demo Mode (using fake data).
/// This can be toggled at the login screen.
final isDemoModeProvider = StateProvider<bool>((ref) => false);
