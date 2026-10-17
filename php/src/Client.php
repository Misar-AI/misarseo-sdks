<?php

declare(strict_types=1);

namespace MisarSEO;

use MisarSEO\Generated\Resources;

/**
 * MisarSEO API client. Every resource is a readonly property —
 * `$client->projects`, `$client->rankTracking`, `$client->aiSearch` …
 *
 * ```php
 * $client = new MisarSEO\Client(getenv('MISARSEO_API_KEY'));
 * $projects = $client->projects->list();
 * ```
 */
final class Client extends Resources
{
    /**
     * @param string|null $apiKey a `mseo_` key; null/empty falls back to MISARSEO_API_KEY
     * @param callable|null $handler replaces cURL (see Transport); used in tests
     */
    public function __construct(
        ?string $apiKey = null,
        string $baseUrl = Transport::DEFAULT_BASE_URL,
        float $timeout = 30.0,
        int $maxRetries = 2,
        float $retryBaseDelay = 0.25,
        float $maxRetryDelay = 60.0,
        ?callable $handler = null,
    ) {
        $key = ($apiKey !== null && $apiKey !== '') ? $apiKey : (string) getenv('MISARSEO_API_KEY');
        if ($key === '') {
            throw new \InvalidArgumentException(
                'A MisarSEO API key (mseo_...) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai'
            );
        }
        parent::__construct(new Transport($key, $baseUrl, $timeout, $maxRetries, $retryBaseDelay, $maxRetryDelay, $handler));
    }
}
