import pino, { type Logger, type LoggerOptions } from 'pino';
import { config } from './config.js';

const baseOptions: LoggerOptions = {
  level: config.LOG_LEVEL,
  base: { service: 'oracle' },
  redact: {
    paths: [
      'req.headers.authorization',
      '*.x-apisports-key',
      'headers.x-apisports-key',
      'ORACLE_INTERNAL_API_KEY',
    ],
    censor: '[REDACTED]',
  },
};

function buildLogger(): Logger {
  if (config.NODE_ENV === 'production') {
    return pino(baseOptions);
  }
  return pino({
    ...baseOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname,service',
      },
    },
  });
}

export const logger: Logger = buildLogger();

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
