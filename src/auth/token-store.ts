import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";
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

/**
 * Persist OAuth tokens to disk with restrictive permissions.
 *
 * On Unix (Linux/macOS) the directory is created with mode 0o700 (owner-only)
 * and the file is written with mode 0o600 (owner read/write only) to prevent
 * other local users from reading refresh tokens.
 *
 * On Windows, filesystem permissions are managed via ACLs, not POSIX modes.
 * Node's `mode` option is a no-op there; the user's home-directory ACL already
 * restricts access to the owner by default.
 */
export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  const isUnix = platform() !== "win32";
  await mkdir(TOKEN_DIR, { recursive: true, ...(isUnix ? { mode: 0o700 } : {}) });
  await writeFile(
    TOKEN_FILE,
    JSON.stringify(tokens, null, 2),
    { encoding: "utf-8", ...(isUnix ? { mode: 0o600 } : {}) },
  );
}

export function isTokenExpired(tokens: OAuthTokens): boolean {
  // Consider expired 5 minutes before actual expiry
  return Date.now() >= tokens.expiry_date - 5 * 60 * 1000;
}
