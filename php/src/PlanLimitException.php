<?php

declare(strict_types=1);

namespace MisarSEO;

/**
 * The organization's plan does not cover the call: a feature its tier locks
 * (402), a spent day/month quota (429 with Retry-After at the rollover) or a
 * point-in-time cap such as projects (402). Never retried — show `$offer`, or
 * at least `$upgradeUrl`, to the user.
 */
final class PlanLimitException extends MisarSeoException
{
    /** The `code` every Misar product sends on a plan-limit rejection. */
    public const PLAN_LIMIT_CODE = 'plan_limit_exceeded';

    /** @var array<string, mixed>|null The server's `upgrade` object: plans, prices, URLs. */
    public readonly ?array $offer;
    /** Current plan slug (x-misar-plan, else the offer). */
    public readonly ?string $plan;
    /** Where to upgrade (x-misar-upgrade-url, else the offer). */
    public readonly ?string $upgradeUrl;
    /** quota_exhausted, feature_locked … */
    public readonly ?string $reason;
    /** Machine key of the limit that was hit. */
    public readonly ?string $feature;

    public function __construct(int $status, string $message, mixed $body, ?int $retryAfter, ?string $planHeader, ?string $upgradeUrlHeader)
    {
        $upgrade = is_array($body) && isset($body['upgrade']) && is_array($body['upgrade']) ? $body['upgrade'] : null;
        $this->offer = $upgrade;
        $this->plan = $planHeader ?? ($upgrade['current_plan']['slug'] ?? null);
        $this->upgradeUrl = $upgradeUrlHeader ?? ($upgrade['urls']['pricing'] ?? null);
        $this->reason = $upgrade['reason'] ?? null;
        $this->feature = $upgrade['feature'] ?? null;
        parent::__construct($status, self::PLAN_LIMIT_CODE, $message, $body, $retryAfter);
    }
}
