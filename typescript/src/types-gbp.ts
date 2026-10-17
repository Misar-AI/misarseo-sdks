/**
 * Google Business Profile types (GAP-151/GAP-152/GAP-155). Split out of
 * `types.ts` the same way `types-rank-tracking.ts` was — one file per
 * resource with enough shapes to be worth its own file.
 */

export interface GbpLocationProfile {
  /** `locations/{id}` resource name, verbatim. */
  name: string;
  title: string | null;
  storeCode: string | null;
  primaryPhone: string | null;
  additionalPhoneCount: number;
  primaryCategory: string | null;
  additionalCategories: string[];
  address: {
    lines: string[];
    locality: string | null;
    administrativeArea: string | null;
    postalCode: string | null;
    regionCode: string | null;
  } | null;
  websiteUri: string | null;
  regularHoursPeriodCount: number;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export interface GbpDiscoveredAccount {
  /** `accounts/{id}` resource name, verbatim. */
  name: string;
  accountName: string | null;
  locations: GbpLocationProfile[];
}

export interface GbpAvailableLocationsResponse {
  accounts: GbpDiscoveredAccount[];
}

export interface GbpConnection {
  id: string;
  projectId: string;
  googleAccountId: string;
  googleLocationId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GbpConnectionResponse {
  connection: GbpConnection | null;
}

export interface LinkGbpLocationInput {
  projectId: string;
  googleAccountId: string;
  googleLocationId: string;
}

export interface GbpAttribute {
  name: string;
  valueType: string | null;
  isSet: boolean;
}

export interface GbpProfileResponse {
  location: GbpLocationProfile;
  attributes: GbpAttribute[];
}

export interface GbpPerformanceInput {
  projectId: string;
  /** Real `DailyMetric` enum values — see `GBP_DAILY_METRICS`. */
  metrics: string[];
  /** Inclusive ISO date, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
}

export interface GbpMetricSeries {
  metric: string;
  points: { date: string; value: number }[];
}

export interface GbpPerformanceResponse {
  series: GbpMetricSeries[];
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewerDisplayName: string | null;
  isAnonymous: boolean;
  starRating: string | null;
  comment: string | null;
  createTime: string | null;
  updateTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

export interface GbpReviewsResponse {
  reviews: GbpReview[];
  averageRating: number | null;
  totalReviewCount: number | null;
  nextPageToken: string | null;
}

export interface GbpReviewReplyInput {
  projectId: string;
  reviewId: string;
  comment: string;
}

export interface GbpReviewReplyResponse {
  reply: { comment: string; updateTime: string | null };
}

export interface GbpLocalPost {
  name: string;
  languageCode: string | null;
  summary: string | null;
  topicType: string | null;
  state: string | null;
  createTime: string | null;
  updateTime: string | null;
  searchUrl: string | null;
}

export interface GbpPostsResponse {
  posts: GbpLocalPost[];
}

export interface GbpCreatePostInput {
  projectId: string;
  summary: string;
  languageCode?: string;
}

export interface GbpCreatePostResponse {
  post: GbpLocalPost;
}

export interface GbpOptimizationRecommendation {
  priority: "high" | "medium" | "low";
  category: string;
  recommendation: string;
}

export interface GbpOptimizationResult {
  /** 0-100 heuristic completeness checklist score — see
   *  `gbpCompletenessScore.ts`'s own docblock for why this is deterministic,
   *  not AI-generated. */
  score: number;
  breakdown: { label: string; points: number; maxPoints: number }[];
  summary: string;
  recommendations: GbpOptimizationRecommendation[];
  facts: {
    descriptionLength: number;
    hasPrimaryCategory: boolean;
    additionalCategoryCount: number;
    hasPhone: boolean;
    hasWebsite: boolean;
    regularHoursPeriodCount: number;
    attributesSetCount: number;
    photoCount: number;
    postsLast90Days: number;
  };
}
