"""Tests for the MisarSEO Python SDK, against httpx.MockTransport — never the real API."""

from __future__ import annotations

import inspect
import json
import re
from pathlib import Path

import httpx
import pytest

from misarseo import (
    MisarSeoClient,
    MisarSeoNotFoundError,
    MisarSeoPlanLimitError,
    MisarSeoRateLimitError,
    MisarSeoUpstreamError,
    iterate_cursor_pages,
    iterate_offset_pages,
)
from misarseo.core.sse import iter_sse_events

MANIFEST = json.loads((Path(__file__).resolve().parent.parent / "manifest.json").read_text())
BASE = "https://api.misar.io/seo"


def snake(name: str) -> str:
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).lower()


class Recorder:
    def __init__(self, *responses):
        self.responses = list(responses) or [(200, {}, {})]
        self.calls = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        status, body, headers = self.responses[min(len(self.calls) - 1, len(self.responses) - 1)]
        if isinstance(body, str):
            return httpx.Response(status, text=body, headers=headers)
        return httpx.Response(status, json=body, headers=headers)


def make(*responses):
    rec = Recorder(*responses)
    client = MisarSeoClient("mseo_test", http_transport=httpx.MockTransport(rec), retry_base_delay=0.001)
    return client, rec


CASES = [
    (resource, method)
    for resource, definition in MANIFEST["resources"].items()
    for method in definition["methods"]
]


def test_manifest_is_complete():
    assert len(CASES) > 200


@pytest.mark.parametrize("resource,method", CASES, ids=[f"{r}.{m['name']}" for r, m in CASES])
def test_every_manifest_method_hits_its_route(resource, method):
    client, rec = make((200, {"ok": True}, {}))
    target = getattr(client, snake(resource))
    name = snake(method["name"])
    fn = getattr(target, name, None) or getattr(target, name + "_")
    positional = method["pathParams"] + method["requiredQuery"]
    params = [p for p in inspect.signature(fn).parameters if p not in ("body", "query")]
    assert len(params) == len(positional)
    kwargs = {"body": {"x": 1}} if method["hasBody"] else {}
    assert fn(*[f"v/{i}" for i in range(len(positional))], **kwargs) == {"ok": True}

    request = rec.calls[0]
    assert request.method == method["verb"]
    expected = method["path"]
    for i, param in enumerate(method["pathParams"]):
        expected = expected.replace(f":{param}", f"v%2F{i}")
    assert request.url.raw_path.decode().split("?")[0] == "/seo" + expected
    for j, name in enumerate(method["requiredQuery"]):
        assert request.url.params.get(name) == f"v/{len(method['pathParams']) + j}"
    assert (request.content != b"") == method["hasBody"]
    assert request.headers["authorization"] == "Bearer mseo_test"
    assert request.headers["user-agent"].startswith("misarseo-python/")


def test_optional_query_is_sent_and_none_dropped():
    client, rec = make((200, {}, {}))
    client.keywords.list_saved("p1", query={"pageSize": 5, "tagNames": None})
    assert rec.calls[0].url.params.get("pageSize") == "5"
    assert "tagNames" not in rec.calls[0].url.params


def test_rate_limit_is_retried_then_succeeds():
    client, rec = make((429, {"error": "slow", "code": "RATE_LIMITED"}, {}), (200, {"projects": []}, {}))
    assert client.projects.list() == {"projects": []}
    assert len(rec.calls) == 2


def test_rate_limit_exhausts_budget():
    client, rec = make((429, {"error": "slow", "code": "RATE_LIMITED"}, {"retry-after": "0"}))
    with pytest.raises(MisarSeoRateLimitError) as info:
        client.projects.list()
    assert len(rec.calls) == 3
    assert info.value.retry_after == 0


OFFER = {
    "product": "seo",
    "reason": "quota_exhausted",
    "feature": "keyword_lookups",
    "current_plan": {"slug": "free", "name": "Free"},
    "urls": {"pricing": "https://seo.misar.io/subscribe"},
}


def test_plan_limit_429_is_not_retried_and_carries_the_offer():
    client, rec = make((429, {"error": "Limit reached.", "code": "plan_limit_exceeded", "upgrade": OFFER},
                        {"retry-after": "3600", "x-misar-plan": "free",
                         "x-misar-upgrade-url": "https://seo.misar.io/subscribe?plan=pro"}))
    with pytest.raises(MisarSeoPlanLimitError) as info:
        client.keywords.research(body={"projectId": "p", "keywords": ["seo"]})
    assert len(rec.calls) == 1
    err = info.value
    assert err.status == 429
    assert err.code == "plan_limit_exceeded"
    assert err.offer["feature"] == "keyword_lookups"
    assert err.reason == "quota_exhausted"
    assert err.plan == "free"
    assert err.upgrade_url == "https://seo.misar.io/subscribe?plan=pro"
    assert err.retry_after == 3600


def test_plan_limit_402_falls_back_to_the_body():
    client, _ = make((402, {"error": "Locked.", "code": "plan_limit_exceeded",
                            "upgrade": {**OFFER, "reason": "feature_locked"}}, {}))
    with pytest.raises(MisarSeoPlanLimitError) as info:
        client.backlinks.overview("p1", "example.com")
    assert info.value.plan == "free"
    assert info.value.upgrade_url == "https://seo.misar.io/subscribe"
    assert info.value.reason == "feature_locked"


def test_not_found_keeps_the_api_code():
    client, _ = make((404, {"error": "Project not found", "code": "NOT_FOUND"}, {}))
    with pytest.raises(MisarSeoNotFoundError) as info:
        client.projects.get("nope")
    assert info.value.code == "NOT_FOUND"


def test_post_503_is_not_retried_but_get_503_is():
    client, rec = make((503, {"error": "down"}, {}))
    with pytest.raises(MisarSeoUpstreamError):
        client.crawl.start(body={"projectId": "p", "startUrl": "https://e.com"})
    assert len(rec.calls) == 1

    client, rec = make((503, {"error": "down"}, {}), (200, {"ok": 1}, {}))
    assert client.projects.list() == {"ok": 1}
    assert len(rec.calls) == 2


def test_offset_pagination_stops_on_has_more_or_empty_page():
    pages = {1: {"rows": [1, 2], "hasMore": True}, 2: {"rows": [3], "hasMore": True}, 3: {"rows": [], "hasMore": True}}
    assert list(iterate_offset_pages(lambda p: pages[p])) == [1, 2, 3]


def test_cursor_pagination_stops_on_repeated_cursor():
    pages = {None: {"rows": ["a"], "hasMore": True, "nextCursor": "c1"},
             "c1": {"rows": ["b"], "hasMore": True, "nextCursor": "c1"}}
    assert list(iterate_cursor_pages(lambda c: pages[c])) == ["a", "b"]


def test_sse_frames_and_comments():
    chunks = [": ping\n\nevent: progress\ndata: {\"pages\":", "3}\n\nevent: complete\ndata: done\n\n"]
    assert list(iter_sse_events(chunks)) == [
        {"event": "progress", "data": {"pages": 3}},
        {"event": "complete", "data": "done"},
    ]


def test_crawl_stream_requests_event_stream_and_stops_on_complete():
    body = "event: progress\ndata: {}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n"
    client, rec = make((200, body, {"content-type": "text/event-stream"}))
    events = list(client.crawl.stream_events("a1", "p1"))
    assert [e["event"] for e in events] == ["progress", "complete"]
    assert rec.calls[0].headers["accept"] == "text/event-stream"
    assert rec.calls[0].url.params["projectId"] == "p1"


def test_missing_key_fails_fast(monkeypatch):
    monkeypatch.delenv("MISARSEO_API_KEY", raising=False)
    with pytest.raises(ValueError, match="seo.misar.io"):
        MisarSeoClient()
