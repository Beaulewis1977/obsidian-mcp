
import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Create logger with redacted sensitive data
 */
export const logger = pino({
  level: LOG_LEVEL,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  
  // Redact sensitive fields
  redact: {
    paths: [
      'Authorization',
      'authorization',
      'api_key',
      'apiKey',
      '*.Authorization',
      '*.authorization',
      '*.api_key',
      'headers.Authorization',
      'headers.authorization',
      'config.obsidian_api.api_key',
      'config.vaults[*].obsidian_api.api_key'
    ],
    censor: '[REDACTED]'
  }
});

/**
 * Create child logger with context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}
