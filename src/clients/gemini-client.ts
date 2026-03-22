import { GoogleGenAI } from "@google/genai";
import type { GoogleAuth } from "../auth/google-oauth.js";
import type { GeminiModel } from "../types.js";
import type { Config } from "../config.js";
import { withRetry } from "../utils/retry.js";
import { geminiProLimiter, geminiFlashLimiter } from "../utils/rate-limiter.js";

export class GeminiClient {
  private genai: GoogleGenAI;
  private defaultModel: GeminiModel;

  constructor(config: Config, auth: GoogleAuth) {
    if (config.authMode === "api-key" && config.geminiApiKey) {
      // Simplest: direct Gemini API with API key
      this.genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    } else if (config.authMode === "gemini-cli") {
      // Reuse Gemini CLI's OAuth tokens — same credentials, same usage quota.
      // Uses the Gemini API (not Vertex AI) with authorized_user credentials.
      const tokens = auth.getTokens();
      if (!tokens?.refresh_token) {
        throw new Error("Gemini CLI tokens not available. Sign in with: gemini auth login");
      }
      this.genai = new GoogleGenAI({
        googleAuthOptions: {
          credentials: {
            type: "authorized_user",
            client_id: auth.getGeminiCliClientId(),
            client_secret: auth.getGeminiCliClientSecret(),
            refresh_token: tokens.refresh_token,
          },
        },
      });
    } else if (config.authMode === "adc") {
      // Zero-config: Vertex AI with Application Default Credentials.
      // Works if user has run: gcloud auth application-default login
      // The SDK's internal google-auth-library auto-discovers ADC.
      this.genai = new GoogleGenAI({
        vertexai: true,
        project: config.googleCloudProject,
        location: config.googleCloudLocation,
      });
    } else {
      // Explicit OAuth: Vertex AI with authorized_user credentials.
      const tokens = auth.getTokens();
      if (!tokens?.refresh_token) {
        throw new Error("OAuth tokens not available for Vertex AI mode");
      }

      this.genai = new GoogleGenAI({
        vertexai: true,
        project: config.googleCloudProject,
        location: config.googleCloudLocation,
        googleAuthOptions: {
          credentials: {
            type: "authorized_user",
            client_id: config.googleClientId,
            client_secret: config.googleClientSecret,
            refresh_token: tokens.refresh_token,
          },
        },
      });
    }
    this.defaultModel = config.geminiDefaultModel;
  }

  async generate(
    prompt: string,
    options: {
      model?: GeminiModel;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;
    const limiter = model.includes("pro") ? geminiProLimiter : geminiFlashLimiter;

    await limiter.acquire();

    return withRetry(async () => {
      const response = await this.genai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: options.systemPrompt,
        },
      });

      return response.text ?? "";
    });
  }

  resolveModel(requested?: GeminiModel): GeminiModel {
    return requested ?? this.defaultModel;
  }
}
