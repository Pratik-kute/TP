import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../state/auth_controller.dart';

class SessionExpiredScreen extends ConsumerWidget {
  const SessionExpiredScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Stack(
        children: <Widget>[
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.s24),
              child: Column(
                children: <Widget>[
                  const Spacer(),
                  EmptyState(
                    icon: Icons.lock_clock_outlined,
                    title: 'Session expired',
                    message: 'Sign in again to continue.',
                    action: PrimaryButton(
                      label: 'Sign in',
                      onPressed: () async {
                        await ref
                            .read(authControllerProvider.notifier)
                            .logout();
                        if (!context.mounted) return;
                        context.goNamed(AppRoute.login);
                      },
                    ),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ),
          const Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: ScreenIdLabel(id: 2, name: 'Session expired'),
            ),
          ),
        ],
      ),
    );
  }
}
