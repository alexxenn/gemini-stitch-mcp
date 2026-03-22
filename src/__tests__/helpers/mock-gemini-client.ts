import { vi } from 'vitest';
import type { GeminiClient } from '../../clients/gemini-client.js';

export function createMockGeminiClient(): GeminiClient {
  return {
    generate: vi.fn().mockResolvedValue('generated code output'),
    resolveModel: vi.fn().mockImplementation((model: string) => model ?? 'gemini-3.1-pro-preview'),
  } as unknown as GeminiClient;
}
