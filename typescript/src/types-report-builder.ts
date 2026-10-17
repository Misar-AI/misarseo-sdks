/**
 * Report Builder (GAP-192) types — named, user-composed widget selections
 * for one project's report.
 */

/** Widget type strings — mirrors `@/shared/report-widgets`'s `WIDGET_TYPES`. */
export type ReportWidgetType =
  | "site_health"
  | "internal_linking"
  | "rank_tracking"
  | "keywords"
  | "search_console"
  | "web_analytics"
  | "gsc_coverage"
  | "rank_movers"
  | "rank_volatility"
  | "share_of_voice"
  | "log_analyzer";

export interface ReportDefinitionSummary {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  widgetCount: number;
}

export interface ListReportDefinitionsInput {
  projectId: string;
}

export interface ListReportDefinitionsResponse {
  definitions: ReportDefinitionSummary[];
}

export interface CreateReportDefinitionInput {
  projectId: string;
  name: string;
  /** May be empty — a report with no widgets yet. */
  widgetTypes: string[];
}

export interface CreateReportDefinitionResponse {
  id: string;
}

export interface GetReportDefinitionInput {
  projectId: string;
  reportDefinitionId: string;
}

export interface GetReportDefinitionResponse {
  id: string;
  name: string;
  /** Print order. */
  widgetTypes: string[];
}

export interface RenameReportDefinitionInput {
  projectId: string;
  reportDefinitionId: string;
  name: string;
}

export interface DeleteReportDefinitionInput {
  projectId: string;
  reportDefinitionId: string;
}

export interface SetReportWidgetsInput {
  projectId: string;
  reportDefinitionId: string;
  /** Replaces the whole list, in this order. */
  widgetTypes: string[];
}

export interface SetReportWidgetsResponse {
  widgetCount: number;
}

export interface RenderReportDefinitionInput {
  projectId: string;
  reportDefinitionId: string;
  /** 7, 28 or 90, default 28. Coerced, never rejected. */
  periodDays?: number;
}

export interface ReportDefinitionMeta {
  name: string;
  organizationName: string | null;
  projectName: string;
  projectDomain: string | null;
  startDate: string;
  endDate: string;
  periodDays: number;
  generatedAt: string;
}

/**
 * One widget's rendered data. `data`'s shape depends on `type` — this SDK
 * does not re-declare all eleven widget payload shapes (they are the same
 * absence-is-stated discriminated unions `@/client/features/reports
 * /reportTypes` and the server's `ReportWidgetService` define); narrow on
 * `type` and treat `data` as the matching shape documented there.
 */
export interface RenderedReportWidget {
  type: ReportWidgetType;
  data: unknown;
}

export interface RenderReportDefinitionResponse {
  meta: ReportDefinitionMeta;
  widgets: RenderedReportWidget[];
}

/** How often a schedule re-sends. */
export type ReportScheduleInterval = "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  scheduleInterval: ReportScheduleInterval;
  nextSendAt: string;
  lastSentAt: string | null;
  /**
   * Recipients are platform users (organization members), not arbitrary
   * email addresses — see `UpsertReportScheduleInput`'s own docs for why.
   */
  recipientUserIds: string[];
}

export interface GetReportScheduleInput {
  projectId: string;
  reportDefinitionId: string;
}

export interface GetReportScheduleResponse {
  /** `null` when the definition has no schedule — a normal state, not an error. */
  schedule: ReportSchedule | null;
}

/**
 * `recipientUserIds` must be members of the calling organization — an id
 * that is not a member is silently dropped rather than rejected, the same
 * pattern `PortfolioProjectsMutation`'s project-id resolution uses. There is
 * no arbitrary external-email recipient in this version: every existing
 * MisarSEO email type sends to a platform user, and this follows the same
 * consent/unsubscribe model rather than inventing a second one.
 */
export interface UpsertReportScheduleInput {
  projectId: string;
  reportDefinitionId: string;
  scheduleInterval: ReportScheduleInterval;
  recipientUserIds: string[];
}

export interface UpsertReportScheduleResponse {
  recipientCount: number;
}

export interface DeleteReportScheduleInput {
  projectId: string;
  reportDefinitionId: string;
}
