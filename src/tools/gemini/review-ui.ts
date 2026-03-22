import type { GeminiClient } from "../../clients/gemini-client.js";
import type { ReviewUIParams } from "../../types.js";
import { UI_REVIEW_PROMPT } from "../../prompts/system-prompts.js";

export async function geminiReviewUI(client: GeminiClient, params: ReviewUIParams) {
  const { code, checkAccessibility = true, checkResponsiveness = true, model } = params;

  const focusAreas = [
    "General code quality and best practices",
    checkAccessibility ? "Accessibility (WCAG 2.1 AA compliance)" : null,
    checkResponsiveness ? "Responsive design across breakpoints" : null,
  ]
    .filter(Boolean)
    .join("\n- ");

  const prompt = `Review this UI code:\n\n${code}\n\nFocus areas:\n- ${focusAreas}`;

  const review = await client.generate(prompt, {
    model: model ?? "gemini-2.5-pro",
    systemPrompt: UI_REVIEW_PROMPT,
  });

  // Try to parse as JSON, fall back to raw text
  try {
    return JSON.parse(review);
  } catch {
    return { review, model: client.resolveModel(model ?? "gemini-2.5-pro") };
  }
}
