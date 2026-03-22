import { describe, it, expect, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_INDEX = resolve(__dirname, '../../../dist/index.js');

function sendRequest(proc: ChildProcess, request: object): Promise<object> {
  return new Promise((res, rej) => {
    const message = JSON.stringify(request) + '\n';
    let buffer = '';

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        try {
          const parsed = JSON.parse(line);
          proc.stdout!.off('data', onData);
          res(parsed);
          return;
        } catch {
          // not JSON — ignore (could be stderr-to-stdout bleed)
        }
      }
    };

    proc.stdout!.on('data', onData);
    setTimeout(() => {
      proc.stdout!.off('data', onData);
      rej(new Error(`Timeout waiting for response to: ${message.trim()}`));
    }, 5000);

    proc.stdin!.write(message);
  });
}

describe('MCP server stdio E2E', { timeout: 30000 }, () => {
  let proc: ChildProcess | null = null;

  afterEach(async () => {
    if (proc) {
      proc.stdin?.end();
      proc.kill();
      proc = null;
      // Give the process a moment to clean up
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  it('responds to initialize with server name and version', async () => {
    proc = spawn('node', [DIST_INDEX], {
      env: { ...process.env, GEMINI_API_KEY: 'test-key' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Collect stderr for debugging but don't fail on it
    proc.stderr?.on('data', () => {});

    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.1' },
      },
    }) as Record<string, unknown>;

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);

    const result = response.result as Record<string, unknown>;
    expect(result).toBeDefined();

    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo).toBeDefined();
    expect(serverInfo.name).toBe('gemini-stitch-mcp');
    expect(serverInfo.version).toBeTruthy();
  });

  it('lists all expected tools in tools/list response', async () => {
    proc = spawn('node', [DIST_INDEX], {
      env: { ...process.env, GEMINI_API_KEY: 'test-key' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stderr?.on('data', () => {});

    // Initialize first
    await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.1' },
      },
    });

    // Then request tools list
    const response = await sendRequest(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }) as Record<string, unknown>;

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(2);

    const result = response.result as Record<string, unknown>;
    const tools = result.tools as Array<{ name: string }>;
    expect(Array.isArray(tools)).toBe(true);

    const toolNames = tools.map((t) => t.name);

    const expectedTools = [
      'gemini_generate_ui',
      'gemini_refine_code',
      'gemini_review_ui',
      'gemini_chat',
      'gemini_prompt',
      'stitch_generate_screen',
      'stitch_get_html',
      'stitch_edit_screen',
      'stitch_get_variants',
      'stitch_list_screens',
      'design_to_code',
      'iterate_design',
    ];

    for (const expectedName of expectedTools) {
      expect(toolNames, `Expected tool "${expectedName}" to be present`).toContain(expectedName);
    }
  });
});
