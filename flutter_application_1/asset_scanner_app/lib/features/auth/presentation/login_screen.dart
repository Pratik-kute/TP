import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router.dart';
import '../../../core/errors/app_error.dart';
import '../../../core/theme/theme.dart';
import '../../../shared/widgets/widgets.dart';
import '../state/auth_controller.dart';
import '../../../core/config/demo_config.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      // Ensure we are NOT in demo mode when using real credentials
      ref.read(isDemoModeProvider.notifier).state = false;
      
      await ref.read(authControllerProvider.notifier).login(
            email: _email.text.trim(),
            password: _password.text,
          );
      if (!mounted) return;
      context.goNamed(AppRoute.home);
    } on AppError catch (e) {
      setState(() => _error = e.userMessage);
    } catch (_) {
      setState(() => _error = 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: <Widget>[
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const SizedBox(height: AppSpacing.s48),
                  const Text('Asset Scanner', style: AppTypography.title),
                  const SizedBox(height: AppSpacing.s4),
                  const HintText('Sign in to continue.'),
                  const SizedBox(height: AppSpacing.s32),
                  if (_error != null) ...<Widget>[
                    BannerError(
                      message: _error!,
                      onDismiss: () => setState(() => _error = null),
                    ),
                    const SizedBox(height: AppSpacing.s16),
                  ],
                  AppTextField(
                    label: 'Work email',
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofocus: true,
                  ),
                  const SizedBox(height: AppSpacing.s16),
                  AppPasswordField(
                    label: 'Password',
                    controller: _password,
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: AppSpacing.s24),
                  PrimaryButton(
                    label: 'Sign in',
                    onPressed: _submitting ? null : _submit,
                    isLoading: _submitting,
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
              child: ScreenIdLabel(id: 1, name: 'Login'),
            ),
          ),
        ],
      ),
    );
  }
}
