/**
 * Plan/credit/quota usage transparency (GAP-197) types.
 */

/** `"none"`: the organization has no active plan (there is no free plan). */
export type PlanTier = "none" | "pro" | "business" | "enterprise";

export interface QuotaUsage {
  /** `null` means NOT TRACKED (an unlimited-tier counter is never written), never a real zero. */
  used: number | null;
  /** `null` means unlimited. */
  limit: number | null;
  /** `null` when unlimited — nothing periodic is being counted. */
  resetsAt: string | null;
}

export interface UsageQuotas {
  keywordLookupsPerDay: QuotaUsage;
  auditsPerMonth: QuotaUsage;
  aiBrandRadarScansPerMonth: QuotaUsage;
  logFileUploadsPerMonth: QuotaUsage;
}

export interface UsageCounts {
  projects: QuotaUsage;
  rankTrackedKeywords: QuotaUsage;
  apiKeys: QuotaUsage;
}

export interface GetUsageResponse {
  /** Whether this deployment enforces MisarSEO's own plan tiers at all. */
  gatingActive: boolean;
  tier: PlanTier | null;
  /** `null` means the ledger could not be read — never a balance of zero. */
  creditsRemaining: number | null;
  /** `null` when `gatingActive` is false — no plan to report quotas against. */
  quotas: UsageQuotas | null;
  /** Point-in-time counts — always populated, independent of `gatingActive`. */
  counts: UsageCounts;
  /**
   * The shared platform AI-gateway key's own monthly ceiling — a
   * platform-abuse ceiling, NOT a plan entitlement, always populated
   * independent of `gatingActive`.
   */
  aiGatewayOps: QuotaUsage;
}
