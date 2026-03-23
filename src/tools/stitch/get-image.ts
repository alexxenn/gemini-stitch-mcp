import type { StitchClient } from "../../clients/stitch-client.js";
import type { GetImageParams } from "../../types.js";
import { type ScreenCache } from "../../cache/screen-cache.js";

export async function stitchGetImage(
  client: StitchClient,
  cache: ScreenCache,
  params: GetImageParams
) {
  const { screenId } = params;

  const cacheKey = `image:${screenId}`;
  const cached = cache.get<{ imageUrl: string }>(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const result = await client.getScreenImage(screenId);
  cache.set(cacheKey, result);

  return result;
}
