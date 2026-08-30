import type { HttpClient, RequestOptions } from "../http.js";
import type {
  BusinessListingsInput,
  BusinessListingsResponse,
  QuestionsAnswersInput,
  QuestionsAnswersResponse,
} from "../types.js";

/**
 * Local resource — local business listings and Google Business Q&A near a
 * coordinate.
 */
export class LocalResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Search local business listings near a coordinate. Free-mode: real
   * OpenStreetMap data (Overpass/Nominatim). Paid mode (`SEO_DATA_PROVIDER=dataforseo`):
   * DataForSEO Business Data. Charges credits in paid mode.
   */
  businessListings(
    input: BusinessListingsInput,
    options?: RequestOptions,
  ): Promise<BusinessListingsResponse> {
    return this.http.post<BusinessListingsResponse>(
      "/local/business-listings",
      input,
      options,
    );
  }

  /**
   * Fetch Google Business Profile questions and answers for one business
   * keyword near a coordinate. Free-mode: real Google/Bing autocomplete
   * completions reframed as questions. Paid mode: DataForSEO Business Data
   * Q&A. Charges credits in paid mode.
   */
  questionsAnswers(
    input: QuestionsAnswersInput,
    options?: RequestOptions,
  ): Promise<QuestionsAnswersResponse> {
    return this.http.post<QuestionsAnswersResponse>(
      "/local/questions-answers",
      input,
      options,
    );
  }
}
