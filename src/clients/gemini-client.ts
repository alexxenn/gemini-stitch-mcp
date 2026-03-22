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
      // Direct Gemini API with API key
      this.genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    } else {
      // OAuth mode — use Vertex AI with authorized_user credentials.
      // google-auth-library recognizes type "authorized_user" and creates
      // a UserRefreshClient that auto-refreshes using the refresh_token.
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
