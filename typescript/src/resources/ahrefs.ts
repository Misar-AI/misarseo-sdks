import type { HttpClient, RequestOptions } from "../http.js";
import type {
  AhrefsConnectionStatusInput,
  AhrefsConnectionStatusResponse,
  AhrefsListProjectsInput,
  AhrefsListProjectsResponse,
  AhrefsSetProjectInput,
  AhrefsConnection,
  AhrefsDisconnectInput,
} from "../types.js";

/**
 * Ahrefs Connect resource (GAP-207) — the per-project OAuth "Connect" flow
 * for Ahrefs' Rank Tracker and Site Audit projects. Mirrors `BingResource`'s
 * own connect/list/set/disconnect shape exactly, doubled: `setProject`
 * takes a `projectType` naming which of the two independent Ahrefs project
 * concepts it binds, since one MisarSEO project can bind up to one of
 * each. There is no operator-level fallback here (unlike Bing/Yandex) —
 * this IS the only Ahrefs credential path in this codebase.
 *
 * CODE-COMPLETE BUT INERT: hidden/disabled on every deployment until a
 * human completes the Ahrefs Connect partner application and sets
 * `AHREFS_OAUTH_CLIENT_ID`/`_SECRET` — see
 * `docs/reference/ahrefs-connect-application-checklist.md`.
 */
export class AhrefsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get the Ahrefs Connect connection status for a project: whether the
   * caller has an Ahrefs OAuth grant at all, and which Rank Tracker / Site
   * Audit projects (if any) are bound.
   *
   * NOT the OAuth entry point — this starts no authorization flow. Ahrefs'
   * own consent screen and redirect are a browser-only flow the web app
   * drives; there is no SDK method that starts it (an API-key caller has no
   * browser to send the user through Ahrefs' consent screen).
   */
  connect(
    input: AhrefsConnectionStatusInput,
    options?: RequestOptions,
  ): Promise<AhrefsConnectionStatusResponse> {
    return this.http.get<AhrefsConnectionStatusResponse>(
      "/ahrefs/connection",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Every Rank Tracker + Site Audit project the caller's connected Ahrefs
   * account can access — the picker's data source. A live call to the
   * Ahrefs API v3 (`GET /v3/management/projects` + `GET
   * /v3/site-audit/projects`) under the caller's OWN OAuth token.
   *
   * Check `requiresReconnect` first: `true` (with both lists empty) means
   * the stored grant can no longer reach Ahrefs.
   */
  listProjects(
    input: AhrefsListProjectsInput,
    options?: RequestOptions,
  ): Promise<AhrefsListProjectsResponse> {
    return this.http.get<AhrefsListProjectsResponse>(
      "/ahrefs/projects",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Bind (or repoint) ONE of the project's two independent Ahrefs project
   * types — `input.projectType` selects `"rank_tracker"` or `"site_audit"`.
   * `ahrefsProjectId` is re-validated against the caller's LIVE project
   * list on every call — it can 404 if the project fell out of the
   * connected account's access since it was last listed via
   * `listProjects()`.
   */
  setProject(
    input: AhrefsSetProjectInput,
    options?: RequestOptions,
  ): Promise<{ connection: AhrefsConnection }> {
    return this.http.post<{ connection: AhrefsConnection }>(
      "/ahrefs/connection",
      input,
      options,
    );
  }

  /**
   * Full disconnect: drops BOTH project bindings and the stored grant.
   * Requires at least the admin role — disconnecting breaks Ahrefs data
   * for every member, not just the caller.
   */
  disconnect(
    input: AhrefsDisconnectInput,
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/ahrefs/connection", input, options);
  }
}
