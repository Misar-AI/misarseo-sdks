/**
 * MisarSEO TypeScript SDK — keyword-research response types.
 *
 * Split out of `types.ts` to keep that module readable; these describe what
 * `POST /keywords/research` actually returns, which is
 * `KeywordResearchService.research()`'s result passed to `jsonOk` verbatim.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 * `ResearchKeywordsResponse` used to be `{ results: KeywordResearchResult[] }`,
 * a per-seed envelope with `seed` / `ok` / `rowCount` / `topRows` on each entry.
 * NO ROUTE HAS EVER RETURNED THAT. It is the output schema of the IN-APP MCP
 * tool `research_keywords` (`src/server/mcp/tools/research-keywords.ts`), which
 * calls the service once per seed itself and assembles that envelope in the
 * tool handler. The REST route calls the service ONCE, for the whole keyword
 * list, and returns its single result. So `response.results` was `undefined`
 * on every successful call, and the SDK's own test mocked `{ results: [] }` —
 * a third shape, produced by nothing — so it agreed with itself.
 *
 * This is the same defect as the old `GetRankTrackerResponse`: a published
 * response type inferred from an MCP tool definition and then pointed at a REST
 * route that answers something else entirely.
 */

/** One month of a keyword's search-volume history. */
export interface KeywordMonthlySearch {
  year: number;
  /** 1–12. */
  month: number;
  searchVolume: number;
}

/**
 * Where the returned rows actually came from.
 *
 * A literal union rather than `string`, unlike `AuditIssueType` on a response:
 * this is not read back out of a stored row that could predate a vocabulary
 * change. It is set in-process from a closed set on a live fetch, and the
 * cached form is re-validated against the same `z.enum` on every read — an
 * entry naming a source outside this list fails that parse and is refetched, so
 * it cannot reach the wire. `google_ads` is not requestable as a mode; it is the
 * automatic source for countries the Labs endpoints do not serve.
 */
export type KeywordResearchSource =
  | "related"
  | "suggestions"
  | "ideas"
  | "google_ads";

/** The mode that was requested, before any fallback. */
export type KeywordResearchMode = "auto" | "related" | "suggestions" | "ideas";

/**
 * Which provider backed the difficulty column. See
 * {@link ResearchKeywordsResponse.keywordDifficultySource} — reading this and
 * labelling the figure is not optional.
 *
 * `openpagerank` and `tranco` are free-mode APPROXIMATIONS: the mean link-graph
 * authority, or the mean popularity rank, of the domains currently in the top
 * 10. `dataforseo` is the paid provider's own published keyword-difficulty
 * metric, passed through unchanged. Describing one as the other is the mistake
 * this field exists to prevent, in both directions.
 */
export type KeywordDifficultySource = "openpagerank" | "tranco" | "dataforseo";

/** One keyword returned by research. */
export interface KeywordResearchRow {
  keyword: string;
  /** Null when no configured source measured a volume — never 0 as a stand-in. */
  searchVolume: number | null;
  /** Volume history, oldest first. Empty when the provider carried none. */
  trend: KeywordMonthlySearch[];
  /** 0–100. Null when nothing derived one. Read `keywordDifficultySource`. */
  keywordDifficulty: number | null;
  cpc: number | null;
  /** 0–1 advertiser competition, null when unmeasured. */
  competition: number | null;
  /**
   * Search intent. A closed union here — the service classifies it in-process
   * (`classifyIntentFromText`) or normalises the provider's value into this set
   * before it ever leaves. Contrast `Keyword.intent` on the SAVED-keyword list,
   * which is `string | null` because that one is a raw Postgres text column
   * whose stored values can predate any change to this list.
   */
  intent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational"
    | "unknown";
}

/** One source the service tried, in the order it tried them. */
export interface KeywordResearchSourceAttempt {
  source: KeywordResearchSource;
  rowCount: number;
  /** Rows that were not the seed itself — what "auto" judges coverage on. */
  nonSeedCount: number;
}

/**
 * Why these rows came from this source. Present on every response: it is what
 * distinguishes "this source genuinely has little for your seed" from "the
 * preferred source returned nothing and we fell back".
 */
export interface KeywordResearchDiagnostics {
  requestedMode: KeywordResearchMode;
  /** Non-seed rows a source had to produce for `auto` to stop there. */
  threshold: number;
  sourceAttempts: KeywordResearchSourceAttempt[];
}

/**
 * `POST /keywords/research` response — the service result, verbatim.
 *
 * There is no per-seed grouping on the wire. One call researches the whole
 * `keywords` list against one market and returns one flat `rows` array; if you
 * need results attributed per seed, issue one request per seed.
 */
export interface ResearchKeywordsResponse {
  rows: KeywordResearchRow[];
  /** The source the returned rows came from, after any fallback. */
  source: KeywordResearchSource;
  /** True when `source` is not what `diagnostics.requestedMode` asked for. */
  usedFallback: boolean;
  diagnostics: KeywordResearchDiagnostics;
  /**
   * Which provider backed the difficulty figures, or null when nothing said.
   * Surface it: with Open PageRank unkeyed (the documented default) the
   * difficulty is an average of *Tranco popularity* ranks, not link-graph
   * authority, and presenting that as "ranking difficulty" unlabelled overstates
   * SERPs dominated by large general sites. On the paid provider it is
   * `dataforseo` — the vendor's own metric, which is equally not an authority
   * average and equally must not be described as one.
   */
  keywordDifficultySource: KeywordDifficultySource | null;
  /**
   * True when keyword discovery could not run at all — no source is configured
   * for this deployment, or the configured one did not answer.
   *
   * Check it before treating `rows` as a finding. An empty `rows` with
   * `unavailable: false` means the seed genuinely expands to nothing; an empty
   * `rows` with `unavailable: true` means nobody looked, and presenting it as
   * "no keyword opportunities" would be a claim with no measurement behind it.
   */
  unavailable?: boolean;
  /** Which upstream failed and why, when `unavailable` is true. */
  unavailableReason?: string | null;
}
