import type { HttpClient, RequestOptions } from "../http.js";
import type {
  GbpAvailableLocationsResponse,
  GbpConnection,
  GbpConnectionResponse,
  GbpCreatePostInput,
  GbpCreatePostResponse,
  GbpOptimizationResult,
  GbpPerformanceInput,
  GbpPerformanceResponse,
  GbpPostsResponse,
  GbpProfileResponse,
  GbpReviewReplyInput,
  GbpReviewReplyResponse,
  GbpReviewsResponse,
  LinkGbpLocationInput,
} from "../types.js";

/**
 * Google Business Profile resource — connection management, profile, daily
 * performance metrics, reviews, posts, and AI-grounded optimization
 * recommendations (GAP-151, GAP-152, GAP-155).
 *
 * Requires the OPERATOR to have configured a Business Profile OAuth
 * credential on the MisarSEO deployment (`GOOGLE_BUSINESS_PROFILE_CLIENT_ID`
 * / `_CLIENT_SECRET` / `_REFRESH_TOKEN`) — every method here 401s with
 * `AUTH_CONFIG_MISSING` on a deployment that has not set one up.
 */
export class GoogleBusinessProfileResource {
  constructor(private readonly http: HttpClient) {}

  /** Every account + location the operator credential can manage, for a
   *  "link a location" picker. Not project-scoped data. */
  availableLocations(
    projectId: string,
    options?: RequestOptions,
  ): Promise<GbpAvailableLocationsResponse> {
    return this.http.get<GbpAvailableLocationsResponse>(
      "/gbp/accounts",
      { projectId },
      options,
    );
  }

  /** The project's current link, or `{ connection: null }`. */
  getConnection(
    projectId: string,
    options?: RequestOptions,
  ): Promise<GbpConnectionResponse> {
    return this.http.get<GbpConnectionResponse>(
      "/gbp/connection",
      { projectId },
      options,
    );
  }

  /** Link (or repoint) the project's GBP location. */
  link(
    input: LinkGbpLocationInput,
    options?: RequestOptions,
  ): Promise<{ connection: GbpConnection }> {
    return this.http.post<{ connection: GbpConnection }>(
      "/gbp/connection",
      input,
      options,
    );
  }

  /** Remove the project's GBP link. */
  unlink(projectId: string, options?: RequestOptions): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>(
      "/gbp/connection",
      { projectId },
      options,
    );
  }

  /** The linked location's profile — hours, categories, phone, website,
   *  description, and attribute completeness. Fetched live from Google. */
  getProfile(
    projectId: string,
    options?: RequestOptions,
  ): Promise<GbpProfileResponse> {
    return this.http.get<GbpProfileResponse>(
      "/gbp/profile",
      { projectId },
      options,
    );
  }

  /** Daily performance metrics for the linked location over an inclusive
   *  date range. `metrics` must be real `DailyMetric` values. */
  getPerformance(
    input: GbpPerformanceInput,
    options?: RequestOptions,
  ): Promise<GbpPerformanceResponse> {
    return this.http.get<GbpPerformanceResponse>(
      "/gbp/performance",
      {
        projectId: input.projectId,
        metrics: input.metrics.join(","),
        startDate: input.startDate,
        endDate: input.endDate,
      },
      options,
    );
  }

  /** Reviews for the linked location, one Google-paginated page at a time. */
  listReviews(
    input: { projectId: string; pageToken?: string },
    options?: RequestOptions,
  ): Promise<GbpReviewsResponse> {
    return this.http.get<GbpReviewsResponse>(
      "/gbp/reviews",
      { projectId: input.projectId, pageToken: input.pageToken },
      options,
    );
  }

  /** Reply to (or overwrite the reply on) one review. */
  replyToReview(
    input: GbpReviewReplyInput,
    options?: RequestOptions,
  ): Promise<GbpReviewReplyResponse> {
    return this.http.post<GbpReviewReplyResponse>(
      "/gbp/review-reply",
      input,
      options,
    );
  }

  /** Remove a previously posted reply. */
  deleteReviewReply(
    input: { projectId: string; reviewId: string },
    options?: RequestOptions,
  ): Promise<{ ok: true }> {
    return this.http.delete<{ ok: true }>("/gbp/review-reply", input, options);
  }

  /** Posts published on the linked location. */
  listPosts(
    projectId: string,
    options?: RequestOptions,
  ): Promise<GbpPostsResponse> {
    return this.http.get<GbpPostsResponse>(
      "/gbp/posts",
      { projectId },
      options,
    );
  }

  /** Publish a new "What's New" post immediately — there is no draft state. */
  createPost(
    input: GbpCreatePostInput,
    options?: RequestOptions,
  ): Promise<GbpCreatePostResponse> {
    return this.http.post<GbpCreatePostResponse>("/gbp/posts", input, options);
  }

  /**
   * GBP Optimization / "GBP AI Agent" (GAP-155). Charges one AI-gateway
   * operation against the organization's shared monthly ceiling — see
   * `ai-gateway-budget.ts`. The `score` is deterministic; only
   * `recommendations` comes from the model.
   */
  getOptimization(
    projectId: string,
    options?: RequestOptions,
  ): Promise<GbpOptimizationResult> {
    return this.http.post<GbpOptimizationResult>(
      "/gbp/optimization",
      { projectId },
      options,
    );
  }
}
