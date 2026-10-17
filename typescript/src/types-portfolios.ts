/**
 * Portfolios (GAP-191) types — group the org's own projects and view their
 * aggregate summary.
 */
import type {
  ProjectDashboardAudit,
  ProjectDashboardRankTracking,
  ProjectDashboardWebAnalytics,
} from "./types-dashboard.js";

export interface Portfolio {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  projectCount: number;
}

export interface ListPortfoliosResponse {
  portfolios: Portfolio[];
}

export interface CreatePortfolioInput {
  name: string;
}

export interface CreatePortfolioResponse {
  id: string;
}

export interface GetPortfolioInput {
  portfolioId: string;
}

export interface PortfolioMemberProject {
  projectId: string;
  name: string;
  domain: string | null;
  audit: ProjectDashboardAudit | null;
  rankTracking: ProjectDashboardRankTracking | null;
  webAnalytics: ProjectDashboardWebAnalytics | null;
}

export interface GetPortfolioResponse {
  id: string;
  name: string;
  projects: PortfolioMemberProject[];
  totals: {
    /** Averaged over member projects that HAVE been audited — an
     *  un-audited member does not drag this toward zero. Null when none
     *  have. */
    averageHealthScore: number | null;
    totalActiveTrackers: number;
    /** Summed trailing-7-day web-analytics sessions across every member. */
    totalSessions: number;
  };
}

export interface RenamePortfolioInput {
  portfolioId: string;
  name: string;
}

export interface DeletePortfolioInput {
  portfolioId: string;
}

export interface PortfolioProjectsMutationInput {
  portfolioId: string;
  projectIds: string[];
}

export interface AddPortfolioProjectsResponse {
  /** How many of the supplied ids were actually added — ids that don't
   *  resolve to a project of the caller's own organization are silently
   *  dropped rather than erroring the whole call. */
  added: number;
}
