//! Server-Sent Events for the crawl progress stream.

use futures_util::StreamExt;
use serde_json::Value;

use crate::errors::Error;

/// One frame: the `event:` name and its JSON-decoded `data:`.
#[derive(Debug, Clone, PartialEq)]
pub struct Event {
    pub event: String,
    pub data: Value,
}

/// Decode one frame; `None` for keep-alive comments and frames without an event.
pub fn parse_frame(frame: &str) -> Option<Event> {
    let mut event = None;
    let mut data = Vec::new();
    for line in frame.replace("\r\n", "\n").split('\n') {
        if line.is_empty() || line.starts_with(':') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("event:") {
            event = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("data:") {
            data.push(rest.trim_start().to_string());
        }
    }
    let raw = data.join("\n");
    let data = if raw.is_empty() {
        Value::String(raw)
    } else {
        serde_json::from_str(&raw).unwrap_or(Value::String(raw))
    };
    event.map(|event| Event { event, data })
}

/// An open `text/event-stream`. Call [`EventStream::next`] until it yields
/// `None`, which happens after a terminal event or when the server closes.
pub struct EventStream {
    body: futures_util::stream::BoxStream<'static, reqwest::Result<bytes::Bytes>>,
    buffer: String,
    terminal: Vec<String>,
    done: bool,
}

impl EventStream {
    pub(crate) fn new(resp: reqwest::Response, terminal: Vec<String>) -> Self {
        Self { body: resp.bytes_stream().boxed(), buffer: String::new(), terminal, done: false }
    }

    /// The next event, `None` at the end of the stream.
    pub async fn next(&mut self) -> Option<Result<Event, Error>> {
        loop {
            if self.done {
                return None;
            }
            if let Some(pos) = self.buffer.find("\n\n") {
                let frame: String = self.buffer.drain(..pos + 2).collect();
                if let Some(ev) = parse_frame(&frame) {
                    if self.terminal.contains(&ev.event) {
                        self.done = true;
                    }
                    return Some(Ok(ev));
                }
                continue;
            }
            match self.body.next().await {
                Some(Ok(chunk)) => self.buffer.push_str(&String::from_utf8_lossy(&chunk).replace("\r\n", "\n")),
                Some(Err(e)) => {
                    self.done = true;
                    return Some(Err(Error::Network(e.to_string())));
                }
                None => {
                    self.done = true;
                    let rest = std::mem::take(&mut self.buffer);
                    return parse_frame(&rest).map(Ok);
                }
            }
        }
    }
}
