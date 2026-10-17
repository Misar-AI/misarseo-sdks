import type { HttpClient, RequestOptions } from "../http.js";
import type {
  ClassifyKeywordIntentInput,
  ClassifyKeywordIntentResult,
  KeywordGapInput,
  KeywordGapResult,
  KeywordPotential,
  KeywordPotentialInput,
  KeywordSerpOverview,
  KeywordSerpOverviewInput,
  KeywordListShareOfVoiceInput,
  KeywordListShareOfVoiceResult,
  KeywordStrategyInput,
  KeywordStrategyResult,
  ListSavedKeywordsInput,
  ListSavedKeywordsResponse,
  ResearchKeywordsInput,
  ResearchKeywordsResponse,
  SaveKeywordsInput,
  SaveKeywordsResponse,
  TopicResearchInput,
  TopicResearchResult,
} from "../types.js";

/**
 * The saved-keyword list filters travel as comma-separated values, and the
 * route refuses a parameter that is present but holds nothing usable —
 * `?tagNames=` is a 400, never "no filter". So an empty array is sent as
 * nothing at all rather than as an empty string.
 */
function commaList(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

/**
 * Keywords resource — research, save, list, and compare keywords.
 */
export class KeywordsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Research keyword data (search volume, difficulty, CPC, related ideas)
   * for 1–100 seed keywords in one call.
   * Charges credits per seed (~30–100 credits each).
   *
   * Resolves to ONE flat `rows` array for the whole request — there is no
   * per-seed grouping on the wire. This used to be declared as
   * `{ results: [{ seed, ok, topRows }] }`, which is the in-app MCP tool's
   * envelope and not this route's; `response.results` was `undefined` on every
   * successful call. Issue one request per seed if you need the split.
   *
   * Read `keywordDifficultySource` before showing the difficulty column, and
   * `diagnostics` before concluding a thin result means a thin niche.
   */
  research(
    input: ResearchKeywordsInput,
    options?: RequestOptions,
  ): Promise<ResearchKeywordsResponse> {
    return this.http.post<ResearchKeywordsResponse>(
      "/keywords/research",
      input,
      options,
    );
  }

  /**
   * List keywords saved to a project, with cached metrics.
   * Free — reads from MisarSEO database, charges no credits.
   *
   * Sends `tagNames` and `pageSize`. It used to send `tags` and `limit`, which
   * this route does not read: both were dropped and the caller got an
   * unfiltered first page back with a 200, so a narrow that matched nothing
   * looked exactly like one that matched everything.
   *
   * The route splits its query between `restSavedKeywordsQuerySchema` (paging
   * and sorting) and `parseSavedKeywordFilters` (the ten value filters). That
   * split is a server-side implementation detail — every name below is read by
   * one or the other, and the contract test checks against both.
   */
  listSaved(
    input: ListSavedKeywordsInput,
    options?: RequestOptions,
  ): Promise<ListSavedKeywordsResponse> {
    return this.http.get<ListSavedKeywordsResponse>(
      "/keywords/saved",
      {
        projectId: input.projectId,
        search: input.search,
        page: input.page,
        pageSize: input.pageSize,
        sort: input.sort,
        order: input.order,
        tagNames: commaList(input.tagNames),
        tagIds: commaList(input.tagIds),
        includeTerms: commaList(input.includeTerms),
        excludeTerms: commaList(input.excludeTerms),
        minVolume: input.minVolume,
        maxVolume: input.maxVolume,
        minCpc: input.minCpc,
        maxCpc: input.maxCpc,
        minDifficulty: input.minDifficulty,
        maxDifficulty: input.maxDifficulty,
      },
      options,
    );
  }

  /**
   * Save keywords to a project's saved-keywords list.
   * Free — charges no credits. Idempotent, so it is safe to pass
   * `{ idempotent: true }` and let the SDK retry it like a GET.
   *
   * Tags are APPENDED. There is no `tagMode` here because the route has never
   * read one — see {@link SaveKeywordsInput}.
   */
  save(
    input: SaveKeywordsInput,
    options?: RequestOptions,
  ): Promise<SaveKeywordsResponse> {
    return this.http.post<SaveKeywordsResponse>(
      "/keywords/saved",
      input,
      options,
    );
  }

  /**
   * Get the Parent Topic and Traffic Potential of one keyword, from real SERP
   * overlap across a bounded set (up to 5) of related keywords — see
   * {@link KeywordPotential} for why both figures are honest, bounded
   * estimates rather than a full reverse-index total.
   *
   * Free (no paid provider), but up to 7 upstream calls per cache miss (1 seed
   * SERP, up to 5 candidate SERPs, 1 batched volume lookup), each
   * independently cached — a deliberate per-keyword lookup rather than
   * something to run over a result set.
   */
  potential(
    input: KeywordPotentialInput,
    options?: RequestOptions,
  ): Promise<KeywordPotential> {
    return this.http.get<KeywordPotential>(
      "/keywords/potential",
      {
        projectId: input.projectId,
        keyword: input.keyword,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
      },
      options,
    );
  }

  /**
   * Per-keyword SERP overview (GAP-094): a fresh live SERP snapshot, plus —
   * when this exact keyword happens to already be tracked in this project's
   * rank tracking — its position history and volatility, read straight from
   * the SAME rank-tracking services `rankTracking.getKeywordHistory()` and
   * the volatility index already use. `tracked.isTracked: false` is an
   * honest "not tracked", never a fabricated trend.
   *
   * One upstream call (the live SERP fetch); the rank-tracking portion is
   * DB-only reads.
   */
  serpOverview(
    input: KeywordSerpOverviewInput,
    options?: RequestOptions,
  ): Promise<KeywordSerpOverview> {
    return this.http.get<KeywordSerpOverview>(
      "/keywords/serp-overview",
      {
        projectId: input.projectId,
        keyword: input.keyword,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
        sinceDays: input.sinceDays,
      },
      options,
    );
  }

  /**
   * Share of Voice across a saved keyword list (GAP-099): the project's own
   * domain plus up to 3 competitor domains, scored over a saved-keyword tag
   * (or every saved keyword when no tag is named). Reuses the EXACT SoV
   * computation `rankTracking`'s own GAP-107 Share of Voice already uses.
   *
   * Billable-adjacent: one live SERP fetch per keyword in the resolved
   * list (up to a bounded per-run cap — see `result.truncated`), each
   * cached 12h — unlike rank tracking's own SoV, a saved list carries no
   * stored positions to read for free.
   */
  listShareOfVoice(
    input: KeywordListShareOfVoiceInput,
    options?: RequestOptions,
  ): Promise<KeywordListShareOfVoiceResult> {
    return this.http.post<KeywordListShareOfVoiceResult>(
      "/keywords/list-share-of-voice",
      {
        projectId: input.projectId,
        tagId: input.tagId,
        tagName: input.tagName,
        competitorDomains: input.competitorDomains,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
      },
      options,
    );
  }

  /**
   * Keyword Strategy Builder (GAP-097): a volume -> cluster -> page -> brief
   * pipeline over a pasted keyword list, composed entirely from existing
   * pieces — the same bulk lookup `bulk.analyze()` uses, the same
   * phrase-clustering engine the saved-keyword Topic Clusters feature and
   * `topicResearch()` both already use, a text-match against the project's
   * own crawled pages, and a BOUNDED number of AI-gateway content-brief
   * calls (`result.briefLimit`, gated by the shared AI-gateway budget).
   *
   * `page.status: "existing"` means the site already has a page ABOUT that
   * topic, never a claim it verifiably ranks for the cluster's keywords.
   */
  strategy(
    input: KeywordStrategyInput,
    options?: RequestOptions,
  ): Promise<KeywordStrategyResult> {
    return this.http.post<KeywordStrategyResult>(
      "/keywords/strategy",
      {
        projectId: input.projectId,
        keywords: input.keywords,
        locationCode: input.locationCode,
        languageCode: input.languageCode,
      },
      options,
    );
  }

  /**
   * Classify 1-200 keywords' search intent from their wording —
   * informational/navigational/commercial/transactional/unknown (GAP-093).
   *
   * Free and purely local: no upstream call, no market dependency. Callable
   * on demand, independent of a research run — the same wording heuristic
   * `research()` already applies as its free-tier fallback, made directly
   * reachable for a keyword list that has no volume data yet.
   */
  classifyIntent(
    input: ClassifyKeywordIntentInput,
    options?: RequestOptions,
  ): Promise<ClassifyKeywordIntentResult> {
    return this.http.post<ClassifyKeywordIntentResult>(
      "/keywords/classify-intent",
      { projectId: input.projectId, keywords: input.keywords },
      options,
    );
  }

  /**
   * Compare the project's own domain against up to 3 competitor domains and
   * classify every keyword a competitor ranks for as missing / behind / tied /
   * ahead / unknown.
   *
   * Charges credits: one ranked-keywords lookup per domain, so a comparison
   * costs up to FOUR upstream requests (your domain plus up to 3 competitors).
   * Each is cached 12h, so re-sorting or re-filtering the same comparison costs
   * nothing extra.
   *
   * Your own domain comes from the project row — there is no field for it, by
   * design. Read `unavailable` before `rows`, and keep `missing` (a provable
   * absence) distinct from `unknown` (the keyword fell below the fetched slice,
   * so nothing was measured either way).
   */
  gap(
    input: KeywordGapInput,
    options?: RequestOptions,
  ): Promise<KeywordGapResult> {
    return this.http.post<KeywordGapResult>("/keywords/gap", input, options);
  }

  /**
   * Content ideas for a seed keyword, composed from three sources this
   * codebase already fetches for other features — the SERP for the seed,
   * PAA-style questions, and autocomplete suggestions — then grouped into
   * topic clusters by shared phrasing.
   *
   * FREE: none of the three sources is billable in this codebase today.
   * Three real upstream calls per request, so it is rate limited like the
   * other compound research endpoints (`research`, `gap`).
   *
   * Not a Keywords-Explorer-style overlap: `clusters` group the REAL text of
   * three observed sources, never a fabricated "what else these pages rank
   * for" (this codebase has no keyword-to-URL index to answer that from).
   * `coverage.serpUnavailable` / `suggestionsUnavailable` distinguish a
   * source that could not be asked at all from one that genuinely had
   * nothing to say.
   */
  topicResearch(
    input: TopicResearchInput,
    options?: RequestOptions,
  ): Promise<TopicResearchResult> {
    return this.http.post<TopicResearchResult>(
      "/keywords/topic-research",
      input,
      options,
    );
  }
}
