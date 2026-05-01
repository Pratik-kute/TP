import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/api_config.dart';
import '../errors/app_error.dart';
import 'token_store.dart';

enum ApiAuthMode {
  none,
  apiKey,
  userJwt,
  userJwtOrApiKey,
}

class ApiClient {
  ApiClient({
    required ApiConfig config,
    required TokenStore tokenStore,
    HttpClient? httpClient,
  })  : _config = config,
        _tokenStore = tokenStore,
        _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 15);
  }

  final ApiConfig _config;
  final TokenStore _tokenStore;
  final HttpClient _httpClient;
  final Random _random = Random.secure();
  String? _resolvedBaseUrl;

  Future<Map<String, dynamic>> getMap(
    String path, {
    ApiAuthMode authMode = ApiAuthMode.userJwtOrApiKey,
    Map<String, String?> query = const <String, String?>{},
  }) async {
    final data = await request(
      'GET',
      path,
      authMode: authMode,
      query: query,
    );
    return _asMap(data);
  }

  Future<Map<String, dynamic>> postMap(
    String path, {
    ApiAuthMode authMode = ApiAuthMode.userJwtOrApiKey,
    Object? body,
    bool idempotent = true,
  }) async {

    final data = await request(
      'POST',
      path,
      authMode: authMode,
      body: body,
      idempotent: idempotent,
    );
    return _asMap(data);
  }

  Future<dynamic> request(
    String method,
    String path, {
    ApiAuthMode authMode = ApiAuthMode.userJwtOrApiKey,
    Object? body,
    Map<String, String?> query = const <String, String?>{},
    bool idempotent = false,
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'X-Request-Id': _newId(),
      if (body != null) 'Content-Type': 'application/json',
      if (idempotent) 'Idempotency-Key': _newId(),
    };
    return _send(
      method,
      path,
      authMode: authMode,
      body: body,
      query: query,
      headers: headers,
      retryOnExpiredToken: true,
    );
  }

  Future<void> putAbsolute(
    Uri uri, {
    required List<int> bytes,
    required Map<String, String> headers,
  }) async {
    try {
      final request = await _httpClient.openUrl('PUT', uri);
      headers.forEach((key, value) => request.headers.set(key, value));
      request.add(bytes);
      final response = await request.close().timeout(
            const Duration(seconds: 60),
          );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AppError.unknown('Photo upload failed.');
      }
    } on AppError {
      rethrow;
    } on TimeoutException {
      throw AppError.network('Upload timed out.');
    } on SocketException catch (e) {
      throw AppError.network('Upload failed: ${e.message}');
    } on HttpException catch (e) {
      throw AppError.network('HTTP error during upload: ${e.message}');
    }

  }

  Future<dynamic> _send(
    String method,
    String path, {
    required ApiAuthMode authMode,
    required Map<String, String> headers,
    required bool retryOnExpiredToken,
    Object? body,
    Map<String, String?> query = const <String, String?>{},
  }) async {
    final candidates = _candidateBaseUrls(path);
    AppError? lastNetworkError;

    for (var index = 0; index < candidates.length; index++) {
      final baseUrl = candidates[index];
      final uri = _uri(
        path,
        query,
        overrideBaseUrl: baseUrl,
      );

      try {
        final response = await _sendToUri(
          method,
          uri,
          authMode: authMode,
          headers: headers,
          retryOnExpiredToken: retryOnExpiredToken,
          body: body,
          path: path,
          query: query,
        );
        if (!_isAbsolutePath(path)) {
          _resolvedBaseUrl = baseUrl;
        }
        return response;
      } on AppError catch (error) {
        final isLastCandidate = index == candidates.length - 1;
        if (!isLastCandidate && error.code == AppErrorCode.network) {
          lastNetworkError = error;
          continue;
        }
        rethrow;
      }
    }

    throw lastNetworkError ?? AppError.network();
  }

  Future<dynamic> _sendToUri(
    String method,
    Uri uri, {
    required ApiAuthMode authMode,
    required Map<String, String> headers,
    required bool retryOnExpiredToken,
    required String path,
    required Map<String, String?> query,
    Object? body,
  }) async {
    try {
      final request = await _httpClient.openUrl(method, uri);
      final authHeader = _authHeader(authMode);
      if (authHeader != null) {
        headers['Authorization'] = authHeader;
      }
      headers.forEach((key, value) => request.headers.set(key, value));
      if (body != null) {
        request.add(utf8.encode(jsonEncode(body)));
      }
      final response = await request.close().timeout(
            const Duration(seconds: 30),
          );
      final responseText = await response.transform(utf8.decoder).join();
      final requestId = response.headers.value('x-request-id');
      final data = responseText.isEmpty ? null : jsonDecode(responseText);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return data;
      }

      final error = _errorFromResponse(data, requestId);
      if (retryOnExpiredToken &&
          error.code == AppErrorCode.tokenExpired &&
          authMode != ApiAuthMode.apiKey &&
          await _refreshSession()) {
        return _send(
          method,
          path,
          authMode: authMode,
          body: body,
          query: query,
          headers: headers,
          retryOnExpiredToken: false,
        );
      }
      throw error;
    } on AppError {
      rethrow;
    } on TimeoutException {
      throw AppError.network(
        'Request timed out. Tried ${_candidateBaseUrls(path).join(', ')}',
      );
    } on SocketException catch (e) {
      throw AppError.network(
        'Connection failed at ${uri.origin}. ${e.message}',
      );
    } on FormatException catch (error) {
      throw AppError.unknown(error.message);
    } on HttpException catch (e) {
      throw AppError.network('HTTP error: ${e.message}');
    }
  }

  List<String> _candidateBaseUrls(String path) {
    if (_isAbsolutePath(path)) {
      return const <String>[];
    }

    final ordered = <String>[
      if (_resolvedBaseUrl != null) _resolvedBaseUrl!,
      ..._config.candidateBaseUrls,
    ];
    final seen = <String>{};
    return ordered.where(seen.add).toList(growable: false);
  }

  Future<bool> _refreshSession() async {
    final session = _tokenStore.session;
    if (session == null || _config.apiKey.isEmpty) {
      return false;
    }

    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Request-Id': _newId(),
      'Authorization': 'Bearer ${_config.apiKey}',
    };
    final data = await _send(
      'POST',
      '/api/v1/auth/refresh',
      authMode: ApiAuthMode.none,
      body: <String, Object?>{
        'refreshToken': session.refreshToken,
        'deviceId': _deviceId,
      },
      headers: headers,
      retryOnExpiredToken: false,
    );
    final map = _asMap(data);
    await _tokenStore.save(
      session.copyWith(
        accessToken: map['accessToken'] as String,
        refreshToken: map['refreshToken'] as String,
        accessTokenExpiresAt: _expiresAt(map['accessTokenExpiresIn']),
        refreshTokenExpiresAt: _expiresAt(map['refreshTokenExpiresIn']),
      ),
    );
    return true;
  }

  String? _authHeader(ApiAuthMode authMode) {
    switch (authMode) {
      case ApiAuthMode.none:
        return null;
      case ApiAuthMode.apiKey:
        if (_config.apiKey.isEmpty) {
          throw const AppError(
            code: AppErrorCode.invalidApiKey,
            message: 'API key is missing.',
          );
        }
        return 'Bearer ${_config.apiKey}';
      case ApiAuthMode.userJwt:
        final token = _tokenStore.session?.accessToken;
        if (token == null || token.isEmpty) {
          throw const AppError(code: AppErrorCode.unauthenticated);
        }
        return 'Bearer $token';
      case ApiAuthMode.userJwtOrApiKey:
        final token = _tokenStore.session?.accessToken;
        if (token != null && token.isNotEmpty) {
          return 'Bearer $token';
        }
        if (_config.apiKey.isNotEmpty) {
          return 'Bearer ${_config.apiKey}';
        }
        throw const AppError(code: AppErrorCode.unauthenticated);
    }
  }

  Uri _uri(
    String path,
    Map<String, String?> query, {
    String? overrideBaseUrl,
  }) {
    final base = Uri.parse(overrideBaseUrl ?? _config.baseUrl);
    final uri = path.startsWith('http')
        ? Uri.parse(path)
        : base.resolve(path.startsWith('/') ? path : '/$path');
    final queryParameters = <String, String>{
      ...uri.queryParameters,
      for (final entry in query.entries)
        if (entry.value != null) entry.key: entry.value!,
    };
    return uri.replace(
      queryParameters: queryParameters.isEmpty ? null : queryParameters,
    );
  }

  bool _isAbsolutePath(String path) {
    return path.startsWith('http://') || path.startsWith('https://');
  }

  AppError _errorFromResponse(dynamic data, String? fallbackRequestId) {
    if (data is Map<String, dynamic>) {
      final error = data['error'];
      if (error is Map<String, dynamic>) {
        return AppError(
          code: AppErrorCode.fromString(error['code'] as String?),
          message: error['message'] as String?,
          requestId: error['requestId'] as String? ?? fallbackRequestId,
        );
      } else if (error is String) {
        // Handle single-string error response used in Phase 3 login
        return AppError(
          code: AppErrorCode.unknown,
          message: error,
          requestId: fallbackRequestId,
        );
      }
    }
    return AppError(
      code: AppErrorCode.unknown,
      requestId: fallbackRequestId,
    );
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data;
    }
    return <String, dynamic>{};
  }

  DateTime _expiresAt(dynamic seconds) {
    final value = seconds is num ? seconds.toInt() : 0;
    return DateTime.now().add(Duration(seconds: value));
  }

  String _newId() {
    final time = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    final random = List<String>.generate(
      4,
      (_) => _random.nextInt(0x10000).toRadixString(16).padLeft(4, '0'),
    ).join();
    return '$time-$random';
  }

  String get _deviceId => 'asset-scanner-mobile';
}

final apiConfigProvider = Provider<ApiConfig>((ref) {
  return ApiConfig.fromEnvironment();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    config: ref.read(apiConfigProvider),
    tokenStore: ref.read(tokenStoreProvider),
  );
});
