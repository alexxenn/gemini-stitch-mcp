import type { GeminiModel } from "./types.js";

export interface Config {
  // OAuth credentials
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;

  // Google Cloud project (required for OAuth/Vertex AI mode)
  googleCloudProject?: string;
  googleCloudLocation: string;

  // API key fallbacks
  geminiApiKey?: string;
  stitchApiKey?: string;

  // Gemini settings
  geminiDefaultModel: GeminiModel;

  // Stitch settings
  stitchApiUrl: string;
  stitchProjectId?: string;

  // Auth mode
  authMode: "oauth" | "api-key";
}

export function loadConfig(): Config {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const stitchApiKey = process.env.STITCH_API_KEY;

  const hasOAuth = !!(googleClientId && googleClientSecret);
  const hasApiKey = !!(geminiApiKey);

  if (!hasOAuth && !hasApiKey) {
    throw new Error(
      "Authentication required. Provide either:\n" +
      "  - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (OAuth 2.0), or\n" +
      "  - GEMINI_API_KEY (API key fallback)"
    );
  }

  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  if (hasOAuth && !googleCloudProject) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is required for OAuth mode.\n" +
      "Set it to your Google Cloud project ID."
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
    authMode: hasOAuth ? "oauth" : "api-key",
  };
}
