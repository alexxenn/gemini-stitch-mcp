import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGeminiClient } from '../../__tests__/helpers/mock-gemini-client.js';
import { geminiGenerateUI } from './generate-ui.js';

describe('geminiGenerateUI', () => {
  let gemini: ReturnType<typeof createMockGeminiClient>;

  beforeEach(() => {
    gemini = createMockGeminiClient();
    vi.mocked(gemini.generate).mockResolvedValue('<button class="btn">Click me</button>');
    vi.mocked(gemini.resolveModel).mockImplementation((m) => m ?? 'gemini-3.1-pro-preview');
  });

  it('generates code and returns framework, styling, and model', async () => {
    const result = await geminiGenerateUI(gemini, {
      prompt: 'A login form',
      framework: 'react',
      styling: 'tailwind',
    });

    expect(result.code).toBe('<button class="btn">Click me</button>');
    expect(result.framework).toBe('react');
    expect(result.styling).toBe('tailwind');
    expect(result.model).toBe('gemini-3.1-pro-preview');
  });

  it('includes framework and styling in the prompt sent to generate', async () => {
    await geminiGenerateUI(gemini, {
      prompt: 'A dashboard card',
      framework: 'vue',
      styling: 'css',
    });

    const callArg = vi.mocked(gemini.generate).mock.calls[0][0] as string;
    expect(callArg).toContain('Framework: vue');
    expect(callArg).toContain('Styling: css');
    expect(callArg).toContain('A dashboard card');
  });

  it('includes componentType in prompt when provided', async () => {
    await geminiGenerateUI(gemini, {
      prompt: 'A data display widget',
      framework: 'react',
      styling: 'tailwind',
      componentType: 'card',
    });

    const callArg = vi.mocked(gemini.generate).mock.calls[0][0] as string;
    expect(callArg).toContain('Component type: card');
  });

  it('omits componentType line when not provided', async () => {
    await geminiGenerateUI(gemini, {
      prompt: 'A simple button',
      framework: 'react',
      styling: 'tailwind',
    });

    const callArg = vi.mocked(gemini.generate).mock.calls[0][0] as string;
    expect(callArg).not.toContain('Component type:');
  });

  it('uses default model gemini-3.1-pro-preview when no model specified', async () => {
    await geminiGenerateUI(gemini, { prompt: 'A nav bar' });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-3.1-pro-preview');
  });

  it('passes model override to generate', async () => {
    await geminiGenerateUI(gemini, {
      prompt: 'A footer',
      model: 'gemini-2.5-flash',
    });

    const opts = vi.mocked(gemini.generate).mock.calls[0][1];
    expect(opts?.model).toBe('gemini-2.5-flash');
  });

  it('defaults to react framework and tailwind styling', async () => {
    const result = await geminiGenerateUI(gemini, { prompt: 'A header' });

    expect(result.framework).toBe('react');
    expect(result.styling).toBe('tailwind');
  });

  it('calls resolveModel with the model used', async () => {
    await geminiGenerateUI(gemini, {
      prompt: 'A sidebar',
      model: 'gemini-3.1-pro-preview',
    });

    expect(vi.mocked(gemini.resolveModel)).toHaveBeenCalledWith('gemini-3.1-pro-preview');
  });
});
