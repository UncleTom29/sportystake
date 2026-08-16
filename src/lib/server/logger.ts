/**
 * Structured logger for server-side code. In production, outputs JSON lines
 * suitable for log aggregation (Datadog, CloudWatch, etc.). In development,
 * outputs human-readable colored console output.
 *
 * Usage:
 *   import { logger } from "@/lib/server/logger";
 *   logger.info("bet placed", { userId, game, amount });
 *   logger.critical("bankroll insufficient", { contractBalance, requiredPayout });
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  critical: "\x1b[35m", // magenta
};
const COLOR_RESET = "\x1b[0m";

function getLogLevel(): number {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && LEVEL_SEVERITY[envLevel] !== undefined) {
    return LEVEL_SEVERITY[envLevel];
  }
  return process.env.NODE_ENV === "production" ? LEVEL_SEVERITY.info : LEVEL_SEVERITY.debug;
}

function logMessage(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVEL_SEVERITY[level] < getLogLevel()) {
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const finalContext = { ...context };

  if (level === "error" || level === "critical") {
    finalContext.stack = new Error().stack;
  }

  if (level === "critical") {
    finalContext.alert = true;
  }

  if (isProd) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...finalContext,
    };
    
    const output = JSON.stringify(payload);
    if (level === "critical" || level === "error") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  } else {
    let output = `${LEVEL_COLORS[level]}[${level}]${COLOR_RESET} ${message}`;
    if (Object.keys(finalContext).length > 0) {
      output += ` ${JSON.stringify(finalContext)}`;
    }
    
    if (level === "critical" || level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => logMessage("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => logMessage("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => logMessage("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => logMessage("error", message, context),
  critical: (message: string, context?: Record<string, unknown>) => logMessage("critical", message, context),
};
