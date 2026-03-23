import type { StitchClient } from "../../clients/stitch-client.js";
import type { GetVariantsParams } from "../../types.js";
import { type ScreenCache } from "../../cache/screen-cache.js";

export async function stitchGetVariants(
  client: StitchClient,
  cache: ScreenCache,
  params: GetVariantsParams
) {
  const { screenId, prompt, count = 3, creativeRange, aspects } = params;

  const variants = await client.getVariants(screenId, {
    prompt,
    count,
    creativeRange,
    aspects,
  });

  for (const v of variants) {
    cache.set(`screen:${v.id}`, v);
  }

  return {
    variants: variants.map((v) => ({
      screenId: v.id,
      imageUrl: v.imageUrl,
      title: v.title,
      htmlUrl: v.htmlUrl,
    })),
  };
}
