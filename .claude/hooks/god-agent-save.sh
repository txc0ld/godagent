#!/bin/bash
#===============================================================================
# God Agent Session Save Script
# Called on Claude Code exit to persist God Agent state
#===============================================================================

# Source environment
source ~/.profile 2>/dev/null
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 22 --silent 2>/dev/null

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

# Quick save - just trigger a learn command which will save state on shutdown
echo "[God Agent] Saving session state..."

# Create a minimal save by running status (which initializes and shuts down cleanly)
timeout 15 npx tsx src/god-agent/universal/cli.ts status --quiet 2>/dev/null

# Check if save succeeded
if [ $? -eq 0 ]; then
    echo "[God Agent] Session state saved to .agentdb/"
else
    echo "[God Agent] Warning: Could not save session state (timeout or error)"
fi
