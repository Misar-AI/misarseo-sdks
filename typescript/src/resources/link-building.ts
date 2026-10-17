import type { HttpClient, RequestOptions } from "../http.js";
import type {
  LinkBuildingListQuery,
  LinkBuildingListResponse,
  AddLinkProspectInput,
  AddLinkProspectResponse,
  UpdateLinkProspectInput,
  UpdateLinkProspectResponse,
  RemoveLinkProspectInput,
  RemoveLinkProspectResponse,
  UpdateLinkProspectStatusInput,
  UpdateLinkProspectStatusResponse,
  ListLinkProspectActivityQuery,
  ListLinkProspectActivityResponse,
  AddLinkProspectNoteInput,
  AddLinkProspectNoteResponse,
  LinkBuildingExportQuery,
  LinkBuildingExportResponse,
  ImportLinkProspectsInput,
  ImportLinkProspectsResponse,
} from "../types.js";

/**
 * Link Building Tool (GAP-084) — a per-project prospect list with an
 * explicit outreach-status pipeline and a per-prospect activity log.
 *
 * WHITE-HAT SCOPE: research + outreach assistance only. Never sends email,
 * never submits a form, never scrapes/discovers third-party contact info
 * (contact fields are plain manually-typed free text), never computes a
 * "success probability" or "domain quality" score — the one enrichment
 * (`domainAuthority`) is resolved live from this codebase's own existing
 * free domain-authority resolver, never a new formula.
 */
export class LinkBuildingResource {
  constructor(private readonly http: HttpClient) {}

  /** Every prospect for a project, newest first, each enriched with a live
   *  domain-authority read. */
  list(
    input: LinkBuildingListQuery,
    options?: RequestOptions,
  ): Promise<LinkBuildingListResponse> {
    return this.http.get<LinkBuildingListResponse>(
      "/link-building/prospects",
      { projectId: input.projectId },
      options,
    );
  }

  /** Adds one prospect. `prospect` is `null` in the response when this
   *  exact domain+url was already a prospect for the project — not an
   *  error. */
  add(
    input: AddLinkProspectInput,
    options?: RequestOptions,
  ): Promise<AddLinkProspectResponse> {
    return this.http.post<AddLinkProspectResponse>(
      "/link-building/prospects",
      input,
      options,
    );
  }

  /** Edits a prospect's editable fields (never `domain` or `status`) —
   *  only fields present in `input` are changed. */
  update(
    input: UpdateLinkProspectInput,
    options?: RequestOptions,
  ): Promise<UpdateLinkProspectResponse> {
    return this.http.patch<UpdateLinkProspectResponse>(
      "/link-building/prospects",
      input,
      options,
    );
  }

  /** Removes one prospect. Succeeds whether or not `prospectId` existed. */
  remove(
    input: RemoveLinkProspectInput,
    options?: RequestOptions,
  ): Promise<RemoveLinkProspectResponse> {
    return this.http.delete<RemoveLinkProspectResponse>(
      "/link-building/prospects",
      input,
      options,
    );
  }

  /** Moves a prospect through the outreach-status pipeline. Throws on an
   *  illegal jump (e.g. `prospected` straight to `link_placed`) — the
   *  error message names the allowed next stage(s). */
  updateStatus(
    input: UpdateLinkProspectStatusInput,
    options?: RequestOptions,
  ): Promise<UpdateLinkProspectStatusResponse> {
    return this.http.post<UpdateLinkProspectStatusResponse>(
      "/link-building/status",
      input,
      options,
    );
  }

  /** A prospect's activity log — every manual note plus every
   *  auto-recorded status change, newest first. */
  listActivity(
    input: ListLinkProspectActivityQuery,
    options?: RequestOptions,
  ): Promise<ListLinkProspectActivityResponse> {
    return this.http.get<ListLinkProspectActivityResponse>(
      "/link-building/activity",
      { projectId: input.projectId, prospectId: input.prospectId },
      options,
    );
  }

  /** Adds one manual activity-log entry, e.g. "emailed on 9/5". */
  addNote(
    input: AddLinkProspectNoteInput,
    options?: RequestOptions,
  ): Promise<AddLinkProspectNoteResponse> {
    return this.http.post<AddLinkProspectNoteResponse>(
      "/link-building/activity",
      input,
      options,
    );
  }

  /** The exact CSV text for a project's prospect list — write `csvContent`
   *  to a `.csv` file yourself. */
  exportCsv(
    input: LinkBuildingExportQuery,
    options?: RequestOptions,
  ): Promise<LinkBuildingExportResponse> {
    return this.http.get<LinkBuildingExportResponse>(
      "/link-building/csv",
      { projectId: input.projectId },
      options,
    );
  }

  /** Bulk-adds prospects from already-parsed rows (max 500 per call). One
   *  bad or duplicate row never aborts the rest — see the response's
   *  `added`/`duplicates`/`errors`. */
  importCsv(
    input: ImportLinkProspectsInput,
    options?: RequestOptions,
  ): Promise<ImportLinkProspectsResponse> {
    return this.http.post<ImportLinkProspectsResponse>(
      "/link-building/csv",
      input,
      options,
    );
  }
}
