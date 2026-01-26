---
agent: general
scope: dev
title: "Database changeset table not created during migration"
short_summary: "Changesets table missing from database causing execution failures with 'no such table: changesets' error."
version: "0.1"
topics: ["database", "migration", "execution", "sqlite"]
status: open
priority: high
created: 2026-01-26
labels: [bug, database, migration, execution]
---


## Problem

The `changesets` table is not being created during database migration, causing execution failures with "no such table: changesets" error when trying to track plan execution changesets.

## Reproduction Steps

```bash
# Run database migration
deno run --allow-all scripts/migrate_db.ts up

# Create a request and approve plan
cd ~/ExoFrame && deno run --allow-all src/cli/exoctl.ts request "Analyze test suite" --agent default --model google:gemini-2.0-flash-exp --priority normal
cd ~/ExoFrame && deno run --allow-all src/cli/exoctl.ts plan approve <plan-id>

# Check execution - fails with database error
cd ~/ExoFrame && deno run --allow-all src/cli/exoctl.ts daemon logs --lines 20
```

## Observed Behavior

- Database migration reports "up to date"
- Plan approval succeeds
- Execution fails with: `ExecutionError: no such table: changesets`
- SQLite database file exists at `./.exo/journal.db`

## Expected Behavior

- Changesets table should be created during migration
- Plan execution should proceed without database errors
- Changesets should be properly tracked for execution history

## Environment

- ExoFrame Version: Current development
- OS: Linux
- Deno Version: 1.x.x
- Database: SQLite (journal.db)

## Investigation Needed

1. **Migration Scripts**: Check `scripts/migrate_db.ts` and migration files
   - Verify changeset table creation SQL is present
   - Check if migration is properly registered

2. **Database Schema**: Examine existing table structure
   - What tables currently exist in journal.db?
   - Is the migration system working for other tables?

## Related Files

- `scripts/migrate_db.ts` - Database migration script
- `src/services/db.ts` - Database service implementation
- `migrations/` - Migration files directory

## Workaround

None currently known - execution is blocked by this issue.

## Priority Justification

High priority - blocks plan execution functionality, which is core to the system. Users cannot execute approved plans.

## Examples

- Database migration runs without errors but changeset table doesn't exist
- Plan execution fails with "no such table: changesets" error
- SQLite database file exists but missing critical tables
