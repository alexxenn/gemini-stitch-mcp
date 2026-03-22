import type { GeminiModel } from "./types.js";

export type AuthMode = "api-key" | "adc" | "oauth";

export interface Config {
  // OAuth credentials (explicit OAuth only)
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;

  // Google Cloud project (required for ADC and OAuth modes)
  googleCloudProject?: string;
  googleCloudLocation: string;

  // API key (simplest mode)
  geminiApiKey?: string;
  stitchApiKey?: string;

  // Gemini settings
  geminiDefaultModel: GeminiModel;

  // Stitch settings
  stitchApiUrl: string;
  stitchProjectId?: string;

  // Auth mode (resolved priority: api-key > adc > oauth)
  authMode: AuthMode;
}

export function loadConfig(): Config {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const stitchApiKey = process.env.STITCH_API_KEY;

  const hasApiKey = !!geminiApiKey;
  const hasADC = !!googleCloudProject && !googleClientId;
  const hasOAuth = !!(googleClientId && googleClientSecret);

  // Resolve auth mode by priority
  let authMode: AuthMode;
  if (hasApiKey) {
    authMode = "api-key";
  } else if (hasOAuth) {
    if (!googleCloudProject) {
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is required for OAuth mode.\n" +
        "Set it to your Google Cloud project ID."
      );
    }
    authMode = "oauth";
  } else if (hasADC) {
    authMode = "adc";
  } else {
    throw new Error(
      "Authentication required. Provide one of (easiest first):\n" +
      "  1. GEMINI_API_KEY                              (API key — quickest)\n" +
      "  2. GOOGLE_CLOUD_PROJECT                        (ADC — run: gcloud auth application-default login)\n" +
      "  3. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET     (OAuth 2.0 — full access)"
    );
  }

  return {
    googleClientId,
    googleClientSecret,
    googleRefreshToken,
    googleCloudProject,
    googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    geminiApiKey,
    stitchApiKey,
    geminiDefaultModel: (process.env.GEMINI_DEFAULT_MODEL as GeminiModel) || "gemini-3.1-flash-lite-preview",
    stitchApiUrl: process.env.STITCH_API_URL || "https://stitch.googleapis.com/v1",
    stitchProjectId: process.env.STITCH_PROJECT_ID,
    authMode,
  };
}
