/**
 * MisarSEO TypeScript SDK — Log File Analyzer / Bot Analytics types.
 *
 * A log upload is parsed in the background into AGGREGATE counts only — no
 * raw per-line data is ever returned by this API (see
 * docs/reference/misarseo-gap-register.md's Log File Analyzer / Bot Analytics
 * rows for why: a busy site's log can be millions of lines, and nothing here
 * needs per-line granularity).
 */

export type LogUploadStatus = "queued" | "parsing" | "completed" | "failed";

export interface LogUpload {
  id: string;
  projectId: string;
  fileName: string;
  sizeBytes: number;
  status: LogUploadStatus;
  /** The file's true total line count, uncapped by any plan-tier limit. */
  lineCount: number | null;
  /**
   * Parsed successfully, out of only the plan-tier-capped subset actually
   * read. `parsedLineCount + skippedLineCount < lineCount` means the cap was
   * hit, not that the extra lines were unparseable.
   */
  parsedLineCount: number | null;
  skippedLineCount: number | null;
  errorMessage: string | null;
  createdByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ListLogUploadsInput {
  projectId: string;
}

export interface ListLogUploadsResponse {
  uploads: LogUpload[];
}

export interface UploadLogFileInput {
  projectId: string;
  fileName: string;
  /** Raw Apache/Nginx Combined Log Format text. */
  content: string;
}

export type UploadLogFileResponse = LogUpload;

export interface GetLogUploadInput {
  projectId: string;
  uploadId: string;
}

export type GetLogUploadResponse = LogUpload;

/**
 * "ai_crawler" — the same curated token list the audit engine's robots.txt
 * check uses (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).
 * "search_engine" — Googlebot, Bingbot, YandexBot, DuckDuckBot, Baiduspider.
 * "other_bot" — any other bot-shaped User-Agent.
 */
export type BotCategory = "ai_crawler" | "search_engine" | "other_bot";

/** "html" | "image" | "script" | "style" | "other" — a coarse bucket, not a MIME type. */
export type ContentTypeBucket = "html" | "image" | "script" | "style" | "other";

export interface LogHitDailySummaryRow {
  id: string;
  projectId: string;
  /** ISO date (YYYY-MM-DD), UTC. */
  day: string;
  botCategory: BotCategory;
  botLabel: string;
  statusCode: number;
  contentType: ContentTypeBucket;
  hitCount: number;
}

export interface GetLogHitDailySummaryInput {
  projectId: string;
  /** ISO date, inclusive. */
  sinceDay: string;
  /** ISO date, inclusive. */
  untilDay: string;
}

export interface GetLogHitDailySummaryResponse {
  rows: LogHitDailySummaryRow[];
}

export interface LogHitPathSummaryRow {
  id: string;
  projectId: string;
  botCategory: BotCategory;
  botLabel: string;
  path: string;
  statusCode: number;
  hitCount: number;
  lastSeenAt: string;
}

export interface GetLogHitTopPathsInput {
  projectId: string;
  /** Omit for every bot category. */
  botCategory?: BotCategory | null;
}

export interface GetLogHitTopPathsResponse {
  paths: LogHitPathSummaryRow[];
}
