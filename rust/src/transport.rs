//! Request plumbing and the shared retry policy.
//!
//! 429 is retried for every verb unless the body says `plan_limit_exceeded`;
//! 502/503/504 and network failures are retried for GET only (a POST may have
//! started a billed crawl). Backoff starts at 250 ms with jitter and honours
//! `Retry-After` up to the configured cap.

use std::collections::BTreeMap;
use std::time::Duration;

use rand::Rng;
use serde_json::Value;

use crate::errors::{from_response, Error};
use crate::sse::EventStream;
use crate::{Client, VERSION};

/// Optional query parameters.
pub type Query = BTreeMap<String, String>;

pub(crate) fn seg(v: &str) -> String {
    urlencoding::encode(v).into_owned()
}

/// Required parameters first; an explicit key in `query` wins.
pub(crate) fn merge(required: &[(&str, &str)], query: Option<&Query>) -> Query {
    let mut out: Query = required.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    if let Some(q) = query {
        out.extend(q.iter().map(|(k, v)| (k.clone(), v.clone())));
    }
    out
}

impl Client {
    fn url(&self, path: &str, query: Option<&Query>) -> String {
        let mut url = format!("{}{}", self.config.base_url, path);
        if let Some(q) = query.filter(|q| !q.is_empty()) {
            let encoded: Vec<String> = q.iter().map(|(k, v)| format!("{}={}", seg(k), seg(v))).collect();
            url.push('?');
            url.push_str(&encoded.join("&"));
        }
        url
    }

    fn builder(&self, method: &str, url: &str, accept: &str) -> reqwest::RequestBuilder {
        let method = reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET);
        self.http
            .request(method, url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .header("Accept", accept)
            .header("User-Agent", format!("misarseo-rust/{VERSION}"))
    }

    fn backoff(&self, attempt: u32, retry_after: Option<u64>) -> Option<Duration> {
        if let Some(secs) = retry_after {
            let d = Duration::from_secs(secs);
            return (d <= self.config.max_retry_delay).then_some(d);
        }
        let base = self.config.retry_base_delay.saturating_mul(1 << attempt.min(16));
        let half = base / 2;
        let jitter = rand::thread_rng().gen_range(0..=half.as_millis() as u64);
        Some((half + Duration::from_millis(jitter)).min(self.config.max_retry_delay))
    }

    pub(crate) async fn request(&self, method: &str, path: &str, query: Option<&Query>, body: Option<Value>) -> Result<Value, Error> {
        let url = self.url(path, query);
        let mut attempt = 0;
        loop {
            let mut req = self.builder(method, &url, "application/json").timeout(self.config.timeout);
            if let Some(b) = &body {
                req = req.body(b.to_string());
            }
            match req.send().await {
                Err(e) => {
                    if method == "GET" && attempt < self.config.max_retries {
                        if let Some(d) = self.backoff(attempt, None) {
                            tokio::time::sleep(d).await;
                        }
                        attempt += 1;
                        continue;
                    }
                    return Err(Error::Network(e.to_string()));
                }
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    let headers = resp.headers().clone();
                    let raw = resp.bytes().await.map_err(|e| Error::Network(e.to_string()))?;
                    if (200..300).contains(&status) {
                        if raw.iter().all(u8::is_ascii_whitespace) {
                            return Ok(Value::Null);
                        }
                        return Ok(serde_json::from_slice(&raw)
                            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&raw).into_owned())));
                    }
                    let err = from_response(status, &headers, &raw);
                    let retryable = status == 429 || (method == "GET" && matches!(status, 502..=504));
                    if matches!(err, Error::PlanLimit(_)) || !retryable || attempt >= self.config.max_retries {
                        return Err(err);
                    }
                    let retry_after = match &err {
                        Error::Api { retry_after, .. } => *retry_after,
                        _ => None,
                    };
                    match self.backoff(attempt, retry_after) {
                        Some(d) => tokio::time::sleep(d).await,
                        None => return Err(err),
                    }
                    attempt += 1;
                }
            }
        }
    }

    pub(crate) async fn stream(&self, path: &str, query: Option<&Query>, terminal: &[&str]) -> Result<EventStream, Error> {
        let url = self.url(path, query);
        // No overall timeout: the stream stays open for minutes.
        let resp = self
            .builder("GET", &url, "text/event-stream")
            .send()
            .await
            .map_err(|e| Error::Network(e.to_string()))?;
        let status = resp.status().as_u16();
        if !(200..300).contains(&status) {
            let headers = resp.headers().clone();
            let raw = resp.bytes().await.unwrap_or_default();
            return Err(from_response(status, &headers, &raw));
        }
        Ok(EventStream::new(resp, terminal.iter().map(|s| s.to_string()).collect()))
    }
}
