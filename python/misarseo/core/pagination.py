"""Pagination helpers.

The API pages two ways. Offset pages (``{rows, hasMore, page}``) address rows
by position and know the total; keyset pages (``{rows, hasMore, nextCursor}``)
address rows by key and never skip or duplicate when rows are inserted
mid-walk. They stay distinct so a caller knows which guarantee it gets.
"""

from __future__ import annotations

from typing import Any, Callable, Iterator, Mapping, Optional


def iterate_offset_pages(fetch_page: Callable[[int], Mapping[str, Any]], start_page: int = 1) -> Iterator[Any]:
    """Yield rows page by page. Stops on ``hasMore`` false OR an empty page, so a
    result set that shrank mid-walk cannot loop forever against a billed endpoint."""
    page = start_page
    while True:
        result = fetch_page(page)
        rows = list(result.get("rows") or [])
        yield from rows
        if not result.get("hasMore") or not rows:
            return
        page += 1  # our own counter, never the echoed page


def iterate_cursor_pages(fetch_page: Callable[[Optional[str]], Mapping[str, Any]],
                         start_cursor: Optional[str] = None) -> Iterator[Any]:
    """Yield rows following ``nextCursor``; stops when it is absent or repeats."""
    cursor = start_cursor
    while True:
        result = fetch_page(cursor)
        yield from list(result.get("rows") or [])
        nxt = result.get("nextCursor")
        if not result.get("hasMore") or not nxt or nxt == cursor:
            return
        cursor = nxt
