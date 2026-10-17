import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:misarseo_flutter/misarseo_flutter.dart';
import 'package:misarseo_flutter/src/generated/dispatch.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records each request and serves canned replies — never the real API.
class Recorder {
  final List<(int, String, Map<String, String>)> replies;
  final List<http.Request> calls = [];
  Recorder([this.replies = const [(200, '{"ok":true}', {})]]);

  MockClient get client => MockClient((req) async {
        calls.add(req);
        final r = replies[(calls.length - 1).clamp(0, replies.length - 1)];
        return http.Response(r.$2, r.$1, headers: r.$3);
      });
}

MisarSeoClient clientFor(Recorder rec) => MisarSeoClient(
      apiKey: 'mseo_test',
      retryBaseDelay: const Duration(milliseconds: 1),
      maxRetryDelay: const Duration(milliseconds: 50),
      httpClient: rec.client,
    );

void main() {
  final manifest = jsonDecode(File('manifest.json').readAsStringSync()) as Map<String, dynamic>;
  final resources = manifest['resources'] as Map<String, dynamic>;

  group('manifest coverage', () {
    test('has the whole surface', () {
      final count = resources.values.fold<int>(0, (n, d) => n + ((d as Map)['methods'] as List).length);
      expect(count, greaterThan(200));
    });

    resources.forEach((resource, def) {
      for (final m in (def as Map)['methods'] as List) {
        final method = m as Map<String, dynamic>;
        final name = method['name'] as String;
        test('$resource.$name hits its route', () async {
          final rec = Recorder();
          final entry = generatedDispatch['$resource.$name'];
          expect(entry, isNotNull, reason: 'not dispatchable');
          final pathParams = (method['pathParams'] as List).cast<String>();
          final required = (method['requiredQuery'] as List).cast<String>();
          final hasBody = method['hasBody'] as bool;
          final args = List.generate(pathParams.length + required.length, (i) => 'v/$i');
          expect(entry!.$1, args.length);
          final out = await entry.$2(clientFor(rec), args, hasBody ? {'x': 1} : null);
          expect(out, {'ok': true});

          final req = rec.calls.single;
          expect(req.method, method['verb']);
          var want = method['path'] as String;
          for (var i = 0; i < pathParams.length; i++) {
            want = want.replaceFirst(':${pathParams[i]}', 'v%2F$i');
          }
          expect(req.url.path, '/seo$want');
          for (var j = 0; j < required.length; j++) {
            expect(req.url.queryParameters[required[j]], 'v/${pathParams.length + j}');
          }
          expect(req.body.isNotEmpty, hasBody);
          expect(req.headers['Authorization'], 'Bearer mseo_test');
          expect(req.headers['User-Agent'], startsWith('misarseo-flutter/'));
        });
      }
    });
  });

  test('retries an ordinary 429, then succeeds', () async {
    final rec = Recorder([(429, '{"error":"slow","code":"RATE_LIMITED"}', {}), (200, '{"projects":[]}', {})]);
    expect(await clientFor(rec).projects.list(), {'projects': []});
    expect(rec.calls, hasLength(2));
  });

  test('does not retry a plan-limit 429 and surfaces the offer', () async {
    final rec = Recorder([
      (
        429,
        '{"error":"Limit reached.","code":"plan_limit_exceeded","upgrade":{"reason":"quota_exhausted","feature":"keyword_lookups","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}',
        {'retry-after': '3600', 'x-misar-plan': 'free', 'x-misar-upgrade-url': 'https://seo.misar.io/subscribe?plan=pro'}
      )
    ]);
    try {
      await clientFor(rec).keywords.research(body: {'projectId': 'p'});
      fail('expected a plan-limit exception');
    } on MisarSeoPlanLimitException catch (e) {
      expect(rec.calls, hasLength(1));
      expect(e.status, 429);
      expect(e.code, 'plan_limit_exceeded');
      expect(e.reason, 'quota_exhausted');
      expect(e.feature, 'keyword_lookups');
      expect(e.plan, 'free');
      expect(e.upgradeUrl, 'https://seo.misar.io/subscribe?plan=pro');
      expect(e.retryAfter, 3600);
      expect(e.offer, isNotNull);
      expect(e.isRateLimited, isFalse);
    }
  });

  test('falls back to the body for a 402 plan limit', () async {
    final rec = Recorder([
      (
        402,
        '{"error":"Locked.","code":"plan_limit_exceeded","upgrade":{"reason":"feature_locked","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}',
        {}
      )
    ]);
    await expectLater(
        clientFor(rec).backlinks.overview('p1', 'example.com'),
        throwsA(isA<MisarSeoPlanLimitException>()
            .having((e) => e.plan, 'plan', 'free')
            .having((e) => e.upgradeUrl, 'upgradeUrl', 'https://seo.misar.io/subscribe')));
  });

  test('maps 404 with the API code', () async {
    final rec = Recorder([(404, '{"error":"Project not found","code":"NOT_FOUND"}', {})]);
    await expectLater(clientFor(rec).projects.get('nope'),
        throwsA(isA<MisarSeoException>().having((e) => e.isNotFound, 'isNotFound', true).having((e) => e.code, 'code', 'NOT_FOUND')));
  });

  test('does not retry a POST 503 but retries a GET 503', () async {
    var rec = Recorder([(503, '{"error":"down"}', {})]);
    await expectLater(clientFor(rec).crawl.start(body: {}), throwsA(isA<MisarSeoException>()));
    expect(rec.calls, hasLength(1));
    rec = Recorder([(503, '{}', {}), (200, '{}', {})]);
    await clientFor(rec).projects.list();
    expect(rec.calls, hasLength(2));
  });

  test('paginates offset and cursor pages', () async {
    final pages = {
      1: {'rows': [1, 2], 'hasMore': true},
      2: {'rows': [3], 'hasMore': true},
      3: {'rows': <int>[], 'hasMore': true},
    };
    expect(await Pagination.offsetRows((p) async => pages[p]!).toList(), [1, 2, 3]);
    final cursors = {
      '': {'rows': ['a'], 'hasMore': true, 'nextCursor': 'c1'},
      'c1': {'rows': ['b'], 'hasMore': true, 'nextCursor': 'c1'},
    };
    expect(await Pagination.cursorRows((c) async => cursors[c ?? '']!).toList(), ['a', 'b']);
  });

  test('streams crawl events until complete', () async {
    const body = ': ping\n\nevent: progress\ndata: {"pages":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n';
    final rec = Recorder([(200, body, {'content-type': 'text/event-stream'})]);
    final events = await clientFor(rec).crawl.streamEvents('a1', 'p1').toList();
    expect(events.map((e) => e.event), ['progress', 'complete']);
    expect(rec.calls.single.headers['Accept'], 'text/event-stream');
    expect(rec.calls.single.url.queryParameters['projectId'], 'p1');
  });

  test('rejects an empty key', () {
    expect(() => MisarSeoClient(apiKey: ''), throwsA(isA<ArgumentError>()));
  });
}
