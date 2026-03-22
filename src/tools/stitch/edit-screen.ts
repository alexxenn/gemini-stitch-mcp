import type { StitchClient } from "../../clients/stitch-client.js";
import type { EditScreenParams } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";

export async function stitchEditScreen(
  client: StitchClient,
  cache: ScreenCache,
  params: EditScreenParams
) {
  const { screenId, instructions } = params;

  const screen = await client.editScreen(screenId, instructions);
  cache.set(`screen:${screen.screenId}`, screen);
  // Invalidate cached HTML since screen changed
  cache.delete(`html:${screenId}:true`);
  cache.delete(`html:${screenId}:false`);

  return {
    screenId: screen.screenId,
    previewUrl: screen.previewUrl,
    name: screen.name,
  };
}
