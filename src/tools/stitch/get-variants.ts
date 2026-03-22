import type { StitchClient } from "../../clients/stitch-client.js";
import type { GetVariantsParams } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";

export async function stitchGetVariants(
  client: StitchClient,
  cache: ScreenCache,
  params: GetVariantsParams
) {
  const { screenId, count = 3 } = params;

  const variants = await client.getVariants(screenId, count);

  for (const v of variants) {
    cache.set(`screen:${v.screenId}`, v);
  }

  return {
    variants: variants.map((v) => ({
      screenId: v.screenId,
      previewUrl: v.previewUrl,
      name: v.name,
    })),
  };
}
