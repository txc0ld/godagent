---
description: Generate code using the Universal Self-Learning God Agent with DAI-001 agent selection
---

Generate code using the Universal Self-Learning God Agent with DAI-001 dynamic agent selection.

**Task:** $ARGUMENTS

---

## Phase 1: Agent Selection (CLI)

Run the God Agent CLI to get the dynamically selected agent and built prompt:

```bash
npx tsx src/god-agent/universal/cli.ts code "$ARGUMENTS" --json 2>/dev/null | grep -E '^\{' | head -1
```

The CLI returns JSON with the selected agent and complete prompt:

```json
{
  "command": "code",
  "selectedAgent": "backend-dev",
  "prompt": "[original user prompt]",
  "isPipeline": false,
  "result": {
    "builtPrompt": "## Agent: backend-dev\n\n**Description:** ...\n\n### Agent Instructions\n...\n\n### Task\n[user task]\n\n### Response Format\n...",
    "agentType": "backend-dev",
    "agentCategory": "core",
    "memoryContext": "[retrieved context from prior trajectories]"
  },
  "success": true,
  "trajectoryId": "traj_xxx_yyy"
}
```

---

## Phase 2: Task Execution (Subagent)

**CRITICAL**: You MUST spawn a Task() subagent with the CLI output. Do NOT execute the task yourself.

### Extract from JSON:
- `result.agentType` - The specialized agent type to spawn
- `result.builtPrompt` - The complete prompt with agent instructions, context, and task

### Spawn Task:

```
Task(result.agentType, result.builtPrompt)
```

**Example**: If CLI returns `agentType: "backend-dev"`, spawn:
```
Task("backend-dev", "[full builtPrompt from result]")
```

### Pipeline Mode

If `isPipeline` is `true`, the task requires multiple sequential agents. The `result` will contain pipeline configuration - execute agents sequentially as specified.

---

## Phase 3: Present Results

After the Task() subagent completes:

1. Present the subagent's output to the user
2. Include the `trajectoryId` for feedback tracking
3. Summarize what was accomplished

---

## Phase 4: Feedback (Recommended)

To improve future agent selection, provide feedback on the trajectory:

```bash
npx tsx src/god-agent/universal/cli.ts feedback [trajectoryId] [rating] --trajectory --notes "[optional notes]"
```

**Rating scale**: 0.0 (poor) to 1.0 (excellent)

**Example**:
```bash
npx tsx src/god-agent/universal/cli.ts feedback traj_xxx_yyy 0.9 --trajectory --notes "Agent selection was appropriate"
```

---

## Two-Phase Execution Model

This skill implements the **DAI-001 Two-Phase Execution Model**:

1. **Phase 1 (CLI)**: God Agent analyzes the task, searches 198+ agents via semantic matching, retrieves relevant memory context, and builds a specialized prompt
2. **Phase 2 (Task)**: Claude Code spawns a Task() subagent with the selected agent type and built prompt

This separation ensures:
- Optimal agent selection via AI-powered capability matching
- Context injection from prior trajectories (SoNA learning)
- Clean execution boundary between selection and implementation
- Trajectory tracking for continuous improvement
