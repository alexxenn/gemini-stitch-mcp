/**
 * Minimal structured logger for MCP server.
 * All output goes to stderr (stdout is reserved for JSON-RPC).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function log(level: LogLevel, component: string, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    component,
    msg: message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  console.error(JSON.stringify(entry));
}

export const logger = {
  debug: (component: string, message: string, meta?: Record<string, unknown>) => log("debug", component, message, meta),
  info: (component: string, message: string, meta?: Record<string, unknown>) => log("info", component, message, meta),
  warn: (component: string, message: string, meta?: Record<string, unknown>) => log("warn", component, message, meta),
  error: (component: string, message: string, meta?: Record<string, unknown>) => log("error", component, message, meta),
};
