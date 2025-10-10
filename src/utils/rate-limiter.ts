import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { logger } from './logger.js';
import { createErrorResponse } from './errors.js';
import type { RateLimitConfig, ToolResponse, ToolInfo } from '../types/index.js';

/**
 * Tool operation type classification
 */
export const TOOL_CLASSIFICATIONS: Record<string, ToolInfo> = {
  read_note: { name: 'read_note', operationType: 'read', riskLevel: 'low' },
  list_notes: { name: 'list_notes', operationType: 'read', riskLevel: 'low' },
  search_notes: { name: 'search_notes', operationType: 'read', riskLevel: 'medium' },
  get_backlinks: { name: 'get_backlinks', operationType: 'read', riskLevel: 'medium' },
  get_vault_stats: { name: 'get_vault_stats', operationType: 'read', riskLevel: 'low' },
  get_daily_note: { name: 'get_daily_note', operationType: 'read', riskLevel: 'low' },

  create_note: { name: 'create_note', operationType: 'write', riskLevel: 'medium' },
  edit_note: { name: 'edit_note', operationType: 'write', riskLevel: 'high' },
  delete_note: { name: 'delete_note', operationType: 'write', riskLevel: 'high' },
  move_note: { name: 'move_note', operationType: 'write', riskLevel: 'high' },
  update_frontmatter: { name: 'update_frontmatter', operationType: 'write', riskLevel: 'medium' },
  create_folder: { name: 'create_folder', operationType: 'write', riskLevel: 'low' },
  open_in_obsidian: { name: 'open_in_obsidian', operationType: 'write', riskLevel: 'low' },
};

/**
 * Rate limiter manager with multiple tiers
 */
export class RateLimitManager {
  private config: RateLimitConfig;
  private globalLimiter: RateLimiterMemory | RateLimiterRedis;
  private readLimiter: RateLimiterMemory | RateLimiterRedis;
  private writeLimiter: RateLimiterMemory | RateLimiterRedis;
  private toolLimiters: Map<string, RateLimiterMemory | RateLimiterRedis> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Initialize backends
    this.globalLimiter = this.createLimiter('global');
    this.readLimiter = this.createLimiter('read');
    this.writeLimiter = this.createLimiter('write');

    // Initialize tool-specific limiters
    if (config.limits.tools) {
      for (const [toolName, limits] of Object.entries(config.limits.tools)) {
        this.toolLimiters.set(toolName, this.createLimiter('tool', toolName, limits));
      }
    }
  }

  /**
   * Create a rate limiter instance
   */
  private createLimiter(type: string, toolName?: string, customLimits?: any): RateLimiterMemory | RateLimiterRedis {
    const keyPrefix = `obsidian_mcp_${type}${toolName ? `_${toolName}` : ''}`;

    if (this.config.backend === 'redis') {
      if (!this.config.redis) {
        throw new Error('Redis configuration required for Redis backend');
      }

      return new RateLimiterRedis({
        keyPrefix,
        points: this.getLimitForType(type, toolName, 'minute', customLimits),
        duration: 60,
        storeClient: this.createRedisClient(),
      });
    }

    return new RateLimiterMemory({
      keyPrefix,
      points: this.getLimitForType(type, toolName, 'minute', customLimits),
      duration: 60,
    });
  }

  /**
   * Get rate limit for specific type and timeframe
   */
  private getLimitForType(type: string, toolName?: string, timeframe: 'minute' | 'hour' = 'minute', customLimits?: any): number {
    if (customLimits && customLimits[`requests_per_${timeframe}`]) {
      return customLimits[`requests_per_${timeframe}`];
    }

    switch (type) {
      case 'global':
        return this.config.limits.global[`requests_per_${timeframe}`];
      case 'read':
        return this.config.limits.read[`requests_per_${timeframe}`];
      case 'write':
        return this.config.limits.write[`requests_per_${timeframe}`];
      case 'tool':
        const classification = TOOL_CLASSIFICATIONS[toolName!];
        if (classification) {
          return this.config.limits[classification.operationType][`requests_per_${timeframe}`];
        }
        return this.config.limits.global[`requests_per_${timeframe}`];
      default:
        return this.config.limits.global[`requests_per_${timeframe}`];
    }
  }

  /**
   * Create Redis client (placeholder - implement based on your Redis setup)
   */
  private createRedisClient() {
    // This would be implemented with actual Redis client
    // For now, return a mock that throws an error
    throw new Error('Redis backend not implemented yet. Use memory backend for development.');
  }

  /**
   * Check rate limits for a tool call
   */
  async checkRateLimit(toolName: string, vaultName?: string): Promise<{
    allowed: boolean;
    waitTime?: number;
    warning?: string;
    response?: ToolResponse;
  }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const classification = TOOL_CLASSIFICATIONS[toolName];
    if (!classification) {
      logger.warn({ toolName }, 'Unknown tool for rate limiting');
      return { allowed: true };
    }

    const keySuffix = vaultName ? `_${vaultName}` : '';

    // Check global limits
    try {
      await this.globalLimiter.consume(`global${keySuffix}`);
    } catch (rejRes: any) {
      if (rejRes.msBeforeNext) {
        const waitTime = Math.ceil(rejRes.msBeforeNext / 1000);
        return {
          allowed: false,
          waitTime,
          response: createErrorResponse(
            'Global rate limit exceeded',
            `Too many total requests. Try again in ${waitTime} seconds.`,
            'RATE_LIMIT_EXCEEDED',
            `Current usage: ${rejRes.totalHits}/${rejRes.totalPoints} requests`
          ),
        };
      }
    }

    // Check operation-specific limits
    const operationLimiter = classification.operationType === 'read' ? this.readLimiter : this.writeLimiter;
    try {
      await operationLimiter.consume(`${classification.operationType}${keySuffix}`);
    } catch (rejRes: any) {
      if (rejRes.msBeforeNext) {
        const waitTime = Math.ceil(rejRes.msBeforeNext / 1000);
        return {
          allowed: false,
          waitTime,
          response: createErrorResponse(
            `${classification.operationType} rate limit exceeded`,
            `Too many ${classification.operationType} operations. Try again in ${waitTime} seconds.`,
            'RATE_LIMIT_EXCEEDED',
            `Current usage: ${rejRes.totalHits}/${rejRes.totalPoints} requests`
          ),
        };
      }
    }

    // Check tool-specific limits if configured
    const toolLimiter = this.toolLimiters.get(toolName);
    if (toolLimiter) {
      try {
        await toolLimiter.consume(`${toolName}${keySuffix}`);
      } catch (rejRes: any) {
        if (rejRes.msBeforeNext) {
          const waitTime = Math.ceil(rejRes.msBeforeNext / 1000);
          return {
            allowed: false,
            waitTime,
            response: createErrorResponse(
              'Tool rate limit exceeded',
              `Too many ${toolName} operations. Try again in ${waitTime} seconds.`,
              'RATE_LIMIT_EXCEEDED',
              `Current usage: ${rejRes.totalHits}/${rejRes.totalPoints} requests`
            ),
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Get current rate limit status for monitoring
   */
  async getRateLimitStatus(vaultName?: string): Promise<{
    global: { current: number; limit: number };
    read: { current: number; limit: number };
    write: { current: number; limit: number };
    tools: Record<string, { current: number; limit: number }>;
  }> {
    if (!this.config.enabled) {
      return {
        global: { current: 0, limit: 0 },
        read: { current: 0, limit: 0 },
        write: { current: 0, limit: 0 },
        tools: {},
      };
    }

    const keySuffix = vaultName ? `_${vaultName}` : '';
    const status = {
      global: await this.getLimiterStatus(this.globalLimiter, `global${keySuffix}`),
      read: await this.getLimiterStatus(this.readLimiter, `read${keySuffix}`),
      write: await this.getLimiterStatus(this.writeLimiter, `write${keySuffix}`),
      tools: {} as Record<string, { current: number; limit: number }>,
    };

    // Get tool-specific statuses
    for (const [toolName] of this.toolLimiters) {
      const toolStatus = await this.getLimiterStatus(
        this.toolLimiters.get(toolName)!,
        `${toolName}${keySuffix}`
      );
      status.tools[toolName] = toolStatus;
    }

    return status;
  }

  /**
   * Get status for a specific rate limiter
   */
  private async getLimiterStatus(limiter: any, key: string): Promise<{ current: number; limit: number }> {
    try {
      const result = await limiter.get(key);
      return {
        current: result.totalHits || 0,
        limit: result.totalPoints || 0,
      };
    } catch {
      return { current: 0, limit: 0 };
    }
  }
}
