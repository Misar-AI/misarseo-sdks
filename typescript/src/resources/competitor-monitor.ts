import type { HttpClient, RequestOptions } from "../http.js";
import type {
  CompetitorMonitorAddTargetInput,
  CompetitorMonitorListChangesInput,
  CompetitorMonitorListChangesResponse,
  CompetitorMonitorListTargetsInput,
  CompetitorMonitorListTargetsResponse,
  CompetitorMonitorRemoveTargetInput,
} from "../types.js";

/**
 * Competitor Monitor resource — competitor page change detection (GAP-164).
 * Free: this codebase's own SSRF-safe fetch on a daily schedule, no paid
 * provider call.
 */
export class CompetitorMonitorResource {
  constructor(private readonly http: HttpClient) {}

  /** List the competitor URLs monitored for a project. */
  listTargets(
    input: CompetitorMonitorListTargetsInput,
    options?: RequestOptions,
  ): Promise<CompetitorMonitorListTargetsResponse> {
    return this.http.get<CompetitorMonitorListTargetsResponse>(
      "/competitor-monitor/targets",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Start monitoring one competitor URL for page changes. Idempotent —
   * re-adding an already-tracked URL is a no-op. The first snapshot is
   * captured on the next scheduled cron pass, not immediately.
   */
  addTarget(
    input: CompetitorMonitorAddTargetInput,
    options?: RequestOptions,
  ): Promise<{ id: string }> {
    return this.http.post<{ id: string }>(
      "/competitor-monitor/targets",
      { projectId: input.projectId, url: input.url, label: input.label },
      options,
    );
  }

  /** Stop monitoring a URL. Its snapshots and detected changes are deleted
   *  along with it. */
  removeTarget(
    input: CompetitorMonitorRemoveTargetInput,
    options?: RequestOptions,
  ): Promise<{ success: true }> {
    return this.http.delete<{ success: true }>(
      "/competitor-monitor/targets",
      { projectId: input.projectId, targetId: input.targetId },
      options,
    );
  }

  /**
   * Timeline of detected changes for one monitored URL, newest first. Only
   * checks that found a real difference appear here.
   */
  listChanges(
    input: CompetitorMonitorListChangesInput,
    options?: RequestOptions,
  ): Promise<CompetitorMonitorListChangesResponse> {
    return this.http.get<CompetitorMonitorListChangesResponse>(
      "/competitor-monitor/changes",
      {
        projectId: input.projectId,
        targetId: input.targetId,
        limit: input.limit,
      },
      options,
    );
  }
}
