// Prompt Research types, split out of types.ts to keep that file under the
// lint line budget (same pattern as types-topic-research.ts).
//
// Mirrors src/types/schemas/promptResearch.ts. NOT "prompt volume" — see that
// file's own docblock for why no honest volume/difficulty number exists for
// arbitrary natural-language prompts, and what this composes instead.

export interface PromptResearchInput {
  projectId: string;
  /** The seed topic used to discover candidate prompts. */
  seedTopic: string;
  /** Defaults to "en". Prompts carry no location dimension in this product. */
  languageCode?: string;
}

/** The same five-value taxonomy keyword research's intent classifier uses —
 *  see `promptIntent.ts` server-side for why prompts needed their own
 *  adaptation of that classifier rather than a straight reuse. */
export type PromptIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | "unknown";

export type PromptCandidateSource = "autocomplete_derived";

export interface PromptCandidate {
  text: string;
  source: PromptCandidateSource;
  intent: PromptIntent;
  /** Whether this exact prompt text already matches one of this project's
   *  tracked prompts (GAP-144) — a real, derived fact. */
  alreadyTracked: boolean;
}

export interface TrackedPromptSignal {
  trackedPromptId: string;
  prompt: string;
  brandTarget: string;
  /** The most recent scheduled check's date (GAP-144). */
  checkedOn: string;
  mentionedByCount: number;
  citedByCount: number;
  successfulModelCount: number;
  /** `mentionedByCount / successfulModelCount` from the latest check, or
   *  `null` when that check had zero successful models. NEVER "search
   *  volume" — an observed AI-answer mention rate over models actually
   *  checked, nothing more. */
  observedMentionRate: number | null;
}

export interface PromptResearchResult {
  seedTopic: string;
  languageCode: string;
  /** Real PAA-style prompt candidates for the seed topic. Empty is a
   *  legitimate answer, never an error. */
  candidates: PromptCandidate[];
  /** This project's tracked prompts (GAP-144), ranked by observed mention
   *  rate, most-present first. Empty until at least one prompt has been
   *  tracked and checked at least once. */
  observedSignals: TrackedPromptSignal[];
  fetchedAt: string;
}
