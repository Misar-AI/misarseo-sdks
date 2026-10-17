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
  CoreWebVitalsInput,
  CoreWebVitalsReport,
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
  CreateCustomIssueRuleInput,
  CreateCustomIssueRuleResponse,
  DeleteCustomIssueRuleInput,
  DeleteCustomIssueRuleResponse,
  ListCustomIssueRulesInput,
  ListCustomIssueRulesResponse,
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
import type {
  InternalLinkReportInput,
  InternalLinkReport,
  StructuredDataReportInput,
  StructuredDataReport,
  HttpsReportInput,
  HttpsReport,
} from "../types-audit-reports.js";

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
   * Core Web Vitals report (GAP-064): LCP/INP/CLS per page/strategy this
   * audit already ran Lighthouse against, classified against Google's own
   * published thresholds. No new fetch — reads `audit_lighthouse_results`,
   * the same table the results UI already renders as raw numbers.
   *
   * LAB DATA ONLY, never Search Console's real Chrome UX Report (CrUX) field
   * data — every number is a single simulated Lighthouse run, not an
   * aggregated real-user measurement. This codebase's audit pipeline runs
   * local headless Chrome as its PRIMARY path, so CrUX field data is not
   * reliably available for any given page.
   *
   * ALWAYS narrow on `report.state` first: `no_lighthouse_data` (this audit
   * has no Lighthouse rows at all — an absence of data, NOT every page
   * passing) or `analysed`. 404s when no audit with that id belongs to the
   * project.
   *
   * Free — reads from MisarSEO state, charges no credits.
   */
  coreWebVitals(
    input: CoreWebVitalsInput,
    options?: RequestOptions,
  ): Promise<CoreWebVitalsReport> {
    return this.http.get<CoreWebVitalsReport>(
      `/crawl/${input.auditId}/core-web-vitals`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Internal Link Report (GAP-071): outbound/inbound internal link counts per
   * page, orphan pages, dead ends, and the click-depth distribution — for a
   * project's latest completed crawl, or a named earlier one.
   *
   * INTERNAL LINKS ONLY. External links are explicitly out of scope:
   * grouping pages by external domain, or an external link graph, needs data
   * this codebase does not collect (see GAP-081's own wont-fix decision).
   * `totals.externalLinkOccurrences` is the one external-facing number here —
   * a raw per-page outbound tally, never a graph.
   *
   * ALWAYS narrow on `report.state` first. `no_audit` and
   * `signal_not_captured` are both absences of measurement, never a clean
   * bill of health — the latter fires when a crawl predates the
   * inbound-link/click-depth columns, or link metrics were otherwise never
   * computed. `notDerivable` is returned with every state and lists what this
   * report can never compute from what is stored, and why.
   *
   * Free — reads from MisarSEO's own already-crawled state, charges no
   * credits, makes no external call. 404s when `auditId` is given but does
   * not name a completed audit for this project.
   */
  internalLinks(
    input: InternalLinkReportInput,
    options?: RequestOptions,
  ): Promise<InternalLinkReport> {
    return this.http.post<InternalLinkReport>(
      "/crawl/internal-links",
      input,
      options,
    );
  }

  /**
   * Structured Data Report (GAP-066): pages grouped by schema.org `@type`,
   * which pages have none, and which pages carry an unparseable JSON-LD
   * block — for a project's latest completed crawl, or a named earlier one.
   *
   * PRESENCE AND PARSE VALIDITY, NOT A RICH-RESULTS ELIGIBILITY CHECK.
   * Derives entirely from GAP-020's already-collected extraction — no new
   * crawl-time work. Only `typeGroups[].invalidCount` on the BreadcrumbList
   * group is a real, verified per-type validity verdict; every other type
   * reports only presence and page-level parse validity (never attributable
   * to one type when a page declares several).
   *
   * ALWAYS narrow on `report.state` first. `typeGroups: []` on an `analysed`
   * report means every page was measured and none declared any structured
   * data — a real finding, not a withheld section. `notDerivable` lists what
   * this report can never compute from what is stored, and why.
   *
   * Free — reads from MisarSEO's own already-crawled state, charges no
   * credits, makes no external call. 404s when `auditId` is given but does
   * not name a completed audit for this project.
   */
  structuredDataReport(
    input: StructuredDataReportInput,
    options?: RequestOptions,
  ): Promise<StructuredDataReport> {
    return this.http.post<StructuredDataReport>(
      "/crawl/structured-data-report",
      input,
      options,
    );
  }

  /**
   * HTTPS Report (GAP-065 + GAP-010 remainder): percentage of pages secure,
   * mixed-content and insecure-link counts, homepage HTTPS-path status, and
   * HTTP URLs in an HTTPS site's sitemap — for a project's latest completed
   * crawl, or a named earlier one.
   *
   * Derives entirely from already-computed crawl data — no new work at read
   * time. SOCKET-LEVEL TLS CHECKS STAY EXPLICITLY UNBUILT: expiring/expired
   * certificate, old security protocol, incorrect certificate name, and
   * subdomains without SNI/HSTS all need a real TLS handshake this
   * fetch-based crawler does not make. `notDerivable` lists these with the
   * reason, returned with every analysed report.
   *
   * `homepageStatus.redirectsToHttps` is null (not measured), never assumed
   * healthy, unless the standalone homepage-HTTPS fetch actually observed a
   * failure — the report cannot distinguish "checked and fine" from "never
   * checked" from stored issue rows alone, and does not guess.
   *
   * Free — reads from MisarSEO's own already-crawled state, charges no
   * credits, makes no external call. 404s when `auditId` is given but does
   * not name a completed audit for this project.
   */
  httpsReport(
    input: HttpsReportInput,
    options?: RequestOptions,
  ): Promise<HttpsReport> {
    return this.http.post<HttpsReport>("/crawl/https-report", input, options);
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
   * List a project's custom-issue rules.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listCustomIssueRules(
    input: ListCustomIssueRulesInput,
    options?: RequestOptions,
  ): Promise<ListCustomIssueRulesResponse> {
    return this.http.get<ListCustomIssueRulesResponse>(
      "/crawl/custom-issue-rules",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Define a new custom issue: one condition over an already-collected page
   * attribute (`field`/`operator`/`value`), optionally scoped by URL glob.
   * Every matching finding is reported as issue type `custom_issue`, with
   * this rule's own name/id attached so it groups separately from every
   * other custom rule. Requires the `admin` role.
   *
   * Rules apply when an audit is finalized, so a new rule affects the next
   * crawl rather than rewriting past ones.
   */
  createCustomIssueRule(
    input: CreateCustomIssueRuleInput,
    options?: RequestOptions,
  ): Promise<CreateCustomIssueRuleResponse> {
    return this.http.post<CreateCustomIssueRuleResponse>(
      "/crawl/custom-issue-rules",
      input,
      options,
    );
  }

  /** Delete a custom-issue rule. Requires the `admin` role. */
  deleteCustomIssueRule(
    input: DeleteCustomIssueRuleInput,
    options?: RequestOptions,
  ): Promise<DeleteCustomIssueRuleResponse> {
    return this.http.delete<DeleteCustomIssueRuleResponse>(
      "/crawl/custom-issue-rules",
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
