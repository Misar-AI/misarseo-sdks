import type { HttpClient, RequestOptions } from "../http.js";
import type {
  AuditComparison,
  AuditComparisonInput,
  AuditStartInput,
  AuditStartResponse,
  AuditStatusInput,
  AuditSummary,
  ClearIssueStatusInput,
  ClearIssueStatusResponse,
  CrawlStreamEvent,
  CrawlStreamInput,
  CreateIssueMuteRuleInput,
  CreateIssueMuteRuleResponse,
  DeleteIssueMuteRuleInput,
  DeleteIssueMuteRuleResponse,
  ListIssueMuteRulesInput,
  ListIssueMuteRulesResponse,
  CreateIssueSeverityOverrideInput,
  CreateIssueSeverityOverrideResponse,
  DeleteIssueSeverityOverrideInput,
  DeleteIssueSeverityOverrideResponse,
  ListIssueSeverityOverridesInput,
  ListIssueSeverityOverridesResponse,
  CreateAuditSegmentInput,
  CreateAuditSegmentResponse,
  DeleteAuditSegmentInput,
  DeleteAuditSegmentResponse,
  GetSegmentedAuditResultsInput,
  GetSegmentedAuditResultsResponse,
  ListAuditSegmentsInput,
  ListAuditSegmentsResponse,
  ListIssueStatusesInput,
  ListIssueStatusesResponse,
  SetIssueStatusInput,
  SetIssueStatusResponse,
} from "../types.js";

/**
 * Parse one `\n\n`-delimited SSE frame (as emitted by `/crawl/:auditId/stream`)
 * into `{ event, data }`. Returns null for frames with no `event:` line (e.g.
 * the `: ping` keep-alive comment).
 */
function parseSseFrame(raw: string): CrawlStreamEvent | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keep-alive
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }
  if (!event) return null;

  const dataText = dataLines.join("\n");
  let data: unknown = dataText;
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      // leave as raw text — server always sends JSON, but don't throw on a
      // malformed frame mid-stream.
    }
  }
  // eslint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return { event: event as CrawlStreamEvent["event"], data };
}

/**
 * Crawl / site-audit resource.
 */
export class CrawlResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Start a site crawl/audit.
   *
   * Resolves to `{ jobId, auditId }` and nothing else — the two are the SAME
   * id, and the route answers `202`. It does NOT return the crawl's status,
   * url or start time; poll {@link status} for those. The SDK used to declare
   * all three, so a caller that branched on `result.status` branched on
   * `undefined`.
   */
  start(
    input: AuditStartInput,
    options?: RequestOptions,
  ): Promise<AuditStartResponse> {
    return this.http.post<AuditStartResponse>("/crawl/start", input, options);
  }

  /**
   * Progress of a running or completed audit.
   *
   * The payload is nested under `status`: read `result.status.pagesCrawled`,
   * not `result.pagesCrawled`. It carries progress only — page and Lighthouse
   * counts, the current phase and the timestamps — and NOT the findings; there
   * is no `issues` array here, and the terminal state is `"completed"`, not
   * `"complete"`. Use {@link comparison} for what changed between two runs.
   */
  status(
    input: AuditStatusInput,
    options?: RequestOptions,
  ): Promise<AuditSummary> {
    return this.http.get<AuditSummary>(
      `/crawl/${input.auditId}/status`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * What changed between an audit and an earlier one: new, resolved, and
   * persisting issues plus the health-score delta. Omit `baselineAuditId` to
   * compare against the run immediately before.
   *
   * Only pages BOTH crawls visited are compared, so a crawl that reached fewer
   * pages never reports the ones it missed as fixed — those are counted in
   * `notComparableCount` instead. 404s when there is no earlier completed
   * audit to compare against.
   * Free — reads from MisarSEO state, charges no credits.
   */
  comparison(
    input: AuditComparisonInput,
    options?: RequestOptions,
  ): Promise<AuditComparison> {
    return this.http.get<AuditComparison>(
      `/crawl/${input.auditId}/comparison`,
      {
        projectId: input.projectId,
        baselineAuditId: input.baselineAuditId,
      },
      options,
    );
  }

  /**
   * List a project's issue mute rules.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listIssueMuteRules(
    input: ListIssueMuteRulesInput,
    options?: RequestOptions,
  ): Promise<ListIssueMuteRulesResponse> {
    return this.http.get<ListIssueMuteRulesResponse>(
      "/crawl/issue-mute-rules",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Mute an issue type on a URL glob, so future audits stop reporting it and
   * stop counting it against the health score. Requires the `admin` role.
   *
   * Rules apply when an audit is finalized, so a new rule affects the next
   * crawl rather than rewriting past ones.
   */
  createIssueMuteRule(
    input: CreateIssueMuteRuleInput,
    options?: RequestOptions,
  ): Promise<CreateIssueMuteRuleResponse> {
    return this.http.post<CreateIssueMuteRuleResponse>(
      "/crawl/issue-mute-rules",
      input,
      options,
    );
  }

  /** Unmute — delete a mute rule. Requires the `admin` role. */
  deleteIssueMuteRule(
    input: DeleteIssueMuteRuleInput,
    options?: RequestOptions,
  ): Promise<DeleteIssueMuteRuleResponse> {
    return this.http.delete<DeleteIssueMuteRuleResponse>(
      "/crawl/issue-mute-rules",
      input,
      options,
    );
  }

  /**
   * List a project's severity-override rules.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listIssueSeverityOverrides(
    input: ListIssueSeverityOverridesInput,
    options?: RequestOptions,
  ): Promise<ListIssueSeverityOverridesResponse> {
    return this.http.get<ListIssueSeverityOverridesResponse>(
      "/crawl/issue-severity-overrides",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Re-rank an issue type's severity on a URL glob, so future audits report
   * (and score) it at the new severity instead of the check's own default.
   * Requires the `admin` role.
   *
   * Rules apply when an audit is finalized, so a new rule affects the next
   * crawl rather than rewriting past ones.
   */
  createIssueSeverityOverride(
    input: CreateIssueSeverityOverrideInput,
    options?: RequestOptions,
  ): Promise<CreateIssueSeverityOverrideResponse> {
    return this.http.post<CreateIssueSeverityOverrideResponse>(
      "/crawl/issue-severity-overrides",
      input,
      options,
    );
  }

  /** Delete a severity-override rule. Requires the `admin` role. */
  deleteIssueSeverityOverride(
    input: DeleteIssueSeverityOverrideInput,
    options?: RequestOptions,
  ): Promise<DeleteIssueSeverityOverrideResponse> {
    return this.http.delete<DeleteIssueSeverityOverrideResponse>(
      "/crawl/issue-severity-overrides",
      input,
      options,
    );
  }

  /**
   * List a project's saved audit segments.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listAuditSegments(
    input: ListAuditSegmentsInput,
    options?: RequestOptions,
  ): Promise<ListAuditSegmentsResponse> {
    return this.http.get<ListAuditSegmentsResponse>(
      "/crawl/audit-segments",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Save a named segment: pages matching ANY of 1-10 URL globs. Apply it with
   * {@link segment}. Requires the `admin` role.
   */
  createAuditSegment(
    input: CreateAuditSegmentInput,
    options?: RequestOptions,
  ): Promise<CreateAuditSegmentResponse> {
    return this.http.post<CreateAuditSegmentResponse>(
      "/crawl/audit-segments",
      input,
      options,
    );
  }

  /** Delete a saved segment. Requires the `admin` role. */
  deleteAuditSegment(
    input: DeleteAuditSegmentInput,
    options?: RequestOptions,
  ): Promise<DeleteAuditSegmentResponse> {
    return this.http.delete<DeleteAuditSegmentResponse>(
      "/crawl/audit-segments",
      input,
      options,
    );
  }

  /**
   * Apply a saved segment to one audit's results: health score, issue counts
   * and a capped, worst-first issue list re-scoped to just the pages the
   * segment's URL patterns match. Nothing is re-crawled.
   * Free — reads from MisarSEO state, charges no credits.
   */
  segment(
    input: GetSegmentedAuditResultsInput,
    options?: RequestOptions,
  ): Promise<GetSegmentedAuditResultsResponse> {
    return this.http.get<GetSegmentedAuditResultsResponse>(
      `/crawl/${input.auditId}/segment`,
      { projectId: input.projectId, segmentId: input.segmentId },
      options,
    );
  }

  /**
   * Every recorded triage status in a project. Status attaches to
   * `project + issueType + url`, not to an audit, so it survives the audit
   * retention purge.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listIssueStatuses(
    input: ListIssueStatusesInput,
    options?: RequestOptions,
  ): Promise<ListIssueStatusesResponse> {
    return this.http.get<ListIssueStatusesResponse>(
      "/crawl/issue-status",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Set one finding's triage status. Upsert — re-setting a status is an
   * update, not a second opinion, so `{ idempotent: true }` is safe here.
   * Requires the `member` role.
   */
  setIssueStatus(
    input: SetIssueStatusInput,
    options?: RequestOptions,
  ): Promise<SetIssueStatusResponse> {
    return this.http.post<SetIssueStatusResponse>(
      "/crawl/issue-status",
      input,
      options,
    );
  }

  /** Return one finding to untriaged. Requires the `member` role. */
  clearIssueStatus(
    input: ClearIssueStatusInput,
    options?: RequestOptions,
  ): Promise<ClearIssueStatusResponse> {
    return this.http.delete<ClearIssueStatusResponse>(
      "/crawl/issue-status",
      input,
      options,
    );
  }

  /**
   * Open a live Server-Sent Events stream of crawl progress and consume it as
   * an async iterator — `for await (const { event, data } of client.crawl.streamEvents(...))`.
   *
   * The endpoint only accepts `Authorization: Bearer` auth, and browser
   * `EventSource` can't attach custom headers, so this isn't exposed as an
   * `EventSource`-compatible URL — it streams the response body via `fetch`
   * and parses SSE frames manually, which works the same in Node and browsers.
   *
   * Emits `progress` events roughly every 1.5s, then a single terminal
   * `complete` or `error` event. The server enforces a 10-minute hard timeout.
   *
   * `options.timeoutMs` bounds only the wait for response headers — once the
   * stream is open it may legitimately run for minutes. To stop early, either
   * `break` out of the loop or abort `options.signal`.
   */
  async *streamEvents(
    input: CrawlStreamInput,
    options?: RequestOptions,
  ): AsyncGenerator<CrawlStreamEvent, void, void> {
    const response = await this.http.getRaw(
      `/crawl/${input.auditId}/stream`,
      { projectId: input.projectId },
      options,
    );
    const body = response.body;
    if (!body) return;

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex: number;
        while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawFrame = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const parsed = parseSseFrame(rawFrame);
          if (parsed) yield parsed;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
