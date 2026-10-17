import type { HttpClient, RequestOptions } from "../http.js";
import type {
  ListPortfoliosResponse,
  CreatePortfolioInput,
  CreatePortfolioResponse,
  GetPortfolioInput,
  GetPortfolioResponse,
  RenamePortfolioInput,
  DeletePortfolioInput,
  PortfolioProjectsMutationInput,
  AddPortfolioProjectsResponse,
  MutationSuccess,
} from "../types.js";

/**
 * Portfolios (GAP-191) resource — group the org's own projects and view
 * their aggregate summary. Free: every method reads MisarSEO's own
 * Postgres, no upstream calls — see `GetPortfolioResponse`'s own docs for
 * what is (and, deliberately, is not) included in a member's card.
 */
export class PortfoliosResource {
  constructor(private readonly http: HttpClient) {}

  /** All portfolios in the caller's organization, each carrying `projectCount`. */
  list(options?: RequestOptions): Promise<ListPortfoliosResponse> {
    return this.http.get<ListPortfoliosResponse>(
      "/portfolios",
      undefined,
      options,
    );
  }

  /** Create a portfolio. Starts with no member projects — add them with `addProjects`. */
  create(
    input: CreatePortfolioInput,
    options?: RequestOptions,
  ): Promise<CreatePortfolioResponse> {
    return this.http.post<CreatePortfolioResponse>(
      "/portfolios",
      input,
      options,
    );
  }

  /**
   * One card per member project (same shape `dashboard.get()` returns) plus
   * aggregate totals.
   */
  get(
    input: GetPortfolioInput,
    options?: RequestOptions,
  ): Promise<GetPortfolioResponse> {
    return this.http.get<GetPortfolioResponse>(
      `/portfolios/${encodeURIComponent(input.portfolioId)}`,
      undefined,
      options,
    );
  }

  rename(
    input: RenamePortfolioInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.patch<MutationSuccess>(
      `/portfolios/${encodeURIComponent(input.portfolioId)}`,
      { name: input.name },
      options,
    );
  }

  /** Deletes the grouping only — member projects themselves are untouched. */
  delete(
    input: DeletePortfolioInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      `/portfolios/${encodeURIComponent(input.portfolioId)}`,
      undefined,
      options,
    );
  }

  /**
   * Only ids that resolve to a project of the CALLER'S organization are
   * added; any other id is silently dropped rather than erroring the whole
   * call — `added` counts what actually landed.
   */
  addProjects(
    input: PortfolioProjectsMutationInput,
    options?: RequestOptions,
  ): Promise<AddPortfolioProjectsResponse> {
    return this.http.post<AddPortfolioProjectsResponse>(
      `/portfolios/${encodeURIComponent(input.portfolioId)}/projects`,
      { projectIds: input.projectIds },
      options,
    );
  }

  /** Succeeds whether or not an id was actually a member. */
  removeProjects(
    input: PortfolioProjectsMutationInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      `/portfolios/${encodeURIComponent(input.portfolioId)}/projects`,
      { projectIds: input.projectIds },
      options,
    );
  }
}
