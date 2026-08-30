import { z } from "zod";
/**
 * seo_ai_radar — look up brand visibility in AI-generated answers.
 */
export function registerAiRadarTool(server, client) {
    server.tool("seo_ai_radar", "Look up how a brand or domain is mentioned across AI platforms (ChatGPT, Google AI Overviews). Returns share of voice, top cited pages, and top prompts. Charges credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        brand: z
            .string()
            .min(1)
            .max(250)
            .describe("Brand name or domain to look up (e.g. 'Acme Corp' or 'acme.com')."),
        competitors: z
            .array(z.string().min(1).max(250))
            .max(5)
            .optional()
            .describe("Up to 5 competitor brands or domains to compare share of voice against."),
        locationCode: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("DataForSEO location code (default 2840 = United States)."),
        languageCode: z
            .string()
            .min(2)
            .max(8)
            .optional()
            .describe("Language code (default 'en')."),
    }, async ({ projectId, brand, competitors, locationCode, languageCode }) => {
        // AI radar runs asynchronously on the misarseo:ai-radar queue: enqueue,
        // then poll the status route until the shaped result is ready.
        const { jobId } = await client.post("/ai/brand-lookup", {
            projectId,
            query: brand,
            competitors: competitors ?? [],
            locationCode,
            languageCode,
        });
        const POLL_INTERVAL_MS = 2000;
        const TIMEOUT_MS = 120000;
        const deadline = Date.now() + TIMEOUT_MS;
        for (;;) {
            const res = await client.get(`/ai/brand-lookup/${encodeURIComponent(jobId)}/status`, {
                projectId,
            });
            if (res.status === "complete") {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(res.result, null, 2),
                        },
                    ],
                };
            }
            if (res.status === "errored") {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `AI radar scan failed: ${res.error?.message ?? "unknown error"}`,
                        },
                    ],
                };
            }
            if (Date.now() >= deadline) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `AI radar scan timed out after ${TIMEOUT_MS}ms (jobId ${jobId}). Retry status with the same projectId.`,
                        },
                    ],
                };
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    });
}
//# sourceMappingURL=aiRadar.js.map