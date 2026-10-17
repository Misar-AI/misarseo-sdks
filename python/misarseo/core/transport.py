"""HTTP transport shared by the generated resource layer.

One credential, one path in: the account API key (``mseo_…``) sent as
``Authorization: Bearer``. Plan tier, quotas and credits are decided
server-side from the organization behind the key; the SDK carries the key and
surfaces the answer.

Retry policy (identical across every MisarSEO SDK):
  * 429 is retried for every verb — the server's rate-limit check runs before
    any work, so nothing was written — EXCEPT when the body says
    ``plan_limit_exceeded``: that is a quota, and retrying cannot help.
  * 502/503/504 and network failures are retried for GET only; a POST may
    already have started a billed crawl.
  * Exponential backoff from 250 ms with jitter, honouring ``Retry-After`` up
    to 60 s.
"""

from __future__ import annotations

import json
import random
import time
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional
from urllib.parse import quote

import httpx

from .._version import __version__
from ..errors import MisarSeoNetworkError, MisarSeoPlanLimitError, error_from_response
from .sse import iter_sse_events

DEFAULT_BASE_URL = "https://api.misar.io/seo"
RETRYABLE_STATUSES = frozenset({429, 502, 503, 504})


def _seg(value: Any) -> str:
    """Encode one path segment."""
    return quote(str(value), safe="")


def _merge(required: Mapping[str, Any], query: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    """Required query parameters first; an explicit key in ``query`` wins."""
    merged = dict(required)
    merged.update(query or {})
    return merged


def _clean(query: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key, value in (query or {}).items():
        if value is None:
            continue
        if isinstance(value, bool):
            out[key] = "true" if value else "false"
        elif isinstance(value, (list, tuple)):
            out[key] = ",".join(str(v) for v in value)
        else:
            out[key] = value
    return out


def _decode(response: httpx.Response) -> Any:
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return {"error": response.text}


class Transport:
    """Low-level request plumbing the generated resources are written against."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        *,
        timeout: float = 30.0,
        max_retries: int = 2,
        retry_base_delay: float = 0.25,
        max_retry_delay: float = 60.0,
        http_transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay
        self.max_retry_delay = max_retry_delay
        self._client = httpx.Client(timeout=timeout, transport=http_transport)

    def headers(self, accept: str = "application/json") -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": accept,
            "User-Agent": f"misarseo-python/{__version__}",
        }

    def _delay(self, attempt: int, response: Optional[httpx.Response] = None) -> Optional[float]:
        """Seconds to wait before the next attempt; None means 'do not wait that long'."""
        if response is not None:
            header = response.headers.get("retry-after")
            if header and header.strip().isdigit():
                seconds = float(header)
                return None if seconds > self.max_retry_delay else seconds
        base = self.retry_base_delay * (2 ** attempt)
        return min(self.max_retry_delay, base / 2 + random.uniform(0, base / 2))

    def request(self, method: str, path: str, body: Any = None,
                query: Optional[Mapping[str, Any]] = None) -> Any:
        url = f"{self.base_url}{path}"
        attempt = 0
        while True:
            try:
                response = self._client.request(
                    method,
                    url,
                    headers=self.headers(),
                    params=_clean(query),
                    content=None if body is None else json.dumps(body),
                )
            except httpx.HTTPError as exc:
                if method == "GET" and attempt < self.max_retries:
                    time.sleep(self._delay(attempt) or 0)
                    attempt += 1
                    continue
                raise MisarSeoNetworkError(f"Could not reach the MisarSEO API: {exc}", exc) from exc

            if response.is_success:
                return _decode(response)

            error = error_from_response(response.status_code, _decode(response), dict(response.headers))
            retryable = response.status_code == 429 or (
                method == "GET" and response.status_code in RETRYABLE_STATUSES
            )
            if isinstance(error, MisarSeoPlanLimitError) or not retryable or attempt >= self.max_retries:
                raise error
            delay = self._delay(attempt, response)
            if delay is None:
                raise error
            time.sleep(delay)
            attempt += 1

    def stream(self, path: str, query: Optional[Mapping[str, Any]] = None,
               terminal: Iterable[str] = ("complete", "error")) -> Iterator[Dict[str, Any]]:
        """GET a text/event-stream endpoint and yield ``{"event", "data"}`` frames."""
        url = f"{self.base_url}{path}"
        ends = set(terminal)
        with self._client.stream("GET", url, headers=self.headers("text/event-stream"),
                                 params=_clean(query), timeout=httpx.Timeout(30.0, read=None)) as response:
            if not response.is_success:
                response.read()
                raise error_from_response(response.status_code, _decode(response), dict(response.headers))
            for event in iter_sse_events(response.iter_text()):
                yield event
                if event.get("event") in ends:
                    return

    def close(self) -> None:
        self._client.close()
