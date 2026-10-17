//! Pagination helpers for the two shapes the API pages in.
//!
//! Offset pages (`{rows, hasMore, page}`) address rows by position; keyset
//! pages (`{rows, hasMore, nextCursor}`) by key, so they never skip or repeat
//! when rows are inserted mid-walk.

use std::future::Future;

use serde_json::Value;

use crate::errors::Error;

fn rows(v: &Value) -> Vec<Value> {
    v.get("rows").and_then(Value::as_array).cloned().unwrap_or_default()
}

fn has_more(v: &Value) -> bool {
    v.get("hasMore").and_then(Value::as_bool).unwrap_or(false)
}

/// Collect every row of an offset-paginated endpoint. Stops on `hasMore`
/// false OR an empty page, so a shrinking result set cannot loop forever.
pub async fn collect_offset_pages<F, Fut>(start_page: u32, mut fetch: F) -> Result<Vec<Value>, Error>
where
    F: FnMut(u32) -> Fut,
    Fut: Future<Output = Result<Value, Error>>,
{
    let mut out = Vec::new();
    let mut page = start_page;
    loop {
        let result = fetch(page).await?;
        let r = rows(&result);
        let empty = r.is_empty();
        out.extend(r);
        if !has_more(&result) || empty {
            return Ok(out);
        }
        page += 1;
    }
}

/// Collect every row of a cursor-paginated endpoint, stopping when
/// `nextCursor` is absent or repeats.
pub async fn collect_cursor_pages<F, Fut>(start: Option<String>, mut fetch: F) -> Result<Vec<Value>, Error>
where
    F: FnMut(Option<String>) -> Fut,
    Fut: Future<Output = Result<Value, Error>>,
{
    let mut out = Vec::new();
    let mut cursor = start;
    loop {
        let result = fetch(cursor.clone()).await?;
        out.extend(rows(&result));
        let next = result.get("nextCursor").and_then(Value::as_str).map(str::to_string);
        if !has_more(&result) || next.is_none() || next == cursor {
            return Ok(out);
        }
        cursor = next;
    }
}
