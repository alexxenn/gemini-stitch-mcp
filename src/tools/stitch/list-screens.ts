import type { StitchClient } from "../../clients/stitch-client.js";
import type { ListScreensParams } from "../../types.js";

export async function stitchListScreens(client: StitchClient, params: ListScreensParams) {
  const { projectId } = params;

  const screens = await client.listScreens(projectId);

  return {
    screens: screens.map((s) => ({
      screenId: s.screenId,
      name: s.name,
      previewUrl: s.previewUrl,
      createdAt: s.createdAt,
    })),
  };
}
