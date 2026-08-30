import type { HttpClient, RequestOptions } from "../http.js";
import { iterateOffsetPages } from "../pagination.js";
import type {
  AnchorRow,
  BacklinksAnchorsInput,
  BacklinksAnchorsPage,
  BacklinksInput,
  BacklinkProfile,
  LinkIntersectInput,
  LinkIntersectResult,
} from "../types.js";

/**
 * Backlinks resource — domain and page backlink profiles.
 */
export class BacklinksResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get a backlinks profile summary — totals, spam scores and the daily
   * trend series for the target.
   * Charges credits (~200–500 typical).
   *
   * It does NOT return a list of referring domains, despite the summary
   * counting them. The response type promised `result.referringDomains.rows`
   * as a required field; the route answers `{ overview }` alone, so that read
   * threw a TypeError after a billed request. See {@link BacklinkProfile}.
   *
   * On the free data provider this endpoint answers **501
   * `SEO_DATA_UNAVAILABLE`**, not a 200 carrying an `unavailable` flag the way
   * {@link intersect} does — backlink graphs need a proprietary crawl index.
   * Catch `MisarSeoError` and check `code`; there is no field on the success
   * type to inspect, because there is no success response in that mode.
   *
   * There is no spam filter on this call. One used to be offered as
   * `hideSpam` and never did anything — see {@link BacklinksInput} — so it is
   * gone rather than left as a control that reads as though it works.
   */
  overview(
    input: BacklinksInput,
    options?: RequestOptions,
  ): Promise<BacklinkProfile> {
    return this.http.get<BacklinkProfile>(
      "/backlinks",
      {
        projectId: input.projectId,
        target: input.target,
        scope: input.scope,
      },
      options,
    );
  }

  /**
   * Get one page of the anchor-text distribution for a target — what the web
   * collectively calls the site, rather than what any one link says.
   * Charges credits (~200–500 typical).
   *
   * `totalCount` is `number | null`: the provider does not always report a
   * total, and `null` means "not reported", never zero. Use `hasMore` to page.
   *
   * Unavailable on the free provider for the same reason as {@link overview},
   * and in the same way — a 501, not an `unavailable` field on a 200.
   */
  anchors(
    input: BacklinksAnchorsInput,
    options?: RequestOptions,
  ): Promise<BacklinksAnchorsPage> {
    return this.http.get<BacklinksAnchorsPage>(
      "/backlinks/anchors",
      {
        projectId: input.projectId,
        target: input.target,
        scope: input.scope,
        page: input.page,
        pageSize: input.pageSize,
        sortField: input.sortField,
        sortOrder: input.sortOrder,
      },
      options,
    );
  }

  /**
   * Find the domains that link to 2–4 of your competitors but not to you —
   * every row is a site that has already demonstrated it will link to something
   * in your space.
   *
   * Charges credits: one referring-domains lookup per request, five of them
   * paging YOUR OWN referring domains plus one per competitor, so a run costs up
   * to NINE upstream requests. Each is cached per organization+target+page, so
   * re-running the same intersect with a different threshold, proof filter or
   * sort costs nothing extra — do that rather than issuing a fresh run.
   *
   * Your own domain comes from the project row — there is no field for it, by
   * design.
   *
   * Read `unavailable` before `rows`: backlink graphs need a proprietary crawl
   * index, so the free provider refuses permanently and the empty `rows` (and
   * the zero `totalRows` / `provenRows`) on that response mean "we could not
   * look", not "no opportunities exist". Keep `absence: "proven"` (our read
   * ruled the domain out) distinct from `"unproven"` (our read was cut off at or
   * above it, so it may already link to you), and read `absenceBound` and
   * `coverage[]` for the authority floor those labels rest on.
   */
  intersect(
    input: LinkIntersectInput,
    options?: RequestOptions,
  ): Promise<LinkIntersectResult> {
    return this.http.post<LinkIntersectResult>(
      "/backlinks/intersect",
      input,
      options,
    );
  }

  /**
   * Iterate every anchor row for a target, fetching pages lazily:
   *
   * ```typescript
   * for await (const anchor of client.backlinks.iterateAnchors({ projectId, target })) {
   *   console.log(anchor.anchor, anchor.backlinks);
   * }
   * ```
   *
   * This is *offset* paging (see `pagination.ts`): each page is addressed by
   * number, so it can start anywhere via `input.page`, but rows shifting
   * upstream mid-walk can repeat or hide one. Every page is a separate billed
   * request — `break` out as soon as you have what you need.
   */
  iterateAnchors(
    input: BacklinksAnchorsInput,
    options?: RequestOptions,
  ): AsyncGenerator<AnchorRow, void, void> {
    return iterateOffsetPages<AnchorRow>(async (page) => {
      const result = await this.anchors({ ...input, page }, options);
      return {
        rows: result.rows,
        hasMore: result.hasMore,
        page: result.page,
      };
    }, input.page ?? 1);
  }
}
