import type { HttpClient, RequestOptions } from "../http.js";
import type {
  DisavowListQuery,
  DisavowListResponse,
  AddDisavowEntryInput,
  AddDisavowEntryResponse,
  RemoveDisavowEntryInput,
  RemoveDisavowEntryResponse,
  DisavowExportQuery,
  DisavowExportResponse,
} from "../types.js";

/**
 * Disavow file management (GAP-083) — a per-project list of URLs/domains
 * marked for disavowal, exported in Google's exact documented disavow-file
 * format. Given ANY link list this codebase has access to (a project's own
 * inbound links from Bing — see `bing.backlinks()` — or a domain/URL typed
 * in directly), mark entries here and export them.
 */
export class DisavowResource {
  constructor(private readonly http: HttpClient) {}

  /** Every disavow entry for a project, oldest first. */
  list(
    input: DisavowListQuery,
    options?: RequestOptions,
  ): Promise<DisavowListResponse> {
    return this.http.get<DisavowListResponse>(
      "/disavow/entries",
      { projectId: input.projectId },
      options,
    );
  }

  /** Adds one entry. `entry` is `null` in the response when this exact
   *  value was already disavowed for the project — not an error. */
  add(
    input: AddDisavowEntryInput,
    options?: RequestOptions,
  ): Promise<AddDisavowEntryResponse> {
    return this.http.post<AddDisavowEntryResponse>(
      "/disavow/entries",
      input,
      options,
    );
  }

  /** Removes one entry. Succeeds whether or not `entryId` existed. */
  remove(
    input: RemoveDisavowEntryInput,
    options?: RequestOptions,
  ): Promise<RemoveDisavowEntryResponse> {
    return this.http.delete<RemoveDisavowEntryResponse>(
      "/disavow/entries",
      input,
      options,
    );
  }

  /**
   * The exact `.txt` content Google's disavow tool accepts, built from
   * every entry currently on the project. Returned as a JSON string field
   * rather than a raw file download — write `fileContent` to a `.txt` file
   * yourself.
   */
  export(
    input: DisavowExportQuery,
    options?: RequestOptions,
  ): Promise<DisavowExportResponse> {
    return this.http.get<DisavowExportResponse>(
      "/disavow/export",
      { projectId: input.projectId },
      options,
    );
  }
}
