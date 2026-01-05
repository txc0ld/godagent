/**
 * Security Utilities (SPEC-SEC-001)
 *
 * Security helpers for handling sensitive information.
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

// ==================== API Key Handling ====================

/**
 * Mask an API key for safe logging/display
 * Shows first 7 and last 4 characters only
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 15) return '***masked***';
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
}

/**
 * Validate API key format without exposing it
 */
export function validateApiKeyFormat(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'API key is required' };
  }
  if (typeof key !== 'string') {
    return { valid: false, error: 'API key must be a string' };
  }
  if (!key.startsWith('sk-ant-')) {
    return { valid: false, error: 'Invalid API key format' };
  }
  if (key.length < 50) {
    return { valid: false, error: 'API key appears to be truncated' };
  }
  return { valid: true };
}

/**
 * Hash an API key for storage/comparison (if needed)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ==================== Input Sanitization ====================

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeInput(input: string, maxLength = 10000): string {
  if (typeof input !== 'string') return '';
  
  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);
  
  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  const sanitized = url.trim();
  
  // Only allow http and https protocols
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    return '';
  }
  
  // Basic URL validation
  try {
    new URL(sanitized);
    return sanitized;
  } catch {
    return '';
  }
}

// ==================== Request Validation ====================

/**
 * Validate request body has required fields
 */
export function validateRequestBody(
  body: unknown,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, missing: requiredFields };
  }
  
  const missing = requiredFields.filter(
    field => !(field in (body as Record<string, unknown>))
  );
  
  return { valid: missing.length === 0, missing };
}

// ==================== Security Headers Middleware ====================

/**
 * Add security headers to responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (adjust as needed)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:* https://api.anthropic.com"
  );
  
  // Remove powered-by header
  res.removeHeader('X-Powered-By');
  
  next();
}

// ==================== Rate Limiting ====================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, maxRequests, keyGenerator } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }
    }
    
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    }
    
    entry.count++;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
    
    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }
    
    next();
  };
}

// ==================== Logging Utilities ====================

/**
 * Safe logger that masks sensitive data
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
  const sensitiveKeys = ['apiKey', 'api_key', 'apikey', 'key', 'secret', 'password', 'token', 'authorization'];
  
  let safeData = data;
  if (data) {
    safeData = { ...data };
    for (const key of Object.keys(safeData)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        const value = safeData[key];
        if (typeof value === 'string') {
          safeData[key] = maskApiKey(value);
        } else {
          safeData[key] = '***masked***';
        }
      }
    }
  }
  
  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (safeData) {
    logFn(`[${level.toUpperCase()}] ${message}`, safeData);
  } else {
    logFn(`[${level.toUpperCase()}] ${message}`);
  }
}

// ==================== File Permissions ====================

/**
 * Set secure file permissions (Unix only)
 */
export async function setSecureFilePermissions(filePath: string): Promise<void> {
  try {
    const fs = await import('fs');
    // 0o600 = owner read/write only
    fs.chmodSync(filePath, 0o600);
  } catch {
    // May fail on Windows or if permissions can't be changed
  }
}

// ==================== Environment Validation ====================

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY not set in environment');
  }
  
  if (isProduction()) {
    if (!process.env.NODE_ENV) {
      warnings.push('NODE_ENV should be set to "production" in production');
    }
  }
  
  return { valid: warnings.length === 0, warnings };
}

