import 'dart:io' show Platform;

import 'package:http/http.dart' as http;

import 'transport.dart';

/// MisarSEO API client. Every resource is a getter — `client.projects`,
/// `client.rankTracking`, `client.aiSearch` … — whose methods return Futures.
///
/// ```dart
/// final client = MisarSeoClient(apiKey: 'mseo_...');
/// final projects = await client.projects.list();
/// ```
class MisarSeoClient {
  static const version = '1.0.0';
  static const defaultBaseUrl = 'https://api.misar.io/seo';

  /// The transport every resource sends through.
  final Transport transport;

  /// [apiKey] falls back to `MISARSEO_API_KEY` where the platform has an
  /// environment. [httpClient] replaces the default (proxies, tests).
  MisarSeoClient({
    String? apiKey,
    String baseUrl = defaultBaseUrl,
    Duration timeout = const Duration(seconds: 30),
    int maxRetries = 2,
    Duration retryBaseDelay = const Duration(milliseconds: 250),
    Duration maxRetryDelay = const Duration(seconds: 60),
    http.Client? httpClient,
  }) : transport = Transport(
          apiKey: _resolveKey(apiKey),
          baseUrl: baseUrl,
          timeout: timeout,
          maxRetries: maxRetries,
          retryBaseDelay: retryBaseDelay,
          maxRetryDelay: maxRetryDelay,
          userAgent: 'misarseo-dart/$version',
          client: httpClient,
        );

  static String _resolveKey(String? key) {
    var resolved = key ?? '';
    if (resolved.isEmpty) {
      try {
        resolved = Platform.environment['MISARSEO_API_KEY'] ?? '';
      } catch (_) {
        // No process environment (web).
      }
    }
    if (resolved.isEmpty) {
      throw ArgumentError('A MisarSEO API key (mseo_...) is required: pass apiKey or set MISARSEO_API_KEY; '
          'see https://seo.misar.io/ai');
    }
    return resolved;
  }

  /// Closes the underlying HTTP client.
  void close() => transport.close();
}
