import type { StitchClient } from "../../clients/stitch-client.js";
import type { GenerateScreenParams } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";

export async function stitchGenerateScreen(
  client: StitchClient,
  cache: ScreenCache,
  params: GenerateScreenParams
) {
  const { prompt, projectId } = params;

  const screen = await client.generateScreen(prompt, projectId);
  cache.set(`screen:${screen.screenId}`, screen);

  return {
    screenId: screen.screenId,
    projectId: screen.projectId,
    previewUrl: screen.previewUrl,
    name: screen.name,
  };
}
