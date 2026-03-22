import type { GeminiClient } from "../../clients/gemini-client.js";
import type { GeminiModel } from "../../types.js";

export interface GeminiPromptParams {
  prompt: string;
  systemPrompt?: string;
  model?: GeminiModel;
}

export async function geminiPrompt(client: GeminiClient, params: GeminiPromptParams) {
  const { prompt, systemPrompt, model } = params;

  const response = await client.generate(prompt, {
    model,
    systemPrompt,
  });

  return {
    response,
    model: client.resolveModel(model),
  };
}
