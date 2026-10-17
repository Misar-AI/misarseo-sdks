import 'package:http/http.dart' as http;

import 'transport.dart';

/// MisarSEO API client. Every resource is a getter — `client.projects`,
/// `client.rankTracking`, `client.aiSearch` … — whose methods return Futures.
///
/// Apps have no process environment to read a key from, so pass it in —
/// typically loaded with [SecureKeyStore]:
///
/// ```dart
/// final key = await const SecureKeyStore().loadApiKey();
/// final client = MisarSeoClient(apiKey: key!);
/// final projects = await client.projects.list();
/// ```
class MisarSeoClient {
  static const version = '1.0.0';
  static const defaultBaseUrl = 'https://api.misar.io/seo';

  /// The transport every resource sends through.
  final Transport transport;

  MisarSeoClient({
    required String apiKey,
    String baseUrl = defaultBaseUrl,
    Duration timeout = const Duration(seconds: 30),
    int maxRetries = 2,
    Duration retryBaseDelay = const Duration(milliseconds: 250),
    Duration maxRetryDelay = const Duration(seconds: 60),
    http.Client? httpClient,
  }) : transport = Transport(
          apiKey: _checkKey(apiKey),
          baseUrl: baseUrl,
          timeout: timeout,
          maxRetries: maxRetries,
          retryBaseDelay: retryBaseDelay,
          maxRetryDelay: maxRetryDelay,
          userAgent: 'misarseo-flutter/$version',
          client: httpClient,
        );

  static String _checkKey(String key) {
    if (key.isEmpty) {
      throw ArgumentError('A MisarSEO API key (mseo_...) is required; see https://seo.misar.io/ai');
    }
    return key;
  }

  /// Closes the underlying HTTP client.
  void close() => transport.close();
}
