import type { StitchClient } from "../../clients/stitch-client.js";
import type { EditScreenParams, StitchScreen } from "../../types.js";
import { type ScreenCache } from "../../cache/screen-cache.js";

export async function stitchEditScreen(
  client: StitchClient,
  cache: ScreenCache,
  params: EditScreenParams
) {
  const { screenId, instructions } = params;

  // Resolve projectId from cached screen metadata
  const screenMeta = cache.get<StitchScreen>(`screen:${screenId}`);
  const projectId = screenMeta?.projectId;

  const screen = await client.editScreen(screenId, instructions, projectId);
  cache.set(`screen:${screen.id}`, screen);

  // Invalidate cached HTML since screen changed
  cache.delete(`html:${screenId}:true`);
  cache.delete(`html:${screenId}:false`);

  return {
    screenId: screen.id,
    imageUrl: screen.imageUrl,
    title: screen.title,
    htmlUrl: screen.htmlUrl,
  };
}
