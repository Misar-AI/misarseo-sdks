import type { HttpClient, RequestOptions } from "../http.js";
import { iterateCursorPages } from "../pagination.js";
import type {
  ActivityEntry,
  ListActivityInput,
  ListActivityResponse,
} from "../types.js";

/**
 * Activity resource — the tenant activity log: who did what, newest first.
 *
 * Separate from {@link AccountResource}, which is strictly the caller's own
 * Data Subject Rights surface. This log is organization-wide, names other
 * members, and requires the `admin` role.
 */
export class ActivityResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List activity entries, newest first. Page by feeding the previous page's
   * `nextCursor` back as `before` — keyset rather than offset, so an entry
   * recorded mid-pagination cannot duplicate or skip a row.
   *
   * Always scoped to the caller's own organization. Requires the `admin` role.
   * Free — reads from MisarSEO state, charges no credits.
   */
  list(
    input: ListActivityInput = {},
    options?: RequestOptions,
  ): Promise<ListActivityResponse> {
    return this.http.get<ListActivityResponse>(
      "/activity",
      {
        projectId: input.projectId,
        pageSize: input.pageSize,
        before: input.before,
      },
      options,
    );
  }

  /**
   * Iterate the whole log entry by entry, following the keyset cursor:
   *
   * ```typescript
   * for await (const entry of client.activity.iterate({ pageSize: 100 })) {
   *   console.log(entry.createdAt, entry.action);
   * }
   * ```
   *
   * Unlike the offset-paged endpoints (see `pagination.ts`) this cannot skip
   * ahead to an arbitrary page and never reports a total — the trade for a
   * walk that stays correct while the log is being written to underneath it.
   * Free — charges no credits, but it is one request per page, so `break` when
   * you have seen enough.
   */
  iterate(
    input: ListActivityInput = {},
    options?: RequestOptions,
  ): AsyncGenerator<ActivityEntry, void, void> {
    return iterateCursorPages<ActivityEntry>(async (cursor) => {
      const result = await this.list({ ...input, before: cursor }, options);
      return {
        rows: result.entries,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      };
    }, input.before);
  }
}
