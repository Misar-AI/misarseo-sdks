import type { HttpClient, RequestOptions } from "../http.js";
import type { TeamMembersResponse } from "../types-team.js";

/**
 * Team resource — who is in the caller's organization.
 *
 * Read-only on purpose: membership changes (role edits, removals, invitations)
 * refuse API keys and require a signed-in session, so a leaked key cannot plant
 * standing human access that outlives revoking it.
 */
export class TeamResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Members, pending invitations and the caller's own role.
   * Free — charges no credits.
   */
  listMembers(options?: RequestOptions): Promise<TeamMembersResponse> {
    return this.http.get<TeamMembersResponse>(
      "/team/members",
      undefined,
      options,
    );
  }
}
