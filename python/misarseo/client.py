"""The MisarSEO client."""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from .core.transport import DEFAULT_BASE_URL, Transport
from .generated import RESOURCES


class MisarSeoClient:
    """MisarSEO API client.

    Every resource is an attribute named after it — ``client.projects``,
    ``client.rank_tracking``, ``client.ai_search`` … (see ``RESOURCES``).

    Args:
        api_key: a ``mseo_`` key. Falls back to ``MISARSEO_API_KEY``.
        base_url: defaults to ``https://api.misar.io/seo``.
        timeout: per-request timeout in seconds (default 30).
        max_retries: extra attempts for retryable failures (default 2).
        http_transport: an ``httpx`` transport, e.g. ``httpx.MockTransport`` in tests.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 30.0,
        max_retries: int = 2,
        retry_base_delay: float = 0.25,
        max_retry_delay: float = 60.0,
        http_transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        key = api_key or os.environ.get("MISARSEO_API_KEY")
        if not key:
            raise ValueError(
                "A MisarSEO API key is required (mseo_…). Pass api_key= or set "
                "MISARSEO_API_KEY; create one as described at https://seo.misar.io/ai."
            )
        self._transport = Transport(
            key,
            base_url,
            timeout=timeout,
            max_retries=max_retries,
            retry_base_delay=retry_base_delay,
            max_retry_delay=max_retry_delay,
            http_transport=http_transport,
        )
        for attribute, resource in RESOURCES.items():
            setattr(self, attribute, resource(self._transport))

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> "MisarSeoClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()
