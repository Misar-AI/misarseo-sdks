import { defineConfig } from "vitest/config";

// Live-API suite: run from sdks/typescript (which has vitest installed) with
//   INTEGRATION=1 INTEGRATION_API_KEY=mseo_… npx vitest run --config ../tests/vitest.config.ts
export default defineConfig({
  test: {
    environment: "node",
    root: __dirname,
    include: ["integration/**/*.test.ts"],
  },
});
