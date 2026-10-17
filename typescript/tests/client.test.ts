/* eslint-disable typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unnecessary-type-assertion, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-return --
 * Table-driven test over untyped JSON (the manifest and recorded requests):
 * values are narrowed by the assertions below, not by the type system. */
/**
 * @misarseo/sdk — standalone tests (run with `npm test` inside sdks/typescript).
 *
 * The repository-level suite in tests/unit/sdk covers each resource in depth;
 * these are the checks that must travel with the package when it is mirrored
 * to github.com/Misar-AI/misarseo-sdks: every manifest method is reachable on
 * the client and hits its route, and plan-limit refusals surface the upgrade
 * offer instead of being retried as rate limits.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MisarSeoClient,
  MisarSeoNotFoundError,
  MisarSeoPlanLimitError,
  MisarSeoRateLimitError,
} from "../src/index.js";

interface ManifestMethod {
  name: string;
  verb: string;
  path: string;
  pathParams: string[];
  requiredQuery: string[];
  hasBody: boolean;
}
interface Manifest {
  baseUrl: string;
  resources: Record<string, { methods: ManifestMethod[] }>;
}

const manifest: Manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "manifest.json"), "utf8"),
);

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function mockFetch(...responses: Response[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return (
      responses[Math.min(calls.length - 1, responses.length - 1)] ??
      json(200, {})
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const client = () =>
  new MisarSeoClient({
    apiKey: "mseo_test",
    retryBaseDelayMs: 1,
    maxRetryDelayMs: 5,
  });

/**
 * One input object that satisfies every resource method: each path parameter
 * and required query parameter under its wire name, plus the SDK-side aliases
 * the hand-written resources use for the same values (`auditId` for the
 * crawl `jobId` segment).
 */
function dummyInput(): Record<string, unknown> {
  const input: Record<string, unknown> = {
    auditId: "id-1",
    confirm: "DELETE",
  };
  for (const def of Object.values(manifest.resources)) {
    for (const method of def.methods) {
      for (const name of [...method.pathParams, ...method.requiredQuery]) {
        input[name] = "id-1";
      }
    }
  }
  // Array-valued query parameters (joined by the resource method).
  input.metrics = ["WEBSITE_CLICKS"];
  return input;
}

describe("manifest coverage", () => {
  const cases = Object.entries(manifest.resources).flatMap(([resource, def]) =>
    def.methods.map((method) => ({ resource, method })),
  );

  it("has the whole surface", () => {
    expect(cases.length).toBeGreaterThan(200);
  });

  it.each(cases.map((c) => [`${c.resource}.${c.method.name}`, c] as const))(
    "%s hits its route",
    async (_label, { resource, method }) => {
      const calls = mockFetch(json(200, {}));
      const target = (
        client() as unknown as Record<string, Record<string, unknown>>
      )[resource];
      expect(target, `client.${resource}`).toBeDefined();
      const fn = target?.[method.name];
      expect(typeof fn, `client.${resource}.${method.name}`).toBe("function");
      await (fn as (input: unknown) => Promise<unknown>).call(
        target,
        dummyInput(),
      );

      expect(calls).toHaveLength(1);
      const sent = new URL(calls[0]!.url);
      expect(calls[0]!.init.method).toBe(method.verb);
      const pattern = new RegExp(
        "^/seo" + method.path.replace(/:[A-Za-z_]\w*/g, "[^/]+") + "$",
      );
      expect(sent.pathname).toMatch(pattern);
      for (const name of method.requiredQuery) {
        expect(sent.searchParams.has(name), `query ${name}`).toBe(true);
      }
      expect(calls[0]!.init.headers).toMatchObject({
        Authorization: "Bearer mseo_test",
      });
    },
  );
});

const offer = {
  product: "seo",
  reason: "quota_exhausted",
  feature: "keyword_lookups",
  current_plan: { slug: "free", name: "Free" },
  urls: {
    pricing: "https://seo.misar.io/subscribe",
    billing: "",
    docs: "",
    compare: "",
  },
};

describe("plan limits", () => {
  it("does not retry a 429 that carries plan_limit_exceeded", async () => {
    const calls = mockFetch(
      json(
        429,
        {
          error: "Limit reached. Upgrade to Pro to continue.",
          code: "plan_limit_exceeded",
          upgrade: offer,
        },
        {
          "retry-after": "3600",
          "x-misar-plan": "free",
          "x-misar-upgrade-url": "https://seo.misar.io/subscribe?plan=pro",
        },
      ),
    );
    const error = await client()
      .keywords.research({ projectId: "p", keywords: ["seo"] } as never)
      .catch((e: unknown) => e);

    expect(calls).toHaveLength(1);
    expect(error).toBeInstanceOf(MisarSeoPlanLimitError);
    const planError = error as MisarSeoPlanLimitError;
    expect(planError.statusCode).toBe(429);
    expect(planError.code).toBe("plan_limit_exceeded");
    expect(planError.offer?.feature).toBe("keyword_lookups");
    expect(planError.reason).toBe("quota_exhausted");
    expect(planError.plan).toBe("free");
    expect(planError.upgradeUrl).toBe(
      "https://seo.misar.io/subscribe?plan=pro",
    );
    expect(planError.retryAfterSeconds).toBe(3600);
  });

  it("surfaces a 402 feature lock with the offer, falling back to the body", async () => {
    mockFetch(
      json(402, {
        error: "Backlinks isn't included in your Free plan.",
        code: "plan_limit_exceeded",
        upgrade: { ...offer, reason: "feature_locked", feature: "backlinks" },
      }),
    );
    const error = await client()
      .projects.list()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MisarSeoPlanLimitError);
    expect((error as MisarSeoPlanLimitError).plan).toBe("free");
    expect((error as MisarSeoPlanLimitError).upgradeUrl).toBe(
      "https://seo.misar.io/subscribe",
    );
  });

  it("still retries an ordinary 429", async () => {
    const calls = mockFetch(
      json(429, { error: "slow down", code: "RATE_LIMITED" }),
      json(200, { projects: [] }),
    );
    await expect(client().projects.list()).resolves.toEqual({ projects: [] });
    expect(calls).toHaveLength(2);
  });

  it("gives up on an ordinary 429 with a rate-limit error once the budget is spent", async () => {
    mockFetch(json(429, { error: "slow down", code: "RATE_LIMITED" }));
    await expect(client().projects.list()).rejects.toBeInstanceOf(
      MisarSeoRateLimitError,
    );
  });
});

describe("errors", () => {
  it("maps 404 to a not-found error carrying the API code", async () => {
    mockFetch(json(404, { error: "Project not found", code: "NOT_FOUND" }));
    const error = await client()
      .projects.get({ projectId: "nope" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MisarSeoNotFoundError);
    expect((error as MisarSeoNotFoundError).code).toBe("NOT_FOUND");
  });
});

describe("crawl stream", () => {
  it("asks for text/event-stream and yields frames until complete", async () => {
    const body =
      ': ping\n\nevent: progress\ndata: {"pagesCrawled":3}\n\nevent: complete\ndata: {"status":"completed"}\n\n';
    const calls = mockFetch(
      new Response(body, { headers: { "content-type": "text/event-stream" } }),
    );
    const events: unknown[] = [];
    for await (const event of client().crawl.streamEvents({
      auditId: "a1",
      projectId: "p1",
    })) {
      events.push(event);
    }
    expect(events).toEqual([
      { event: "progress", data: { pagesCrawled: 3 } },
      { event: "complete", data: { status: "completed" } },
    ]);
    expect(calls[0]!.init.headers).toMatchObject({
      Accept: "text/event-stream",
    });
  });
});
