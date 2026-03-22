import type { GoogleAuth } from "../auth/google-oauth.js";
import type { Config } from "../config.js";
import type { StitchScreen, StitchProject } from "../types.js";
import { withRetry } from "../utils/retry.js";
import { stitchLimiter } from "../utils/rate-limiter.js";

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
      headers["X-API-Key"] = this.apiKey;
    } else {
      const token = await this.auth.getAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    await stitchLimiter.acquire();

    return withRetry(async () => {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const error = new Error(`Stitch API error ${response.status}: ${body}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      return response.json() as Promise<T>;
    });
  }

  async generateScreen(prompt: string, projectId?: string): Promise<StitchScreen> {
    const pid = projectId ?? this.defaultProjectId ?? await this.getOrCreateProject();

    return this.request<StitchScreen>(`/projects/${pid}/screens`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }

  async getScreenHtml(screenId: string): Promise<{ html: string; css: string }> {
    return this.request<{ html: string; css: string }>(`/screens/${screenId}/html`);
  }

  async editScreen(screenId: string, instructions: string): Promise<StitchScreen> {
    return this.request<StitchScreen>(`/screens/${screenId}/edit`, {
      method: "POST",
      body: JSON.stringify({ instructions }),
    });
  }

  async getVariants(screenId: string, count = 3): Promise<StitchScreen[]> {
    return this.request<StitchScreen[]>(`/screens/${screenId}/variants?count=${count}`);
  }

  async listScreens(projectId: string): Promise<StitchScreen[]> {
    return this.request<StitchScreen[]>(`/projects/${projectId}/screens`);
  }

  async listProjects(): Promise<StitchProject[]> {
    return this.request<StitchProject[]>("/projects");
  }

  private async getOrCreateProject(): Promise<string> {
    const projects = await this.listProjects();
    const existing = projects.find((p) => p.name === "claude-code-workspace");
    if (existing) {
      this.defaultProjectId = existing.projectId;
      return existing.projectId;
    }

    const project = await this.request<StitchProject>("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "claude-code-workspace" }),
    });

    this.defaultProjectId = project.projectId;
    return project.projectId;
  }
}
