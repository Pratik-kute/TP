import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/app_error.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/token_store.dart';
import '../../../core/config/demo_config.dart';
import '../domain/user.dart';


abstract class AuthRepository {
  Future<User> login({required String email, required String password});
  Future<void> logout();
  User? currentUser();
}

class FakeAuthRepository implements AuthRepository {
  User? _user;

  @override
  Future<User> login({required String email, required String password}) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (email.isEmpty || password.isEmpty) {
      throw const AppError(code: AppErrorCode.unauthenticated);
    }
    _user = User(
      id: '91',
      fullName: _displayName(email),
      email: email,
      role: 'auditor',
      organizationId: 'demo-org-id',
      organisationName: 'Demo Organisation',
    );
    return _user!;
  }

  @override
  Future<void> logout() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _user = null;
  }

  @override
  User? currentUser() => _user;

  String _displayName(String email) {
    final local = email.split('@').first;
    if (local.isEmpty) return 'User';
    return local
        .split(RegExp('[._-]'))
        .where((p) => p.isNotEmpty)
        .map((p) => p[0].toUpperCase() + p.substring(1))
        .join(' ');
  }
}

class RealAuthRepository implements AuthRepository {
  RealAuthRepository(this._api, this._tokenStore);

  final ApiClient _api;
  final TokenStore _tokenStore;
  User? _user;

  @override
  Future<User> login({required String email, required String password}) async {
    final response = await _api.postMap(
      '/api/v1/auth/login',
      authMode: ApiAuthMode.apiKey,
      body: <String, Object?>{
        'email': email,
        'password': password,
      },
    );

    final token = response['token'] as String?;
    if (token == null) {
      throw AppError.unknown('Auth response did not include a token.');
    }

    await _tokenStore.save(AuthSession(accessToken: token));

    final rawUser = response['user'];
    if (rawUser is! Map<String, dynamic>) {
      throw AppError.unknown('Auth response did not include a user.');
    }
    
    _user = User.fromJson(rawUser);
    return _user!;
  }

  @override
  Future<void> logout() async {
    await _tokenStore.clear();
    _user = null;
  }

  @override
  User? currentUser() => _user;
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final isDemo = ref.watch(isDemoModeProvider);
  if (isDemo) return FakeAuthRepository();
  
  if (ref.read(apiConfigProvider).useRealApi) {
    return RealAuthRepository(
      ref.read(apiClientProvider),
      ref.read(tokenStoreProvider),
    );
  }
  return FakeAuthRepository();
});

