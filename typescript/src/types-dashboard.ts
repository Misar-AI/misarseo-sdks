/**
 * Cross-project dashboard (GAP-190) types.
 */

export interface ProjectDashboardAudit {
  id: string;
  status: string;
  healthScore: number | null;
  issuesError: number | null;
  issuesWarning: number | null;
  issuesNotice: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ProjectDashboardRankTracking {
  /** Active rank trackers configured on this project. */
  configCount: number;
  lastRunStatus: string | null;
  lastRunCompletedAt: string | null;
}

export interface ProjectDashboardWebAnalytics {
  /** Sessions in the trailing 7 days. */
  sessions: number;
}

export interface ProjectDashboardCard {
  projectId: string;
  name: string;
  domain: string | null;
  /** Null when the project has never been audited. */
  audit: ProjectDashboardAudit | null;
  /** Null when the project has no active rank tracker. */
  rankTracking: ProjectDashboardRankTracking | null;
  /** Null when the project has no web-analytics sessions in the window. */
  webAnalytics: ProjectDashboardWebAnalytics | null;
}

export interface GetDashboardResponse {
  /** One card per active project, newest project first. */
  projects: ProjectDashboardCard[];
}
