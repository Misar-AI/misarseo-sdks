import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The `code` every Misar product sends on a plan-limit rejection.
public let planLimitCode = "plan_limit_exceeded"

/// A non-2xx response, or (status 0) a request that never got one. `code` is
/// the API's own code — `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED` …
public struct MisarSeoError: Error, CustomStringConvertible, Sendable {
    public let status: Int
    public let code: String
    public let message: String
    public let body: JSONValue
    /// Seconds from `Retry-After`, when sent.
    public let retryAfter: Int?

    public var isNotFound: Bool { status == 404 }
    public var isUnauthorized: Bool { status == 401 }
    /// An ordinary throttle (a plan limit is a separate type).
    public var isRateLimited: Bool { status == 429 }

    public var description: String {
        status == 0 ? "misarseo: \(message)" : "misarseo: HTTP \(status) (\(code)): \(message)"
    }
}

/// The organization's plan does not cover the call: a feature its tier locks
/// (402), a spent day/month quota (429 with `Retry-After` at the rollover) or a
/// point-in-time cap such as projects (402). Never retried — show `offer`, or
/// at least `upgradeURL`, to the user.
public struct MisarSeoPlanLimitError: Error, CustomStringConvertible, Sendable {
    public let status: Int
    public let message: String
    /// The server's `upgrade` object: plans, prices, URLs — all server-side copy.
    public let offer: JSONValue
    /// Current plan slug (`x-misar-plan`, else the offer).
    public let plan: String?
    /// Where to upgrade (`x-misar-upgrade-url`, else the offer).
    public let upgradeURL: String?
    /// Seconds until a periodic quota resets, when sent.
    public let retryAfter: Int?

    public var code: String { planLimitCode }
    /// `quota_exhausted`, `feature_locked` …
    public var reason: String? { offer["reason"].stringValue }
    /// Machine key of the limit that was hit.
    public var feature: String? { offer["feature"].stringValue }

    public var description: String { "misarseo: HTTP \(status) (\(planLimitCode)): \(message)" }
}
