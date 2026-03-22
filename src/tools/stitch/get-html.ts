import type { StitchClient } from "../../clients/stitch-client.js";
import type { GetHtmlParams } from "../../types.js";
import { ScreenCache } from "../../cache/screen-cache.js";

const MAX_OUTPUT_CHARS = 8000;

export async function stitchGetHtml(
  client: StitchClient,
  cache: ScreenCache,
  params: GetHtmlParams
) {
  const { screenId, minify = false } = params;

  const cacheKey = `html:${screenId}:${minify}`;
  const cached = cache.get<{ html: string; css: string }>(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const result = await client.getScreenHtml(screenId);

  let { html, css } = result;

  if (minify) {
    html = html.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
    css = css.replace(/\s+/g, " ").replace(/;\s+/g, ";").trim();
  }

  const truncated = html.length + css.length > MAX_OUTPUT_CHARS;

  if (truncated) {
    const halfMax = Math.floor(MAX_OUTPUT_CHARS / 2);
    html = html.slice(0, halfMax);
    css = css.slice(0, halfMax);
  }

  const output = { html, css, truncated };
  cache.set(cacheKey, output);

  return output;
}
