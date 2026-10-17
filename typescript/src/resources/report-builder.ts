import type { HttpClient, RequestOptions } from "../http.js";
import type {
  ListReportDefinitionsInput,
  ListReportDefinitionsResponse,
  CreateReportDefinitionInput,
  CreateReportDefinitionResponse,
  GetReportDefinitionInput,
  GetReportDefinitionResponse,
  RenameReportDefinitionInput,
  DeleteReportDefinitionInput,
  SetReportWidgetsInput,
  SetReportWidgetsResponse,
  RenderReportDefinitionInput,
  RenderReportDefinitionResponse,
  GetReportScheduleInput,
  GetReportScheduleResponse,
  UpsertReportScheduleInput,
  UpsertReportScheduleResponse,
  DeleteReportScheduleInput,
  MutationSuccess,
} from "../types.js";

/**
 * Report Builder (GAP-192) resource — named, user-composed widget
 * selections for one project's report. Free: every widget is a local
 * Postgres read, no upstream calls — see `RenderReportDefinitionResponse`'s
 * own docs for the two widgets (volatility, share of voice) that read only
 * the project's first active rank tracker rather than blending several.
 */
export class ReportBuilderResource {
  constructor(private readonly http: HttpClient) {}

  /** A project's report definitions, each carrying `widgetCount`. */
  listDefinitions(
    input: ListReportDefinitionsInput,
    options?: RequestOptions,
  ): Promise<ListReportDefinitionsResponse> {
    return this.http.get<ListReportDefinitionsResponse>(
      "/reports/definitions",
      { projectId: input.projectId },
      options,
    );
  }

  /** Create a report definition. `widgetTypes` may be empty. */
  createDefinition(
    input: CreateReportDefinitionInput,
    options?: RequestOptions,
  ): Promise<CreateReportDefinitionResponse> {
    return this.http.post<CreateReportDefinitionResponse>(
      "/reports/definitions",
      input,
      options,
    );
  }

  /** A definition's name and ordered widget types. */
  getDefinition(
    input: GetReportDefinitionInput,
    options?: RequestOptions,
  ): Promise<GetReportDefinitionResponse> {
    return this.http.get<GetReportDefinitionResponse>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}`,
      { projectId: input.projectId },
      options,
    );
  }

  renameDefinition(
    input: RenameReportDefinitionInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.patch<MutationSuccess>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}`,
      { projectId: input.projectId, name: input.name },
      options,
    );
  }

  deleteDefinition(
    input: DeleteReportDefinitionInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    // `projectId` travels in the QUERY: the route reads it from the URL, and
    // the SDK used to send it as a DELETE body the handler never looked at,
    // so every call answered 400.
    return this.http.delete<MutationSuccess>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}?projectId=${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }

  /** Replaces a definition's whole widget list, in order. */
  setWidgets(
    input: SetReportWidgetsInput,
    options?: RequestOptions,
  ): Promise<SetReportWidgetsResponse> {
    return this.http.post<SetReportWidgetsResponse>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}/widgets`,
      { projectId: input.projectId, widgetTypes: input.widgetTypes },
      options,
    );
  }

  /**
   * Renders a definition — fetches ONLY its selected widgets, unlike the
   * fixed report (`reports` server function), which always computes all
   * five original sections.
   */
  renderDefinition(
    input: RenderReportDefinitionInput,
    options?: RequestOptions,
  ): Promise<RenderReportDefinitionResponse> {
    return this.http.get<RenderReportDefinitionResponse>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}/render`,
      { projectId: input.projectId, periodDays: input.periodDays },
      options,
    );
  }

  /** A definition's schedule, or `{ schedule: null }` if it has none. */
  getSchedule(
    input: GetReportScheduleInput,
    options?: RequestOptions,
  ): Promise<GetReportScheduleResponse> {
    return this.http.get<GetReportScheduleResponse>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}/schedule`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Creates or replaces a definition's schedule. Requires the admin role in
   * the calling organization — see `UpsertReportScheduleInput`'s own docs.
   */
  upsertSchedule(
    input: UpsertReportScheduleInput,
    options?: RequestOptions,
  ): Promise<UpsertReportScheduleResponse> {
    return this.http.post<UpsertReportScheduleResponse>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}/schedule`,
      {
        projectId: input.projectId,
        scheduleInterval: input.scheduleInterval,
        recipientUserIds: input.recipientUserIds,
      },
      options,
    );
  }

  /** Requires the admin role in the calling organization, same as creating one. */
  deleteSchedule(
    input: DeleteReportScheduleInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    // `projectId` travels in the QUERY: the route reads it from the URL, and
    // the SDK used to send it as a DELETE body the handler never looked at,
    // so every call answered 400.
    return this.http.delete<MutationSuccess>(
      `/reports/definitions/${encodeURIComponent(input.reportDefinitionId)}/schedule?projectId=${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }
}
