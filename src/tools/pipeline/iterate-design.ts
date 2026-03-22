import type { GeminiClient } from "../../clients/gemini-client.js";
import type { StitchClient } from "../../clients/stitch-client.js";
import type { IterateDesignParams, PipelineContext } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";
import { getIterationTemplate } from "../../prompts/templates.js";
import { HTML_TO_COMPONENT_PROMPT } from "../../prompts/system-prompts.js";

export async function iterateDesign(
  gemini: GeminiClient,
  stitch: StitchClient,
  cache: ScreenCache,
  pipelineStore: Map<string, PipelineContext>,
  params: IterateDesignParams
) {
  const { contextId, feedback, model } = params;

  const context = pipelineStore.get(contextId);
  if (!context) {
    throw new Error(`Pipeline context not found: ${contextId}. Use design_to_code first.`);
  }

  // Step 1: Edit the Stitch design based on feedback
  const updatedScreen = await stitch.editScreen(context.screenId, feedback);
  cache.set(`screen:${updatedScreen.screenId}`, updatedScreen);

  // Step 2: Get updated HTML/CSS
  const { html, css } = await stitch.getScreenHtml(updatedScreen.screenId);

  // Step 3: Get the latest code (from last iteration or initial)
  const previousCode =
    context.iterations.length > 0
      ? context.iterations[context.iterations.length - 1].generatedCode
      : context.generatedCode;

  // Step 4: Re-convert with context of previous code + feedback
  const iterationPrompt = getIterationTemplate(
    previousCode,
    feedback,
    html,
    css,
    context.framework,
    context.styling
  );

  const generatedCode = await gemini.generate(iterationPrompt, {
    model: model ?? context.model,
    systemPrompt: HTML_TO_COMPONENT_PROMPT,
  });

  // Step 5: Store iteration
  context.iterations.push({
    feedback,
    screenId: updatedScreen.screenId,
    rawHtml: html,
    rawCss: css,
    generatedCode,
    timestamp: Date.now(),
  });

  // Update screen ID if Stitch returned a new one
  context.screenId = updatedScreen.screenId;

  return {
    contextId,
    screenId: updatedScreen.screenId,
    previewUrl: updatedScreen.previewUrl,
    code: generatedCode,
    iteration: context.iterations.length,
    framework: context.framework,
    styling: context.styling,
  };
}
