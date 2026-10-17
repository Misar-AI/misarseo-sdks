/* eslint-disable typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unnecessary-type-assertion, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-return --
 * Table-driven test over untyped JSON (the manifest and recorded requests):
 * values are narrowed by the assertions below, not by the type system. */
/**
 * @misarseo/cli tests — a stubbed fetch, never the real API.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run, type Io } from "../src/run.js";

interface ManifestMethod {
  name: string;
  verb: string;
  path: string;
  pathParams: string[];
  requiredQuery: string[];
  hasBody: boolean;
}

const manifest: { resources: Record<string, { methods: ManifestMethod[] }> } =
  JSON.parse(readFileSync(join(__dirname, "..", "manifest.json"), "utf8"));

const kebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function harness(
  ...replies: Array<{
    status: number;
    body: string;
    headers?: Record<string, string>;
  }>
) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    env: { MISARSEO_API_KEY: "mseo_test" },
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url: new URL(url), init });
      const r = replies[Math.min(calls.length - 1, replies.length - 1)] ?? {
        status: 200,
        body: '{"ok":true}',
      };
      return new Response(r.body, { status: r.status, headers: r.headers });
    }) as typeof fetch,
  };
  return { io, calls, out, err };
}

describe("every manifest method is a command", () => {
  const cases = Object.entries(manifest.resources).flatMap(([resource, def]) =>
    def.methods.map(
      (method) => [`${resource}.${method.name}`, resource, method] as const,
    ),
  );

  it("has the whole surface", () => expect(cases.length).toBeGreaterThan(200));

  it.each(cases)("%s", async (_label, resource, method) => {
    const h = harness({ status: 200, body: '{"ok":true}' });
    const args = [...method.pathParams, ...method.requiredQuery].map(
      (_, i) => `v/${i}`,
    );
    const extra = method.hasBody ? ["--body", '{"x":1}'] : [];
    const code = await run(
      [kebab(resource), kebab(method.name), ...args, ...extra],
      h.io,
    );
    expect(code, h.err.join("\n")).toBe(0);
    const call = h.calls[0]!;
    expect(call.init.method).toBe(method.verb);
    let want = method.path;
    method.pathParams.forEach(
      (p, i) => (want = want.replace(`:${p}`, `v%2F${i}`)),
    );
    expect(call.url.pathname).toBe(`/seo${want}`);
    method.requiredQuery.forEach((q, j) =>
      expect(call.url.searchParams.get(q)).toBe(
        `v/${method.pathParams.length + j}`,
      ),
    );
    expect(call.init.body !== undefined).toBe(method.hasBody);
    expect((call.init.headers as Record<string, string>).Authorization).toBe(
      "Bearer mseo_test",
    );
    expect(JSON.parse(h.out.join("\n"))).toEqual({ ok: true });
  });
});

describe("cli behaviour", () => {
  it("prints an upgrade card and exits 3 on a plan limit, without retrying", async () => {
    const h = harness({
      status: 429,
      body: JSON.stringify({
        error: "Limit reached.",
        code: "plan_limit_exceeded",
        upgrade: {
          headline:
            "You've reached your Free plan's limit of 25 keyword lookups per day.",
          cta: "Upgrade to Pro to continue.",
          plans: [
            { name: "Free", price: "Free", current: true },
            {
              name: "Pro",
              price: "$19/month",
              recommended: true,
              unlocks: "250 keyword lookups per day",
            },
          ],
          urls: { pricing: "https://seo.misar.io/subscribe" },
        },
      }),
      headers: {
        "retry-after": "3600",
        "x-misar-upgrade-url": "https://seo.misar.io/subscribe?plan=pro",
      },
    });
    const code = await run(
      ["keywords", "research", "--body", '{"projectId":"p"}'],
      h.io,
    );
    expect(code).toBe(3);
    expect(h.calls).toHaveLength(1);
    const card = h.err.join("\n");
    expect(card).toContain("Free plan's limit of 25");
    expect(card).toContain("* Pro ($19/month) — 250 keyword lookups per day");
    expect(card).toContain("Upgrade: https://seo.misar.io/subscribe?plan=pro");
  });

  it("retries an ordinary 429", async () => {
    const h = harness(
      {
        status: 429,
        body: '{"error":"slow","code":"RATE_LIMITED"}',
        headers: { "retry-after": "0" },
      },
      { status: 200, body: "{}" },
    );
    expect(await run(["projects", "list"], h.io)).toBe(0);
    expect(h.calls).toHaveLength(2);
  });

  it("reports an API error with its code and exits 1", async () => {
    const h = harness({
      status: 404,
      body: '{"error":"Project not found","code":"NOT_FOUND"}',
    });
    expect(await run(["projects", "get", "nope"], h.io)).toBe(1);
    expect(h.err.join("")).toContain("404 (NOT_FOUND): Project not found");
  });

  it("passes optional query parameters as flags", async () => {
    const h = harness({ status: 200, body: "{}" });
    await run(["keywords", "list-saved", "p1", "--pageSize", "5"], h.io);
    expect(h.calls[0]!.url.searchParams.get("pageSize")).toBe("5");
  });

  it("streams crawl events until complete", async () => {
    const body =
      ': ping\n\nevent: progress\ndata: {"pages":3}\n\nevent: complete\ndata: {}\n\nevent: progress\ndata: {}\n\n';
    const h = harness({
      status: 200,
      body,
      headers: { "content-type": "text/event-stream" },
    });
    expect(await run(["crawl", "stream-events", "a1", "p1"], h.io)).toBe(0);
    expect(h.out.map((l) => JSON.parse(l).event)).toEqual([
      "progress",
      "complete",
    ]);
    expect((h.calls[0]!.init.headers as Record<string, string>).Accept).toBe(
      "text/event-stream",
    );
  });

  it("rejects unknown commands and wrong arity with exit 2", async () => {
    expect(await run(["nope", "nothing"], harness().io)).toBe(2);
    expect(await run(["projects", "get"], harness().io)).toBe(2);
  });

  it("requires an API key", async () => {
    const h = harness();
    h.io.env = {};
    expect(await run(["projects", "list"], h.io)).toBe(2);
    expect(h.err.join("")).toContain("seo.misar.io");
  });

  it("lists every resource", async () => {
    const h = harness();
    expect(await run(["list"], h.io)).toBe(0);
    expect(h.out.some((l) => l.startsWith("rank-tracking:"))).toBe(true);
  });
});
