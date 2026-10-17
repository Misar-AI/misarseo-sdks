"""Errors raised by the MisarSEO SDK.

Every error extends :class:`MisarSeoError`, so one ``except MisarSeoError``
catches everything. The subclasses exist so a caller can branch on what to do
next — back off, re-authenticate, upgrade, fix the request — instead of
comparing status numbers. The API's own ``code`` (``NOT_FOUND``,
``VALIDATION_ERROR``, ``plan_limit_exceeded`` …) is always preserved, because
the status alone is lossy.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

PLAN_LIMIT_CODE = "plan_limit_exceeded"


class MisarSeoError(Exception):
    """Base error. ``status`` is 0 when no response arrived."""

    def __init__(self, status: int, message: str, code: str = "API_ERROR", body: Any = None) -> None:
        self.status = status
        self.code = code
        self.body = body
        self.message = message
        super().__init__(f"misarseo: HTTP {status} ({code}): {message}" if status else f"misarseo: {message}")

    @property
    def is_retryable(self) -> bool:
        return self.status in (429, 502, 503, 504) and self.code != PLAN_LIMIT_CODE


class MisarSeoValidationError(MisarSeoError):
    """400 — the request was malformed or failed schema validation."""


class MisarSeoAuthenticationError(MisarSeoError):
    """401 — missing, malformed, revoked or expired API key."""


class MisarSeoPaymentRequiredError(MisarSeoError):
    """402 — out of credits or a billing problem on a metered add-on."""


class MisarSeoPermissionError(MisarSeoError):
    """403 — authenticated but not permitted (org role, provider add-on, crawl policy)."""


class MisarSeoNotFoundError(MisarSeoError):
    """404 — no such project, audit, tracker or record."""


class MisarSeoRateLimitError(MisarSeoError):
    """429 — throttled. ``retry_after`` is the server's ``Retry-After`` in seconds."""

    def __init__(self, status: int, message: str, code: str = "RATE_LIMITED", body: Any = None,
                 retry_after: Optional[int] = None) -> None:
        self.retry_after = retry_after
        super().__init__(status, message, code, body)


class MisarSeoUpstreamError(MisarSeoError):
    """502/503/504 — a third-party upstream or the gateway failed."""


class MisarSeoNetworkError(MisarSeoError):
    """The request never got a response (DNS, TLS, connection reset, timeout)."""

    def __init__(self, message: str, cause: Optional[BaseException] = None) -> None:
        self.cause = cause
        super().__init__(0, message, "NETWORK_ERROR")


class MisarSeoPlanLimitError(MisarSeoError):
    """The organization's plan does not cover this call.

    Raised whenever the body carries ``code: "plan_limit_exceeded"``, whatever
    the status: 402 for a feature the plan locks or a point-in-time cap, 429
    (with ``Retry-After``) for a spent day/month quota. Never retried — show
    :attr:`offer` (or at least :attr:`upgrade_url`) to the user instead.

    Attributes:
        offer: the ``upgrade`` object from the body (plans, prices, URLs — all
            server-side copy), or ``None``.
        reason: ``quota_exhausted``, ``feature_locked`` …
        feature: machine key of the limit that was hit.
        plan: current plan slug (``x-misar-plan`` header, else the offer).
        upgrade_url: where to upgrade (``x-misar-upgrade-url``, else the offer).
        retry_after: seconds until a periodic quota resets, when sent.
    """

    def __init__(self, status: int, message: str, body: Any = None,
                 headers: Optional[Mapping[str, str]] = None) -> None:
        h = {k.lower(): v for k, v in (headers or {}).items()}
        data = body if isinstance(body, dict) else {}
        offer = data.get("upgrade") if isinstance(data.get("upgrade"), dict) else None
        self.offer: Optional[dict] = offer
        self.reason = (offer or {}).get("reason")
        self.feature = (offer or {}).get("feature")
        self.plan = h.get("x-misar-plan") or ((offer or {}).get("current_plan") or {}).get("slug")
        self.upgrade_url = h.get("x-misar-upgrade-url") or ((offer or {}).get("urls") or {}).get("pricing")
        retry = h.get("retry-after")
        self.retry_after = int(retry) if retry and str(retry).isdigit() else None
        super().__init__(status, message, PLAN_LIMIT_CODE, body)


def error_from_response(status: int, body: Any, headers: Optional[Mapping[str, str]] = None) -> MisarSeoError:
    """Build the most specific error for a non-2xx response.

    The plan-limit code is checked BEFORE the status: a spent quota is a 429
    that is otherwise indistinguishable from an ordinary throttle.
    """
    data = body if isinstance(body, dict) else {}
    message = str(data.get("error") or data.get("message") or f"HTTP {status}")
    code = str(data.get("code") or "API_ERROR")
    if code == PLAN_LIMIT_CODE:
        return MisarSeoPlanLimitError(status, message, body, headers)
    if status == 400:
        return MisarSeoValidationError(status, message, code, body)
    if status == 401:
        return MisarSeoAuthenticationError(status, message, code, body)
    if status == 402:
        return MisarSeoPaymentRequiredError(status, message, code, body)
    if status == 403:
        return MisarSeoPermissionError(status, message, code, body)
    if status == 404:
        return MisarSeoNotFoundError(status, message, code, body)
    if status == 429:
        h = {k.lower(): v for k, v in (headers or {}).items()}
        retry = h.get("retry-after")
        return MisarSeoRateLimitError(status, message, code, body,
                                      int(retry) if retry and str(retry).isdigit() else None)
    if status in (502, 503, 504):
        return MisarSeoUpstreamError(status, message, code, body)
    return MisarSeoError(status, message, code, body)
