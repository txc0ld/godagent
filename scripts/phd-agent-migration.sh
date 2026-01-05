#!/bin/bash
#
# PhD Agent Memory Migration Script
# Toggles between claude-flow and god-agent CLI commands
#
# Usage:
#   ./scripts/phd-agent-migration.sh migrate   # Apply migration (claude-flow -> god-agent)
#   ./scripts/phd-agent-migration.sh revert    # Revert migration (god-agent -> claude-flow)
#   ./scripts/phd-agent-migration.sh status    # Check current state
#

set -e

AGENTS_DIR=".claude/agents/phdresearch"
BACKUP_DIR=".claude/agents/phdresearch-backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 {migrate|revert|status}"
    echo ""
    echo "Commands:"
    echo "  migrate  - Convert claude-flow commands to god-agent CLI"
    echo "  revert   - Revert god-agent CLI back to claude-flow commands"
    echo "  status   - Show current migration state"
    echo ""
    exit 1
}

check_status() {
    echo -e "${YELLOW}=== Migration Status ===${NC}"

    # Count god-agent CLI commands
    god_agent_count=$(grep -r "npx tsx src/god-agent/universal/cli.ts" "$AGENTS_DIR"/*.md 2>/dev/null | wc -l || echo 0)

    # Count unmarked claude-flow commands (not preceded by # LEGACY:)
    unmarked_cf=$(grep -rn "npx claude-flow" "$AGENTS_DIR"/*.md 2>/dev/null | grep -v "# LEGACY:" | wc -l || echo 0)

    # Count LEGACY comments
    legacy_count=$(grep -r "# LEGACY:" "$AGENTS_DIR"/*.md 2>/dev/null | wc -l || echo 0)

    # Total files
    total_files=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | wc -l || echo 0)

    echo "Total agent files: $total_files"
    echo "God-agent CLI commands: $god_agent_count"
    echo "LEGACY comments: $legacy_count"
    echo "Unmarked claude-flow commands: $unmarked_cf"
    echo ""

    if [ "$unmarked_cf" -eq 0 ] && [ "$god_agent_count" -gt 0 ]; then
        echo -e "${GREEN}Status: MIGRATED${NC}"
        echo "All agents are using god-agent CLI with LEGACY comments preserved."
    elif [ "$god_agent_count" -eq 0 ] && [ "$legacy_count" -eq 0 ]; then
        echo -e "${YELLOW}Status: ORIGINAL (not migrated)${NC}"
        echo "Agents are using original claude-flow commands."
    else
        echo -e "${RED}Status: PARTIAL/MIXED${NC}"
        echo "Some agents may need attention."
    fi
}

create_backup() {
    echo -e "${YELLOW}Creating backup...${NC}"
    rm -rf "$BACKUP_DIR"
    cp -r "$AGENTS_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}Backup created at $BACKUP_DIR${NC}"
}

restore_backup() {
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}Restoring from backup...${NC}"
        rm -rf "$AGENTS_DIR"
        cp -r "$BACKUP_DIR" "$AGENTS_DIR"
        echo -e "${GREEN}Restored from backup${NC}"
    else
        echo -e "${RED}No backup found at $BACKUP_DIR${NC}"
        exit 1
    fi
}

do_revert() {
    echo -e "${YELLOW}=== Starting Revert ===${NC}"
    create_backup

    local count=0
    for file in "$AGENTS_DIR"/*.md; do
        if [ -f "$file" ]; then
            # Check if file has LEGACY comments (meaning it was migrated)
            if grep -q "# LEGACY:" "$file"; then
                echo "Reverting: $(basename "$file")"

                # Step 1: Remove lines with god-agent CLI commands
                sed -i '/npx tsx src\/god-agent\/universal\/cli.ts/d' "$file"

                # Step 2: Remove the "# LEGACY: " prefix, keeping the original command
                sed -i 's/# LEGACY: //' "$file"

                # Step 3: Clean up any leftover temp file patterns from migration
                # Remove the cat > /tmp/... << 'EOF' blocks and rm -f lines
                sed -i '/^cat > \/tmp\/phd-.*\.json << .EOF.$/d' "$file"
                sed -i '/^rm -f \/tmp\/phd-.*\.json$/d' "$file"

                ((count++)) || true
            fi
        fi
    done

    echo ""
    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}No files needed reverting (not migrated)${NC}"
    else
        echo -e "${GREEN}Reverted $count files${NC}"
    fi

    echo ""
    check_status
}

do_migrate() {
    echo -e "${YELLOW}=== Starting Migration ===${NC}"
    create_backup

    local count=0
    for file in "$AGENTS_DIR"/*.md; do
        if [ -f "$file" ]; then
            # Check if file has unmarked claude-flow commands
            if grep "npx claude-flow" "$file" | grep -qv "# LEGACY:"; then
                echo "Migrating: $(basename "$file")"

                # Process retrieve commands
                # Pattern: npx claude-flow memory retrieve --key "domain/tag"
                # or: npx claude-flow@alpha memory retrieve --key "domain/tag"

                # Use perl for more reliable in-place editing with complex patterns
                perl -i -pe '
                    # Skip if already has LEGACY prefix
                    next if /# LEGACY:/;

                    # Match retrieve commands and add LEGACY + new command
                    if (/^(\s*)(npx claude-flow(?:@alpha)? memory retrieve --key "([^"]+)")/) {
                        my $indent = $1;
                        my $orig = $2;
                        my $key = $3;
                        my ($domain, $tag) = $key =~ m|(.+)/([^/]+)$|;
                        $_ = "${indent}# LEGACY: ${orig}\n${indent}npx tsx src/god-agent/universal/cli.ts query -d \"${domain}\" -t \"${tag}\" --json\n";
                    }
                    # Match store commands
                    elsif (/^(\s*)(npx claude-flow(?:@alpha)? memory store\s+.*--namespace\s+"([^"]+)".*--key\s+"([^"]+)")/) {
                        my $indent = $1;
                        my $orig = $2;
                        my $ns = $3;
                        my $key = $4;
                        $_ = "${indent}# LEGACY: ${orig}\n${indent}npx tsx src/god-agent/universal/cli.ts learn \"\\\$DATA\" -d \"${ns}\" -t \"${key}\" -c \"fact\"\n";
                    }
                    # Match variable assignment with retrieve
                    elsif (/^(\s*)(\w+)=\$\(npx claude-flow(?:@alpha)? memory retrieve --key "([^"]+)"\)/) {
                        my $indent = $1;
                        my $var = $2;
                        my $key = $3;
                        my ($domain, $tag) = $key =~ m|(.+)/([^/]+)$|;
                        $_ = "${indent}# LEGACY: ${var}=\$(npx claude-flow memory retrieve --key \"${key}\")\n${indent}${var}=\$(npx tsx src/god-agent/universal/cli.ts query -d \"${domain}\" -t \"${tag}\" --json)\n";
                    }
                ' "$file"

                ((count++)) || true
            fi
        fi
    done

    echo ""
    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}No files needed migration (already migrated or no claude-flow commands)${NC}"
    else
        echo -e "${GREEN}Migrated $count files${NC}"
    fi

    echo ""
    check_status
}

# Main
case "${1:-}" in
    migrate)
        do_migrate
        ;;
    revert)
        do_revert
        ;;
    status)
        check_status
        ;;
    restore)
        restore_backup
        check_status
        ;;
    *)
        usage
        ;;
esac
