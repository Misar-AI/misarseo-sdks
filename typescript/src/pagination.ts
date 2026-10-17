/**
 * Pagination helpers.
 *
 * The API paginates two different ways, and the difference is not cosmetic —
 * it is the reason there are two iterators here instead of one:
 *
 * **Offset paging** (`{ rows, totalCount, hasMore, page, pageSize }`, e.g.
 * `GET /backlinks/anchors`) addresses rows by *position* in a sorted result
 * set. It can jump straight to page 7 and it knows the total, which is what a
 * numbered-pages UI needs. The cost is that positions move: rows appearing or
 * disappearing between two requests shift everything after them, so a row can
 * be returned twice or skipped entirely. That is acceptable for the anchors
 * report, which is a paged view over an upstream snapshot that barely changes
 * within one pagination pass.
 *
 * **Keyset paging** (`{ entries, hasMore, nextCursor }`, e.g. `GET /activity`)
 * addresses rows by a *key* that is monotonic in the sort order — "give me
 * what is older than this entry". It cannot jump to page 7 and it has no total
 * count, but insertions during pagination cannot shift anything, so it never
 * duplicates or skips. The activity log is append-heavy and sorted newest
 * first, which is precisely the shape where offset paging drifts: one entry
 * recorded mid-pass pushes every row down a slot.
 *
 * Collapsing these into one abstraction would mean inventing a cursor for the
 * offset endpoint or a page number for the keyset one, and the second of those
 * quietly reintroduces the drift keyset paging was chosen to avoid. So the
 * shapes stay distinct, and callers see which guarantee they are getting.
 */

/** One page of an offset-paginated endpoint. */
export interface OffsetPage<TRow> {
  rows: TRow[];
  /** Whether a further page exists after this one. */
  hasMore: boolean;
  /** 1-based index of the page that was returned. */
  page: number;
}

/** One page of a keyset (cursor) paginated endpoint. */
export interface CursorPage<TRow> {
  rows: TRow[];
  /** Whether a further page exists after this one. */
  hasMore: boolean;
  /** Cursor to feed back for the next page, or `null` at the end. */
  nextCursor: string | null;
}

/**
 * Walk an offset-paginated endpoint row by row, requesting each page lazily —
 * stop iterating and no further request is made.
 *
 * Termination is deliberately belt-and-braces: `hasMore === false` is the
 * normal exit, but an empty page also ends the walk. Offset paging over a
 * result set that shrank mid-pass can otherwise report `hasMore` forever while
 * returning nothing, and an infinite loop against a billed endpoint is a much
 * worse failure than a short read.
 */
export async function* iterateOffsetPages<TRow>(
  fetchPage: (page: number) => Promise<OffsetPage<TRow>>,
  startPage = 1,
): AsyncGenerator<TRow, void, void> {
  let page = startPage;
  for (;;) {
    const result = await fetchPage(page);
    for (const row of result.rows) yield row;
    if (!result.hasMore || result.rows.length === 0) return;
    // Advance our own counter rather than trusting the echoed `page`: a server
    // that echoes a stale number would otherwise pin us to one page forever.
    page += 1;
  }
}

/**
 * Walk a keyset-paginated endpoint row by row, following `nextCursor`.
 *
 * Ends when the server stops handing out a cursor, and also if it hands back
 * the same cursor it was given — that would fetch the same page again, and
 * looping on it is never what the caller wanted.
 */
export async function* iterateCursorPages<TRow>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<TRow>>,
  startCursor?: string,
): AsyncGenerator<TRow, void, void> {
  let cursor = startCursor;
  for (;;) {
    const result = await fetchPage(cursor);
    for (const row of result.rows) yield row;
    const next = result.nextCursor;
    if (!result.hasMore || !next || next === cursor) return;
    cursor = next;
  }
}
