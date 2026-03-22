#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { GoogleAuth } from "./auth/google-oauth.js";
import { GeminiClient } from "./clients/gemini-client.js";
import { StitchClient } from "./clients/stitch-client.js";
import { ScreenCache } from "./cache/screen-cache.js";
import type { PipelineContext } from "./types.js";
import { logger } from "./utils/logger.js";

// Tool implementations
import { geminiGenerateUI } from "./tools/gemini/generate-ui.js";
import { geminiRefineCode } from "./tools/gemini/refine-code.js";
import { geminiReviewUI } from "./tools/gemini/review-ui.js";
import { geminiChat } from "./tools/gemini/chat.js";
import { geminiPrompt } from "./tools/gemini/prompt.js";
import { stitchGenerateScreen } from "./tools/stitch/generate-screen.js";
import { stitchGetHtml } from "./tools/stitch/get-html.js";
import { stitchEditScreen } from "./tools/stitch/edit-screen.js";
import { stitchGetVariants } from "./tools/stitch/get-variants.js";
import { stitchListScreens } from "./tools/stitch/list-screens.js";
import { stitchGetImage } from "./tools/stitch/get-image.js";
import { designToCode } from "./tools/pipeline/design-to-code.js";
import { iterateDesign } from "./tools/pipeline/iterate-design.js";

const PIPELINE_STORE_MAX_SIZE = 100;

/**
 * Bounded Map for pipeline contexts. When the store exceeds
 * PIPELINE_STORE_MAX_SIZE, the oldest entries (by createdAt) are evicted.
 */
class BoundedPipelineStore {
  private store = new Map<string, PipelineContext>();

  get(key: string): PipelineContext | undefined {
    return this.store.get(key);
  }

  set(key: string, value: PipelineContext): void {
    this.store.set(key, value);
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    if (this.store.size <= PIPELINE_STORE_MAX_SIZE) return;

    const entries = [...this.store.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    );

    const toRemove = entries.length - PIPELINE_STORE_MAX_SIZE;
    for (let i = 0; i < toRemove; i++) {
      this.store.delete(entries[i][0]);
    }

    logger.debug("pipeline-store", `Evicted ${toRemove} old pipeline context(s)`, {
      size: this.store.size,
    });
  }

  get size(): number {
    return this.store.size;
  }
}

async function main() {
  const config = loadConfig();
  const auth = new GoogleAuth(config);
  await auth.initialize();

  const gemini = new GeminiClient(config, auth);
  const stitch = new StitchClient(config, auth);
  const cache = new ScreenCache();
  const pipelineStore = new BoundedPipelineStore();

  const server = new McpServer({
    name: "gemini-stitch-mcp",
    version: "1.0.0",
  });

  // === Input length limits ===
  // 500KB max for large content (code, prompts); 10KB for short-form fields
  const MAX_PROMPT_LEN = 500_000;
  const MAX_SHORT_LEN = 10_000;

  // === Gemini Tools ===

  server.tool(
    "gemini_generate_ui",
    "Generate a UI component from a text prompt using Gemini. Returns production-ready code for React, Vue, or HTML.",
    {
      prompt: z.string().max(MAX_PROMPT_LEN).describe("Description of the UI component to generate"),
      framework: z.enum(["react", "vue", "html"]).optional().describe("Target framework (default: react)"),
      styling: z.enum(["tailwind", "css", "styled-components"]).optional().describe("Styling approach (default: tailwind)"),
      componentType: z.string().max(200).optional().describe("Component type hint (e.g., 'form', 'card', 'dashboard')"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model (default: gemini-3.1-pro-preview)"),
    },
    async ({ prompt, framework, styling, componentType, model }) => {
      try {
        const result = await geminiGenerateUI(gemini, { prompt, framework, styling, componentType, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "gemini_refine_code",
    "Refine and improve existing frontend code using Gemini. Provide code and improvement instructions.",
    {
      code: z.string().max(MAX_PROMPT_LEN).describe("The existing code to refine"),
      instructions: z.string().max(MAX_SHORT_LEN).describe("What improvements to make"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model (default: gemini-3.1-flash-lite-preview)"),
    },
    async ({ code, instructions, model }) => {
      try {
        const result = await geminiRefineCode(gemini, { code, instructions, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "gemini_review_ui",
    "Review UI code for accessibility, responsiveness, and best practices using Gemini.",
    {
      code: z.string().max(MAX_PROMPT_LEN).describe("The UI code to review"),
      checkAccessibility: z.boolean().optional().describe("Check WCAG accessibility (default: true)"),
      checkResponsiveness: z.boolean().optional().describe("Check responsive design (default: true)"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model (default: gemini-3.1-pro-preview)"),
    },
    async ({ code, checkAccessibility, checkResponsiveness, model }) => {
      try {
        const result = await geminiReviewUI(gemini, { code, checkAccessibility, checkResponsiveness, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "gemini_chat",
    "Chat with Gemini about frontend development topics. Good for brainstorming and Q&A.",
    {
      message: z.string().max(MAX_PROMPT_LEN).describe("Your question or message"),
      context: z.string().max(MAX_PROMPT_LEN).optional().describe("Additional context (e.g., code snippet, project details)"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model (default: gemini-3.1-flash-lite-preview)"),
    },
    async ({ message, context, model }) => {
      try {
        const result = await geminiChat(gemini, { message, context, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "gemini_prompt",
    "Send any prompt to Gemini and get a response. General-purpose access to Gemini models from within Claude Code — use this to delegate any task to Gemini (code generation, analysis, writing, brainstorming, etc.).",
    {
      prompt: z.string().max(MAX_PROMPT_LEN).describe("The prompt to send to Gemini"),
      systemPrompt: z.string().max(MAX_PROMPT_LEN).optional().describe("Optional system prompt to set Gemini's behavior"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model (default: uses GEMINI_DEFAULT_MODEL)"),
    },
    async ({ prompt, systemPrompt, model }) => {
      try {
        const result = await geminiPrompt(gemini, { prompt, systemPrompt, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // === Stitch Tools ===

  server.tool(
    "stitch_generate_screen",
    "Generate a UI design screen using Google Stitch from a text description.",
    {
      prompt: z.string().max(MAX_SHORT_LEN).describe("Description of the UI design to generate"),
      projectId: z.string().optional().describe("Stitch project ID (auto-creates if not provided)"),
    },
    async ({ prompt, projectId }) => {
      try {
        const result = await stitchGenerateScreen(stitch, cache, { prompt, projectId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "stitch_get_html",
    "Extract raw HTML from a Stitch screen design. Fetches content from the Stitch download URL.",
    {
      screenId: z.string().describe("The Stitch screen ID"),
      minify: z.boolean().optional().describe("Minify the output HTML (default: false)"),
    },
    async ({ screenId, minify }) => {
      try {
        const result = await stitchGetHtml(stitch, cache, { screenId, minify });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "stitch_edit_screen",
    "Edit an existing Stitch screen design with text instructions.",
    {
      screenId: z.string().describe("The Stitch screen ID to edit"),
      instructions: z.string().max(MAX_SHORT_LEN).describe("Editing instructions (e.g., 'change the header color to blue')"),
    },
    async ({ screenId, instructions }) => {
      try {
        const result = await stitchEditScreen(stitch, cache, { screenId, instructions });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "stitch_get_variants",
    "Generate design variations of an existing Stitch screen with control over creativity.",
    {
      screenId: z.string().describe("The Stitch screen ID to generate variants from"),
      prompt: z.string().max(MAX_SHORT_LEN).optional().describe("Optional prompt to guide variant generation"),
      count: z.number().int().min(1).max(10).optional().describe("Number of variants, 1-10 (default: 3)"),
      creativeRange: z.enum(["REFINE", "EXPLORE", "REIMAGINE"]).optional().describe("How different variants should be (default: EXPLORE)"),
      aspects: z.array(z.string()).optional().describe("Aspects to vary, e.g. COLOR_SCHEME, LAYOUT"),
    },
    async ({ screenId, prompt, count, creativeRange, aspects }) => {
      try {
        const result = await stitchGetVariants(stitch, cache, { screenId, prompt, count, creativeRange, aspects });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "stitch_list_screens",
    "List all screens in a Stitch project.",
    {
      projectId: z.string().describe("The Stitch project ID"),
    },
    async ({ projectId }) => {
      try {
        const result = await stitchListScreens(stitch, { projectId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "stitch_get_image",
    "Get the screenshot/preview image URL for a Stitch screen design.",
    {
      screenId: z.string().describe("The Stitch screen ID"),
    },
    async ({ screenId }) => {
      try {
        const result = await stitchGetImage(stitch, cache, { screenId });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // === Pipeline Tools ===

  server.tool(
    "design_to_code",
    "Full design-to-code pipeline: generates a Stitch design, extracts HTML, and converts to a production React/Vue/HTML component via Gemini. Returns contextId for iteration.",
    {
      prompt: z.string().max(MAX_SHORT_LEN).describe("Description of the UI to design and code"),
      framework: z.enum(["react", "vue", "html"]).optional().describe("Target framework (default: react)"),
      styling: z.enum(["tailwind", "css", "styled-components"]).optional().describe("Styling approach (default: tailwind)"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model for code conversion (default: gemini-3.1-pro-preview)"),
    },
    async ({ prompt, framework, styling, model }) => {
      try {
        const result = await designToCode(gemini, stitch, cache, pipelineStore, { prompt, framework, styling, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  server.tool(
    "iterate_design",
    "Iterate on a previous design_to_code result. Applies feedback to the Stitch design and re-generates the component code.",
    {
      contextId: z.string().describe("The contextId from a previous design_to_code call"),
      feedback: z.string().max(MAX_SHORT_LEN).describe("What to change (e.g., 'add a forgot password link', 'make the header sticky')"),
      model: z.enum(["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-2.5-pro", "gemini-2.5-flash"]).optional().describe("Gemini model override for this iteration"),
    },
    async ({ contextId, feedback, model }) => {
      try {
        const result = await iterateDesign(gemini, stitch, cache, pipelineStore, { contextId, feedback, model });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }], isError: true };
      }
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("server", "Server started successfully");

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info("server", `Received ${signal}, shutting down gracefully`);
    try {
      await server.close();
      logger.info("server", "MCP server connection closed");
    } catch (err) {
      logger.error("server", "Error during shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("server", "Fatal error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
