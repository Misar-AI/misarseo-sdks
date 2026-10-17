import type { HttpClient, RequestOptions } from "../http.js";
import type {
  CreateProjectInput,
  DeleteProjectInput,
  GetProjectInput,
  ListProjectsResponse,
  MutationSuccess,
  ProjectResponse,
  UpdateProjectInput,
} from "../types.js";

/**
 * Projects resource — list, inspect, update, and archive MisarSEO projects.
 */
export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all non-archived projects in the authenticated organization,
   * creating the "Default" project if the org has none.
   * Free — charges no credits.
   *
   * Every method here resolves a {@link Project} of exactly four fields:
   * `id`, `name`, `domain` and `createdAt`. There is no `url` — the SDK
   * declared one as optional and nothing has ever populated it.
   */
  list(options?: RequestOptions): Promise<ListProjectsResponse> {
    return this.http.get<ListProjectsResponse>("/projects", undefined, options);
  }

  /** Create a new project. */
  create(
    input: CreateProjectInput,
    options?: RequestOptions,
  ): Promise<ProjectResponse> {
    return this.http.post<ProjectResponse>("/projects", input, options);
  }

  /** Get a single project by ID. */
  get(
    input: GetProjectInput,
    options?: RequestOptions,
  ): Promise<ProjectResponse> {
    return this.http.get<ProjectResponse>(
      `/projects/${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }

  /**
   * Update a project's name and/or domain.
   * At least one of `name` or `domain` must be provided. Explicit `null` for
   * `domain` clears it; an omitted key leaves the current value unchanged.
   */
  update(
    input: UpdateProjectInput,
    options?: RequestOptions,
  ): Promise<ProjectResponse> {
    const { projectId, ...body } = input;
    return this.http.patch<ProjectResponse>(
      `/projects/${encodeURIComponent(projectId)}`,
      body,
      options,
    );
  }

  /** Archive (soft-delete) a project. A user's last remaining project can't be archived. */
  delete(
    input: DeleteProjectInput,
    options?: RequestOptions,
  ): Promise<MutationSuccess> {
    return this.http.delete<MutationSuccess>(
      `/projects/${encodeURIComponent(input.projectId)}`,
      undefined,
      options,
    );
  }
}
