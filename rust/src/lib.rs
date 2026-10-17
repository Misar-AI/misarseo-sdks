//! MisarSEO API client for Rust.
//!
//! Keyword research, site audits, rank tracking, backlinks, AI search
//! visibility, Search Console, GA4 and Business Profile — every endpoint of
//! `https://api.misar.io/seo`, one accessor per resource:
//!
//! ```no_run
//! # async fn run() -> Result<(), misarseo::Error> {
//! let client = misarseo::Client::new("mseo_...")?;
//! let projects = client.projects().list(None).await?;
//! # Ok(()) }
//! ```
//!
//! Calls authenticate with a MisarSEO API key (`mseo_…`) sent as
//! `Authorization: Bearer`. A plan refusal is [`Error::PlanLimit`] with the
//! server's upgrade offer and is never retried.

pub mod errors;
pub mod generated;
pub mod pagination;
pub mod sse;
mod transport;

pub use errors::{Error, PlanLimit, PLAN_LIMIT_CODE};
pub use generated::*;
pub use sse::{Event, EventStream};
pub use transport::Query;

use std::time::Duration;

/// SDK version, sent in the `User-Agent` header.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
/// The public API gateway for MisarSEO.
pub const DEFAULT_BASE_URL: &str = "https://api.misar.io/seo";

/// Client configuration. `Default` gives the production settings.
#[derive(Clone, Debug)]
pub struct Config {
    pub base_url: String,
    pub timeout: Duration,
    /// Extra attempts for retryable failures.
    pub max_retries: u32,
    /// First backoff step; doubles per attempt, with jitter.
    pub retry_base_delay: Duration,
    /// Cap on any single wait, including a server-sent `Retry-After`.
    pub max_retry_delay: Duration,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            timeout: Duration::from_secs(30),
            max_retries: 2,
            retry_base_delay: Duration::from_millis(250),
            max_retry_delay: Duration::from_secs(60),
        }
    }
}

/// The MisarSEO client. Cheap to clone.
#[derive(Clone)]
pub struct Client {
    pub(crate) api_key: String,
    pub(crate) config: Config,
    pub(crate) http: reqwest::Client,
}

impl Client {
    /// Build a client with the default configuration. An empty key falls back
    /// to `MISARSEO_API_KEY`.
    pub fn new(api_key: &str) -> Result<Self, Error> {
        Self::with_config(api_key, Config::default())
    }

    /// Build a client with an explicit configuration.
    pub fn with_config(api_key: &str, config: Config) -> Result<Self, Error> {
        let key = if api_key.is_empty() {
            std::env::var("MISARSEO_API_KEY").unwrap_or_default()
        } else {
            api_key.to_string()
        };
        if key.is_empty() {
            return Err(Error::Config(
                "a MisarSEO API key (mseo_…) is required: pass it or set MISARSEO_API_KEY; see https://seo.misar.io/ai".into(),
            ));
        }
        let http = reqwest::Client::builder()
            .connect_timeout(config.timeout)
            .build()
            .map_err(|e| Error::Config(e.to_string()))?;
        Ok(Self {
            api_key: key,
            config: Config {
                base_url: config.base_url.trim_end_matches('/').to_string(),
                ..config
            },
            http,
        })
    }
}
