import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGeminiClient } from '../../__tests__/helpers/mock-gemini-client.js';
import { createMockStitchClient } from '../../__tests__/helpers/mock-stitch-client.js';
import { ScreenCache } from '../../cache/screen-cache.js';
import type { PipelineContext } from '../../types.js';
import { designToCode } from './design-to-code.js';

describe('designToCode', () => {
  let gemini: ReturnType<typeof createMockGeminiClient>;
  let stitch: ReturnType<typeof createMockStitchClient>;
  let cache: ScreenCache;
  let pipelineStore: Map<string, PipelineContext>;

  const mockScreen = {
    id: 'screen-abc',
    projectId: 'proj-xyz',
    title: 'Login Screen',
    imageUrl: 'https://stitch.example.com/image/screen-abc',
    htmlUrl: 'https://stitch.example.com/html/screen-abc',
  };

  const mockHtml = '<div class="login">Login Form</div>';
  const mockGeneratedCode = 'export default function Login() { return <div>Login</div>; }';

  beforeEach(() => {
    gemini = createMockGeminiClient();
    stitch = createMockStitchClient();
    cache = new ScreenCache();
    pipelineStore = new Map();

    vi.mocked(stitch.generateScreen).mockResolvedValue(mockScreen as never);
    vi.mocked(stitch.getScreenHtml).mockResolvedValue({ html: mockHtml });
    vi.mocked(gemini.generate).mockResolvedValue(mockGeneratedCode);
    vi.mocked(gemini.resolveModel).mockImplementation((m) => m ?? 'gemini-3.1-pro-preview');
  });

  it('calls generateScreen with the prompt', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A login page',
    });

    expect(vi.mocked(stitch.generateScreen)).toHaveBeenCalledWith('A login page');
  });

  it('calls getScreenHtml with the screen id and projectId', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A login page',
    });

    expect(vi.mocked(stitch.getScreenHtml)).toHaveBeenCalledWith('screen-abc', 'proj-xyz');
  });

  it('calls gemini.generate with html in the prompt', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A login page',
    });

    const callArg = vi.mocked(gemini.generate).mock.calls[0][0] as string;
    expect(callArg).toContain(mockHtml);
  });

  it('returns contextId, code, framework, and styling', async () => {
    const result = await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A login page',
      framework: 'react',
      styling: 'tailwind',
    });

    expect(result.contextId).toBeTruthy();
    expect(result.code).toBe(mockGeneratedCode);
    expect(result.framework).toBe('react');
    expect(result.styling).toBe('tailwind');
  });

  it('stores context in pipelineStore with correct fields', async () => {
    const result = await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A dashboard',
      framework: 'vue',
      styling: 'css',
    });

    const context = pipelineStore.get(result.contextId);
    expect(context).toBeDefined();
    expect(context!.prompt).toBe('A dashboard');
    expect(context!.framework).toBe('vue');
    expect(context!.styling).toBe('css');
    expect(context!.screenId).toBe('screen-abc');
    expect(context!.generatedCode).toBe(mockGeneratedCode);
    expect(context!.iterations).toEqual([]);
  });

  it('uses default model gemini-3.1-pro-preview when none specified', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A form',
    });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-3.1-pro-preview');
  });

  it('passes model override to gemini.generate', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A form',
      model: 'gemini-2.5-pro',
    });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-2.5-pro');
  });

  it('caches the screen by id', async () => {
    await designToCode(gemini, stitch, cache, pipelineStore, {
      prompt: 'A hero section',
    });

    expect(cache.has('screen:screen-abc')).toBe(true);
  });

  it('generates a unique contextId per call', async () => {
    const r1 = await designToCode(gemini, stitch, cache, pipelineStore, { prompt: 'Page A' });
    const r2 = await designToCode(gemini, stitch, cache, pipelineStore, { prompt: 'Page B' });

    expect(r1.contextId).not.toBe(r2.contextId);
  });
});
