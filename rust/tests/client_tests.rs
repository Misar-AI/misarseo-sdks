//! Integration tests against a local wiremock server — never the real API.

use std::time::Duration;

use misarseo::{generated::dispatch::invoke, Client, Config, Error};
use serde_json::{json, Value};
use wiremock::matchers::any;
use wiremock::{Mock, MockServer, Request, ResponseTemplate};

async fn client(server: &MockServer) -> Client {
    Client::with_config(
        "mseo_test",
        Config {
            base_url: format!("{}/seo", server.uri()),
            retry_base_delay: Duration::from_millis(1),
            max_retry_delay: Duration::from_millis(50),
            ..Config::default()
        },
    )
    .unwrap()
}

async fn reply(server: &MockServer, template: ResponseTemplate) {
    Mock::given(any()).respond_with(template).mount(server).await;
}

fn manifest() -> Value {
    serde_json::from_str(include_str!("../manifest.json")).unwrap()
}

#[tokio::test]
async fn every_manifest_method_hits_its_route() {
    let m = manifest();
    let mut count = 0;
    for (resource, def) in m["resources"].as_object().unwrap() {
        for method in def["methods"].as_array().unwrap() {
            count += 1;
            let server = MockServer::start().await;
            reply(&server, ResponseTemplate::new(200).set_body_json(json!({"ok": true}))).await;
            let c = client(&server).await;
            let path_params: Vec<&str> = method["pathParams"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
            let required: Vec<&str> = method["requiredQuery"].as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
            let args: Vec<String> = (0..path_params.len() + required.len()).map(|i| format!("v/{i}")).collect();
            let has_body = method["hasBody"].as_bool().unwrap();
            let name = method["name"].as_str().unwrap();
            let out = invoke(&c, resource, name, &args, has_body.then(|| json!({"x": 1})))
                .await
                .unwrap_or_else(|| panic!("{resource}.{name} not dispatchable"));
            assert_eq!(out.unwrap(), json!({"ok": true}), "{resource}.{name}");

            let requests: Vec<Request> = server.received_requests().await.unwrap();
            let req = &requests[0];
            assert_eq!(req.method.as_str(), method["verb"].as_str().unwrap(), "{resource}.{name}");
            let mut want = method["path"].as_str().unwrap().to_string();
            for (i, p) in path_params.iter().enumerate() {
                want = want.replacen(&format!(":{p}"), &format!("v%2F{i}"), 1);
            }
            assert_eq!(req.url.path(), format!("/seo{want}"), "{resource}.{name}");
            for (j, q) in required.iter().enumerate() {
                let got = req.url.query_pairs().find(|(k, _)| k == q).map(|(_, v)| v.into_owned());
                assert_eq!(got, Some(format!("v/{}", path_params.len() + j)), "{resource}.{name} ?{q}");
            }
            assert_eq!(!req.body.is_empty(), has_body, "{resource}.{name} body");
            assert_eq!(req.headers.get("authorization").unwrap(), "Bearer mseo_test");
            assert!(req.headers.get("user-agent").unwrap().to_str().unwrap().starts_with("misarseo-rust/"));
        }
    }
    assert!(count > 200);
}

#[tokio::test]
async fn rate_limit_retried_then_succeeds() {
    let server = MockServer::start().await;
    Mock::given(any()).respond_with(ResponseTemplate::new(429).set_body_json(json!({"error": "slow", "code": "RATE_LIMITED"}))).up_to_n_times(1).mount(&server).await;
    reply(&server, ResponseTemplate::new(200).set_body_json(json!({"projects": []}))).await;
    let c = client(&server).await;
    assert_eq!(c.projects().list(None).await.unwrap(), json!({"projects": []}));
    assert_eq!(server.received_requests().await.unwrap().len(), 2);
}

#[tokio::test]
async fn plan_limit_is_not_retried_and_carries_the_offer() {
    let server = MockServer::start().await;
    reply(
        &server,
        ResponseTemplate::new(429)
            .insert_header("retry-after", "3600")
            .insert_header("x-misar-plan", "free")
            .insert_header("x-misar-upgrade-url", "https://seo.misar.io/subscribe?plan=pro")
            .set_body_json(json!({"error": "Limit reached.", "code": "plan_limit_exceeded",
                "upgrade": {"reason": "quota_exhausted", "feature": "keyword_lookups", "current_plan": {"slug": "free"}, "urls": {"pricing": "https://seo.misar.io/subscribe"}}})),
    )
    .await;
    let c = client(&server).await;
    let err = c.keywords().research(Some(json!({"projectId": "p"})), None).await.unwrap_err();
    assert_eq!(server.received_requests().await.unwrap().len(), 1);
    assert!(!err.is_rate_limited());
    match err {
        Error::PlanLimit(p) => {
            assert_eq!(p.status, 429);
            assert_eq!(p.reason.as_deref(), Some("quota_exhausted"));
            assert_eq!(p.feature.as_deref(), Some("keyword_lookups"));
            assert_eq!(p.plan.as_deref(), Some("free"));
            assert_eq!(p.upgrade_url.as_deref(), Some("https://seo.misar.io/subscribe?plan=pro"));
            assert_eq!(p.retry_after, Some(3600));
            assert!(p.offer.is_some());
        }
        other => panic!("want PlanLimit, got {other:?}"),
    }
}

#[tokio::test]
async fn plan_limit_402_falls_back_to_the_body() {
    let server = MockServer::start().await;
    reply(&server, ResponseTemplate::new(402).set_body_json(json!({"error": "Locked.", "code": "plan_limit_exceeded",
        "upgrade": {"reason": "feature_locked", "current_plan": {"slug": "free"}, "urls": {"pricing": "https://seo.misar.io/subscribe"}}}))).await;
    let c = client(&server).await;
    match c.backlinks().overview("p1", "example.com", None).await.unwrap_err() {
        Error::PlanLimit(p) => {
            assert_eq!(p.plan.as_deref(), Some("free"));
            assert_eq!(p.upgrade_url.as_deref(), Some("https://seo.misar.io/subscribe"));
        }
        other => panic!("{other:?}"),
    }
}

#[tokio::test]
async fn not_found_keeps_the_code() {
    let server = MockServer::start().await;
    reply(&server, ResponseTemplate::new(404).set_body_json(json!({"error": "Project not found", "code": "NOT_FOUND"}))).await;
    let err = client(&server).await.projects().get("nope", None).await.unwrap_err();
    assert!(err.is_not_found());
    assert_eq!(err.code(), Some("NOT_FOUND"));
}

#[tokio::test]
async fn post_503_not_retried_get_503_retried() {
    let server = MockServer::start().await;
    reply(&server, ResponseTemplate::new(503).set_body_json(json!({"error": "down"}))).await;
    let c = client(&server).await;
    assert!(c.crawl().start(Some(json!({})), None).await.is_err());
    assert_eq!(server.received_requests().await.unwrap().len(), 1);

    let server = MockServer::start().await;
    Mock::given(any()).respond_with(ResponseTemplate::new(503)).up_to_n_times(1).mount(&server).await;
    reply(&server, ResponseTemplate::new(200).set_body_json(json!({}))).await;
    client(&server).await.projects().list(None).await.unwrap();
    assert_eq!(server.received_requests().await.unwrap().len(), 2);
}

#[tokio::test]
async fn pagination_helpers() {
    use misarseo::pagination::{collect_cursor_pages, collect_offset_pages};
    let rows = collect_offset_pages(1, |p| async move {
        Ok(match p {
            1 => json!({"rows": [1, 2], "hasMore": true}),
            2 => json!({"rows": [3], "hasMore": true}),
            _ => json!({"rows": [], "hasMore": true}),
        })
    })
    .await
    .unwrap();
    assert_eq!(rows, vec![json!(1), json!(2), json!(3)]);
    let rows = collect_cursor_pages(None, |c| async move {
        Ok(match c.as_deref() {
            None => json!({"rows": ["a"], "hasMore": true, "nextCursor": "c1"}),
            _ => json!({"rows": ["b"], "hasMore": true, "nextCursor": "c1"}),
        })
    })
    .await
    .unwrap();
    assert_eq!(rows, vec![json!("a"), json!("b")]);
}

#[tokio::test]
async fn crawl_stream_reads_until_complete() {
    let server = MockServer::start().await;
    let body = ": ping\n\nevent: progress\ndata: {\"pages\":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n";
    reply(&server, ResponseTemplate::new(200).insert_header("content-type", "text/event-stream").set_body_string(body)).await;
    let c = client(&server).await;
    let mut stream = c.crawl().stream_events("a1", "p1", None).await.unwrap();
    let mut names = Vec::new();
    while let Some(ev) = stream.next().await {
        names.push(ev.unwrap().event);
    }
    assert_eq!(names, vec!["progress", "complete"]);
    let req = &server.received_requests().await.unwrap()[0];
    assert_eq!(req.headers.get("accept").unwrap(), "text/event-stream");
}

#[test]
fn missing_key_fails_fast() {
    std::env::remove_var("MISARSEO_API_KEY");
    match Client::new("") {
        Err(Error::Config(m)) => assert!(m.contains("seo.misar.io")),
        _ => panic!("want Config error"),
    }
}
