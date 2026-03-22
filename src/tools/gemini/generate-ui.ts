import type { GeminiClient } from "../../clients/gemini-client.js";
import type { GenerateUIParams } from "../../types.js";
import { UI_GENERATION_PROMPT } from "../../prompts/system-prompts.js";

export async function geminiGenerateUI(client: GeminiClient, params: GenerateUIParams) {
  const {
    prompt,
    framework = "react",
    styling = "tailwind",
    componentType,
    model,
  } = params;

  const enrichedPrompt = [
    `Framework: ${framework}`,
    `Styling: ${styling}`,
    componentType ? `Component type: ${componentType}` : "",
    "",
    prompt,
  ]
    .filter(Boolean)
    .join("\n");

  const code = await client.generate(enrichedPrompt, {
    model: model ?? "gemini-2.5-pro",
    systemPrompt: UI_GENERATION_PROMPT,
  });

  return {
    code,
    framework,
    styling,
    model: client.resolveModel(model ?? "gemini-2.5-pro"),
  };
}
