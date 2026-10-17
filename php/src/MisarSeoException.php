<?php

declare(strict_types=1);

namespace MisarSEO;

/**
 * A non-2xx response, or (status 0) a request that never got one.
 * `getErrorCode()` is the API's own code — NOT_FOUND, VALIDATION_ERROR,
 * RATE_LIMITED … A plan refusal is the subclass PlanLimitException.
 */
class MisarSeoException extends \RuntimeException
{
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly mixed $body = null,
        public readonly ?int $retryAfter = null,
    ) {
        parent::__construct($status === 0 ? "misarseo: {$message}" : "misarseo: HTTP {$status} ({$errorCode}): {$message}");
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function isNotFound(): bool
    {
        return $this->status === 404;
    }

    public function isUnauthorized(): bool
    {
        return $this->status === 401;
    }

    /** An ordinary throttle — never true for a plan limit. */
    public function isRateLimited(): bool
    {
        return $this->status === 429 && !($this instanceof PlanLimitException);
    }
}
