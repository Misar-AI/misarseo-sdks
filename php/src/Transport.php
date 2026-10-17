<?php

declare(strict_types=1);

namespace MisarSEO;

/**
 * Request plumbing the generated resources are written against.
 *
 * Retry policy, identical in every MisarSEO SDK: 429 is retried for every verb
 * unless the body says plan_limit_exceeded; 502/503/504 and network failures
 * are retried for GET only (a POST may have started a billed crawl); backoff
 * starts at 250 ms with jitter and honours Retry-After up to the configured cap.
 *
 * The HTTP handler is injectable: a callable
 * `(string $method, string $url, array $headers, ?string $body, ?callable $onChunk): array{0:int,1:array<string,string>,2:string}`
 * — cURL by default, a recorder in tests.
 */
final class Transport
{
    public const VERSION = '1.0.0';
    public const DEFAULT_BASE_URL = 'https://api.misar.io/seo';

    /** @var callable */
    private $handler;
    private string $baseUrl;

    public function __construct(
        private readonly string $apiKey,
        string $baseUrl = self::DEFAULT_BASE_URL,
        private readonly float $timeout = 30.0,
        private readonly int $maxRetries = 2,
        private readonly float $retryBaseDelay = 0.25,
        private readonly float $maxRetryDelay = 60.0,
        ?callable $handler = null,
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->handler = $handler ?? $this->curl(...);
    }

    /** Encode one path segment. */
    public static function seg(string $value): string
    {
        return rawurlencode($value);
    }

    /**
     * Required query parameters first; an explicit key in $query wins.
     *
     * @param array<string, mixed>|null $query
     * @param array<string, string> $required
     * @return array<string, mixed>
     */
    public static function merge(?array $query, array $required): array
    {
        return array_merge($required, $query ?? []);
    }

    /** @return array<string, string> */
    private function headers(string $accept = 'application/json'): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
            'Accept' => $accept,
            'User-Agent' => 'misarseo-php/' . self::VERSION,
        ];
    }

    /** @param array<string, mixed>|null $query */
    private function url(string $path, ?array $query): string
    {
        $pairs = [];
        foreach ($query ?? [] as $k => $v) {
            if ($v === null) {
                continue;
            }
            $v = is_bool($v) ? ($v ? 'true' : 'false') : (is_array($v) ? implode(',', $v) : (string) $v);
            $pairs[] = rawurlencode((string) $k) . '=' . rawurlencode($v);
        }
        return $this->baseUrl . $path . ($pairs ? '?' . implode('&', $pairs) : '');
    }

    private static function decode(?string $raw): mixed
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;
    }

    /**
     * The exception for a non-2xx response. The plan-limit code is checked
     * BEFORE the status: a spent quota is a 429 that otherwise looks like an
     * ordinary throttle.
     *
     * @param array<string, string> $headers lower-cased names
     */
    public static function errorFrom(int $status, array $headers, ?string $raw): MisarSeoException
    {
        $body = self::decode($raw);
        $data = is_array($body) ? $body : [];
        $message = (string) ($data['error'] ?? $data['message'] ?? "HTTP {$status}");
        $code = (string) ($data['code'] ?? 'API_ERROR');
        $retry = isset($headers['retry-after']) && ctype_digit(trim($headers['retry-after'])) ? (int) $headers['retry-after'] : null;
        if ($code === PlanLimitException::PLAN_LIMIT_CODE) {
            return new PlanLimitException($status, $message, $body, $retry, $headers['x-misar-plan'] ?? null, $headers['x-misar-upgrade-url'] ?? null);
        }
        return new MisarSeoException($status, $code, $message, $body, $retry);
    }

    private function backoff(int $attempt, ?int $retryAfter): ?float
    {
        if ($retryAfter !== null) {
            return $retryAfter > $this->maxRetryDelay ? null : (float) $retryAfter;
        }
        $base = $this->retryBaseDelay * (2 ** $attempt);
        return min($this->maxRetryDelay, $base / 2 + (mt_rand() / mt_getrandmax()) * $base / 2);
    }

    /** @param array<string, mixed>|null $query */
    public function request(string $method, string $path, ?array $query, mixed $body): mixed
    {
        $url = $this->url($path, $query);
        $payload = $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        for ($attempt = 0;; $attempt++) {
            try {
                [$status, $headers, $raw] = ($this->handler)($method, $url, $this->headers(), $payload, null);
            } catch (\Throwable $e) {
                if ($method === 'GET' && $attempt < $this->maxRetries) {
                    usleep((int) ($this->backoff($attempt, null) * 1e6));
                    continue;
                }
                throw new MisarSeoException(0, 'NETWORK_ERROR', 'could not reach the MisarSEO API: ' . $e->getMessage());
            }
            if ($status >= 200 && $status < 300) {
                return self::decode($raw);
            }
            $error = self::errorFrom($status, $headers, $raw);
            $retryable = $status === 429 || ($method === 'GET' && in_array($status, [502, 503, 504], true));
            if ($error instanceof PlanLimitException || !$retryable || $attempt >= $this->maxRetries) {
                throw $error;
            }
            $wait = $this->backoff($attempt, $error->retryAfter);
            if ($wait === null) {
                throw $error;
            }
            usleep((int) ($wait * 1e6));
        }
    }

    /** Decode one SSE frame; null for keep-alive comments and frames without an event line. */
    public static function parseFrame(string $frame): ?StreamEvent
    {
        $event = null;
        $data = [];
        foreach (explode("\n", str_replace("\r\n", "\n", $frame)) as $line) {
            if ($line === '' || str_starts_with($line, ':')) {
                continue;
            }
            if (str_starts_with($line, 'event:')) {
                $event = trim(substr($line, 6));
            } elseif (str_starts_with($line, 'data:')) {
                $data[] = ltrim(substr($line, 5), ' ');
            }
        }
        if ($event === null) {
            return null;
        }
        $raw = implode("\n", $data);
        return new StreamEvent($event, $raw === '' ? '' : self::decode($raw));
    }

    /**
     * GET a text/event-stream endpoint, yielding frames until a terminal event.
     *
     * @param array<string, mixed>|null $query
     * @param list<string> $terminal
     * @return \Generator<int, StreamEvent>
     */
    public function stream(string $path, ?array $query, array $terminal): \Generator
    {
        $chunks = [];
        $collect = static function (string $chunk) use (&$chunks): void {
            $chunks[] = $chunk;
        };
        [$status, $headers, $raw] = ($this->handler)('GET', $this->url($path, $query), $this->headers('text/event-stream'), null, $collect);
        if ($status < 200 || $status >= 300) {
            throw self::errorFrom($status, $headers, $raw !== '' ? $raw : implode('', $chunks));
        }
        $buffer = str_replace("\r", '', $chunks ? implode('', $chunks) : $raw);
        while (($pos = strpos($buffer, "\n\n")) !== false) {
            $frame = substr($buffer, 0, $pos);
            $buffer = substr($buffer, $pos + 2);
            $event = self::parseFrame($frame);
            if ($event === null) {
                continue;
            }
            yield $event;
            if (in_array($event->event, $terminal, true)) {
                return;
            }
        }
        $last = self::parseFrame($buffer);
        if ($last !== null) {
            yield $last;
        }
    }

    /**
     * Default handler on cURL.
     *
     * @param array<string, string> $headers
     * @return array{0:int,1:array<string,string>,2:string}
     */
    private function curl(string $method, string $url, array $headers, ?string $body, ?callable $onChunk): array
    {
        $ch = curl_init($url);
        $responseHeaders = [];
        $lines = [];
        foreach ($headers as $k => $v) {
            $lines[] = "{$k}: {$v}";
        }
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $lines,
            CURLOPT_RETURNTRANSFER => $onChunk === null,
            CURLOPT_CONNECTTIMEOUT => (int) ceil($this->timeout),
            CURLOPT_TIMEOUT => $onChunk === null ? (int) ceil($this->timeout) : 0,
            CURLOPT_HEADERFUNCTION => static function ($ch, string $line) use (&$responseHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($line);
            },
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        if ($onChunk !== null) {
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, static function ($ch, string $chunk) use ($onChunk): int {
                $onChunk($chunk);
                return strlen($chunk);
            });
        }
        $raw = curl_exec($ch);
        if ($raw === false) {
            $message = curl_error($ch);
            throw new \RuntimeException($message);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        return [$status, $responseHeaders, is_string($raw) ? $raw : ''];
    }
}
