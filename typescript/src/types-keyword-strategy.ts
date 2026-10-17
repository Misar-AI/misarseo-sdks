/**
 * MisarSEO TypeScript SDK — Keyword Strategy Builder response types (GAP-097).
 * Split out of `types.ts` to keep that module readable, matching
 * `types-keyword-research.ts`'s own precedent.
 */

export interface KeywordStrategyInput {
  projectId: string;
  /** 1 to `MAX_BULK_KEYWORDS` (the same ceiling `/keywords/bulk` enforces). */
  keywords: string[];
  locationCode?: number;
  languageCode?: string;
}

/** Same shape `keywords.research()`'s rows use for volume/cpc/difficulty —
 * see `KeywordResearchRow` — but keyed by the plain keyword string; a
 * Strategy Builder cluster member was never necessarily saved. */
export interface KeywordStrategyClusterMember {
  savedKeywordId: string;
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
}

/**
 * Whether the project's own crawled pages already have something for this
 * cluster's topic. A text-match (title/URL contains every token of the
 * cluster's shared phrase), NOT a claim that the page verifiably RANKS for
 * the cluster's keywords — this codebase has no keyword-to-URL index.
 */
export type KeywordStrategyPageRecommendation =
  | { status: "existing"; url: string; title: string | null }
  | { status: "new" };

export interface KeywordStrategyBrief {
  titleSuggestions: string[];
  /** Section headings, in a sensible reading order. */
  outline: string[];
  keyPoints: string[];
  /** Derived locally from the topic phrase's own wording — a real signal,
   *  not an AI guess. */
  targetIntent:
    | "informational"
    | "commercial"
    | "transactional"
    | "navigational"
    | "unknown";
}

export interface KeywordStrategyCluster {
  /** The word or phrase every member contains, verbatim — the cluster's
   *  name and the topic the page/brief steps ran against. */
  sharedPhrase: string;
  phraseTokenCount: number;
  keywordCount: number;
  /** Sum of measured volumes only; null when not one member has a volume. */
  totalSearchVolume: number | null;
  keywordsWithVolume: number;
  keywordsWithoutVolume: number;
  difficultyMin: number | null;
  difficultyMax: number | null;
  keywordsWithDifficulty: number;
  keywordsWithoutDifficulty: number;
  topKeywordByVolume: string | null;
  members: KeywordStrategyClusterMember[];
  page: KeywordStrategyPageRecommendation;
  /** Null for a cluster beyond `briefLimit` — see `briefSkipped`, which says
   *  WHY, rather than leaving that to be inferred, or for a cluster whose
   *  brief generation itself failed (a real, logged failure, not silently
   *  substituted). */
  brief: KeywordStrategyBrief | null;
  /** True only when this cluster was beyond `briefLimit` and never reached
   *  the AI gateway at all — distinct from a `brief: null` caused by a
   *  generation failure on an attempted cluster. */
  briefSkipped: boolean;
}

export interface KeywordStrategyUngrouped {
  keywordCount: number;
  totalSearchVolume: number | null;
  keywordsWithVolume: number;
  keywordsWithoutVolume: number;
  difficultyMin: number | null;
  difficultyMax: number | null;
  keywordsWithDifficulty: number;
  keywordsWithoutDifficulty: number;
  topKeywordByVolume: string | null;
  members: KeywordStrategyClusterMember[];
}

export interface KeywordStrategyResult {
  locationCode: number;
  languageCode: string;
  /** Unique keywords actually looked up (post de-duplication). */
  totalKeywordsAnalyzed: number;
  clusters: KeywordStrategyCluster[];
  /** Keywords that matched no cluster — kept as a first-class part of the
   *  result rather than dropped. */
  ungrouped: KeywordStrategyUngrouped;
  clusterLimit: number;
  briefLimit: number;
  /** Set, with every volume null, when the bulk provider could not answer at
   *  all — clustering and page-matching still ran on keyword text alone. */
  unavailableReason: string | null;
  fetchedAt: string;
}
