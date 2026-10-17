"""Server-Sent Events frame parsing for the crawl progress stream."""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Iterator, Optional


def parse_frame(frame: str) -> Optional[Dict[str, Any]]:
    """Decode one frame; None for a keep-alive comment or a frame without an event."""
    event: Optional[str] = None
    data_lines = []
    for line in frame.replace("\r\n", "\n").split("\n"):
        if not line or line.startswith(":"):
            continue
        if line.startswith("event:"):
            event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_lines.append(line[len("data:"):].lstrip())
    if event is None:
        return None
    raw = "\n".join(data_lines)
    data: Any = raw
    if raw:
        try:
            data = json.loads(raw)
        except ValueError:
            data = raw
    return {"event": event, "data": data}


def iter_sse_events(chunks: Iterable[str]) -> Iterator[Dict[str, Any]]:
    """Reassemble text chunks into frames separated by a blank line."""
    buffer = ""
    for chunk in chunks:
        buffer += chunk.replace("\r\n", "\n")
        while "\n\n" in buffer:
            frame, buffer = buffer.split("\n\n", 1)
            parsed = parse_frame(frame)
            if parsed is not None:
                yield parsed
    if buffer.strip():
        parsed = parse_frame(buffer)
        if parsed is not None:
            yield parsed
