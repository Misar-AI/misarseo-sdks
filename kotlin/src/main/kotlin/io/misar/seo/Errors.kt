package io.misar.seo

import com.fasterxml.jackson.databind.JsonNode

/** The `code` every Misar product sends on a plan-limit rejection. */
const val PLAN_LIMIT_CODE = "plan_limit_exceeded"

/**
 * A non-2xx response, or (status 0) a request that never got one. [code] is
 * the API's own code — `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED` … A plan
 * refusal is the subclass [MisarSeoPlanLimitException].
 */
open class MisarSeoException(
    val status: Int,
    val code: String,
    message: String,
    val body: JsonNode? = null,
    /** Seconds from `Retry-After`, when sent. */
    val retryAfter: Int? = null,
) : RuntimeException(if (status == 0) "misarseo: $message" else "misarseo: HTTP $status ($code): $message") {
    val isNotFound: Boolean get() = status == 404
    val isUnauthorized: Boolean get() = status == 401

    /** An ordinary throttle — never true for a plan limit. */
    val isRateLimited: Boolean get() = status == 429 && this !is MisarSeoPlanLimitException
}

/**
 * The organization's plan does not cover the call: a feature its tier locks
 * (402), a spent day/month quota (429 with `Retry-After` at the rollover) or a
 * point-in-time cap such as projects (402). Never retried — show [offer], or
 * at least [upgradeUrl], to the user.
 */
class MisarSeoPlanLimitException(
    status: Int,
    message: String,
    body: JsonNode?,
    retryAfter: Int?,
    planHeader: String?,
    upgradeUrlHeader: String?,
) : MisarSeoException(status, PLAN_LIMIT_CODE, message, body, retryAfter) {
    /** The server's `upgrade` object: plans, prices, URLs — all server-side copy. */
    val offer: JsonNode? = body?.get("upgrade")?.takeIf { it.isObject }

    /** `quota_exhausted`, `feature_locked` … */
    val reason: String? = offer.text("reason")

    /** Machine key of the limit that was hit. */
    val feature: String? = offer.text("feature")

    /** Current plan slug (`x-misar-plan`, else the offer). */
    val plan: String? = planHeader ?: offer.text("current_plan", "slug")

    /** Where to upgrade (`x-misar-upgrade-url`, else the offer). */
    val upgradeUrl: String? = upgradeUrlHeader ?: offer.text("urls", "pricing")
}

private fun JsonNode?.text(vararg path: String): String? {
    var cur = this
    for (p in path) cur = cur?.get(p)
    return cur?.takeUnless { it.isNull }?.asText()
}
