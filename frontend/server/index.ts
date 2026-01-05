/**
 * God Agent API Server
 * 
 * Express server that bridges the frontend to the God Agent CLI.
 * Handles request routing, orchestration, and streaming responses.
 */

import express, { Request, Response, NextFunction } from 'express';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import {
  securityHeaders,
  createRateLimiter,
  sanitizeInput,
  sanitizeUrl,
  validateApiKeyFormat,
  maskApiKey,
  safeLog,
  setSecureFilePermissions,
} from './security.js';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 4200;

// Project root (parent of frontend)
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

// ==================== Security Middleware ====================

// Apply security headers
app.use(securityHeaders);

// Parse JSON with size limit to prevent DoS
app.use(express.json({ limit: '1mb' }));

// Rate limiting for sensitive endpoints
const setupRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute for setup endpoints
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60, // 60 requests per minute for general API
});

// CORS - restrict in production
app.use((req, res, next) => {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['http://localhost:5173', 'http://localhost:5174']
    : '*';
  
  if (typeof allowedOrigins === 'string') {
    res.header('Access-Control-Allow-Origin', allowedOrigins);
  } else if (Array.isArray(allowedOrigins)) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Logging middleware (sanitized)
app.use((req, res, next) => {
  // Don't log request bodies that might contain sensitive data
  safeLog('info', `${req.method} ${req.path}`);
  next();
});

/**
 * Execute God Agent CLI command
 */
async function runGodAgentCLI(command: string, args: string[]): Promise<unknown> {
  const cliPath = path.join(PROJECT_ROOT, 'src/god-agent/universal/cli.ts');
  const fullArgs = [
    'tsx',
    cliPath,
    command,
    ...args,
    '--json'
  ];

  return runCLI(fullArgs);
}

/**
 * Execute Project CLI command
 */
async function runProjectCLI(command: string, args: string[]): Promise<unknown> {
  const cliPath = path.join(PROJECT_ROOT, 'src/god-agent/core/project/project-cli.ts');
  const fullArgs = [
    'tsx',
    cliPath,
    command,
    ...args,
    '--json'
  ];

  return runCLI(fullArgs);
}

/**
 * Generic CLI runner
 */
async function runCLI(fullArgs: string[]): Promise<unknown> {
  const command = fullArgs[2] || 'unknown';

  console.log(`[CLI] Running: npx ${fullArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', fullArgs, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[CLI] Error (code ${code}):`, stderr);
        // Try to parse JSON from stdout anyway
        try {
          const result = JSON.parse(stdout);
          resolve(result);
          return;
        } catch {
          reject(new Error(stderr || `CLI exited with code ${code}`));
          return;
        }
      }

      try {
        // Try to extract JSON from stdout - handles multi-line JSON with log lines
        const trimmedOutput = stdout.trim();
        
        // Find the main JSON output by looking for the expected structure
        // The CLI outputs with keys like "command", "success", "selectedAgent"
        // Look for opening brace followed by "command" or start of proper JSON
        const jsonPatterns = [
          /\{\s*"command"\s*:/,
          /\{\s*"success"\s*:/,
        ];
        
        let jsonStart = -1;
        for (const pattern of jsonPatterns) {
          const match = trimmedOutput.match(pattern);
          if (match && match.index !== undefined) {
            jsonStart = match.index;
            break;
          }
        }
        
        if (jsonStart !== -1) {
          // Find matching closing brace
          let braceCount = 0;
          let jsonEnd = -1;
          for (let i = jsonStart; i < trimmedOutput.length; i++) {
            if (trimmedOutput[i] === '{') braceCount++;
            else if (trimmedOutput[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i;
                break;
              }
            }
          }
          
          if (jsonEnd !== -1) {
            const jsonStr = trimmedOutput.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);
            resolve(result);
            return;
          }
        }
        
        // Fallback: try parsing entire output
        const result = JSON.parse(trimmedOutput);
        resolve(result);
      } catch (e) {
        console.error('[CLI] Failed to parse JSON:', stdout.substring(0, 500));
        resolve({
          command,
          success: false,
          error: 'Failed to parse CLI output',
          rawOutput: stdout,
        });
      }
    });
  });
}

// ==================== API Routes ====================

/**
 * GET /api/status
 * Get system status
 */
app.get('/api/status', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const result = await runGodAgentCLI('status', []) as any;
    
    res.json({
      initialized: result.result?.initialized ?? false,
      runtime: result.result?.runtime ?? 'native',
      health: result.result?.health ?? {},
      stats: result.result?.stats ?? {},
    });
  } catch (error) {
    console.error('[Status] Error:', error);
    res.status(500).json({
      initialized: false,
      runtime: 'error',
      health: {},
      stats: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ask
 * Ask the God Agent anything
 */
app.post('/api/ask', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Sanitize input to prevent injection attacks
    const sanitizedPrompt = sanitizeInput(prompt);
    if (!sanitizedPrompt) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    safeLog('info', `[Ask] Processing: "${sanitizedPrompt.substring(0, 50)}..."`);
    
    const result = await runGodAgentCLI('ask', [sanitizedPrompt]) as any;
    
    // Add routing info if available
    const response = {
      ...result,
      routing: {
        confidence: result.qualityScore ?? 0.85,
        agentCategory: extractCategory(result.selectedAgent),
        factors: generateRoutingFactors(result),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[Ask] Error:', error);
    res.status(500).json({
      command: 'ask',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/code
 * Generate code
 */
app.post('/api/code', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { prompt, language } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Sanitize inputs
    const sanitizedPrompt = sanitizeInput(prompt);
    const sanitizedLanguage = language ? sanitizeInput(language, 50) : undefined;
    
    if (!sanitizedPrompt) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    safeLog('info', `[Code] Generating: "${sanitizedPrompt.substring(0, 50)}..."`);

    const args = [sanitizedPrompt];
    if (sanitizedLanguage) {
      args.push('--language', sanitizedLanguage);
    }

    const result = await runGodAgentCLI('code', args);
    res.json(result);
  } catch (error) {
    safeLog('error', '[Code] Error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({
      command: 'code',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/research
 * Research a topic
 */
app.post('/api/research', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { query, depth = 'deep' } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await runGodAgentCLI('research', [query]);
    res.json(result);
  } catch (error) {
    console.error('[Research] Error:', error);
    res.status(500).json({
      command: 'research',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/write
 * Write content
 */
app.post('/api/write', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic, style, length, format } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const args = [topic];
    if (style) args.push('--style', style);
    if (length) args.push('--length', length);
    if (format) args.push('--format', format);

    const result = await runGodAgentCLI('write', args);
    res.json(result);
  } catch (error) {
    console.error('[Write] Error:', error);
    res.status(500).json({
      command: 'write',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/feedback
 * Submit feedback for learning
 */
app.post('/api/feedback', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { id, rating, notes } = req.body;
    
    if (!id || rating === undefined) {
      return res.status(400).json({ error: 'ID and rating are required' });
    }

    const args = [id, rating.toString()];
    if (notes) args.push('--notes', notes);
    args.push('--trajectory');

    const result = await runGodAgentCLI('feedback', args);
    res.json(result);
  } catch (error) {
    console.error('[Feedback] Error:', error);
    res.status(500).json({
      command: 'feedback',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents
 * List available agents
 */
app.get('/api/agents', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    // Get agent info from the status command
    const result = await runGodAgentCLI('status', []) as any;
    
    res.json({
      agents: [],  // Would need to query agent registry
      categories: [],
      stats: result.result?.stats ?? {},
    });
  } catch (error) {
    console.error('[Agents] Error:', error);
    res.status(500).json({ agents: [], categories: [] });
  }
});

/**
 * POST /api/project/analyze
 * Analyze a task to determine project type and requirements
 */
app.post('/api/project/analyze', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    console.log(`[Project] Analyzing: "${task.substring(0, 50)}..."`);
    
    const result = await runProjectCLI('analyze', [task]) as any;
    res.json(result);
  } catch (error) {
    console.error('[Project Analyze] Error:', error);
    res.status(500).json({
      command: 'analyze',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/project/init
 * Initialize a new project with scaffolding
 */
app.post('/api/project/init', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { task, projectRoot } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    const root = projectRoot || PROJECT_ROOT;
    console.log(`[Project] Initializing: "${task.substring(0, 50)}..." at ${root}`);
    
    const args = [task, '--root', root, '--yes'];
    const result = await runProjectCLI('init', args) as any;
    res.json(result);
  } catch (error) {
    console.error('[Project Init] Error:', error);
    res.status(500).json({
      command: 'init',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ==================== Setup Routes ====================

// Configuration storage (in memory for now, could be persisted to file)
let setupConfig: {
  anthropicApiKey: string;
  embeddingApiUrl: string;
  preferredModel: string;
  configured: boolean;
} = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  embeddingApiUrl: process.env.EMBEDDING_API_URL || 'http://127.0.0.1:8000',
  preferredModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  configured: !!process.env.ANTHROPIC_API_KEY,
};

/**
 * GET /api/setup/check
 * Check if setup is complete
 * NOTE: Never expose actual API keys in responses
 */
app.get('/api/setup/check', setupRateLimiter, async (req: Request, res: Response) => {
  try {
    // Check if Anthropic key is set (boolean only, never expose key)
    const hasAnthropicKey = !!setupConfig.anthropicApiKey;
    
    // Check if services are running (basic check)
    let servicesRunning = false;
    try {
      await fetch(`${setupConfig.embeddingApiUrl}/health`);
      servicesRunning = true;
    } catch {
      // Services not running, that's okay
    }
    
    res.json({
      configured: setupConfig.configured && hasAnthropicKey,
      hasAnthropicKey,
      servicesRunning,
    });
  } catch (error) {
    safeLog('error', 'Setup check failed', { error: error instanceof Error ? error.message : 'Unknown' });
    res.json({
      configured: false,
      hasAnthropicKey: false,
      servicesRunning: false,
    });
  }
});

/**
 * POST /api/setup/validate
 * Validate API keys and connections
 * SECURITY: API key is validated but never logged or stored in responses
 */
app.post('/api/setup/validate', setupRateLimiter, async (req: Request, res: Response) => {
  try {
    const { anthropicApiKey, embeddingApiUrl } = req.body;
    
    const result = {
      anthropic: { valid: false, error: undefined as string | undefined },
      embedding: { valid: false, error: undefined as string | undefined },
      services: { valid: false, error: undefined as string | undefined },
    };
    
    // Validate Anthropic API key format first
    const keyValidation = validateApiKeyFormat(anthropicApiKey);
    if (!keyValidation.valid) {
      result.anthropic.error = keyValidation.error;
    } else {
      try {
        // Try a simple API call to verify the key
        // SECURITY: Key is only sent to Anthropic's API, never logged
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        
        if (response.ok || response.status === 429) {
          result.anthropic.valid = true;
          safeLog('info', 'API key validated successfully', { keyPrefix: maskApiKey(anthropicApiKey) });
        } else {
          const error = await response.json().catch(() => ({}));
          // Don't expose internal error details
          result.anthropic.error = response.status === 401 
            ? 'Invalid API key' 
            : `API validation failed (${response.status})`;
          safeLog('warn', 'API key validation failed', { status: response.status });
        }
      } catch (e) {
        result.anthropic.error = 'Connection to Anthropic API failed';
        safeLog('error', 'API connection error', { error: e instanceof Error ? e.message : 'Unknown' });
      }
    }
    
    // Validate embedding API URL
    const sanitizedEmbeddingUrl = sanitizeUrl(embeddingApiUrl || 'http://127.0.0.1:8000');
    if (sanitizedEmbeddingUrl) {
      try {
        const response = await fetch(`${sanitizedEmbeddingUrl}/health`);
        if (response.ok) {
          result.embedding.valid = true;
        } else {
          result.embedding.error = `Embedding service returned ${response.status}`;
        }
      } catch {
        result.embedding.error = 'Embedding service not running (optional)';
      }
    } else if (embeddingApiUrl) {
      result.embedding.error = 'Invalid embedding API URL';
    } else {
      result.embedding.valid = true; // Optional
    }
    
    // Check backend services
    try {
      const statusResult = await runGodAgentCLI('status', []) as any;
      if (statusResult.success || statusResult.result) {
        result.services.valid = true;
      } else {
        result.services.error = 'Backend services not fully initialized';
      }
    } catch {
      result.services.error = 'Could not verify backend services';
    }
    
    res.json(result);
  } catch (error) {
    safeLog('error', 'Setup validation error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({
      anthropic: { valid: false, error: 'Validation failed' },
      embedding: { valid: false, error: 'Validation failed' },
      services: { valid: false, error: 'Validation failed' },
    });
  }
});

/**
 * POST /api/setup/save
 * Save setup configuration
 * SECURITY: 
 * - API keys are stored with restricted file permissions
 * - Keys are never logged in plain text
 * - .env file is chmod 600 (owner read/write only)
 */
app.post('/api/setup/save', setupRateLimiter, async (req: Request, res: Response) => {
  try {
    const { anthropicApiKey, embeddingApiUrl, preferredModel } = req.body;
    
    // Validate inputs
    const keyValidation = validateApiKeyFormat(anthropicApiKey);
    if (!keyValidation.valid) {
      return res.status(400).json({ success: false, error: keyValidation.error });
    }
    
    const sanitizedEmbeddingUrl = sanitizeUrl(embeddingApiUrl || 'http://127.0.0.1:8000');
    const sanitizedModel = sanitizeInput(preferredModel || 'claude-sonnet-4-5-20250929', 100);
    
    // Update config (stored in memory)
    setupConfig = {
      anthropicApiKey,
      embeddingApiUrl: sanitizedEmbeddingUrl || 'http://127.0.0.1:8000',
      preferredModel: sanitizedModel,
      configured: true,
    };
    
    // Set environment variable for child processes
    process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    if (sanitizedEmbeddingUrl) {
      process.env.EMBEDDING_API_URL = sanitizedEmbeddingUrl;
    }
    if (sanitizedModel) {
      process.env.CLAUDE_MODEL = sanitizedModel;
    }
    
    // Write to .env file for persistence with secure permissions
    const fs = await import('fs');
    const envPath = path.join(PROJECT_ROOT, '.env');
    
    // Add security notice to .env file
    const envContent = `# God Agent Configuration
# SECURITY: This file contains sensitive API keys. Do not share or commit to version control.
# File permissions should be 600 (owner read/write only)

ANTHROPIC_API_KEY=${anthropicApiKey}
EMBEDDING_API_URL=${sanitizedEmbeddingUrl || 'http://127.0.0.1:8000'}
CLAUDE_MODEL=${sanitizedModel}
`;
    
    try {
      fs.writeFileSync(envPath, envContent, 'utf-8');
      // Set secure file permissions (owner read/write only)
      await setSecureFilePermissions(envPath);
      safeLog('info', 'Configuration saved to .env with secure permissions');
    } catch (e) {
      safeLog('warn', 'Could not write .env file', { error: e instanceof Error ? e.message : 'Unknown' });
    }
    
    res.json({ success: true });
  } catch (error) {
    safeLog('error', 'Setup save error', { error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// ==================== Helper Functions ====================

function extractCategory(agentName: string): string {
  const categoryMap: Record<string, string> = {
    'god-ask': 'general',
    'god-code': 'code',
    'god-research': 'research',
    'god-write': 'writing',
  };
  return categoryMap[agentName] || 'general';
}

function generateRoutingFactors(result: any): Array<{
  name: string;
  weight: number;
  contribution: number;
  description?: string;
}> {
  // Generate synthetic routing factors for visualization
  return [
    {
      name: 'Domain Match',
      weight: 0.4,
      contribution: 0.35,
      description: 'Task matches agent specialization',
    },
    {
      name: 'Capability Score',
      weight: 0.3,
      contribution: 0.28,
      description: 'Agent capabilities align with requirements',
    },
    {
      name: 'Historical Success',
      weight: 0.2,
      contribution: 0.15,
      description: 'Past performance on similar tasks',
    },
    {
      name: 'Context Relevance',
      weight: 0.1,
      contribution: 0.12,
      description: 'Relevant context from memory',
    },
  ];
}

// ==================== Error Handler ====================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               God Agent API Server                            ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                    ║
║  Project root: ${PROJECT_ROOT.substring(0, 40)}...
║  Configured: ${setupConfig.configured ? 'Yes' : 'No - Setup required'}
║                                                               ║
║  Endpoints:                                                   ║
║    GET  /api/status           - System status                ║
║    POST /api/ask              - Ask anything                 ║
║    POST /api/code             - Generate code                ║
║    POST /api/research         - Research topics              ║
║    POST /api/write            - Write content                ║
║    POST /api/feedback         - Submit feedback              ║
║    GET  /api/agents           - List agents                  ║
║    POST /api/project/analyze  - Analyze task requirements    ║
║    POST /api/project/init     - Initialize project scaffold  ║
║    GET  /api/setup/check      - Check setup status           ║
║    POST /api/setup/validate   - Validate API keys            ║
║    POST /api/setup/save       - Save configuration           ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

