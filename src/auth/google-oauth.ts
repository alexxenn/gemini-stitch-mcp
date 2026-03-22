import { OAuth2Client } from "google-auth-library";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { GEMINI_CLI_CREDS_PATH, GEMINI_CLI_CLIENT_ID, GEMINI_CLI_CLIENT_SECRET } from "../config.js";
import type { OAuthTokens } from "../types.js";
import { loadTokens, saveTokens, isTokenExpired } from "./token-store.js";

const SCOPES = [
  "https://www.googleapis.com/auth/generative-language",
  "https://www.googleapis.com/auth/cloud-platform",
];

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export class GoogleAuth {
  private oauth2Client: OAuth2Client | null = null;
  private tokens: OAuthTokens | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.authMode === "api-key") {
      console.error("[auth] Using API key mode");
      return;
    }

    if (this.config.authMode === "gemini-cli") {
      console.error("[auth] Using Gemini CLI credentials (~/.gemini/oauth_creds.json)");
      await this.loadGeminiCliTokens();
      return;
    }

    if (this.config.authMode === "adc") {
      console.error("[auth] Using Application Default Credentials (ADC)");
      console.error("[auth] If this fails, run: gcloud auth application-default login");
      return;
    }

    this.oauth2Client = new OAuth2Client(
      this.config.googleClientId,
      this.config.googleClientSecret,
      REDIRECT_URI
    );

    // Check for pre-provided refresh token
    if (this.config.googleRefreshToken) {
      this.tokens = {
        access_token: "",
        refresh_token: this.config.googleRefreshToken,
        token_type: "Bearer",
        expiry_date: 0,
      };
      await this.refreshAccessToken();
      return;
    }

    // Try loading stored tokens
    this.tokens = await loadTokens();
    if (this.tokens) {
      this.oauth2Client.setCredentials({
        access_token: this.tokens.access_token,
        refresh_token: this.tokens.refresh_token,
        expiry_date: this.tokens.expiry_date,
      });
      if (isTokenExpired(this.tokens)) {
        await this.refreshAccessToken();
      }
      console.error("[auth] Loaded existing OAuth tokens");
      return;
    }

    // Need interactive auth
    await this.interactiveAuth();
  }

  async getAccessToken(): Promise<string> {
    if (this.config.authMode === "api-key") {
      return this.config.geminiApiKey!;
    }

    if (!this.tokens) {
      throw new Error("Not authenticated. Run the OAuth flow first.");
    }

    if (isTokenExpired(this.tokens)) {
      await this.refreshAccessToken();
    }

    return this.tokens.access_token;
  }

  /**
   * Returns the OAuth2Client with credentials already set.
   * The SDK's googleAuthOptions.authClient uses this to auto-refresh tokens.
   */
  getOAuth2Client(): OAuth2Client | null {
    return this.oauth2Client;
  }

  isApiKeyMode(): boolean {
    return this.config.authMode === "api-key";
  }

  getApiKey(): string | undefined {
    return this.config.geminiApiKey;
  }

  /**
   * Returns the stored tokens for use by clients that need
   * client_id/client_secret/refresh_token credentials.
   */
  getTokens(): OAuthTokens | null {
    return this.tokens;
  }

  isGeminiCliMode(): boolean {
    return this.config.authMode === "gemini-cli";
  }

  getGeminiCliClientId(): string {
    return GEMINI_CLI_CLIENT_ID;
  }

  getGeminiCliClientSecret(): string {
    return GEMINI_CLI_CLIENT_SECRET;
  }

  private async loadGeminiCliTokens(): Promise<void> {
    const data = await readFile(GEMINI_CLI_CREDS_PATH, "utf-8");
    const creds = JSON.parse(data) as OAuthTokens;
    this.tokens = {
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
      token_type: creds.token_type || "Bearer",
      expiry_date: creds.expiry_date || 0,
    };

    // Set up OAuth2Client using Gemini CLI's public client credentials
    this.oauth2Client = new OAuth2Client(
      GEMINI_CLI_CLIENT_ID,
      GEMINI_CLI_CLIENT_SECRET,
    );
    this.oauth2Client.setCredentials({
      access_token: this.tokens.access_token,
      refresh_token: this.tokens.refresh_token,
      expiry_date: this.tokens.expiry_date,
    });

    if (isTokenExpired(this.tokens)) {
      await this.refreshAccessToken();
    }
    console.error("[auth] Gemini CLI tokens loaded successfully");
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.oauth2Client || !this.tokens?.refresh_token) {
      throw new Error("Cannot refresh: no OAuth client or refresh token");
    }

    this.oauth2Client.setCredentials({
      refresh_token: this.tokens.refresh_token,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    this.tokens = {
      access_token: credentials.access_token ?? "",
      refresh_token: credentials.refresh_token ?? this.tokens.refresh_token,
      token_type: credentials.token_type ?? "Bearer",
      expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    };

    await saveTokens(this.tokens);
    console.error("[auth] Access token refreshed");
  }

  private async interactiveAuth(): Promise<void> {
    if (!this.oauth2Client) throw new Error("OAuth client not initialized");

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    console.error("\n=== Google OAuth Setup ===");
    console.error("Open this URL in your browser to authorize:");
    console.error(authUrl);
    console.error("Waiting for callback...\n");

    const code = await this.waitForCallback();
    const { tokens } = await this.oauth2Client.getToken(code);

    this.tokens = {
      access_token: tokens.access_token ?? "",
      refresh_token: tokens.refresh_token ?? "",
      token_type: tokens.token_type ?? "Bearer",
      expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    };

    this.oauth2Client.setCredentials({
      access_token: this.tokens.access_token,
      refresh_token: this.tokens.refresh_token,
      expiry_date: this.tokens.expiry_date,
    });

    await saveTokens(this.tokens);
    console.error("[auth] OAuth tokens saved successfully");
  }

  private waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "", `http://localhost:${REDIRECT_PORT}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Auth Failed</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Success!</h1><p>You can close this tab and return to Claude Code.</p>");
          server.close();
          resolve(code);
          return;
        }

        res.writeHead(404);
        res.end();
      });

      server.listen(REDIRECT_PORT, () => {
        console.error(`[auth] Callback server listening on port ${REDIRECT_PORT}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("OAuth callback timed out after 5 minutes"));
      }, 5 * 60 * 1000);
    });
  }
}
