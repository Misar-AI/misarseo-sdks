import type { HttpClient, RequestOptions } from "../http.js";
import type {
  FindSerpCompetitorsInput,
  FindSerpCompetitorsResponse,
} from "../types.js";

/**
 * Competitors resource — SERP competitor discovery for a keyword set.
 */
export class CompetitorsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Find domains competing for a set of keywords in Google's SERPs, with
   * per-domain average/median position and keyword coverage.
   * Charges credits (~1 SERP fetch per keyword).
   */
  find(
    input: FindSerpCompetitorsInput,
    options?: RequestOptions,
  ): Promise<FindSerpCompetitorsResponse> {
    return this.http.post<FindSerpCompetitorsResponse>(
      "/competitors",
      input,
      options,
    );
  }
}
