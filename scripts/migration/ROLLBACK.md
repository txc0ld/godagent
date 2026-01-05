# Vector Migration Rollback Procedure

**Document**: TASK-VEC-001-009 Rollback Procedure
**Constitution**: RULE-009 (zero data loss), RULE-046 (atomic operations)

## Overview

This document describes how to rollback the 768D -> 1536D vector migration if issues are encountered.

## Pre-Requisites

Before any migration, backups are created automatically (unless `--no-backup` is used).

Default backup location: `.agentdb/migration-backups/`

## Rollback Steps

### Step 1: Identify Backup Files

```bash
# List all backup files
ls -la .agentdb/migration-backups/

# Example output:
# interactions.json.2024-12-29T10-30-00-000Z.bak
# session-knowledge.json.2024-12-29T10-30-01-000Z.bak
# vectors.bin.2024-12-29T10-30-02-000Z.bak
```

### Step 2: Stop Running Services

```bash
# Stop the god-agent daemon if running
pkill -f "god-agent daemon" || true

# Stop any processes using the database
fuser -k .agentdb/*.db 2>/dev/null || true
```

### Step 3: Restore Backup Files

```bash
# Restore specific file
cp .agentdb/migration-backups/interactions.json.2024-12-29T10-30-00-000Z.bak \
   .agentdb/universal/interactions.json

# Or restore all backups (interactive)
for backup in .agentdb/migration-backups/*.bak; do
  original="${backup%.bak}"
  original="${original##*/}"  # Remove timestamp
  original="${original%.*.*}"  # Remove .timestamp

  echo "Restore $backup -> .agentdb/universal/$original? [y/N]"
  read answer
  if [ "$answer" = "y" ]; then
    cp "$backup" ".agentdb/universal/$original"
  fi
done
```

### Step 4: Verify Restoration

```bash
# Check restored files have 768D vectors
npx tsx scripts/migration/detect-vector-dimensions.ts --verbose

# Expected output should show 768D vectors
```

### Step 5: Update Constants (Temporary)

If rollback is needed temporarily, update the VECTOR_DIM constant:

**File**: `src/god-agent/core/validation/constants.ts`

```typescript
// Temporarily rollback to 768D
export const VECTOR_DIM = 768;
```

**Important**: This should only be temporary while investigating issues.

### Step 6: Clear Migration State

```bash
# Remove migration state file to allow fresh start
rm -f .agentdb/migration-state.json
```

### Step 7: Restart Services

```bash
# Restart daemon
npm run daemon:start

# Verify health
npm run daemon:health
```

## Emergency Rollback Script

For automated rollback:

```bash
#!/bin/bash
# rollback-migration.sh

set -e

BACKUP_DIR=".agentdb/migration-backups"
TARGET_DIR=".agentdb/universal"

echo "=== Vector Migration Rollback ==="

# Stop services
echo "Stopping services..."
pkill -f "god-agent" || true
sleep 2

# Find most recent backups
echo "Finding backups..."
for target in "$TARGET_DIR"/*.json "$TARGET_DIR"/*.bin; do
  if [ -f "$target" ]; then
    filename=$(basename "$target")
    # Find backup with matching base name
    backup=$(ls -t "$BACKUP_DIR"/${filename}.*.bak 2>/dev/null | head -1)
    if [ -n "$backup" ]; then
      echo "Restoring $backup -> $target"
      cp "$backup" "$target"
    fi
  fi
done

# Clear state
rm -f .agentdb/migration-state.json

echo "Rollback complete. Verify with:"
echo "  npx tsx scripts/migration/detect-vector-dimensions.ts"
```

## Troubleshooting

### Issue: Backups Not Found

If backups are missing, check:
1. Was migration run with `--no-backup`?
2. Is the backup directory correct?
3. Check alternate locations: `.god-agent/backups/`

### Issue: Mixed Dimensions After Rollback

If some files were migrated and others not:

```bash
# Detect current state
npx tsx scripts/migration/detect-vector-dimensions.ts --json > state.json

# Identify mixed files
cat state.json | jq '.results[] | select(.vectorCount > 0)'
```

### Issue: Application Errors After Rollback

If the application expects 1536D vectors but data is 768D:

1. Use backward compatibility layer (automatic)
2. Or re-run migration: `npx tsx scripts/migration/migrate-768-to-1536.ts`

## Prevention

To avoid needing rollback:

1. **Always use dry-run first**:
   ```bash
   npx tsx scripts/migration/migrate-768-to-1536.ts --dry-run
   ```

2. **Verify backups exist**:
   ```bash
   ls .agentdb/migration-backups/ | wc -l
   ```

3. **Run on non-production first**:
   Test migration on a copy of production data.

4. **Monitor after migration**:
   ```bash
   # Watch logs for dimension mismatch errors
   tail -f .agentdb/daemon-spawn.log | grep -i "dimension"
   ```

## Support

If rollback issues persist:

1. Check migration state: `cat .agentdb/migration-state.json`
2. Review logs: `cat .agentdb/migration-backups/*.log`
3. Contact: [file issue on repository]

---

**Last Updated**: 2024-12-29
**Author**: TASK-VEC-001-009 Agent 1
