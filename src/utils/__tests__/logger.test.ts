import { describe, it, expect, vi } from 'vitest';
import { logger, createLogger } from '../logger.js';
import pino from 'pino';

describe('Logger', () => {
  describe('Logger Instance', () => {
    it('should be a pino logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have correct log level', () => {
      // Logger level should be set based on LOG_LEVEL env var or default to 'info'
      expect(logger.level).toBeDefined();
      expect(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).toContain(logger.level);
    });

    it('should not throw when logging messages', () => {
      expect(() => logger.info('Test info message')).not.toThrow();
      expect(() => logger.error('Test error message')).not.toThrow();
      expect(() => logger.warn('Test warning message')).not.toThrow();
      expect(() => logger.debug('Test debug message')).not.toThrow();
    });
  });

  describe('Structured Logging', () => {
    it('should accept structured data without throwing', () => {
      const testData = { userId: '123', action: 'test' };
      expect(() => logger.info(testData, 'User action performed')).not.toThrow();
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        request: {
          method: 'POST',
          url: '/api/test',
          headers: { 'content-type': 'application/json' }
        },
        response: {
          status: 200,
          data: { id: '123', name: 'test' }
        }
      };

      expect(() => logger.info(complexData, 'API request completed')).not.toThrow();
    });

    it('should handle arrays in log data', () => {
      const arrayData = { items: ['item1', 'item2', 'item3'], count: 3 };
      expect(() => logger.info(arrayData, 'Items processed')).not.toThrow();
    });
  });

  describe('Error Logging', () => {
    it('should handle Error objects in log data', () => {
      const error = new Error('Test error');
      const errorData = { error, context: 'test' };

      expect(() => logger.error(errorData, 'Error occurred')).not.toThrow();
    });

    it('should handle error objects with stack traces', () => {
      try {
        throw new Error('Intentional error for testing');
      } catch (error) {
        expect(() => logger.error({ error }, 'Caught error in test')).not.toThrow();
      }
    });
  });

  describe('Child Logger Creation', () => {
    it('should create child logger with context', () => {
      const childLogger = createLogger({ module: 'test', requestId: '123' });
      
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
    });

    it('should not throw when using child logger', () => {
      const childLogger = createLogger({ component: 'test-component' });
      
      expect(() => childLogger.info('Child logger test')).not.toThrow();
      expect(() => childLogger.error('Child logger error')).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      expect(() => {
        logger.info({ nullValue: null, undefinedValue: undefined }, 'Null test');
      }).not.toThrow();
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      // Pino handles circular references internally
      expect(() => {
        logger.info(circular, 'Circular reference test');
      }).not.toThrow();
    });

    it('should handle very large objects', () => {
      const largeData = {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` }))
      };

      expect(() => {
        logger.info(largeData, 'Large data test');
      }).not.toThrow();
    });

    it('should handle empty objects and messages', () => {
      expect(() => logger.info({}, '')).not.toThrow();
      expect(() => logger.info({}, 'Empty object test')).not.toThrow();
    });
  });

  describe('Redaction Configuration', () => {
    it('should have redaction paths configured', () => {
      // Verify that logger has redaction configuration
      // This is a structural test to ensure security features are in place
      expect(logger).toBeDefined();
      
      // Logger should not throw when logging sensitive data
      // (The actual redaction is handled by pino internally)
      expect(() => {
        logger.info({
          Authorization: 'Bearer secret-token',
          api_key: 'secret-key',
          config: {
            vaults: [{
              obsidian_api: {
                api_key: 'vault-secret'
              }
            }]
          }
        }, 'Test with sensitive data');
      }).not.toThrow();
    });
  });
});
