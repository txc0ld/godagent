import type { 
  ApiResponse, 
  SystemStatus, 
  TaskMode, 
  ProjectAnalyzeResponse, 
  ProjectInitResponse,
  SetupConfig,
  SetupValidationResult,
  SetupCheckResult,
} from './types';

const API_BASE = '/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/status');
  }

  async ask(prompt: string): Promise<ApiResponse<{ response: string }>> {
    return this.request<ApiResponse<{ response: string }>>('/ask', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async code(prompt: string, language?: string): Promise<ApiResponse<{
    builtPrompt: string;
    agentType: string;
    agentCategory: string;
    language?: string;
  }>> {
    return this.request('/code', {
      method: 'POST',
      body: JSON.stringify({ prompt, language }),
    });
  }

  async research(query: string, depth: 'quick' | 'deep' = 'deep'): Promise<ApiResponse<{
    synthesis: string;
    findingsCount: number;
    knowledgeStored: boolean;
  }>> {
    return this.request('/research', {
      method: 'POST',
      body: JSON.stringify({ query, depth }),
    });
  }

  async write(
    topic: string,
    options?: {
      style?: 'academic' | 'professional' | 'casual' | 'technical';
      length?: 'short' | 'medium' | 'long' | 'comprehensive';
      format?: 'essay' | 'report' | 'article' | 'paper';
    }
  ): Promise<ApiResponse<{
    builtPrompt: string;
    agentType: string;
    style: string;
    format: string;
  }>> {
    return this.request('/write', {
      method: 'POST',
      body: JSON.stringify({ topic, ...options }),
    });
  }

  async feedback(
    id: string,
    rating: number,
    notes?: string
  ): Promise<ApiResponse<{
    weightUpdates: number;
    patternCreated: boolean;
  }>> {
    return this.request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ id, rating, notes }),
    });
  }

  async getAgents(): Promise<{
    agents: Array<{
      id: string;
      name: string;
      category: string;
      description?: string;
    }>;
    categories: string[];
  }> {
    return this.request('/agents');
  }

  // ==================== Project APIs ====================

  async analyzeProject(task: string): Promise<ProjectAnalyzeResponse> {
    return this.request<ProjectAnalyzeResponse>('/project/analyze', {
      method: 'POST',
      body: JSON.stringify({ task }),
    });
  }

  async initProject(task: string, projectRoot?: string): Promise<ProjectInitResponse> {
    return this.request<ProjectInitResponse>('/project/init', {
      method: 'POST',
      body: JSON.stringify({ task, projectRoot }),
    });
  }

  // ==================== Setup APIs ====================

  async checkSetup(): Promise<SetupCheckResult> {
    return this.request<SetupCheckResult>('/setup/check');
  }

  async validateSetup(config: SetupConfig): Promise<SetupValidationResult> {
    return this.request<SetupValidationResult>('/setup/validate', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async saveSetup(config: SetupConfig): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/setup/save', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // Stream response for long operations
  async *stream(
    mode: TaskMode,
    prompt: string
  ): AsyncGenerator<{ type: 'routing' | 'progress' | 'result'; data: unknown }> {
    const response = await fetch(`${API_BASE}/${mode}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

export const api = new ApiClient();

