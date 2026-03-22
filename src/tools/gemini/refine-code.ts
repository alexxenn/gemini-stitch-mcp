import type { GeminiClient } from "../../clients/gemini-client.js";
import type { RefineCodeParams } from "../../types.js";
import { CODE_REFINEMENT_PROMPT } from "../../prompts/system-prompts.js";

export async function geminiRefineCode(client: GeminiClient, params: RefineCodeParams) {
  const { code, instructions, model } = params;

  const prompt = `=== EXISTING CODE ===\n${code}\n\n=== INSTRUCTIONS ===\n${instructions}`;

  const refined = await client.generate(prompt, {
    model: model ?? "gemini-2.5-flash",
    systemPrompt: CODE_REFINEMENT_PROMPT,
  });

  return {
    code: refined,
    model: client.resolveModel(model ?? "gemini-2.5-flash"),
  };
}
