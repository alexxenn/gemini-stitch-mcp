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
  cache.set(`screen:${screen.id}`, screen);

  return {
    screenId: screen.id,
    projectId: screen.projectId,
    imageUrl: screen.imageUrl,
    title: screen.title,
    htmlUrl: screen.htmlUrl,
  };
}
