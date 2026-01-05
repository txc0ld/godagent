---
description: Generate documents/papers using the Universal Self-Learning God Agent with DAI-001 agent selection
---

Generate written content using the Universal Self-Learning God Agent with DAI-001 dynamic agent selection.

**Topic:** $ARGUMENTS

## Step 1: Get DAI-001 Agent Selection

Run the God Agent CLI to get the selected agent and built prompt:

```bash
npx tsx src/god-agent/universal/cli.ts write "$ARGUMENTS" --json
```

**Options** (add to the command):
- `--style academic` - Academic writing style (or: professional, casual, technical)
- `--format paper` - Paper format (or: essay, report, article)
- `--length comprehensive` - Comprehensive length (or: short, medium, long)

**Example with options:**
```bash
npx tsx src/god-agent/universal/cli.ts write "$ARGUMENTS" --style academic --format paper --length comprehensive --json
```

## Step 2: Parse CLI Output

The CLI will output JSON like:
```json
{
  "command": "write",
  "selectedAgent": "documentation-specialist",
  "prompt": "## Agent: documentation-specialist...",
  "isPipeline": false,
  "result": { ... },
  "success": true,
  "trajectoryId": "trj_xxx"
}
```

## Step 3: Spawn Task() with Selected Agent

**CRITICAL**: You MUST spawn a Task() subagent. Do NOT do the work directly.

If `isPipeline` is false (single agent):
```
Task("[selectedAgent from JSON]", "[prompt from JSON]")
```

If `isPipeline` is true (multi-agent pipeline for complex documents):
```
Use UniversalAgent.runPipeline() with the pipeline from result
```

## Step 4: Present Output

Present the subagent's output to the user along with:
- Generated content
- Style applied
- Word count
- Sources referenced
- Trajectory ID for feedback

## Step 5: Provide Feedback (Recommended)

To improve learning, provide feedback:
```bash
npx tsx src/god-agent/universal/cli.ts feedback [trajectoryId] [rating 0-1] --trajectory --notes "feedback"
```

---

**DAI-002 Command Integration**: This command uses the CommandTaskBridge to determine if a pipeline is needed for complex multi-document tasks. Simple writing tasks spawn a single specialized agent; complex documents (PRD, spec, multi-chapter) trigger a sequential multi-agent pipeline.
