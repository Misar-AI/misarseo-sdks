// Topic Research types, split out of types.ts to keep that file under the
// lint line budget (same pattern as types-cannibalisation.ts).
//
// Mirrors src/types/schemas/topicResearch.ts.

export interface TopicResearchInput {
  projectId: string;
  /** The seed keyword. */
  keyword: string;
  /** Defaults to the project's stored market, else 2840 (US). */
  locationCode?: number;
  /** Defaults to the project's stored market, else "en". */
  languageCode?: string;
}

/** Where one candidate idea came from — carried on every idea so a real PAA
 *  question is never blended, undifferentiated, with a raw autocomplete
 *  completion or a page title observed on the SERP. */
export type TopicIdeaSource =
  | "paa_question"
  | "autocomplete_suggestion"
  | "serp_title";

export interface TopicIdea {
  text: string;
  source: TopicIdeaSource;
  /** Only set for `source: "serp_title"` — the ranking page and its position. */
  sourceUrl: string | null;
  serpRank: number | null;
}

export interface TopicCluster {
  /** The shared phrase every member idea's text contains, verbatim. */
  topic: string;
  phraseTokenCount: number;
  ideaCount: number;
  ideas: TopicIdea[];
  sourceCounts: {
    paaQuestions: number;
    autocompleteSuggestions: number;
    serpTitles: number;
  };
}

export interface TopicResearchUngrouped {
  ideaCount: number;
  ideas: TopicIdea[];
}

export interface TopicResearchCoverage {
  serpResultsRead: number;
  /** True when the SERP could not be fetched at all — distinct from a
   *  genuine zero-organic-results answer. */
  serpUnavailable: boolean;
  questionsRead: number;
  suggestionsRead: number;
  /** True when both autocomplete sources failed to answer at all. */
  suggestionsUnavailable: boolean;
  totalIdeas: number;
}

export interface TopicResearchResult {
  seedKeyword: string;
  locationCode: number;
  languageCode: string;
  /** Biggest cluster first. */
  clusters: TopicCluster[];
  ungrouped: TopicResearchUngrouped;
  coverage: TopicResearchCoverage;
  fetchedAt: string;
}
