import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MisarSeoClient } from "../client.js";

/**
 * seo_prompt_explorer — run a prompt across multiple LLMs and see brand mentions.
 */
export function registerPromptExplorerTool(
  server: McpServer,
  client: MisarSeoClient,
): void {
  server.tool(
    "seo_prompt_explorer",
    "Run a prompt against up to 4 LLMs (ChatGPT, Claude, Gemini, Perplexity) and see how each answers, whether a brand is mentioned, and which sources are cited. " +
      "CHARGES CREDITS: one upstream call per DISTINCT model in `models` (duplicates are collapsed first), so a 4-model call costs four. Requires a paid plan — a free-plan organization gets an error, not an empty result. One model failing does not fail the call: that model comes back as an error entry alongside the answers that succeeded, so check each result before reporting a model said nothing. " +
      "An unrecognised model name is a 400 rather than being silently dropped, so a typo fails loudly.",
    {
      projectId: z
        .string()
        .min(1)
        .describe("MisarSEO project ID. Use seo_list_projects to find it."),
      prompt: z
        .string()
        .min(1)
        .describe(
          "The prompt/question to send to each LLM (e.g. 'What are the best SEO tools?').",
        ),
      models: z
        .array(z.enum(["chat_gpt", "claude", "gemini", "perplexity"]))
        .min(1)
        .max(4)
        .describe(
          "Which LLMs to query: 'chat_gpt', 'claude', 'gemini', 'perplexity'. At least one required.",
        ),
      highlightBrand: z
        .string()
        .optional()
        .describe(
          "Brand name or domain to highlight mentions of in the results (e.g. 'acme.com').",
        ),
      webSearch: z
        .boolean()
        .optional()
        .describe(
          "Allow the LLMs to use web search when supported. Default TRUE — pass false explicitly to ask for answers from model knowledge alone.",
        ),
    },
    async ({ projectId, prompt, models, highlightBrand, webSearch }) => {
      const result = await client.post("/ai/prompt-explorer", {
        projectId,
        prompt,
        models,
        highlightBrand,
        webSearch,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
