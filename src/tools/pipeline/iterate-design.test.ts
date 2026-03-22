import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGeminiClient } from '../../__tests__/helpers/mock-gemini-client.js';
import { createMockStitchClient } from '../../__tests__/helpers/mock-stitch-client.js';
import { ScreenCache } from '../../cache/screen-cache.js';
import type { PipelineContext } from '../../types.js';
import { iterateDesign } from './iterate-design.js';

describe('iterateDesign', () => {
  let gemini: ReturnType<typeof createMockGeminiClient>;
  let stitch: ReturnType<typeof createMockStitchClient>;
  let cache: ScreenCache;
  let pipelineStore: Map<string, PipelineContext>;

  const CONTEXT_ID = 'ctx-test-123';

  const baseContext: PipelineContext = {
    contextId: CONTEXT_ID,
    prompt: 'A login page',
    framework: 'react',
    styling: 'tailwind',
    screenId: 'screen-original',
    projectId: 'proj-456',
    rawHtml: '<div>original html</div>',
    generatedCode: 'function Login() { return <div>Original</div>; }',
    model: 'gemini-3.1-pro-preview',
    iterations: [],
    createdAt: Date.now() - 60000,
  };

  const editedScreen = {
    id: 'screen-edited',
    projectId: 'proj-456',
    title: 'Login Screen Edited',
    imageUrl: 'https://stitch.example.com/image/screen-edited',
    htmlUrl: 'https://stitch.example.com/html/screen-edited',
  };

  const updatedHtml = '<div>updated html with blue header</div>';
  const iteratedCode = 'function Login() { return <div className="updated">Updated</div>; }';

  beforeEach(() => {
    gemini = createMockGeminiClient();
    stitch = createMockStitchClient();
    cache = new ScreenCache();
    pipelineStore = new Map();

    // Seed the store with the base context (deep clone so mutations don't bleed)
    pipelineStore.set(CONTEXT_ID, {
      ...baseContext,
      iterations: [],
    });

    vi.mocked(stitch.editScreen).mockResolvedValue(editedScreen as never);
    vi.mocked(stitch.getScreenHtml).mockResolvedValue({ html: updatedHtml });
    vi.mocked(gemini.generate).mockResolvedValue(iteratedCode);
    vi.mocked(gemini.resolveModel).mockImplementation((m) => m ?? 'gemini-3.1-pro-preview');
  });

  it('calls stitch.editScreen with screenId, feedback, and projectId', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Make the header blue',
    });

    expect(vi.mocked(stitch.editScreen)).toHaveBeenCalledWith(
      'screen-original',
      'Make the header blue',
      'proj-456'
    );
  });

  it('calls stitch.getScreenHtml with the updated screen id and projectId', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Make the header blue',
    });

    expect(vi.mocked(stitch.getScreenHtml)).toHaveBeenCalledWith('screen-edited', 'proj-456');
  });

  it('calls gemini.generate for code re-conversion', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Make the header blue',
    });

    expect(vi.mocked(gemini.generate)).toHaveBeenCalledOnce();
  });

  it('returns contextId, code, screenId, and iteration number', async () => {
    const result = await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Make the header blue',
    });

    expect(result.contextId).toBe(CONTEXT_ID);
    expect(result.code).toBe(iteratedCode);
    expect(result.screenId).toBe('screen-edited');
    expect(result.iteration).toBe(1);
  });

  it('throws when contextId is not found in pipelineStore', async () => {
    await expect(
      iterateDesign(gemini, stitch, cache, pipelineStore, {
        contextId: 'nonexistent-ctx',
        feedback: 'Any feedback',
      })
    ).rejects.toThrow('Pipeline context not found: nonexistent-ctx');
  });

  it('appends iteration to context.iterations', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Make the header blue',
    });

    const context = pipelineStore.get(CONTEXT_ID)!;
    expect(context.iterations).toHaveLength(1);
    expect(context.iterations[0].feedback).toBe('Make the header blue');
    expect(context.iterations[0].generatedCode).toBe(iteratedCode);
    expect(context.iterations[0].screenId).toBe('screen-edited');
  });

  it('uses previous iteration code as base on second iteration', async () => {
    // First iteration
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'First change',
    });

    vi.mocked(gemini.generate).mockResolvedValue('second iteration code');
    vi.mocked(stitch.editScreen).mockResolvedValue({
      ...editedScreen,
      id: 'screen-edited-v2',
    } as never);
    vi.mocked(stitch.getScreenHtml).mockResolvedValue({
      html: '<div>v2 html</div>',
    });

    // Second iteration
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Second change',
    });

    const context = pipelineStore.get(CONTEXT_ID)!;
    expect(context.iterations).toHaveLength(2);
    expect(context.iterations[1].generatedCode).toBe('second iteration code');
  });

  it('updates context.screenId to the newly edited screen id', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Change something',
    });

    const context = pipelineStore.get(CONTEXT_ID)!;
    expect(context.screenId).toBe('screen-edited');
  });

  it('caches the updated screen', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Update layout',
    });

    expect(cache.has('screen:screen-edited')).toBe(true);
  });

  it('uses model override when provided', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Change font',
      model: 'gemini-2.5-flash',
    });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-2.5-flash');
  });

  it('uses context model when no override specified', async () => {
    await iterateDesign(gemini, stitch, cache, pipelineStore, {
      contextId: CONTEXT_ID,
      feedback: 'Change font',
    });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-3.1-pro-preview');
  });
});
