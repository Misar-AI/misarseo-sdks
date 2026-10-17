//! Errors returned by the SDK.

use serde_json::Value;
use std::fmt;

/// The `code` every Misar product sends on a plan-limit rejection.
pub const PLAN_LIMIT_CODE: &str = "plan_limit_exceeded";

/// A plan refusal: a feature the tier locks (402), a spent day/month quota
/// (429 with `Retry-After` at the rollover) or a point-in-time cap (402).
/// Never retried — show `offer` (or at least `upgrade_url`) to the user.
#[derive(Debug, Clone)]
pub struct PlanLimit {
    pub status: u16,
    pub message: String,
    /// The server's `upgrade` object: plans, prices, URLs — all server-side copy.
    pub offer: Option<Value>,
    /// `quota_exhausted`, `feature_locked`, …
    pub reason: Option<String>,
    /// Machine key of the limit that was hit.
    pub feature: Option<String>,
    /// Current plan slug (`x-misar-plan`, else the offer).
    pub plan: Option<String>,
    /// Where to upgrade (`x-misar-upgrade-url`, else the offer).
    pub upgrade_url: Option<String>,
    /// Seconds until a periodic quota resets, when sent.
    pub retry_after: Option<u64>,
}

/// Every failure the SDK reports.
#[derive(Debug)]
pub enum Error {
    /// A non-2xx response other than a plan limit. `code` is the API's own
    /// code (`NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, …).
    Api {
        status: u16,
        code: String,
        message: String,
        body: Option<Value>,
        retry_after: Option<u64>,
    },
    /// The plan does not cover the call.
    PlanLimit(Box<PlanLimit>),
    /// The request never got a response.
    Network(String),
    /// Bad client configuration (missing key, invalid base URL).
    Config(String),
}

impl Error {
    /// HTTP status, when a response arrived.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Api { status, .. } => Some(*status),
            Error::PlanLimit(p) => Some(p.status),
            _ => None,
        }
    }

    /// The API's error code, when a response arrived.
    pub fn code(&self) -> Option<&str> {
        match self {
            Error::Api { code, .. } => Some(code),
            Error::PlanLimit(_) => Some(PLAN_LIMIT_CODE),
            _ => None,
        }
    }

    pub fn is_not_found(&self) -> bool {
        self.status() == Some(404)
    }

    pub fn is_unauthorized(&self) -> bool {
        self.status() == Some(401)
    }

    /// An ordinary throttle — never true for a plan limit.
    pub fn is_rate_limited(&self) -> bool {
        matches!(self, Error::Api { status: 429, .. })
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Api { status, code, message, .. } => write!(f, "misarseo: HTTP {status} ({code}): {message}"),
            Error::PlanLimit(p) => write!(f, "misarseo: HTTP {} ({PLAN_LIMIT_CODE}): {}", p.status, p.message),
            Error::Network(m) => write!(f, "misarseo: could not reach the API: {m}"),
            Error::Config(m) => write!(f, "misarseo: {m}"),
        }
    }
}

impl std::error::Error for Error {}

fn s(v: Option<&Value>) -> Option<String> {
    v.and_then(Value::as_str).map(str::to_string)
}

/// Build the error for a non-2xx response. The plan-limit code is checked
/// BEFORE the status: a spent quota is a 429 that otherwise looks exactly like
/// an ordinary throttle.
pub(crate) fn from_response(status: u16, headers: &reqwest::header::HeaderMap, raw: &[u8]) -> Error {
    let body: Option<Value> = serde_json::from_slice(raw).ok();
    let get = |k: &str| body.as_ref().and_then(|b| b.get(k));
    let message = s(get("error"))
        .or_else(|| s(get("message")))
        .unwrap_or_else(|| format!("HTTP {status}"));
    let code = s(get("code")).unwrap_or_else(|| "API_ERROR".into());
    let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
    let retry_after = header("retry-after").and_then(|v| v.trim().parse().ok());
    if code == PLAN_LIMIT_CODE {
        let offer = get("upgrade").filter(|v| v.is_object()).cloned();
        let o = |path: &[&str]| {
            let mut cur = offer.as_ref()?;
            for p in path {
                cur = cur.get(p)?;
            }
            cur.as_str().map(str::to_string)
        };
        return Error::PlanLimit(Box::new(PlanLimit {
            status,
            message,
            reason: o(&["reason"]),
            feature: o(&["feature"]),
            plan: header("x-misar-plan").or_else(|| o(&["current_plan", "slug"])),
            upgrade_url: header("x-misar-upgrade-url").or_else(|| o(&["urls", "pricing"])),
            retry_after,
            offer,
        }));
    }
    Error::Api { status, code, message, body, retry_after }
}
