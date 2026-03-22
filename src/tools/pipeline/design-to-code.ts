import { randomUUID } from "node:crypto";
import type { GeminiClient } from "../../clients/gemini-client.js";
import type { StitchClient } from "../../clients/stitch-client.js";
import type { DesignToCodeParams, PipelineContext } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";
import { getConversionTemplate } from "../../prompts/templates.js";
import { HTML_TO_COMPONENT_PROMPT } from "../../prompts/system-prompts.js";

export async function designToCode(
  gemini: GeminiClient,
  stitch: StitchClient,
  cache: ScreenCache,
  pipelineStore: Map<string, PipelineContext>,
  params: DesignToCodeParams
) {
  const {
    prompt,
    framework = "react",
    styling = "tailwind",
    model,
  } = params;

  // Step 1: Generate design via Stitch
  const screen = await stitch.generateScreen(prompt);
  cache.set(`screen:${screen.screenId}`, screen);

  // Step 2: Extract HTML/CSS
  const { html, css } = await stitch.getScreenHtml(screen.screenId);

  // Step 3: Convert to component via Gemini
  const conversionPrompt = getConversionTemplate(html, css, framework, styling);
  const generatedCode = await gemini.generate(conversionPrompt, {
    model: model ?? "gemini-3.1-pro-preview",
    systemPrompt: HTML_TO_COMPONENT_PROMPT,
  });

  // Step 4: Store pipeline context for iteration
  const contextId = randomUUID();
  const context: PipelineContext = {
    contextId,
    prompt,
    framework,
    styling,
    screenId: screen.screenId,
    projectId: screen.projectId,
    previewUrl: screen.previewUrl,
    rawHtml: html,
    rawCss: css,
    generatedCode,
    model: gemini.resolveModel(model ?? "gemini-3.1-pro-preview"),
    iterations: [],
    createdAt: Date.now(),
  };

  pipelineStore.set(contextId, context);

  return {
    contextId,
    screenId: screen.screenId,
    previewUrl: screen.previewUrl,
    code: generatedCode,
    framework,
    styling,
    model: context.model,
  };
}
