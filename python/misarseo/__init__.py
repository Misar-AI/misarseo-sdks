"""MisarSEO Python SDK — keyword research, site audits, rank tracking, AI search
visibility and Search Console data over https://api.misar.io/seo."""

from ._version import __version__
from .client import MisarSeoClient
from .core.pagination import iterate_cursor_pages, iterate_offset_pages
from .errors import (
    PLAN_LIMIT_CODE,
    MisarSeoAuthenticationError,
    MisarSeoError,
    MisarSeoNetworkError,
    MisarSeoNotFoundError,
    MisarSeoPaymentRequiredError,
    MisarSeoPermissionError,
    MisarSeoPlanLimitError,
    MisarSeoRateLimitError,
    MisarSeoUpstreamError,
    MisarSeoValidationError,
)

__all__ = [
    "__version__",
    "MisarSeoClient",
    "MisarSeoError",
    "MisarSeoValidationError",
    "MisarSeoAuthenticationError",
    "MisarSeoPaymentRequiredError",
    "MisarSeoPermissionError",
    "MisarSeoNotFoundError",
    "MisarSeoRateLimitError",
    "MisarSeoUpstreamError",
    "MisarSeoNetworkError",
    "MisarSeoPlanLimitError",
    "PLAN_LIMIT_CODE",
    "iterate_offset_pages",
    "iterate_cursor_pages",
]
