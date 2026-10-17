import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import 'errors.dart';

/// One Server-Sent Events frame: its `event:` name and JSON-decoded `data:`.
class SseEvent {
  final String event;
  final Object? data;
  const SseEvent(this.event, this.data);

  @override
  String toString() => 'SseEvent($event, $data)';
}

/// Request plumbing the generated resources are written against.
///
/// Retry policy, identical in every MisarSEO SDK: 429 is retried for every
/// verb unless the body says `plan_limit_exceeded`; 502/503/504 and network
/// failures are retried for GET only (a POST may have started a billed crawl);
/// backoff starts at 250 ms with jitter and honours `Retry-After` up to the
/// configured cap.
class Transport {
  final String _apiKey;
  final String _baseUrl;
  final Duration timeout;
  final int maxRetries;
  final Duration retryBaseDelay;
  final Duration maxRetryDelay;
  final String userAgent;
  final http.Client _client;
  final _random = Random();

  Transport({
    required String apiKey,
    required String baseUrl,
    required this.timeout,
    required this.maxRetries,
    required this.retryBaseDelay,
    required this.maxRetryDelay,
    required this.userAgent,
    http.Client? client,
  })  : _apiKey = apiKey,
        _baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _client = client ?? http.Client();

  /// Encode one path segment.
  static String seg(String value) => Uri.encodeComponent(value);

  /// Required query parameters first; an explicit key in [query] wins.
  static Map<String, String> merge(Map<String, String>? query, Map<String, String> required) =>
      {...required, ...?query};

  Uri _uri(String path, Map<String, String>? query) {
    final qs = (query ?? const {}).entries.map((e) => '${seg(e.key)}=${seg(e.value)}').join('&');
    return Uri.parse(_baseUrl + path + (qs.isEmpty ? '' : '?$qs'));
  }

  Map<String, String> _headers(String accept) => {
        'Authorization': 'Bearer $_apiKey',
        'Content-Type': 'application/json',
        'Accept': accept,
        'User-Agent': userAgent,
      };

  Duration? _backoff(int attempt, int? retryAfter) {
    if (retryAfter != null) {
      final wait = Duration(seconds: retryAfter);
      return wait > maxRetryDelay ? null : wait;
    }
    final base = retryBaseDelay.inMicroseconds * pow(2, attempt);
    final us = base / 2 + _random.nextDouble() * base / 2;
    return Duration(microseconds: min(us.round(), maxRetryDelay.inMicroseconds));
  }

  static Object? _decode(String raw) {
    if (raw.trim().isEmpty) return null;
    try {
      return jsonDecode(raw);
    } on FormatException {
      return raw;
    }
  }

  /// The exception for a non-2xx response; the plan-limit code is checked BEFORE the status.
  static MisarSeoException errorFrom(int status, Map<String, String> headers, String raw) {
    final body = _decode(raw);
    final data = body is Map ? body : const {};
    final message = (data['error'] ?? data['message'] ?? 'HTTP $status').toString();
    final code = (data['code'] ?? 'API_ERROR').toString();
    final retryAfter = int.tryParse((headers['retry-after'] ?? '').trim());
    if (code == planLimitCode) {
      return MisarSeoPlanLimitException(
          status, message, body, retryAfter, headers['x-misar-plan'], headers['x-misar-upgrade-url']);
    }
    return MisarSeoException(status, code, message, body: body, retryAfter: retryAfter);
  }

  /// One request with the shared retry policy; the decoded JSON body (null when empty).
  Future<dynamic> request(String method, String path, {Map<String, String>? query, Object? body}) async {
    final uri = _uri(path, query);
    final payload = body == null ? null : jsonEncode(body);
    for (var attempt = 0;; attempt++) {
      final req = http.Request(method, uri)..headers.addAll(_headers('application/json'));
      if (payload != null) req.body = payload;
      http.Response resp;
      try {
        resp = await http.Response.fromStream(await _client.send(req).timeout(timeout));
      } on Exception catch (e) {
        if (method == 'GET' && attempt < maxRetries) {
          await Future<void>.delayed(_backoff(attempt, null) ?? Duration.zero);
          continue;
        }
        throw MisarSeoException(0, 'NETWORK_ERROR', 'could not reach the MisarSEO API: $e');
      }
      final status = resp.statusCode;
      final raw = utf8.decode(resp.bodyBytes);
      if (status >= 200 && status < 300) return _decode(raw);
      final error = errorFrom(status, resp.headers, raw);
      final retryable = status == 429 || (method == 'GET' && const [502, 503, 504].contains(status));
      if (error is MisarSeoPlanLimitException || !retryable || attempt >= maxRetries) throw error;
      final wait = _backoff(attempt, error.retryAfter);
      if (wait == null) throw error;
      await Future<void>.delayed(wait);
    }
  }

  /// Decode one SSE frame; null for keep-alive comments and frames without an event line.
  static SseEvent? parseFrame(String frame) {
    String? name;
    final data = <String>[];
    for (final line in frame.replaceAll('\r\n', '\n').split('\n')) {
      if (line.isEmpty || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        name = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        data.add(line.substring(5).replaceFirst(RegExp(r'^ +'), ''));
      }
    }
    if (name == null) return null;
    final raw = data.join('\n');
    return SseEvent(name, raw.isEmpty ? '' : _decode(raw));
  }

  /// GET a text/event-stream endpoint, yielding frames until a terminal event.
  Stream<SseEvent> stream(String path, {Map<String, String>? query, List<String> terminal = const []}) async* {
    final req = http.Request('GET', _uri(path, query))..headers.addAll(_headers('text/event-stream'));
    final resp = await _client.send(req).timeout(timeout);
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      throw errorFrom(resp.statusCode, resp.headers, await resp.stream.bytesToString());
    }
    var buffer = '';
    await for (final chunk in resp.stream.transform(utf8.decoder)) {
      buffer += chunk.replaceAll('\r', '');
      int idx;
      while ((idx = buffer.indexOf('\n\n')) != -1) {
        final frame = buffer.substring(0, idx);
        buffer = buffer.substring(idx + 2);
        final event = parseFrame(frame);
        if (event == null) continue;
        yield event;
        if (terminal.contains(event.event)) return;
      }
    }
    final last = parseFrame(buffer);
    if (last != null) yield last;
  }

  void close() => _client.close();
}
