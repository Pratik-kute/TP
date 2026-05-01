import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthSession {
  const AuthSession({
    required this.accessToken,
    this.refreshToken,
    this.accessTokenExpiresAt,
    this.refreshTokenExpiresAt,
  });

  final String accessToken;
  final String? refreshToken;
  final DateTime? accessTokenExpiresAt;
  final DateTime? refreshTokenExpiresAt;

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? accessTokenExpiresAt,
    DateTime? refreshTokenExpiresAt,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      accessTokenExpiresAt:
          accessTokenExpiresAt ?? this.accessTokenExpiresAt,
      refreshTokenExpiresAt:
          refreshTokenExpiresAt ?? this.refreshTokenExpiresAt,
    );
  }
}

abstract class TokenStore {
  AuthSession? get session;
  Future<void> save(AuthSession session);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore() : _storage = const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  AuthSession? _session;

  @override
  AuthSession? get session => _session;

  @override
  Future<void> save(AuthSession session) async {
    _session = session;
    await _storage.write(key: 'auth_token', value: session.accessToken);
    if (session.refreshToken != null) {
      await _storage.write(key: 'refresh_token', value: session.refreshToken);
    }
  }

  @override
  Future<void> clear() async {
    _session = null;
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'refresh_token');
  }

  Future<void> load() async {
    final token = await _storage.read(key: 'auth_token');
    if (token != null) {
      _session = AuthSession(accessToken: token);
    }
  }
}

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore();
});
