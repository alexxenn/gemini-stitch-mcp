import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Mock the fs/promises module before importing the module under test
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { loadTokens, saveTokens, isTokenExpired } from './token-store.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { OAuthTokens } from '../types.js';

const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = writeFile as ReturnType<typeof vi.fn>;
const mockMkdir = mkdir as ReturnType<typeof vi.fn>;

const FIXTURE_TOKENS: OAuthTokens = {
  access_token: 'ya29.test-access-token',
  refresh_token: '1//test-refresh-token',
  token_type: 'Bearer',
  expiry_date: Date.now() + 3600 * 1000,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
};

describe('loadTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed tokens when file exists', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(FIXTURE_TOKENS));

    const result = await loadTokens();

    expect(result).toEqual(FIXTURE_TOKENS);
  });

  it('returns null when file does not exist (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValue(err);

    const result = await loadTokens();

    expect(result).toBeNull();
  });

  it('returns null when file contains invalid JSON', async () => {
    mockReadFile.mockResolvedValue('not valid json{{{{');

    const result = await loadTokens();

    expect(result).toBeNull();
  });
});

describe('saveTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('calls mkdir with recursive: true', async () => {
    await saveTokens(FIXTURE_TOKENS);

    expect(mockMkdir).toHaveBeenCalledOnce();
    const [, options] = mockMkdir.mock.calls[0];
    expect(options).toEqual({ recursive: true });
  });

  it('writes prettified JSON to the correct path', async () => {
    await saveTokens(FIXTURE_TOKENS);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const [, content] = mockWriteFile.mock.calls[0];
    const parsed = JSON.parse(content as string);
    expect(parsed).toEqual(FIXTURE_TOKENS);
  });

  it('writes to TOKEN_FILE path under homedir', async () => {
    await saveTokens(FIXTURE_TOKENS);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const [filePath] = mockWriteFile.mock.calls[0];
    expect((filePath as string).startsWith(homedir())).toBe(true);
  });

  it('roundtrip: saveTokens then loadTokens returns original tokens', async () => {
    let storedContent = '';
    mockWriteFile.mockImplementation(async (_path: unknown, content: unknown) => {
      storedContent = content as string;
    });
    mockReadFile.mockImplementation(async () => storedContent);

    await saveTokens(FIXTURE_TOKENS);
    const result = await loadTokens();

    expect(result).toEqual(FIXTURE_TOKENS);
  });
});

describe('isTokenExpired', () => {
  it('returns true when expiry_date is in the past', () => {
    const tokens: OAuthTokens = {
      ...FIXTURE_TOKENS,
      expiry_date: Date.now() - 1,
    };
    expect(isTokenExpired(tokens)).toBe(true);
  });

  it('returns true within 5-minute buffer (4 minutes remaining)', () => {
    const tokens: OAuthTokens = {
      ...FIXTURE_TOKENS,
      expiry_date: Date.now() + 4 * 60 * 1000, // 4 minutes in the future
    };
    expect(isTokenExpired(tokens)).toBe(true);
  });

  it('returns true exactly at the 5-minute boundary', () => {
    const tokens: OAuthTokens = {
      ...FIXTURE_TOKENS,
      expiry_date: Date.now() + 5 * 60 * 1000, // exactly 5 minutes — still "expired"
    };
    // Date.now() >= expiry_date - 5*60*1000  =>  Date.now() >= Date.now()  => true
    expect(isTokenExpired(tokens)).toBe(true);
  });

  it('returns false when token has more than 5 minutes remaining', () => {
    const tokens: OAuthTokens = {
      ...FIXTURE_TOKENS,
      expiry_date: Date.now() + 6 * 60 * 1000, // 6 minutes
    };
    expect(isTokenExpired(tokens)).toBe(false);
  });
});
