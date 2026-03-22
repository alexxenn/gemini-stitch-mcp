import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthTokens } from "../types.js";

const TOKEN_DIR = join(homedir(), ".gemini-stitch-mcp");
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");

export async function loadTokens(): Promise<OAuthTokens | null> {
  try {
    const data = await readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data) as OAuthTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export function isTokenExpired(tokens: OAuthTokens): boolean {
  // Consider expired 5 minutes before actual expiry
  return Date.now() >= tokens.expiry_date - 5 * 60 * 1000;
}
