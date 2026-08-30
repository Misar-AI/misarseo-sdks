import { z } from "zod";
/**
 * seo_prompt_explorer — run a prompt across multiple LLMs and see brand mentions.
 */
export function registerPromptExplorerTool(server, client) {
    server.tool("seo_prompt_explorer", "Run a prompt against up to 4 LLMs (ChatGPT, Claude, Gemini, Perplexity) and see how each answers, whether a brand is mentioned, and which sources are cited. Charges credits.", {
        projectId: z
            .string()
            .min(1)
            .describe("MisarSEO project ID. Use seo_list_projects to find it."),
        prompt: z
            .string()
            .min(1)
            .describe("The prompt/question to send to each LLM (e.g. 'What are the best SEO tools?')."),
        models: z
            .array(z.enum(["chat_gpt", "claude", "gemini", "perplexity"]))
            .min(1)
            .max(4)
            .describe("Which LLMs to query: 'chat_gpt', 'claude', 'gemini', 'perplexity'. At least one required."),
        highlightBrand: z
            .string()
            .optional()
            .describe("Brand name or domain to highlight mentions of in the results (e.g. 'acme.com')."),
        webSearch: z
            .boolean()
            .optional()
            .describe("Allow the LLMs to use web search when supported (default false)."),
    }, async ({ projectId, prompt, models, highlightBrand, webSearch }) => {
        const result = await client.post("/ai/prompt-explorer", {
            projectId,
            prompt,
            models,
            highlightBrand,
            webSearch,
        });
        return {
            content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=promptExplorer.js.map