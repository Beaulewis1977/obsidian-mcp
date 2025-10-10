
import fetch from 'node-fetch';
import https from 'https';
import { logger } from '../utils/logger.js';
import { isRetryableError, isAuthError, isClientError, sleep } from '../utils/errors.js';
import type { ObsidianAPIConfig, RetryConfig } from '../types/index.js';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  max_retries: 2,
  initial_delay: 1000,
  max_delay: 10000
};

export class ObsidianAPIClient {
  private config: ObsidianAPIConfig;
  private retryConfig: RetryConfig;
  private httpsAgent: https.Agent;
  private available: boolean | null = null;
  
  constructor(config: ObsidianAPIConfig) {
    this.config = {
      timeout: 5000,
      verify_ssl: false,
      fallback_to_filesystem: true,
      retry: DEFAULT_RETRY_CONFIG,
      ...config
    };
    
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...this.config.retry
    };
    
    // Create HTTPS agent
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: this.config.verify_ssl
    });
  }
  
  /**
   * Check if API is available
   */
  async checkAvailability(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }
    
    try {
      const response = await fetch(`${this.config.url}/`, {
        method: 'GET',
        headers: this.getHeaders(),
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      this.available = response.ok;
      logger.info({ available: this.available }, 'API availability checked');
      return this.available;
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'API is not available');
      this.available = false;
      return false;
    }
  }
  
  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.retryConfig.enabled) {
      return operation();
    }
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.retryConfig.max_retries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on auth or client errors
        if (isAuthError(error) || isClientError(error)) {
          throw error;
        }
        
        // Don't retry if this was the last attempt
        if (attempt === this.retryConfig.max_retries) {
          break;
        }
        
        // Only retry on retryable errors
        if (!isRetryableError(error)) {
          throw error;
        }
        
        // Calculate backoff delay
        const delay = Math.min(
          this.retryConfig.initial_delay * Math.pow(2, attempt),
          this.retryConfig.max_delay
        );
        
        logger.warn({
          attempt: attempt + 1,
          maxRetries: this.retryConfig.max_retries,
          delay,
          error: error.message
        }, 'API call failed, retrying...');
        
        await sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Get request headers
   */
  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.api_key}`,
      'Content-Type': 'text/markdown',
      ...additionalHeaders
    };
  }
  
  /**
   * Create or replace note
   */
  async createNote(path: string, content: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.url}/vault/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: content,
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      logger.info({ path }, 'Note created via API');
    });
  }
  
  /**
   * Append to note
   */
  async appendNote(path: string, content: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.url}/vault/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: content,
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      logger.info({ path }, 'Content appended via API');
    });
  }
  
  /**
   * Edit note with targeted insertion
   */
  async editNote(
    path: string,
    content: string,
    options: {
      operation?: 'insert' | 'replace' | 'delete';
      targetType?: 'heading' | 'block' | 'line';
      target?: string;
      createIfMissing?: boolean;
    } = {}
  ): Promise<void> {
    return this.executeWithRetry(async () => {
      const headers = this.getHeaders({
        'Operation': options.operation || 'insert',
        'Target-Type': options.targetType || 'heading',
        'Target': options.target || '',
        'Create-Target-If-Missing': options.createIfMissing ? 'true' : 'false',
        'Trim-Target-Whitespace': 'true'
      });
      
      const response = await fetch(`${this.config.url}/vault/${encodeURIComponent(path)}`, {
        method: 'PATCH',
        headers,
        body: content,
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      logger.info({ path, options }, 'Note edited via API');
    });
  }
  
  /**
   * Delete note
   */
  async deleteNote(path: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.url}/vault/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      logger.info({ path }, 'Note deleted via API');
    });
  }
  
  /**
   * Open note in Obsidian
   */
  async openNote(path: string): Promise<void> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.url}/open/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: this.getHeaders(),
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      logger.info({ path }, 'Note opened via API');
    });
  }
  
  /**
   * Search vault
   */
  async search(query: string): Promise<any> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.config.url}/search/?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: this.getHeaders(),
        agent: this.httpsAgent,
        signal: AbortSignal.timeout(this.config.timeout!)
      });
      
      if (!response.ok) {
        const error: any = new Error(`API request failed: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      const results = await response.json() as any;
      logger.info({ query, resultCount: results.length }, 'Search completed via API');
      return results;
    });
  }
}
