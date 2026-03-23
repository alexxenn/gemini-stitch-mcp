import type { StitchClient } from "../../clients/stitch-client.js";
import type { GetHtmlParams, StitchScreen } from "../../types.js";
import { type ScreenCache } from "../../cache/screen-cache.js";

const MAX_OUTPUT_CHARS = 8000;

export async function stitchGetHtml(
  client: StitchClient,
  cache: ScreenCache,
  params: GetHtmlParams
) {
  const { screenId, minify = false } = params;

  const cacheKey = `html:${screenId}:${minify}`;
  const cached = cache.get<{ html: string }>(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // Resolve projectId from cached screen metadata if available
  const screenMeta = cache.get<StitchScreen>(`screen:${screenId}`);
  const projectId = screenMeta?.projectId;

  const result = await client.getScreenHtml(screenId, projectId);
  let { html } = result;

  if (minify) {
    html = html.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
  }

  const truncated = html.length > MAX_OUTPUT_CHARS;
  if (truncated) {
    html = html.slice(0, MAX_OUTPUT_CHARS);
  }

  const output = { html, truncated };
  cache.set(cacheKey, output);

  return output;
}
