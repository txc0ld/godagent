/**
 * AgentExecutionTracker - Track agent lifecycle from spawn to completion
 *
 * Implements agent execution tracking with timing, status, and memory coordination.
 * Maintains bounded list of active and completed executions with FIFO eviction.
 *
 * @module observability/agent-tracker
 * @see TASK-OBS-003-AGENT-TRACKER.md
 * @see TECH-OBS-001-IMPLEMENTATION.md Section 3.4
 */

import {
  IAgentExecution,
  IMemoryEntry,
  ActivityEventComponent,
  ActivityEventStatus,
} from './types.js';
import { IActivityStream } from './activity-stream.js';

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Agent result data after completion
 */
export interface IAgentResult {
  /** Result output/summary */
  output: string;
  /** Quality score 0-1 */
  qualityScore?: number;
  /** Memory entries stored by this agent */
  memoryStored?: IMemoryEntry[];
}

/**
 * Input for starting agent from IPC event
 */
export interface IAgentStartInput {
  id: string;
  agentKey: string;
  agentName: string;
  category: string;
  pipelineId?: string;
  input: string;
  startTime: number;
}

/**
 * Input for completing agent from IPC event
 */
export interface IAgentCompleteInput {
  output: string;
  qualityScore?: number;
  durationMs: number;
}

/**
 * AgentExecutionTracker interface
 * Implements [REQ-OBS-04]: AgentExecutionTracker MUST track agent lifecycle
 */
export interface IAgentExecutionTracker {
  /**
   * Start tracking a new agent execution
   * @param execution Agent execution data (without endTime, durationMs, status)
   * @returns Unique execution ID
   */
  startAgent(execution: Omit<IAgentExecution, 'endTime' | 'durationMs' | 'status'>): string;

  /**
   * Start tracking agent from IPC event (with pre-generated ID)
   * Used by SocketServer when receiving events from God Agent processes
   * @param input Agent start input with pre-generated executionId
   */
  startAgentFromEvent(input: IAgentStartInput): void;

  /**
   * Mark agent execution as completed successfully
   * @param executionId The execution ID to complete
   * @param result Result data from agent execution
   */
  completeAgent(executionId: string, result: IAgentResult): void;

  /**
   * Mark agent as completed from IPC event
   * @param executionId The execution ID to complete
   * @param input Completion data from event
   */
  completeAgentFromEvent(executionId: string, input: IAgentCompleteInput): void;

  /**
   * Mark agent execution as failed
   * @param executionId The execution ID that failed
   * @param error The error that caused failure
   */
  failAgent(executionId: string, error: Error): void;

  /**
   * Mark agent as failed from IPC event
   * @param executionId The execution ID that failed
   * @param errorMessage Error message from event
   * @param durationMs Execution duration
   */
  failAgentFromEvent(executionId: string, errorMessage: string, durationMs: number): void;

  /**
   * Get all currently active agent executions
   * @returns Array of active executions
   */
  getActive(): IAgentExecution[];

  /**
   * Get executions by agent key (active + recent completed)
   * @param agentKey The agent key to filter by
   * @returns Array of matching executions
   */
  getByType(agentKey: string): IAgentExecution[];

  /**
   * Get a specific execution by ID
   * @param executionId The execution ID to retrieve
   * @returns The execution or null if not found
   */
  getById(executionId: string): IAgentExecution | null;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * AgentExecutionTracker implementation
 *
 * Implements:
 * - [REQ-OBS-04]: Agent lifecycle tracking
 * - [REQ-OBS-05]: Output summary, quality score, memory capture
 * - [RULE-OBS-004]: Memory bounds enforcement (50 completed max)
 */
export class AgentExecutionTracker implements IAgentExecutionTracker {
  // Active executions by ID
  private active: Map<string, IAgentExecution> = new Map();

  // Completed executions (FIFO, max 50)
  private completed: IAgentExecution[] = [];

  // Maximum completed executions to retain
  private readonly MAX_COMPLETED = 50;

  /**
   * Create a new AgentExecutionTracker
   * @param activityStream ActivityStream for event emission
   */
  constructor(private activityStream: IActivityStream) {}

  /**
   * Start tracking a new agent execution
   * Implements [REQ-OBS-04]: Track agent start
   *
   * @param execution Agent execution data
   * @returns Unique execution ID (format: exec_{agentKey}_{timestamp}_{random})
   */
  public startAgent(
    execution: Omit<IAgentExecution, 'endTime' | 'durationMs' | 'status'>
  ): string {
    // Generate execution ID
    const executionId = this.generateExecutionId(execution.agentKey);

    // Create full execution record
    const fullExecution: IAgentExecution = {
      ...execution,
      id: executionId,
      status: 'running',
      startTime: Date.now(),
    };

    // Store in active map
    this.active.set(executionId, fullExecution);

    // Emit agent_started event
    this.activityStream.push({
      id: `evt_${Date.now()}_${this.randomId()}`,
      timestamp: Date.now(),
      component: 'agent' as ActivityEventComponent,
      operation: 'agent_started',
      status: 'running' as ActivityEventStatus,
      metadata: {
        executionId,
        agentKey: execution.agentKey,
        agentName: execution.agentName,
        category: execution.category,
        pipelineId: execution.pipelineId,
        input: execution.input,
      },
    });

    return executionId;
  }

  /**
   * Mark agent execution as completed successfully
   * Implements [REQ-OBS-05]: Capture output, quality, memory
   *
   * @param executionId The execution ID to complete
   * @param result Result data from agent execution
   */
  public completeAgent(executionId: string, result: IAgentResult): void {
    const execution = this.active.get(executionId);

    if (!execution) {
      // Log warning but don't throw (defensive)
      console.warn(`[AgentExecutionTracker] Attempted to complete unknown execution: ${executionId}`);
      return;
    }

    // Calculate duration
    const endTime = Date.now();
    const durationMs = endTime - execution.startTime;

    // Update execution record
    execution.status = 'completed';
    execution.endTime = endTime;
    execution.durationMs = durationMs;
    execution.output = result.output;
    execution.qualityScore = result.qualityScore;
    execution.memoryStored = result.memoryStored;

    // Move from active to completed
    this.active.delete(executionId);
    this.addCompleted(execution);

    // Emit agent_completed event
    this.activityStream.push({
      id: `evt_${Date.now()}_${this.randomId()}`,
      timestamp: Date.now(),
      component: 'agent' as ActivityEventComponent,
      operation: 'agent_completed',
      status: 'success' as ActivityEventStatus,
      durationMs,
      metadata: {
        executionId,
        agentKey: execution.agentKey,
        agentName: execution.agentName,
        qualityScore: result.qualityScore,
        memoryStored: result.memoryStored?.length || 0,
        pipelineId: execution.pipelineId,
      },
    });
  }

  /**
   * Mark agent execution as failed
   *
   * @param executionId The execution ID that failed
   * @param error The error that caused failure
   */
  public failAgent(executionId: string, error: Error): void {
    const execution = this.active.get(executionId);

    if (!execution) {
      console.warn(`[AgentExecutionTracker] Attempted to fail unknown execution: ${executionId}`);
      return;
    }

    // Calculate duration
    const endTime = Date.now();
    const durationMs = endTime - execution.startTime;

    // Update execution record
    execution.status = 'failed';
    execution.endTime = endTime;
    execution.durationMs = durationMs;
    execution.error = error.message;

    // Move from active to completed
    this.active.delete(executionId);
    this.addCompleted(execution);

    // Emit agent_failed event
    this.activityStream.push({
      id: `evt_${Date.now()}_${this.randomId()}`,
      timestamp: Date.now(),
      component: 'agent' as ActivityEventComponent,
      operation: 'agent_failed',
      status: 'error' as ActivityEventStatus,
      durationMs,
      metadata: {
        executionId,
        agentKey: execution.agentKey,
        agentName: execution.agentName,
        error: error.message,
        pipelineId: execution.pipelineId,
      },
    });
  }

  // ===========================================================================
  // IPC Event Methods (for SocketServer routing)
  // ===========================================================================

  /**
   * Start tracking agent from IPC event (with pre-generated ID)
   * Used by SocketServer when receiving events from God Agent processes
   *
   * NOTE: This does NOT emit an event (the event already came from the God Agent
   * process via IPC). It just updates the tracker state.
   *
   * @param input Agent start input with pre-generated executionId
   */
  public startAgentFromEvent(input: IAgentStartInput): void {
    // Create execution record with pre-generated ID
    const execution: IAgentExecution = {
      id: input.id,
      agentKey: input.agentKey,
      agentName: input.agentName,
      category: input.category,
      pipelineId: input.pipelineId,
      input: input.input,
      status: 'running',
      startTime: input.startTime,
    };

    // Store in active map
    this.active.set(input.id, execution);
  }

  /**
   * Mark agent as completed from IPC event
   * Used by SocketServer when receiving events from God Agent processes
   *
   * NOTE: This does NOT emit an event (the event already came from IPC).
   *
   * @param executionId The execution ID to complete
   * @param input Completion data from event
   */
  public completeAgentFromEvent(executionId: string, input: IAgentCompleteInput): void {
    const execution = this.active.get(executionId);

    if (!execution) {
      // Agent may have been started before daemon was running, or event lost
      // Log warning but don't fail
      console.warn(`[AgentExecutionTracker] Attempted to complete unknown execution from event: ${executionId}`);
      return;
    }

    // Update execution record
    const endTime = Date.now();
    execution.status = 'completed';
    execution.endTime = endTime;
    execution.durationMs = input.durationMs || (endTime - execution.startTime);
    execution.output = input.output;
    execution.qualityScore = input.qualityScore;

    // Move from active to completed
    this.active.delete(executionId);
    this.addCompleted(execution);
  }

  /**
   * Mark agent as failed from IPC event
   * Used by SocketServer when receiving events from God Agent processes
   *
   * NOTE: This does NOT emit an event (the event already came from IPC).
   *
   * @param executionId The execution ID that failed
   * @param errorMessage Error message from event
   * @param durationMs Execution duration
   */
  public failAgentFromEvent(executionId: string, errorMessage: string, durationMs: number): void {
    const execution = this.active.get(executionId);

    if (!execution) {
      console.warn(`[AgentExecutionTracker] Attempted to fail unknown execution from event: ${executionId}`);
      return;
    }

    // Update execution record
    const endTime = Date.now();
    execution.status = 'failed';
    execution.endTime = endTime;
    execution.durationMs = durationMs || (endTime - execution.startTime);
    execution.error = errorMessage;

    // Move from active to completed
    this.active.delete(executionId);
    this.addCompleted(execution);
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get all currently active agent executions
   * @returns Array of active executions
   */
  public getActive(): IAgentExecution[] {
    return Array.from(this.active.values());
  }

  /**
   * Get executions by agent key (active + recent completed)
   * @param agentKey The agent key to filter by
   * @returns Array of matching executions
   */
  public getByType(agentKey: string): IAgentExecution[] {
    const activeMatches = this.getActive().filter(e => e.agentKey === agentKey);
    const completedMatches = this.completed.filter(e => e.agentKey === agentKey);

    return [...activeMatches, ...completedMatches];
  }

  /**
   * Get a specific execution by ID
   * @param executionId The execution ID to retrieve
   * @returns The execution or null if not found
   */
  public getById(executionId: string): IAgentExecution | null {
    // Check active first
    const activeExec = this.active.get(executionId);
    if (activeExec) {
      return activeExec;
    }

    // Check completed
    const completedExec = this.completed.find(e => e.id === executionId);
    return completedExec || null;
  }

  /**
   * Get statistics about tracker state
   */
  public getStats(): {
    activeCount: number;
    completedCount: number;
    maxCompleted: number;
  } {
    return {
      activeCount: this.active.size,
      completedCount: this.completed.length,
      maxCompleted: this.MAX_COMPLETED,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate a unique execution ID
   * Format: exec_{agentKey}_{timestamp}_{random}
   *
   * @param agentKey The agent key
   * @returns Unique execution ID
   */
  private generateExecutionId(agentKey: string): string {
    const timestamp = Date.now();
    const random = this.randomId();
    return `exec_${agentKey}_${timestamp}_${random}`;
  }

  /**
   * Generate a random 6-character ID
   * @returns Random alphanumeric string
   */
  private randomId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  /**
   * Add a completed execution to the completed list
   * Implements FIFO eviction when exceeding MAX_COMPLETED
   *
   * @param execution The completed execution
   */
  private addCompleted(execution: IAgentExecution): void {
    // Add to end of array
    this.completed.push(execution);

    // Evict oldest if exceeding max
    if (this.completed.length > this.MAX_COMPLETED) {
      this.completed.shift();  // Remove first (oldest)
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default AgentExecutionTracker;
