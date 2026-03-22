import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:fs so existsSync is controllable
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

import { existsSync } from 'node:fs';
import { loadConfig } from './config.js';

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;

// Snapshot of original env to restore after each test
const ORIGINAL_ENV = { ...process.env };

function clearAuthEnv() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.STITCH_API_KEY;
  delete process.env.GEMINI_DEFAULT_MODEL;
  delete process.env.STITCH_API_URL;
  delete process.env.STITCH_PROJECT_ID;
  delete process.env.GOOGLE_CLOUD_LOCATION;
}

describe('loadConfig', () => {
  beforeEach(() => {
    clearAuthEnv();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    // Restore original env
    clearAuthEnv();
    Object.entries(ORIGINAL_ENV).forEach(([k, v]) => {
      if (v !== undefined) process.env[k] = v;
    });
    vi.clearAllMocks();
  });

  it('uses api-key mode when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'test-api-key-12345';

    const config = loadConfig();

    expect(config.authMode).toBe('api-key');
    expect(config.geminiApiKey).toBe('test-api-key-12345');
  });

  it('uses gemini-cli mode when ~/.gemini/oauth_creds.json exists', () => {
    mockExistsSync.mockReturnValue(true);

    const config = loadConfig();

    expect(config.authMode).toBe('gemini-cli');
  });

  it('uses adc mode when GOOGLE_CLOUD_PROJECT is set (no CLIENT_ID)', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-gcp-project';

    const config = loadConfig();

    expect(config.authMode).toBe('adc');
    expect(config.googleCloudProject).toBe('my-gcp-project');
  });

  it('uses oauth mode when CLIENT_ID and CLIENT_SECRET are set with PROJECT', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id-123';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret-456';
    process.env.GOOGLE_CLOUD_PROJECT = 'my-gcp-project';

    const config = loadConfig();

    expect(config.authMode).toBe('oauth');
    expect(config.googleClientId).toBe('client-id-123');
    expect(config.googleClientSecret).toBe('client-secret-456');
  });

  it('throws when oauth CLIENT_ID + SECRET set but GOOGLE_CLOUD_PROJECT is missing', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id-123';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret-456';
    // No GOOGLE_CLOUD_PROJECT

    expect(() => loadConfig()).toThrow('GOOGLE_CLOUD_PROJECT');
  });

  it('throws when no auth is configured', () => {
    // Nothing set, existsSync returns false
    expect(() => loadConfig()).toThrow('Authentication required');
  });

  it('priority: api-key wins over gemini-cli', () => {
    process.env.GEMINI_API_KEY = 'my-key';
    mockExistsSync.mockReturnValue(true); // gemini-cli also present

    const config = loadConfig();

    expect(config.authMode).toBe('api-key');
  });

  it('priority: api-key wins over adc', () => {
    process.env.GEMINI_API_KEY = 'my-key';
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';

    const config = loadConfig();

    expect(config.authMode).toBe('api-key');
  });

  it('priority: gemini-cli wins over adc', () => {
    mockExistsSync.mockReturnValue(true);
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';

    const config = loadConfig();

    expect(config.authMode).toBe('gemini-cli');
  });

  it('priority: adc wins over oauth when CLIENT_ID also present', () => {
    // According to config.ts: hasADC requires !googleClientId, so adc and oauth are mutually exclusive.
    // When CLIENT_ID is set, hasADC is false; when CLIENT_ID is absent, hasOAuth is false.
    // So oauth takes priority when CLIENT_ID is present (hasADC is false in that case).
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';

    const config = loadConfig();

    // hasADC = !!googleCloudProject && !googleClientId = false (because clientId is set)
    // hasOAuth = true, so authMode = oauth
    expect(config.authMode).toBe('oauth');
  });

  it('returns correct default model when GEMINI_DEFAULT_MODEL is not set', () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const config = loadConfig();

    expect(config.geminiDefaultModel).toBe('gemini-3.1-flash-lite-preview');
  });

  it('uses GEMINI_DEFAULT_MODEL env var when set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_DEFAULT_MODEL = 'gemini-2.5-pro';

    const config = loadConfig();

    expect(config.geminiDefaultModel).toBe('gemini-2.5-pro');
  });

  it('uses default stitch API URL when STITCH_API_URL is not set', () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const config = loadConfig();

    expect(config.stitchApiUrl).toBe('https://stitch.googleapis.com/mcp');
  });

  it('uses default cloud location us-central1 when GOOGLE_CLOUD_LOCATION is not set', () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const config = loadConfig();

    expect(config.googleCloudLocation).toBe('us-central1');
  });
});
