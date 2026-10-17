/**
 * Live smoke test of the TypeScript SDK against the real API — read-only,
 * free endpoints only (no crawl, no paid provider call).
 *
 *   INTEGRATION=1 INTEGRATION_API_KEY=mseo_… npx vitest run sdks/tests/integration
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  MisarSeoAuthenticationError,
  MisarSeoClient,
} from "../../typescript/src/index.js";

const SKIP = !process.env.INTEGRATION;

describe.skipIf(SKIP)("MisarSEO integration", () => {
  let client: MisarSeoClient;

  beforeAll(() => {
    const apiKey = process.env.INTEGRATION_API_KEY;
    if (!apiKey) throw new Error("INTEGRATION_API_KEY required");
    client = new MisarSeoClient({
      apiKey,
      baseUrl: process.env.INTEGRATION_BASE_URL ?? "https://api.misar.io/seo",
    });
  });

  it("lists projects", async () => {
    const { projects } = await client.projects.list();
    expect(Array.isArray(projects)).toBe(true);
  });

  it("reads plan usage", async () => {
    const usage = await client.usage.get();
    expect(usage).toBeTypeOf("object");
  });

  it("rejects an invalid key with 401", async () => {
    const bad = new MisarSeoClient({ apiKey: "mseo_invalid", maxRetries: 0 });
    await expect(bad.projects.list()).rejects.toBeInstanceOf(
      MisarSeoAuthenticationError,
    );
  });
});
