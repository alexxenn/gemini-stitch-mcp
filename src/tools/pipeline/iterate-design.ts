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
  pipelineStore: { get(key: string): PipelineContext | undefined; set(key: string, value: PipelineContext): void },
  params: IterateDesignParams
) {
  const { contextId, feedback, model } = params;

  const context = pipelineStore.get(contextId);
  if (!context) {
    throw new Error(`Pipeline context not found: ${contextId}. Use design_to_code first.`);
  }

  // Step 1: Edit the Stitch design based on feedback
  const updatedScreen = await stitch.editScreen(context.screenId, feedback, context.projectId);
  cache.set(`screen:${updatedScreen.id}`, updatedScreen);

  // Step 2: Get updated HTML
  const { html } = await stitch.getScreenHtml(updatedScreen.id, updatedScreen.projectId);

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
    screenId: updatedScreen.id,
    rawHtml: html,
    generatedCode,
    timestamp: Date.now(),
  });

  // Update screen ID if Stitch returned a new one
  context.screenId = updatedScreen.id;

  return {
    contextId,
    screenId: updatedScreen.id,
    imageUrl: updatedScreen.imageUrl,
    code: generatedCode,
    iteration: context.iterations.length,
    framework: context.framework,
    styling: context.styling,
  };
}
