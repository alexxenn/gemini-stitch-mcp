import { vi } from 'vitest';
import type { StitchClient } from '../../clients/stitch-client.js';

export function createMockStitchClient(): StitchClient {
  return {
    generateScreen: vi.fn().mockResolvedValue({
      id: 'screen-123',
      projectId: 'project-456',
      title: 'Mock Screen',
      imageUrl: 'https://example.com/image/screen-123',
      htmlUrl: 'https://example.com/html/screen-123',
    }),
    getScreenHtml: vi.fn().mockResolvedValue({
      html: '<div>mock html</div>',
    }),
    getScreenImage: vi.fn().mockResolvedValue({
      imageUrl: 'https://example.com/image/screen-123',
    }),
    editScreen: vi.fn().mockResolvedValue({
      id: 'screen-123-edited',
      projectId: 'project-456',
      title: 'Mock Screen Edited',
      imageUrl: 'https://example.com/image/screen-123-edited',
      htmlUrl: 'https://example.com/html/screen-123-edited',
    }),
    getVariants: vi.fn().mockResolvedValue([
      { id: 'variant-1', projectId: 'project-456', title: 'Variant 1' },
      { id: 'variant-2', projectId: 'project-456', title: 'Variant 2' },
      { id: 'variant-3', projectId: 'project-456', title: 'Variant 3' },
    ]),
    listScreens: vi.fn().mockResolvedValue([
      { id: 'screen-1', projectId: 'project-456', title: 'Screen 1' },
    ]),
    listProjects: vi.fn().mockResolvedValue([
      { id: 'project-456', title: 'Test Project' },
    ]),
  } as unknown as StitchClient;
}
