import type { HttpClient, RequestOptions } from "../http.js";
import type {
  GetLogHitDailySummaryInput,
  GetLogHitDailySummaryResponse,
  GetLogHitTopPathsInput,
  GetLogHitTopPathsResponse,
  GetLogUploadInput,
  GetLogUploadResponse,
  ListLogUploadsInput,
  ListLogUploadsResponse,
  UploadLogFileInput,
  UploadLogFileResponse,
} from "../types.js";

/**
 * Log File Analyzer / Bot Analytics resource — upload a server access log
 * (Apache/Nginx Combined Log Format) and read back the aggregate bot-traffic
 * report it produces once background parsing completes.
 */
export class LogAnalyzerResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * A project's log uploads and their parse status.
   * Free — reads from MisarSEO state, charges no credits.
   */
  listUploads(
    input: ListLogUploadsInput,
    options?: RequestOptions,
  ): Promise<ListLogUploadsResponse> {
    return this.http.get<ListLogUploadsResponse>(
      "/log-analyzer/uploads",
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Upload a server access log for background parsing. Only Apache/Nginx
   * Combined Log Format is supported. Requires the `admin` role. Poll
   * {@link getUpload} for status — parsing runs in the background, so this
   * resolves once the upload is stored, before it is fully processed.
   */
  upload(
    input: UploadLogFileInput,
    options?: RequestOptions,
  ): Promise<UploadLogFileResponse> {
    return this.http.post<UploadLogFileResponse>(
      "/log-analyzer/uploads",
      input,
      options,
    );
  }

  /**
   * One log upload's parse status and counts.
   * Free — reads from MisarSEO state, charges no credits.
   */
  getUpload(
    input: GetLogUploadInput,
    options?: RequestOptions,
  ): Promise<GetLogUploadResponse> {
    return this.http.get<GetLogUploadResponse>(
      `/log-analyzer/uploads/${input.uploadId}`,
      { projectId: input.projectId },
      options,
    );
  }

  /**
   * Bot hits per day/bot/status-code/content-type across every upload in the
   * range — powers a time-series, status-code, or content-type view.
   * Free — reads from MisarSEO state, charges no credits.
   */
  dailySummary(
    input: GetLogHitDailySummaryInput,
    options?: RequestOptions,
  ): Promise<GetLogHitDailySummaryResponse> {
    return this.http.get<GetLogHitDailySummaryResponse>(
      "/log-analyzer/daily-summary",
      {
        projectId: input.projectId,
        sinceDay: input.sinceDay,
        untilDay: input.untilDay,
      },
      options,
    );
  }

  /**
   * The busiest paths by bot hit count, optionally filtered to one bot
   * category.
   * Free — reads from MisarSEO state, charges no credits.
   */
  topPaths(
    input: GetLogHitTopPathsInput,
    options?: RequestOptions,
  ): Promise<GetLogHitTopPathsResponse> {
    return this.http.get<GetLogHitTopPathsResponse>(
      "/log-analyzer/top-paths",
      {
        projectId: input.projectId,
        botCategory: input.botCategory ?? undefined,
      },
      options,
    );
  }
}
