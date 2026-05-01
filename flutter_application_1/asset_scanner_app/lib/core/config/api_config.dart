class ApiConfig {
  const ApiConfig({
    required this.useRealApi,
    required this.baseUrl,
    required this.apiKey,
  });

  factory ApiConfig.fromEnvironment() {
    return const ApiConfig(
      useRealApi: bool.fromEnvironment('USE_REAL_API', defaultValue: true),
      baseUrl: String.fromEnvironment(
        'ASSET_TRACKER_API_BASE_URL',
        defaultValue: 'http://192.168.1.31:4000',
      ),
      apiKey: String.fromEnvironment('ASSET_TRACKER_API_KEY'),
    );
  }

  final bool useRealApi;
  final String baseUrl;
  final String apiKey;

  List<String> get candidateBaseUrls {
    final normalized = _normalizeBaseUrl(baseUrl);
    final base = Uri.parse(normalized);
    final port = base.hasPort ? base.port : 4000;

    final urls = <String>[
      normalized,
      if (_isLocalDevHost(base.host))
        ...<String>[
          _withHost(base, '10.0.2.2', port),
          _withHost(base, '127.0.0.1', port),
          _withHost(base, 'localhost', port),
          _withHost(base, '192.168.1.31', port),
        ],
    ];

    final seen = <String>{};
    return urls.where(seen.add).toList(growable: false);
  }

  String _normalizeBaseUrl(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return 'http://192.168.1.31:4000';
    }
    return trimmed.endsWith('/') ? trimmed : '$trimmed/';
  }

  bool _isLocalDevHost(String host) {
    if (host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2') {
      return true;
    }

    final parts = host.split('.');
    if (parts.length != 4) {
      return false;
    }

    final octets = parts.map(int.tryParse).toList(growable: false);
    if (octets.any((value) => value == null)) {
      return false;
    }

    final first = octets[0]!;
    final second = octets[1]!;
    return first == 10 ||
        first == 127 ||
        (first == 172 && second >= 16 && second <= 31) ||
        (first == 192 && second == 168);
  }

  String _withHost(Uri base, String host, int port) {
    return Uri(
      scheme: base.scheme,
      host: host,
      port: port,
    ).toString();
  }
}
