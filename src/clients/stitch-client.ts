import type { GoogleAuth } from "../auth/google-oauth.js";
import type { Config } from "../config.js";
import type { StitchScreen, StitchProject } from "../types.js";
import { withRetry } from "../utils/retry.js";
import { stitchLimiter } from "../utils/rate-limiter.js";
import { logger } from "../utils/logger.js";

/**
 * HTTP client for Google Stitch's MCP server at stitch.googleapis.com/mcp.
 *
 * Stitch exposes a JSON-RPC 2.0 MCP endpoint — not a REST API.
 * All operations are invoked as MCP tool calls over HTTP POST.
 *
 * Auth: X-Goog-Api-Key header (API key) or Authorization: Bearer (OAuth).
 *
 * When @google/stitch-sdk is published to npm, this client can be replaced
 * with a thin wrapper around the official SDK.
 */
export class StitchClient {
  private baseUrl: string;
  private auth: GoogleAuth;
  private apiKey?: string;
  private defaultProjectId?: string;

  constructor(config: Config, auth: GoogleAuth) {
    this.baseUrl = config.stitchApiUrl;
    this.auth = auth;
    this.apiKey = config.stitchApiKey;
    this.defaultProjectId = config.stitchProjectId;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["X-Goog-Api-Key"] = this.apiKey;
    } else {
      const token = await this.auth.getAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Invoke an MCP tool on the Stitch server via JSON-RPC 2.0.
   */
  private async callTool<T = unknown>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    await stitchLimiter.acquire();

    return withRetry(async () => {
      const headers = await this.getHeaders();
      const body = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      logger.debug("stitch", `Calling tool: ${toolName}`, { args });

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(`Stitch API error ${response.status}: ${text}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      const json = await response.json() as { result?: T; error?: { code: number; message: string } };

      if (json.error) {
        const error = new Error(`Stitch tool error: ${json.error.message}`) as Error & { status: number };
        error.status = json.error.code;
        throw error;
      }

      return json.result as T;
    });
  }

  // -- Public API --

  async generateScreen(prompt: string, projectId?: string): Promise<StitchScreen> {
    const pid = projectId ?? this.defaultProjectId ?? await this.getOrCreateProject();

    const result = await this.callTool<Record<string, unknown>>("generate_screen_from_text", {
      projectId: pid,
      prompt,
    });

    return {
      id: String(result.id ?? result.screenId ?? ""),
      projectId: pid,
      title: String(result.title ?? result.name ?? prompt.slice(0, 60)),
      htmlUrl: result.htmlUrl as string | undefined,
      imageUrl: result.imageUrl as string | undefined,
    };
  }

  async getScreenHtml(screenId: string, _projectId?: string): Promise<{ html: string }> {
    const result = await this.callTool<Record<string, unknown>>("fetch_screen_code", { screenId });

    // The MCP tool may return HTML directly as a string, or in a structured response
    const html = typeof result === "string"
      ? result
      : String(result.code ?? result.html ?? result.content ?? JSON.stringify(result));

    return { html };
  }

  async getScreenImage(screenId: string): Promise<{ imageUrl: string }> {
    const result = await this.callTool<Record<string, unknown>>("fetch_screen_image", { screenId });

    const imageUrl = typeof result === "string"
      ? result
      : String(result.url ?? result.imageUrl ?? result.image_url ?? JSON.stringify(result));

    return { imageUrl };
  }

  async editScreen(screenId: string, instructions: string, projectId?: string): Promise<StitchScreen> {
    const pid = projectId ?? this.defaultProjectId;
    if (!pid) {
      throw new Error("projectId required to edit screen — set STITCH_PROJECT_ID or pass it explicitly");
    }

    // Try direct edit tool first, fall back to regeneration with context
    const result = await this.callTool<Record<string, unknown>>("generate_screen_from_text", {
      projectId: pid,
      prompt: instructions,
      editScreenId: screenId,
    });

    return {
      id: String(result.id ?? result.screenId ?? ""),
      projectId: pid,
      title: String(result.title ?? result.name ?? instructions.slice(0, 60)),
      htmlUrl: result.htmlUrl as string | undefined,
      imageUrl: result.imageUrl as string | undefined,
    };
  }

  async getVariants(
    screenId: string,
    options: { prompt?: string; count?: number; creativeRange?: string; aspects?: string[] } = {}
  ): Promise<StitchScreen[]> {
    const pid = this.defaultProjectId;
    if (!pid) throw new Error("projectId required for variants — set STITCH_PROJECT_ID");

    const result = await this.callTool<unknown>("generate_screen_from_text", {
      projectId: pid,
      prompt: options.prompt ?? "Generate variants",
      variantOfScreenId: screenId,
      variantCount: options.count ?? 3,
      creativeRange: options.creativeRange ?? "EXPLORE",
      aspects: options.aspects,
    });

    const screens = Array.isArray(result) ? result : [result];
    return screens.map((s: Record<string, unknown>) => ({
      id: String(s.id ?? s.screenId ?? ""),
      projectId: pid,
      title: String(s.title ?? s.name ?? ""),
      htmlUrl: (s.htmlUrl ?? s.html_url) as string | undefined,
      imageUrl: (s.imageUrl ?? s.image_url) as string | undefined,
    }));
  }

  async listScreens(projectId: string): Promise<StitchScreen[]> {
    const result = await this.callTool<unknown>("list_screens", { projectId });

    const screens = Array.isArray(result) ? result : [];
    return screens.map((s: Record<string, unknown>) => ({
      id: String(s.id ?? ""),
      projectId,
      title: String(s.title ?? s.name ?? ""),
      htmlUrl: undefined,
      imageUrl: undefined,
    }));
  }

  async listProjects(): Promise<StitchProject[]> {
    const result = await this.callTool<unknown>("list_projects");

    const projects = Array.isArray(result) ? result : [];
    return projects.map((p: Record<string, unknown>) => ({
      id: String(p.id ?? ""),
      title: String(p.title ?? p.name ?? ""),
    }));
  }

  private async getOrCreateProject(): Promise<string> {
    const projects = await this.listProjects();
    const existing = projects.find((p) => p.title === "claude-code-workspace");
    if (existing) {
      this.defaultProjectId = existing.id;
      return existing.id;
    }

    const result = await this.callTool<Record<string, unknown>>("create_project", {
      title: "claude-code-workspace",
    });

    const newId = String(result.id ?? "");
    this.defaultProjectId = newId;
    return newId;
  }
}
