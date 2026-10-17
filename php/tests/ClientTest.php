<?php

declare(strict_types=1);

namespace MisarSEO\Tests;

use MisarSEO\Client;
use MisarSEO\MisarSeoException;
use MisarSEO\Pagination;
use MisarSEO\PlanLimitException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Records each request and serves canned replies — never the real API. */
final class Recorder
{
    /** @var list<array{method:string,url:string,headers:array<string,string>,body:?string}> */
    public array $calls = [];

    /** @param list<array{0:int,1:array<string,string>,2:string}> $replies */
    public function __construct(private array $replies = [[200, [], '{"ok":true}']])
    {
    }

    /** @return array{0:int,1:array<string,string>,2:string} */
    public function __invoke(string $method, string $url, array $headers, ?string $body, ?callable $onChunk): array
    {
        $this->calls[] = ['method' => $method, 'url' => $url, 'headers' => $headers, 'body' => $body];
        $reply = $this->replies[min(count($this->calls) - 1, count($this->replies) - 1)];
        if ($onChunk !== null) {
            $onChunk($reply[2]);
            return [$reply[0], $reply[1], ''];
        }
        return $reply;
    }

    /** @return array<string, string> */
    public function query(int $i = 0): array
    {
        parse_str((string) parse_url($this->calls[$i]['url'], PHP_URL_QUERY), $out);
        return $out;
    }
}

final class ClientTest extends TestCase
{
    private static function client(Recorder $rec): Client
    {
        return new Client('mseo_test', retryBaseDelay: 0.001, maxRetryDelay: 0.05, handler: $rec);
    }

    /** @return iterable<string, array{string, array<string, mixed>}> */
    public static function manifestMethods(): iterable
    {
        $manifest = json_decode((string) file_get_contents(__DIR__ . '/../manifest.json'), true);
        foreach ($manifest['resources'] as $resource => $def) {
            foreach ($def['methods'] as $method) {
                yield "{$resource}.{$method['name']}" => [$resource, $method];
            }
        }
    }

    public function testManifestIsComplete(): void
    {
        self::assertGreaterThan(200, iterator_count(self::manifestMethods()));
    }

    /** @param array<string, mixed> $method */
    #[DataProvider('manifestMethods')]
    public function testEveryManifestMethodHitsItsRoute(string $resource, array $method): void
    {
        $rec = new Recorder();
        $target = self::client($rec)->{$resource};
        $name = method_exists($target, $method['name']) ? $method['name'] : $method['name'] . '_';
        $positional = array_merge($method['pathParams'], $method['requiredQuery']);
        $args = [];
        foreach ($positional as $i => $_) {
            $args[] = "v/{$i}";
        }
        if ($method['hasBody']) {
            $args[] = ['x' => 1];
        }
        self::assertSame(['ok' => true], $target->{$name}(...$args));

        $call = $rec->calls[0];
        self::assertSame($method['verb'], $call['method']);
        $want = $method['path'];
        foreach ($method['pathParams'] as $i => $p) {
            $want = str_replace(":{$p}", "v%2F{$i}", $want);
        }
        self::assertSame('/seo' . $want, parse_url($call['url'], PHP_URL_PATH));
        $query = $rec->query();
        foreach ($method['requiredQuery'] as $j => $q) {
            self::assertSame('v/' . (count($method['pathParams']) + $j), $query[$q] ?? null);
        }
        self::assertSame($method['hasBody'], $call['body'] !== null);
        self::assertSame('Bearer mseo_test', $call['headers']['Authorization']);
        self::assertStringStartsWith('misarseo-php/', $call['headers']['User-Agent']);
    }

    public function testRateLimitRetriedThenSucceeds(): void
    {
        $rec = new Recorder([[429, [], '{"error":"slow","code":"RATE_LIMITED"}'], [200, [], '{"projects":[]}']]);
        self::assertSame(['projects' => []], self::client($rec)->projects->list());
        self::assertCount(2, $rec->calls);
    }

    public function testPlanLimitIsNotRetriedAndCarriesTheOffer(): void
    {
        $rec = new Recorder([[429, ['retry-after' => '3600', 'x-misar-plan' => 'free', 'x-misar-upgrade-url' => 'https://seo.misar.io/subscribe?plan=pro'],
            '{"error":"Limit reached.","code":"plan_limit_exceeded","upgrade":{"reason":"quota_exhausted","feature":"keyword_lookups","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}']]);
        try {
            self::client($rec)->keywords->research(['projectId' => 'p']);
            self::fail('expected PlanLimitException');
        } catch (PlanLimitException $e) {
            self::assertCount(1, $rec->calls);
            self::assertSame(429, $e->status);
            self::assertSame('plan_limit_exceeded', $e->getErrorCode());
            self::assertSame('quota_exhausted', $e->reason);
            self::assertSame('keyword_lookups', $e->feature);
            self::assertSame('free', $e->plan);
            self::assertSame('https://seo.misar.io/subscribe?plan=pro', $e->upgradeUrl);
            self::assertSame(3600, $e->retryAfter);
            self::assertIsArray($e->offer);
            self::assertFalse($e->isRateLimited());
        }
    }

    public function testPlanLimit402FallsBackToTheBody(): void
    {
        $rec = new Recorder([[402, [], '{"error":"Locked.","code":"plan_limit_exceeded","upgrade":{"reason":"feature_locked","current_plan":{"slug":"free"},"urls":{"pricing":"https://seo.misar.io/subscribe"}}}']]);
        try {
            self::client($rec)->backlinks->overview('p1', 'example.com');
            self::fail('expected PlanLimitException');
        } catch (PlanLimitException $e) {
            self::assertSame('free', $e->plan);
            self::assertSame('https://seo.misar.io/subscribe', $e->upgradeUrl);
        }
    }

    public function testNotFoundKeepsTheCode(): void
    {
        $rec = new Recorder([[404, [], '{"error":"Project not found","code":"NOT_FOUND"}']]);
        try {
            self::client($rec)->projects->get('nope');
            self::fail('expected an exception');
        } catch (MisarSeoException $e) {
            self::assertTrue($e->isNotFound());
            self::assertSame('NOT_FOUND', $e->getErrorCode());
        }
    }

    public function testPost503NotRetriedGet503Retried(): void
    {
        $rec = new Recorder([[503, [], '{"error":"down"}']]);
        try {
            self::client($rec)->crawl->start([]);
            self::fail('expected an exception');
        } catch (MisarSeoException) {
        }
        self::assertCount(1, $rec->calls);
        $rec = new Recorder([[503, [], '{}'], [200, [], '{}']]);
        self::client($rec)->projects->list();
        self::assertCount(2, $rec->calls);
    }

    public function testPagination(): void
    {
        $pages = [1 => ['rows' => [1, 2], 'hasMore' => true], 2 => ['rows' => [3], 'hasMore' => true], 3 => ['rows' => [], 'hasMore' => true]];
        self::assertSame([1, 2, 3], iterator_to_array(Pagination::offsetRows(fn (int $p) => $pages[$p]), false));
        $cursors = ['' => ['rows' => ['a'], 'hasMore' => true, 'nextCursor' => 'c1'], 'c1' => ['rows' => ['b'], 'hasMore' => true, 'nextCursor' => 'c1']];
        self::assertSame(['a', 'b'], iterator_to_array(Pagination::cursorRows(fn (?string $c) => $cursors[$c ?? '']), false));
    }

    public function testCrawlStreamReadsUntilComplete(): void
    {
        $body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n";
        $rec = new Recorder([[200, ['content-type' => 'text/event-stream'], $body]]);
        $names = [];
        foreach (self::client($rec)->crawl->streamEvents('a1', 'p1') as $event) {
            $names[] = $event->event;
        }
        self::assertSame(['progress', 'complete'], $names);
        self::assertSame('text/event-stream', $rec->calls[0]['headers']['Accept']);
        self::assertSame('p1', $rec->query()['projectId']);
    }

    public function testMissingKeyFailsFast(): void
    {
        $old = getenv('MISARSEO_API_KEY');
        putenv('MISARSEO_API_KEY');
        try {
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessageMatches('/seo\.misar\.io/');
            new Client();
        } finally {
            if ($old !== false) {
                putenv("MISARSEO_API_KEY={$old}");
            }
        }
    }
}
