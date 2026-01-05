#!/bin/bash
#===============================================================================
# God Agent Packaging Script
#
# Creates a distributable package of the God Agent system with full
# directory structure matching /home/[user]/projects/project1/
#
# Usage: ./package-god-agent.sh [OPTIONS]
#   --output DIR     Output directory (default: ./dist-package)
#   --full           Include all components including learned knowledge
#   --minimal        Only include core components
#   --tarball        Create tarball archive
#   --help           Show this help
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/dist-package"
FULL_PACKAGE=false
MINIMAL=false
CREATE_TARBALL=false
VERSION="1.0.0"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --full)
            FULL_PACKAGE=true
            shift
            ;;
        --minimal)
            MINIMAL=true
            shift
            ;;
        --tarball)
            CREATE_TARBALL=true
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help)
            head -17 "$0" | tail -14
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}"
echo "=================================================================="
echo "           God Agent Packaging Script v${VERSION}"
echo "=================================================================="
echo -e "${NC}"

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

#===============================================================================
# STEP 1: God Agent Core Source
#===============================================================================
echo -e "${YELLOW}[1/16] Copying God Agent core (src/god-agent/)...${NC}"
mkdir -p "$OUTPUT_DIR/src"
cp -r "$PROJECT_DIR/src/god-agent" "$OUTPUT_DIR/src/"
TS_COUNT=$(find "$OUTPUT_DIR/src/god-agent" -name "*.ts" | wc -l)
echo -e "${GREEN}  Done: $TS_COUNT TypeScript files${NC}"

#===============================================================================
# STEP 2: Claude Code Configuration
#===============================================================================
echo -e "${YELLOW}[2/16] Copying Claude Code configuration (.claude/)...${NC}"
cp -r "$PROJECT_DIR/.claude" "$OUTPUT_DIR/"
AGENT_COUNT=$(find "$OUTPUT_DIR/.claude/agents" -name "*.md" 2>/dev/null | wc -l)
SKILL_COUNT=$(find "$OUTPUT_DIR/.claude/skills" -type d -mindepth 1 2>/dev/null | wc -l)
COMMAND_COUNT=$(find "$OUTPUT_DIR/.claude/commands" -name "*.md" 2>/dev/null | wc -l)
HOOK_COUNT=$(find "$OUTPUT_DIR/.claude/hooks" -type f 2>/dev/null | wc -l)
echo -e "${GREEN}  Done: ${AGENT_COUNT} agents, ${SKILL_COUNT} skills, ${COMMAND_COUNT} commands, ${HOOK_COUNT} hooks${NC}"

#===============================================================================
# STEP 3: Serena MCP Server
#===============================================================================
echo -e "${YELLOW}[3/16] Copying Serena MCP server (serena/)...${NC}"
mkdir -p "$OUTPUT_DIR/serena"
# Copy Serena source but exclude .venv (it needs to be recreated)
rsync -a --exclude='.venv' --exclude='__pycache__' --exclude='.pytest_cache' \
    --exclude='*.pyc' --exclude='.mypy_cache' --exclude='.ruff_cache' \
    --exclude='.git' --exclude='.github' --exclude='.gitignore.backup' \
    "$PROJECT_DIR/serena/" "$OUTPUT_DIR/serena/" 2>/dev/null || \
    (cp -r "$PROJECT_DIR/serena" "$OUTPUT_DIR/" && \
    rm -rf "$OUTPUT_DIR/serena/.venv" "$OUTPUT_DIR/serena/__pycache__" \
    "$OUTPUT_DIR/serena/.git" "$OUTPUT_DIR/serena/.github" 2>/dev/null)
PY_COUNT=$(find "$OUTPUT_DIR/serena/src" -name "*.py" 2>/dev/null | wc -l)
echo -e "${GREEN}  Done: $PY_COUNT Python files${NC}"

#===============================================================================
# STEP 4: Serena Configuration with Memories
#===============================================================================
echo -e "${YELLOW}[4/16] Copying Serena configuration (.serena/)...${NC}"
mkdir -p "$OUTPUT_DIR/.serena"
cp -r "$PROJECT_DIR/.serena/project.yml" "$OUTPUT_DIR/.serena/" 2>/dev/null || true
# ALWAYS include Serena memories - these contain project context and handoff guides
if [ -d "$PROJECT_DIR/.serena/memories" ]; then
    cp -r "$PROJECT_DIR/.serena/memories" "$OUTPUT_DIR/.serena/"
    MEMORY_COUNT=$(find "$OUTPUT_DIR/.serena/memories" -name "*.md" 2>/dev/null | wc -l)
    echo -e "${GREEN}  - Serena memories: ${MEMORY_COUNT} files${NC}"
fi
if [ -d "$PROJECT_DIR/.serena/cache" ]; then
    mkdir -p "$OUTPUT_DIR/.serena/cache"
    echo -e "${GREEN}  - Cache directory created${NC}"
fi
echo -e "${GREEN}  Done${NC}"

#===============================================================================
# STEP 5: Tests Directory
#===============================================================================
echo -e "${YELLOW}[5/16] Copying tests directory (tests/)...${NC}"
if [ -d "$PROJECT_DIR/tests" ]; then
    cp -r "$PROJECT_DIR/tests" "$OUTPUT_DIR/"
    TEST_COUNT=$(find "$OUTPUT_DIR/tests" -name "*.ts" -o -name "*.test.ts" | wc -l)
    echo -e "${GREEN}  Done: $TEST_COUNT test files${NC}"
else
    mkdir -p "$OUTPUT_DIR/tests"
    echo -e "${YELLOW}  Created empty tests directory${NC}"
fi

#===============================================================================
# STEP 6: Documentation (empty structure only)
#===============================================================================
echo -e "${YELLOW}[6/16] Creating docs directory (empty)...${NC}"
mkdir -p "$OUTPUT_DIR/docs"
echo -e "${GREEN}  Done: Empty docs directory created (files excluded from package)${NC}"

#===============================================================================
# STEP 7: Examples
#===============================================================================
echo -e "${YELLOW}[7/16] Copying examples (examples/)...${NC}"
if [ -d "$PROJECT_DIR/examples" ]; then
    cp -r "$PROJECT_DIR/examples" "$OUTPUT_DIR/"
    EXAMPLE_COUNT=$(find "$OUTPUT_DIR/examples" -type f | wc -l)
    echo -e "${GREEN}  Done: $EXAMPLE_COUNT example files${NC}"
else
    mkdir -p "$OUTPUT_DIR/examples"
    echo -e "${YELLOW}  Created empty examples directory${NC}"
fi

#===============================================================================
# STEP 8: Project Configuration Files
#===============================================================================
echo -e "${YELLOW}[8/16] Copying project configuration files...${NC}"
cp "$PROJECT_DIR/package.json" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/tsconfig.json" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/CLAUDE.md" "$OUTPUT_DIR/"
cp "$PROJECT_DIR/vitest.config.ts" "$OUTPUT_DIR/" 2>/dev/null || true

# Create template .mcp.json (with placeholder paths)
cat > "$OUTPUT_DIR/.mcp.json.template" << 'MCPEOF'
{
  "mcpServers": {
    "serena": {
      "command": "${PROJECT_DIR}/serena/.venv/bin/serena",
      "args": [
        "start-mcp-server",
        "--project",
        "${PROJECT_DIR}"
      ],
      "type": "stdio",
      "env": {
        "VIRTUAL_ENV": "${PROJECT_DIR}/serena/.venv",
        "PATH": "${PROJECT_DIR}/serena/.venv/bin:${PATH}"
      }
    },
    "claude-flow@alpha": {
      "command": "npx",
      "args": ["claude-flow@alpha", "mcp", "start"],
      "type": "stdio"
    },
    "ruv-swarm": {
      "command": "npx",
      "args": ["ruv-swarm@latest", "mcp", "start"],
      "type": "stdio"
    },
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@perplexity-ai/mcp-server"],
      "type": "stdio",
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    }
  }
}
MCPEOF
echo -e "${GREEN}  Done${NC}"

#===============================================================================
# STEP 9: Scripts and Hooks
#===============================================================================
echo -e "${YELLOW}[9/16] Copying scripts and hooks...${NC}"
mkdir -p "$OUTPUT_DIR/scripts/packaging"
mkdir -p "$OUTPUT_DIR/scripts/hooks"

# Copy packaging scripts
cp "$PROJECT_DIR/scripts/packaging/setup-god-agent.sh" "$OUTPUT_DIR/scripts/packaging/"
cp "$PROJECT_DIR/scripts/packaging/package-god-agent.sh" "$OUTPUT_DIR/scripts/packaging/"

# Copy hook scripts
if [ -d "$PROJECT_DIR/scripts/hooks" ]; then
    cp -r "$PROJECT_DIR/scripts/hooks/"* "$OUTPUT_DIR/scripts/hooks/" 2>/dev/null || true
fi

# Copy utility scripts
for script in store-architecture-knowledge.mjs god-status.mjs; do
    if [ -f "$PROJECT_DIR/scripts/$script" ]; then
        cp "$PROJECT_DIR/scripts/$script" "$OUTPUT_DIR/scripts/"
    fi
done

chmod +x "$OUTPUT_DIR/scripts/packaging/"*.sh 2>/dev/null || true
chmod +x "$OUTPUT_DIR/scripts/hooks/"*.sh 2>/dev/null || true
echo -e "${GREEN}  Done${NC}"

#===============================================================================
# STEP 10: ChromaDB Vector Database (1536D)
#===============================================================================
echo -e "${YELLOW}[10/16] Copying ChromaDB vector database (1536D)...${NC}"
# Use the 1536D database directory for gte-Qwen2-1.5B-instruct embeddings
CHROMADB_SOURCE="$PROJECT_DIR/vector_db_1536"
if [ -d "$CHROMADB_SOURCE" ]; then
    mkdir -p "$OUTPUT_DIR/vector_db_1536"
    cp -r "$CHROMADB_SOURCE/"* "$OUTPUT_DIR/vector_db_1536/"
    CHROMADB_SIZE=$(du -sh "$OUTPUT_DIR/vector_db_1536" | cut -f1)
    echo -e "${GREEN}  Done: ChromaDB included ($CHROMADB_SIZE)${NC}"
    echo -e "${GREEN}  - Model: gte-Qwen2-1.5B-instruct (1536 dimensions)${NC}"
else
    echo -e "${YELLOW}  No ChromaDB found at $CHROMADB_SOURCE, creating empty structure${NC}"
    mkdir -p "$OUTPUT_DIR/vector_db_1536"
    touch "$OUTPUT_DIR/vector_db_1536/.gitkeep"
fi

#===============================================================================
# STEP 11: Embedding API (1536D - gte-Qwen2-1.5B-instruct)
#===============================================================================
echo -e "${YELLOW}[11/16] Copying embedding API scripts (1536D)...${NC}"
mkdir -p "$OUTPUT_DIR/embedding-api"

# Use the v2 scripts with gte-Qwen2-1.5B-instruct model (1536 dimensions)
if [ -f "$PROJECT_DIR/scripts/packaging/api_embedder.py" ]; then
    cp "$PROJECT_DIR/scripts/packaging/api_embedder.py" "$OUTPUT_DIR/embedding-api/"
    echo -e "${GREEN}  - api_embedder.py: FastAPI server (gte-Qwen2-1.5B-instruct, 1536D)${NC}"
fi

if [ -f "$PROJECT_DIR/scripts/packaging/api-embed.sh" ]; then
    cp "$PROJECT_DIR/scripts/packaging/api-embed.sh" "$OUTPUT_DIR/embedding-api/"
    chmod +x "$OUTPUT_DIR/embedding-api/api-embed.sh"
    echo -e "${GREEN}  - api-embed.sh: Service controller (configurable)${NC}"
fi

# Create requirements.txt for embedding dependencies (1536D model requires more)
cat > "$OUTPUT_DIR/embedding-api/requirements.txt" << 'EOF'
# God Agent Embedding API Dependencies (1536D - gte-Qwen2-1.5B-instruct)
fastapi>=0.104.0
uvicorn>=0.24.0
sentence-transformers>=2.2.2
chromadb>=0.4.0
pydantic>=2.0.0
transformers>=4.35.0
torch>=2.0.0
EOF
echo -e "${GREEN}  Done: Embedding API included (1536D model)${NC}"

#===============================================================================
# STEP 12: God Agent Knowledge (.agentdb)
#===============================================================================
echo -e "${YELLOW}[12/16] Copying learned knowledge (.agentdb/)...${NC}"
if [ -d "$PROJECT_DIR/.agentdb" ]; then
    cp -r "$PROJECT_DIR/.agentdb" "$OUTPUT_DIR/"
    AGENTDB_SIZE=$(du -sh "$OUTPUT_DIR/.agentdb" | cut -f1)
    echo -e "${GREEN}  Done: Knowledge base included ($AGENTDB_SIZE)${NC}"
    echo -e "${GREEN}  - Learned patterns and domain expertise${NC}"
    echo -e "${GREEN}  - Style profiles and interactions${NC}"
    echo -e "${GREEN}  - SoNA weights and trajectories${NC}"
else
    echo -e "${YELLOW}  No .agentdb found, creating empty structure${NC}"
    mkdir -p "$OUTPUT_DIR/.agentdb/universal"
    mkdir -p "$OUTPUT_DIR/.agentdb/sona"
    mkdir -p "$OUTPUT_DIR/.agentdb/graphs"
    touch "$OUTPUT_DIR/.agentdb/.gitkeep"
fi

#===============================================================================
# STEP 13: Swarm Memory (.swarm)
#===============================================================================
echo -e "${YELLOW}[13/16] Copying swarm memory database (.swarm/)...${NC}"
if [ -d "$PROJECT_DIR/.swarm" ]; then
    mkdir -p "$OUTPUT_DIR/.swarm"
    cp -r "$PROJECT_DIR/.swarm/"* "$OUTPUT_DIR/.swarm/"
    SWARM_SIZE=$(du -sh "$OUTPUT_DIR/.swarm" | cut -f1)
    echo -e "${GREEN}  Done: Swarm memory included ($SWARM_SIZE)${NC}"
else
    mkdir -p "$OUTPUT_DIR/.swarm/agentdb"
    echo -e "${YELLOW}  Created empty .swarm structure${NC}"
fi

#===============================================================================
# STEP 14: Claude Flow Configuration (.claude-flow)
#===============================================================================
echo -e "${YELLOW}[14/16] Copying Claude Flow configuration (.claude-flow/)...${NC}"
if [ -d "$PROJECT_DIR/.claude-flow" ]; then
    mkdir -p "$OUTPUT_DIR/.claude-flow"
    cp -r "$PROJECT_DIR/.claude-flow/"* "$OUTPUT_DIR/.claude-flow/"
    echo -e "${GREEN}  Done: Claude Flow config included${NC}"
else
    mkdir -p "$OUTPUT_DIR/.claude-flow/memory"
    mkdir -p "$OUTPUT_DIR/.claude-flow/metrics"
    echo -e "${YELLOW}  Created empty .claude-flow structure${NC}"
fi

#===============================================================================
# STEP 15: Additional Directory Structures
#===============================================================================
echo -e "${YELLOW}[15/16] Creating additional directory structures...${NC}"

# Hive Mind
if [ -d "$PROJECT_DIR/.hive-mind" ]; then
    cp -r "$PROJECT_DIR/.hive-mind" "$OUTPUT_DIR/"
    echo -e "${GREEN}  - .hive-mind/: Included${NC}"
else
    mkdir -p "$OUTPUT_DIR/.hive-mind"/{backups,config,exports,logs,memory,sessions,templates}
    echo -e "${GREEN}  - .hive-mind/: Created structure${NC}"
fi

# Coordination
if [ -d "$PROJECT_DIR/coordination" ]; then
    cp -r "$PROJECT_DIR/coordination" "$OUTPUT_DIR/"
    echo -e "${GREEN}  - coordination/: Included${NC}"
else
    mkdir -p "$OUTPUT_DIR/coordination"/{memory_bank,orchestration,subtasks}
    echo -e "${GREEN}  - coordination/: Created structure${NC}"
fi

# Memory
if [ -d "$PROJECT_DIR/memory" ]; then
    cp -r "$PROJECT_DIR/memory" "$OUTPUT_DIR/"
    echo -e "${GREEN}  - memory/: Included${NC}"
else
    mkdir -p "$OUTPUT_DIR/memory"/{agents,sessions}
    echo -e "${GREEN}  - memory/: Created structure${NC}"
fi

# Config
if [ -d "$PROJECT_DIR/config" ]; then
    cp -r "$PROJECT_DIR/config" "$OUTPUT_DIR/"
    echo -e "${GREEN}  - config/: Included${NC}"
else
    mkdir -p "$OUTPUT_DIR/config"
    echo -e "${GREEN}  - config/: Created structure${NC}"
fi

# Runtime directories
mkdir -p "$OUTPUT_DIR/tmp"
mkdir -p "$OUTPUT_DIR/logs"
mkdir -p "$OUTPUT_DIR/.run"
echo -e "${GREEN}  - tmp/, logs/, .run/: Created${NC}"

# God Agent Runtime Data (.god-agent)
if [ -d "$PROJECT_DIR/.god-agent" ]; then
    mkdir -p "$OUTPUT_DIR/.god-agent/sessions"
    mkdir -p "$OUTPUT_DIR/.god-agent/weights"
    # Copy structure but not test databases
    cp "$PROJECT_DIR/.god-agent/events.db" "$OUTPUT_DIR/.god-agent/" 2>/dev/null || true
    cp -r "$PROJECT_DIR/.god-agent/sessions/"* "$OUTPUT_DIR/.god-agent/sessions/" 2>/dev/null || true
    cp -r "$PROJECT_DIR/.god-agent/weights/"* "$OUTPUT_DIR/.god-agent/weights/" 2>/dev/null || true
    echo -e "${GREEN}  - .god-agent/: Included (events.db, sessions, weights)${NC}"
else
    mkdir -p "$OUTPUT_DIR/.god-agent"/{sessions,weights}
    echo -e "${GREEN}  - .god-agent/: Created structure${NC}"
fi

# UCM Hook Configuration (.ucm)
if [ -d "$PROJECT_DIR/.ucm" ]; then
    mkdir -p "$OUTPUT_DIR/.ucm"
    cp -r "$PROJECT_DIR/.ucm/"* "$OUTPUT_DIR/.ucm/"
    echo -e "${GREEN}  - .ucm/: Included (handoff-hook-config.json)${NC}"
else
    mkdir -p "$OUTPUT_DIR/.ucm"
    echo -e "${GREEN}  - .ucm/: Created structure${NC}"
fi

# Clean up any git artifacts that may have been copied
echo -e "${YELLOW}Cleaning git artifacts...${NC}"
find "$OUTPUT_DIR" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
find "$OUTPUT_DIR" -name ".github" -type d -exec rm -rf {} + 2>/dev/null || true
find "$OUTPUT_DIR" -name ".gitignore.backup" -type f -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "*.orig" -type f -delete 2>/dev/null || true
echo -e "${GREEN}  - Removed .git/, .github/, .gitignore.backup, *.orig${NC}"

#===============================================================================
# STEP 16: README and Final Package
#===============================================================================
echo -e "${YELLOW}[16/16] Creating README and final package...${NC}"

# Create comprehensive README
cat > "$OUTPUT_DIR/README.md" << 'EOF'
# God Agent - Universal Self-Learning AI System

A complete Claude Code enhancement package with 200+ specialized agents, semantic memory, and self-learning capabilities.

## Quick Start

### 1. Run the setup script

```bash
cd god-agent-package
chmod +x scripts/packaging/setup-god-agent.sh
./scripts/packaging/setup-god-agent.sh
```

This will:
- Install NVM and Node.js 22 (if not present)
- Install Claude Code CLI globally
- Install claude-flow and ruv-swarm globally
- Set up Python 3.11+ virtual environment
- Install Serena MCP server
- Set up the embedding API
- Configure all dependencies

### 2. Add to your shell profile

Add these lines to `~/.profile` or `~/.bashrc`:

```bash
# NVM (Node Version Manager)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm alias default 22 2>/dev/null
```

Then run: `source ~/.profile`

### 3. Start the embedding server

```bash
./embedding-api/api-embed.sh start
```

### 4. Start Claude Code

```bash
claude
```

### 5. Test the installation

```
/god-status
/god-ask What can you help me with?
```

## Directory Structure

```
god-agent-package/
├── src/god-agent/           # Core God Agent (TypeScript)
├── .claude/                 # Claude Code configuration
│   ├── agents/              # 200+ agent definitions
│   ├── commands/            # Slash commands
│   ├── skills/              # Skills library
│   └── hooks/               # Pre/post task hooks
├── serena/                  # Serena MCP server (Python)
├── .serena/                 # Serena config + memories
├── .god-agent/              # God Agent runtime data
│   ├── events.db            # Event/interaction database
│   ├── sessions/            # Session state
│   └── weights/             # SoNA learned weights
├── .ucm/                    # UCM hook configuration
├── tests/                   # Test suite
├── docs/                    # Documentation
├── examples/                # Usage examples
├── scripts/                 # Utility scripts
│   ├── packaging/           # Setup & package scripts
│   └── hooks/               # Hook implementations
├── embedding-api/           # Vector embedding server (1536D)
│   ├── api_embedder.py      # FastAPI server (gte-Qwen2-1.5B-instruct)
│   ├── api-embed.sh         # Service controller
│   └── requirements.txt     # Python dependencies
├── vector_db_1536/          # ChromaDB storage (1536D vectors)
├── .agentdb/                # Learned knowledge & patterns
├── .swarm/                  # Swarm coordination memory
├── .claude-flow/            # Claude Flow metrics
├── .hive-mind/              # Hive Mind state
├── coordination/            # Task coordination
├── memory/                  # Memory storage
├── config/                  # Configuration
├── tmp/                     # Temporary files
├── logs/                    # Log files
└── .run/                    # Runtime PID files
```

## Components

| Component | Purpose |
|-----------|---------|
| src/god-agent/ | Core implementation with ReasoningBank, InteractionStore, SoNA |
| .claude/agents/ | 200+ specialized agent definitions |
| .claude/commands/ | /god-ask, /god-code, /god-research, etc. |
| .god-agent/ | Runtime data: events.db, sessions, learned weights |
| .ucm/ | UCM handoff hook configuration |
| serena/ | Serena MCP for code analysis and memories |
| embedding-api/ | Local semantic search (gte-Qwen2-1.5B-instruct, 1536D) |
| .agentdb/ | Persisted knowledge, patterns, trajectories |

## MCP Servers

| Server | Purpose | Install |
|--------|---------|---------|
| serena | Code analysis | Included |
| claude-flow@alpha | Swarm coordination | Pre-installed |
| ruv-swarm | Enhanced swarm | Pre-installed |
| perplexity | Web search | Requires API key |

## Starting/Stopping Services

```bash
# Embedding API
./embedding-api/api-embed.sh start|stop|status|logs

# Check God Agent status
/god-status
```

## Slash Commands

Once Claude Code is running, use these commands:

| Command | Description |
|---------|-------------|
| `/god-status` | Show God Agent status and learning statistics |
| `/god-ask <question>` | Ask anything with intelligent agent selection |
| `/god-code <task>` | Generate code with DAI-001 agent selection |
| `/god-research <topic>` | Deep research with DAI-002 pipeline orchestration |
| `/god-write <document>` | Generate documents/papers with agent selection |
| `/god-learn <knowledge>` | Store knowledge directly in the God Agent |
| `/god-feedback <id>` | Provide feedback for trajectory improvement |
| `/god-style-status` | Show style profile status and available profiles |
| `/god-learn-style` | Learn a writing style from PDF documents |

### Other Useful Commands

| Command | Description |
|---------|-------------|
| `/sitrep` | Generate situation report for session restoration |
| `/pushrepo` | Commit and push all changes (with validation) |
| `/hive-mind` | Start hive mind multi-agent coordination |
| `/swarm-init` | Initialize swarm orchestration |

## Requirements

- Node.js 22+ (via NVM)
- Python 3.11+
- ~4GB disk space (includes embedding model)
- ~8GB RAM recommended (for embedding model)
- Git, curl or wget

## Troubleshooting

### Node.js not found
```bash
source ~/.nvm/nvm.sh && nvm use 22
```

### Native module errors after Node upgrade
```bash
npm rebuild
```

### Embedding API not connecting
```bash
./embedding-api/api-embed.sh status
./embedding-api/api-embed.sh logs
```

### Embedding model loading slowly
First load downloads ~3GB model. Subsequent starts are faster.

### Serena not starting
```bash
source serena/.venv/bin/activate
serena start-mcp-server --project $(pwd)
```

### MCP servers not registered
```bash
claude mcp list
claude mcp add serena -- $(pwd)/serena/.venv/bin/serena start-mcp-server --project $(pwd)
claude mcp add claude-flow -- npx claude-flow@alpha mcp start
```

### Verify installation
```bash
node --version          # Should be v22.x.x
claude --version        # Should show Claude Code version
./embedding-api/api-embed.sh status
```

## License

See individual component licenses.
EOF

# Calculate sizes
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
echo -e "${GREEN}  Package created: $TOTAL_SIZE${NC}"

# Create tarball if requested
if [ "$CREATE_TARBALL" = true ]; then
    echo ""
    echo -e "${YELLOW}Creating tarball archive...${NC}"
    TARBALL_NAME="god-agent-v${VERSION}.tar.gz"
    cd "$(dirname "$OUTPUT_DIR")"
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.github' \
        --exclude='.gitignore.backup' \
        --exclude='dist' \
        --exclude='coverage' \
        --exclude='*.log' \
        -czvf "$TARBALL_NAME" "$(basename "$OUTPUT_DIR")"
    TARBALL_SIZE=$(du -sh "$TARBALL_NAME" | cut -f1)
    echo -e "${GREEN}  Tarball created: $TARBALL_NAME ($TARBALL_SIZE)${NC}"
    cd "$PROJECT_DIR"
fi

# Summary
echo ""
echo -e "${BLUE}=================================================================="
echo "                    Packaging Complete!"
echo "==================================================================${NC}"
echo ""
echo "Package location: $OUTPUT_DIR"
echo "Total size: $TOTAL_SIZE"
echo ""
echo "Directory Structure Created:"
echo "  - src/god-agent/    : God Agent core (TypeScript)"
echo "  - .claude/          : Claude Code configuration (agents, skills, hooks)"
echo "  - serena/           : Serena MCP server (Python)"
echo "  - .serena/          : Serena config + memories"
echo "  - tests/            : Test suite"
echo "  - docs/             : Documentation"
echo "  - examples/         : Usage examples"
echo "  - scripts/          : Setup + utility scripts"
echo "  - embedding-api/    : Vector embedding server (1536D)"
echo "  - vector_db_1536/   : ChromaDB embeddings (gte-Qwen2-1.5B-instruct)"
echo "  - .agentdb/         : Learned knowledge"
echo "  - .swarm/           : Swarm memory"
echo "  - .claude-flow/     : Claude Flow config"
echo "  - .hive-mind/       : Hive Mind state"
echo "  - coordination/     : Task coordination"
echo "  - memory/           : Memory storage"
echo "  - config/           : Configuration"
echo "  - tmp/, logs/, .run/: Runtime directories"
echo ""
echo "To deploy:"
echo "  1. Copy package to target machine"
echo "  2. Run: ./scripts/packaging/setup-god-agent.sh"
echo "  3. Start embedding: ./embedding-api/api-embed.sh start"
echo "  4. Run: claude"
echo ""
