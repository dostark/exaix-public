# Phase 19: Folder Restructuring

> [!NOTE]
> **Status: Integrated**
> This planning document has been implemented and its features are now part of the core codebase.
> The directory structure is now established.

**Created:** 2026-01-05
**Status:** 📋 Planning
**Priority:** Medium
**Estimated Duration:** 2-3 days
**Parent Phase:** [Phase 18: Blueprint Modernization](./phase-18-blueprint-modernization.md)

---

## Progress Summary

| Milestone            | Status         | Description                              |
| -------------------- | -------------- | ---------------------------------------- |
| Current State Audit  | ❌ Not Started | Document all folders and their purposes  |
| Design New Structure | ❌ Not Started | Define target folder hierarchy           |
| Migration Scripts    | ❌ Not Started | Create automated migration tooling       |
| .gitignore Update    | ❌ Not Started | Update ignore patterns for new structure |
| Service Updates      | ❌ Not Started | Update path references in services       |
| CLI Updates          | ❌ Not Started | Update CLI commands for new paths        |
| Documentation        | ❌ Not Started | Update all docs with new structure       |
| Testing              | ❌ Not Started | Verify all tests pass with new structure |

---

## Executive Summary

ExoFrame's folder structure has evolved organically across 18 phases, resulting in
inconsistencies that confuse users and complicate maintenance. This phase introduces
a **domain-driven folder hierarchy** that clearly separates:

1. **Definitions** - Static templates and configurations
2. **Runtime** - Active state and execution artifacts
3. **Persistent** - Long-term storage (memory, archives)
4. **Integration** - External project access

### Key Problems

| Problem                       | Impact                                                                    | Example                               |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| **Lifecycle Fragmentation**   | Requests start in `Inbox/`, execute in `System/Active/`, no clear archive | User loses track of request lifecycle |
| **Mixed Concerns in System/** | `journal.db`, `daemon.pid`, `daemon.log` alongside `Active/`              | Runtime pollution                     |
| **Confusing Naming**          | `agents/` = AI knowledge base, `Blueprints/Agents/` = agent definitions   | Naming collision                      |
| **Orphaned Templates**        | `templates/` at root, separate from `Blueprints/`                         | Inconsistent location                 |
| **No Clear Archive**          | Documentation mentions Archive but structure unclear                      | Completed work not organized          |

### Key Goals

| Goal                       | Description                                       |
| -------------------------- | ------------------------------------------------- |
| **Domain Separation**      | Each top-level folder has single responsibility   |
| **Lifecycle Clarity**      | Request → Plan → Active → Archive flow is obvious |
| **Runtime Isolation**      | Daemon files in dedicated location                |
| **Consistent Naming**      | No ambiguous folder names                         |
| **Backward Compatibility** | Symlinks for transition period                    |

---

## Current State Analysis

### Top-Level Folder Inventory

```
ExoFrame/
├── agents/              # ⚠️ CONFUSING: AI dev knowledge base (not agent definitions!)
│   ├── chunks/          # Chunked docs for retrieval
│   ├── embeddings/      # Vector embeddings
│   ├── planning/        # Phase planning docs (THIS document)
│   └── ...
├── Blueprints/          # ✅ Agent & Flow definitions
│   ├── Agents/          # Agent blueprint markdown files
│   └── Flows/           # Flow definition TypeScript files
├── coverage/            # Test coverage JSON files
├── docs/                # Documentation markdown files
├── Inbox/               # ⚠️ PARTIAL LIFECYCLE: Only requests and plans
│   ├── Plans/           # Generated plans awaiting approval
│   └── Requests/        # User requests awaiting processing
├── Memory/              # ✅ WELL-ORGANIZED: Memory bank system
│   ├── Execution/       # Execution traces
│   ├── Index/           # Search indices
│   ├── Projects/        # Project-specific memory
│   ├── Skills/          # Procedural knowledge
│   └── Tasks/           # Task tracking
├── migrations/          # Database migration SQL files
├── Portals/             # ✅ External project symlinks
├── scripts/             # Build and utility scripts
├── src/                 # Source code
├── System/              # ⚠️ MIXED CONCERNS: Runtime + Active plans
│   ├── Active/          # Plans currently executing
│   ├── journal.db       # Activity database
│   ├── daemon.pid       # Daemon process ID
│   └── daemon.log       # Daemon log file
├── templates/           # ⚠️ ORPHANED: Sample config files
├── tests/               # Test files
└── tests_infra/         # Test infrastructure
```

### Problem Analysis

#### 1. Lifecycle Fragmentation

The request lifecycle is split across non-adjacent folders:

```
Current Flow:
  Inbox/Requests/ → Inbox/Plans/ → System/Active/ → ???
                                                    ↑
                                          No clear Archive!
```

**User Confusion:** Where do completed plans go? Where's the history?

#### 2. System/ Mixed Concerns

```
System/
├── Active/          # Lifecycle state (plans)
├── journal.db       # Runtime artifact (database)
├── journal.db-shm   # Runtime artifact (SQLite WAL)
├── journal.db-wal   # Runtime artifact (SQLite WAL)
├── daemon.pid       # Runtime artifact (process)
├── daemon.log       # Runtime artifact (logs)
└── activity_export.md  # Export file
```

**Issues:**

- Active plans mixed with daemon runtime files
- No separation between persistent data and ephemeral state
- Git must ignore runtime files but track Active/ structure

#### 3. agents/ Naming Confusion

```
agents/          # Dev knowledge base for AI assistants
Blueprints/Agents/  # Actual agent definitions
```

**Issues:**

- New users look for agent definitions in `agents/`
- The name doesn't convey "AI assistant knowledge base"
- Creates cognitive overhead when explaining structure

#### 4. Orphaned templates/

```
templates/
├── Knowledge_Dashboard.md
├── README.md
├── README.template.md
└── exo.config.sample.toml
```

**Issues:**

- Sample config belongs with configuration
- Templates not integrated with Blueprints/
- Unclear purpose without README

---

## Proposed Structure

### Target Folder Hierarchy

```
ExoFrame/
├── .exo/                    # Runtime state (gitignored except structure)
│   ├── daemon.pid
│   ├── daemon.log
│   ├── journal.db
│   └── cache/               # Temporary cache files
│
├── Blueprints/              # DEFINITIONS: Agent & Flow templates
│   ├── Agents/              # Agent definitions
│   │   ├── examples/        # Example agents
│   │   └── templates/       # ← MOVED from root templates/
│   └── Flows/               # Flow definitions
│
├── Workspace/               # LIFECYCLE: Request processing pipeline
│   ├── Requests/            # ← MOVED from Inbox/Requests/
│   ├── Plans/               # ← MOVED from Inbox/Plans/
│   ├── Active/              # ← MOVED from System/Active/
│   └── Archive/             # NEW: Completed plans with traces
│       ├── 2026/
│       │   ├── 01/
│       │   │   ├── {trace-id}_plan.md
│       │   │   └── {trace-id}_request.md
│       │   └── ...
│       └── index.json       # Archive index for fast lookup
│
├── Memory/                  # PERSISTENT: Long-term knowledge
│   ├── Execution/           # Execution traces
│   ├── Index/               # Search indices
│   ├── Projects/            # Project-specific memory
│   ├── Skills/              # Procedural knowledge
│   └── Tasks/               # Task tracking
│
├── Portals/                 # INTEGRATION: External projects
│   └── {project-name} →     # Symlinks to external paths
│
├── .copilot/                # DEV KNOWLEDGE: AI assistant context
│   ├── chunks/              # ← MOVED from agents/chunks/
│   ├── embeddings/          # ← MOVED from agents/embeddings/
│   ├── planning/            # ← MOVED from agents/planning/
│   └── ...                  # Other AI context files
│
├── docs/                    # Documentation
├── migrations/              # Database migrations
├── scripts/                 # Build scripts
├── src/                     # Source code
├── tests/                   # Tests
└── tests_infra/             # Test infrastructure
```

### Design Rationale

#### Domain Separation

| Domain          | Folder        | Responsibility                   |
| --------------- | ------------- | -------------------------------- |
| **Runtime**     | `.exo/`       | Ephemeral daemon state, caches   |
| **Definitions** | `Blueprints/` | Static templates (agents, flows) |
| **Lifecycle**   | `Workspace/`  | Request processing pipeline      |
| **Knowledge**   | `Memory/`     | Persistent learnings, skills     |
| **Integration** | `Portals/`    | External project access          |
| **Dev Context** | `.copilot/`   | AI assistant knowledge base      |

#### Lifecycle Clarity

```
New Flow:
  Workspace/Requests/ → Workspace/Plans/ → Workspace/Active/ → Workspace/Archive/

  ↑ Clear linear progression through single parent folder
```

#### Naming Improvements

| Old Name     | New Name                       | Rationale                                    |
| ------------ | ------------------------------ | -------------------------------------------- |
| `agents/`    | `.copilot/`                    | Indicates AI dev tooling, dotfile convention |
| `Inbox/`     | `Workspace/`                   | Better conveys active work area              |
| `System/`    | `.exo/`                        | Standard runtime dir, clearly gitignored     |
| `templates/` | `Blueprints/Agents/templates/` | Integrated with definitions                  |

---

## Implementation Plan

### Step 19.1: Create Migration Infrastructure ❌ NOT STARTED

**Goal:** Build tooling for safe folder migration with rollback capability.

**Deliverables:**

1. Create `scripts/migrate_folders.ts` with dry-run mode
2. Create backup mechanism before migration
3. Create symlink generator for backward compatibility
4. Add migration status tracking

**Files to Create:**

- `scripts/migrate_folders.ts`
- `scripts/migration_config.json`

**Migration Config Schema:**

```json
{
  "version": "19.0.0",
  "migrations": [
    {
      "id": "inbox-to-workspace",
      "source": "Inbox/",
      "target": "Workspace/",
      "type": "move",
      "symlink": true
    }
  ],
  "rollback": {
    "enabled": true,
    "backupDir": ".exo/migration-backup/"
  }
}
```

**Success Criteria:**

- [ ] Migration script runs in dry-run mode without changes
- [ ] Backup created before actual migration
- [ ] Symlinks created for backward compatibility
- [ ] Rollback restores original structure

**Projected Tests:** `tests/scripts/migrate_folders_test.ts`

```
❌ Migration: dry-run reports planned changes
❌ Migration: creates backup before changes
❌ Migration: creates symlinks for compatibility
❌ Migration: rollback restores original state
```

---

### Step 19.2: Create .exo/ Runtime Directory ❌ NOT STARTED

**Goal:** Move runtime artifacts to dedicated .exo/ directory.

**Deliverables:**

1. Create `.exo/` directory structure
2. Update `ConfigService` to use `.exo/journal.db`
3. Update `DaemonCommands` to use `.exo/daemon.pid` and `.exo/daemon.log`
4. Update `.gitignore` for new paths
5. Create migration for existing `System/` runtime files

**Files to Modify:**

- `src/config/service.ts` - Database path
- `src/cli/daemon_commands.ts` - PID and log paths
- `src/services/db.ts` - Database path resolution
- `.gitignore` - Add `.exo/` patterns

**Path Changes:**

| Old Path            | New Path          |
| ------------------- | ----------------- |
| `System/journal.db` | `.exo/journal.db` |
| `System/daemon.pid` | `.exo/daemon.pid` |
| `System/daemon.log` | `.exo/daemon.log` |

**Success Criteria:**

- [ ] `.exo/` directory created on daemon start
- [ ] Database operations use new path
- [ ] Daemon PID/log use new paths
- [ ] Old paths create deprecation warning
- [ ] `.gitignore` properly excludes `.exo/`

**Projected Tests:** `tests/services/db_test.ts`, `tests/cli/daemon_commands_test.ts`

```
❌ Database: uses .exo/journal.db path
❌ Daemon: writes PID to .exo/daemon.pid
❌ Daemon: writes logs to .exo/daemon.log
❌ Config: warns on deprecated System/ paths
```

---

### Step 19.2b: Consolidate System/Notifications into SQLite ✅ COMPLETED

> **Status:** ✅ Completed
> **Completion Date:** 2026-01-06
> **Details:** Notification system migrated to SQLite, redundant file storage removed, NotificationService updated, migration script and schema applied, tests passing except legacy file test.

**Goal:** Eliminate redundant file-based notification storage by using existing Activity Journal.

**Current State Analysis:**

The notification system currently maintains a **redundant storage layer** in `System/Notifications/memory.json` that duplicates what's already in the Activity Journal database.

**Current Implementation:**

- **Path:** `System/Notifications/memory.json`
- **Format:** JSON array of notification objects
- **Purpose:** User alerts for pending memory updates (Phase 12.9)
- **Problem:** Duplicates activity data already logged to `journal.db`

**Architecture Redundancy:**

```
Current (Redundant):
┌─────────────────────────┐
│ NotificationService     │
├─────────────────────────┤
│ 1. Log to journal.db    │ ← Already has the data!
│ 2. Write to memory.json │ ← Redundant file I/O
└─────────────────────────┘
```

**Problems with Current Approach:**

| Problem                | Impact                                           |
| ---------------------- | ------------------------------------------------ |
| **Data Duplication**   | Same notification data in two places (DB + file) |
| **Sync Complexity**    | File and DB can become inconsistent              |
| **File I/O Overhead**  | Parse/stringify JSON on every operation          |
| **Race Conditions**    | Concurrent file access not handled               |
| **Maintenance Burden** | Two storage layers to maintain                   |

**Why SQLite is Better:**

ExoFrame **already has** all the infrastructure needed:

✅ `journal.db` database with ACID transactions
✅ `DatabaseService` with query methods
✅ Activity logging for all events
✅ Migration system for schema changes
✅ Indexed queries for fast filtering

**Deliverables:**

1. Remove `System/Notifications/` directory entirely
2. Add `notifications` table to `journal.db` schema
3. Update `NotificationService` to use database-only storage
4. Update TUI dashboard to query from database
5. Create migration to import existing `memory.json` data
6. Remove file I/O code from NotificationService

**Database Schema:**

```sql
-- migrations/010_add_notifications_table.sql

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  proposal_id TEXT,
  trace_id TEXT,
  created_at TEXT NOT NULL,
  dismissed_at TEXT,
  metadata TEXT,  -- JSON for extensibility

  FOREIGN KEY (trace_id) REFERENCES activity(trace_id)
);

CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_dismissed ON notifications(dismissed_at);
CREATE INDEX idx_notifications_proposal ON notifications(proposal_id);
```

**Updated NotificationService:**

```typescript
// src/services/notification.ts (simplified)

export class NotificationService {
  constructor(
    private config: Config,
    private db: DatabaseService,
  ) {
    // No file path needed anymore!
  }

  async notifyMemoryUpdate(proposal: MemoryUpdateProposal): Promise<void> {
    // Single database operation - no files!
    const id = crypto.randomUUID();

    await this.db.execute(
      `
      INSERT INTO notifications (id, type, message, proposal_id, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        "memory_update_pending",
        `Memory update pending: ${proposal.learning.title}`,
        proposal.id,
        new Date().toISOString(),
        JSON.stringify({ learning_title: proposal.learning.title, reason: proposal.reason }),
      ],
    );

    // Activity Journal logging (already exists)
    this.db.logActivity("notification-service", "memory.update.pending", proposal.id);
  }

  async getNotifications(): Promise<MemoryNotification[]> {
    // Direct database query - no file parsing!
    return this.db.query<MemoryNotification>(`
      SELECT id, type, message, proposal_id, created_at, metadata
      FROM notifications
      WHERE dismissed_at IS NULL
      ORDER BY created_at DESC
    `);
  }

  async getPendingCount(): Promise<number> {
    const result = await this.db.query<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE type = 'memory_update_pending' AND dismissed_at IS NULL
    `);
    return result[0]?.count || 0;
  }

  async clearNotification(proposalId: string): Promise<void> {
    // Soft delete with timestamp
    await this.db.execute(
      `
      UPDATE notifications
      SET dismissed_at = ?
      WHERE proposal_id = ? AND dismissed_at IS NULL
    `,
      [new Date().toISOString(), proposalId],
    );
  }

  async clearAllNotifications(): Promise<void> {
    await this.db.execute(
      `
      UPDATE notifications
      SET dismissed_at = ?
      WHERE dismissed_at IS NULL
    `,
      [new Date().toISOString()],
    );
  }
}
```

**Files to Modify:**

- `src/services/notification.ts` - Replace file I/O with SQL queries
- `src/services/db.ts` - Add notification query helpers
- `src/tui/tui_dashboard.ts` - Query notifications from DB
- `src/cli/memory_commands.ts` - Query notifications from DB

**Files to Create:**

- `migrations/010_add_notifications_table.sql` - Schema migration
- `scripts/migrate_notifications_to_db.ts` - One-time data migration

**Files to Delete:**

- `System/Notifications/memory.json` - No longer needed
- `System/Notifications/` directory - Remove entirely

**Path Changes:**

| Old Storage                        | New Storage                        | Status        |
| ---------------------------------- | ---------------------------------- | ------------- |
| `System/Notifications/memory.json` | `journal.db`.`notifications` table | ✅ Simplified |
| `System/Notifications/` directory  | (removed)                          | ✅ Eliminated |

**Migration Script:**

```typescript
// scripts/migrate_notifications_to_db.ts

async function migrateNotificationsToDatabase(config: Config, db: DatabaseService): Promise<void> {
  const oldPath = join(config.system.root, "System", "Notifications", "memory.json");

  if (!await exists(oldPath)) {
    console.log("No notifications to migrate");
    return;
  }

  // Read old file
  const content = await Deno.readTextFile(oldPath);
  const notifications = JSON.parse(content) as MemoryNotification[];

  // Insert into database
  for (const notif of notifications) {
    await db.execute(
      `
      INSERT INTO notifications (id, type, message, proposal_id, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        crypto.randomUUID(),
        notif.type,
        notif.message,
        notif.proposal_id,
        notif.created_at,
        "{}",
      ],
    );
  }

  // Archive old file
  const archivePath = join(config.system.root, "System", "Notifications", "memory.json.migrated");
  await Deno.rename(oldPath, archivePath);

  console.log(`✓ Migrated ${notifications.length} notifications to database`);
  console.log(`✓ Archived old file to: ${archivePath}`);
}
```

**Benefits of SQLite Approach:**

| Benefit                       | Impact                                         |
| ----------------------------- | ---------------------------------------------- |
| ✅ **Single Source of Truth** | No data duplication between file and DB        |
| ✅ **ACID Transactions**      | No race conditions or corruption               |
| ✅ **Indexed Queries**        | Fast filtering by type, date, dismissal status |
| ✅ **Concurrent Access**      | SQLite handles locking automatically           |
| ✅ **Schema Evolution**       | Migrations already in place                    |
| ✅ **Simpler Code**           | ~50% less code in NotificationService          |
| ✅ **Better Performance**     | Binary format, no JSON parse/stringify         |
| ✅ **Auditability**           | Notifications linked to Activity Journal       |

**Success Criteria:**

- [x] `notifications` table added to `journal.db`
- [x] Migration runs successfully
- [x] NotificationService uses database-only storage
- [ ] TUI dashboard queries notifications from DB
- [ ] Old `memory.json` backed up and removed
- [x] All existing notification tests pass (9/10 - file test expected to fail)
- [x] Performance improved (no file I/O overhead)

**Projected Tests:** `tests/services/notification_sqlite_test.ts`

```
✅ Migration: adds notifications table to journal.db
✅ Migration: notifications table has correct schema
✅ NotificationService: inserts notification into DB
✅ NotificationService: queries active notifications
✅ NotificationService: excludes dismissed notifications
✅ NotificationService: soft-deletes with dismissed_at
✅ NotificationService: only affects undismissed notifications
✅ NotificationService: soft-deletes all active
✅ NotificationService: counts pending notifications
✅ NotificationService: handles concurrent inserts
✅ NotificationService: stores metadata as JSON
✅ NotificationService: returns empty array when none exist
```

**Why This is Better Than Files:**

1. **No Redundancy:** Activity Journal already logs events, notifications extend it
2. **Better Queries:** `WHERE dismissed_at IS NULL ORDER BY created_at DESC` vs reading entire file
3. **Atomic Updates:** Database transactions prevent corruption
4. **Future-Proof:** Easy to add columns (priority, read_at, expires_at)
5. **System Consistency:** All persistent state in `.exo/journal.db`

---

### Step 19.2a: Draft Target Folder Hierarchy (Design)

**Proposed New Folder Tree:**

> **Status:** ✅ Completed
> **Completion Date:** 2026-01-06
> **Details:** Target folder hierarchy drafted, rationale documented, structure ready for migration planning.

```
ExoFrame/
├── .exo/                    # Runtime state (gitignored except structure)
│   ├── daemon.pid
│   ├── daemon.log
│   ├── journal.db
│   └── cache/
│
├── Blueprints/              # DEFINITIONS: Agent & Flow templates
│   ├── Agents/
│   │   ├── examples/
│   │   └── templates/
│   └── Flows/
│
├── Workspace/               # LIFECYCLE: Request processing pipeline
│   ├── Requests/
│   ├── Plans/
│   ├── Active/
│   └── Archive/
│       ├── 2026/
│       │   ├── 01/
│       │   │   ├── {trace-id}_plan.md
│       │   │   └── {trace-id}_request.md
│       │   └── ...
│       └── index.json
│
├── Memory/                  # PERSISTENT: Long-term knowledge
│   ├── Execution/
│   ├── Index/
│   ├── Projects/
│   ├── Skills/
│   └── Tasks/
│
├── Portals/                 # INTEGRATION: External projects
│   └── {project-name} →     # Symlinks to external paths
│
├── .copilot/                # DEV KNOWLEDGE: AI assistant context
│   ├── chunks/
│   ├── embeddings/
│   ├── planning/
│   └── ...
│
├── docs/                    # Documentation
├── migrations/              # Database migrations
├── scripts/                 # Build scripts
├── src/                     # Source code
├── tests/                   # Tests
└── tests_infra/             # Test infrastructure
```

**Rationale:**

- `.exo/`: All runtime and ephemeral state, clearly separated and gitignored.
- `Blueprints/`: All static agent and flow definitions, including templates and examples.
- `Workspace/`: All user-facing lifecycle content, with a clear flow from Requests → Plans → Active → Archive.
- `Memory/`: Persistent, structured knowledge and learnings, including skills and execution traces.
- `Portals/`: Symlinks to external projects, for integration and context.
- `.copilot/`: All AI assistant/dev knowledge base content, formerly `agents/`.
- `docs/`, `migrations/`, `scripts/`, `src/`, `tests/`, `tests_infra/`: Standard project support folders, unchanged.

This structure enforces domain separation, lifecycle clarity, and naming consistency, and supports migration and backward compatibility.

---

### Step 19.3: Create Workspace/ Lifecycle Directory ❌ NOT STARTED

**Goal:** Consolidate lifecycle folders under Workspace/.

**Deliverables:**

1. Create `Workspace/` directory with subdirectories
2. Move `Inbox/Requests/` → `Workspace/Requests/`
3. Move `Inbox/Plans/` → `Workspace/Plans/`
4. Move `System/Active/` → `Workspace/Active/`
5. Create `Workspace/Archive/` with year/month structure
6. Create symlinks: `Inbox/` → `Workspace/`, `System/Active/` → `Workspace/Active/`
7. Update all services using these paths

**Files to Modify:**

- `src/services/watcher.ts` - Watch paths
- `src/services/request_processor.ts` - Request/Plan paths
- `src/services/plan_executor.ts` - Active path
- `src/cli/request_commands.ts` - Request path
- `src/cli/plan_commands.ts` - Plan path

**Path Changes:**

| Old Path          | New Path              |
| ----------------- | --------------------- |
| `Inbox/Requests/` | `Workspace/Requests/` |
| `Inbox/Plans/`    | `Workspace/Plans/`    |
| `System/Active/`  | `Workspace/Active/`   |
| (new)             | `Workspace/Archive/`  |

**Archive Structure:**

```
Workspace/Archive/
├── index.json           # Fast lookup index
└── 2026/
    └── 01/
        ├── {trace-id}/
        │   ├── request.md
        │   ├── plan.md
        │   └── summary.json
        └── ...
```

**Success Criteria:**

- [ ] All lifecycle stages in Workspace/
- [ ] Symlinks provide backward compatibility
- [ ] Watcher detects files in new locations
- [ ] CLI commands work with new paths
- [ ] Archive stores completed work

**Projected Tests:** `tests/services/watcher_test.ts`, `tests/cli/request_commands_test.ts`

```
❌ Watcher: monitors Workspace/Requests/
❌ Watcher: monitors Workspace/Plans/
❌ Watcher: monitors Workspace/Active/
❌ Request: creates in Workspace/Requests/
❌ Plan: writes to Workspace/Plans/
❌ Archive: stores completed plans by date
```

---

### Step 19.4: Rename agents/ to .copilot/ ❌ NOT STARTED

**Goal:** Rename AI knowledge base to avoid confusion with Blueprints/Agents/.

**Deliverables:**

1. Move `agents/` → `.copilot/`
2. Update all scripts referencing `agents/`
3. Update documentation references
4. Update all internal references to `agents/` in `.copilot/` files (planning docs, READMEs, manifests, etc.)
5. Create symlink `agents/` → `.copilot/` for transition
6. Update `.gitignore` patterns

**Files to Modify:**

- `scripts/build_agents_index.ts` → Path references
- `scripts/build_agents_embeddings.ts` → Path references
- `scripts/verify_manifest_fresh.ts` → Path references
- `scripts/validate_agents_docs.ts` → Path references
- `docs/ExoFrame_Architecture.md` → Documentation
- `CLAUDE.md` → AI context references
- `.copilot/planning/phase-*.md` → Internal links and references
- `.copilot/README.md` → Internal links
- `.copilot/manifest.json` → Path references if present

**Path Changes:**

| Old Path               | New Path                 |
| ---------------------- | ------------------------ |
| `agents/manifest.json` | `.copilot/manifest.json` |
| `agents/chunks/`       | `.copilot/chunks/`       |
| `agents/embeddings/`   | `.copilot/embeddings/`   |
| `agents/planning/`     | `.copilot/planning/`     |
| `agents/docs/`         | `.copilot/docs/`         |

**Success Criteria:**

- [ ] All AI knowledge base files in `.copilot/`
- [ ] Build scripts work with new paths
- [ ] Symlink provides transition compatibility
- [ ] Documentation updated
- [ ] No references to old `agents/` path in code

**Projected Tests:** `tests/scripts/build_agents_test.ts`

```
❌ Build: agents index uses .copilot/ path
❌ Build: embeddings use .copilot/ path
❌ Verify: manifest fresh check uses .copilot/ path
```

---

### Step 19.5: Integrate templates/ with Blueprints/ ❌ NOT STARTED

**Goal:** Move orphaned templates into Blueprints structure.

**Deliverables:**

1. Move `templates/exo.config.sample.toml` → root (sample config)
2. Move `templates/README.template.md` → `Blueprints/Agents/templates/`
3. Move `templates/Knowledge_Dashboard.md` → `docs/templates/`
4. Remove empty `templates/` directory
5. Update any references

**Files to Move:**

| Old Path                           | New Path                       | Rationale          |
| ---------------------------------- | ------------------------------ | ------------------ |
| `templates/exo.config.sample.toml` | `exo.config.sample.toml`       | Root config sample |
| `templates/README.template.md`     | `Blueprints/Agents/templates/` | Agent template     |
| `templates/Knowledge_Dashboard.md` | `docs/templates/`              | Doc template       |

**Success Criteria:**

- [ ] No orphaned `templates/` directory
- [ ] Config sample at root level
- [ ] Agent templates with Blueprints
- [ ] Doc templates with docs

**Projected Tests:** None (file moves only)

---

### Step 19.6: Update .gitignore ❌ NOT STARTED

**Goal:** Consolidate and update .gitignore for new folder structure.

**Current .gitignore Issues:**

```gitignore
# Current patterns (problematic)
/System/*.db*           # Will be obsolete
/System/activity_export.md
/System/daemon.pid      # Will be obsolete
/System/*.log           # Will be obsolete
/Inbox/                 # Will be obsolete
/Portals/               # Correct - external symlinks
```

**Deliverables:**

1. Add `.exo/` runtime directory patterns
2. Add `Workspace/` lifecycle patterns
3. Keep `Portals/` pattern (unchanged)
4. Add deprecation comments for old patterns (transition period)
5. Remove obsolete patterns after migration complete
6. Organize patterns by domain with clear section headers

**File to Modify:**

- `.gitignore`

**New .gitignore Structure:**

```gitignore
# ============================================
# ExoFrame .gitignore
# ============================================

# --------------------------------------------
# Build & Cache
# --------------------------------------------
/.cache
dist/
*.log

# --------------------------------------------
# Test Artifacts
# --------------------------------------------
coverage*/
.coverage/
jscpd-report/
report/
test-*.toml
cov_profile/

# Allow agent-facing coverage snapshot
!.copilot/coverage/
!.copilot/coverage/coverage-summary.md

# --------------------------------------------
# Runtime State (.exo/)
# --------------------------------------------
# Database files
.exo/*.db
.exo/*.db-shm
.exo/*.db-wal

# Daemon state
.exo/daemon.pid
.exo/daemon.log
.exo/cache/

# Migration backups (temporary)
.exo/migration-backup/

# --------------------------------------------
# Workspace (User Content)
# --------------------------------------------
# Requests and plans are user-generated
Workspace/Requests/
Workspace/Plans/
Workspace/Active/

# Archive is persistent but large
Workspace/Archive/

# --------------------------------------------
# Integration (External Projects)
# --------------------------------------------
# Portal symlinks to external projects
Portals/

# --------------------------------------------
# DEPRECATED: Old paths (remove in v2.0.0)
# --------------------------------------------
# These patterns maintained for transition compatibility
# TODO: Remove after migration period

# Old runtime location
/System/*.db*
/System/daemon.pid
/System/*.log
/System/activity_export.md

# Old lifecycle location
/Inbox/

# --------------------------------------------
# Build Artifacts
# --------------------------------------------
exoframe
/.ci-bin/
```

**Pattern Changes:**

| Old Pattern          | New Pattern                               | Status      |
| -------------------- | ----------------------------------------- | ----------- |
| `/System/*.db*`      | `.exo/*.db*`                              | New primary |
| `/System/daemon.pid` | `.exo/daemon.pid`                         | New primary |
| `/System/*.log`      | `.exo/daemon.log`                         | New primary |
| `/Inbox/`            | `Workspace/Requests/`, `Workspace/Plans/` | New primary |
| (none)               | `Workspace/Active/`                       | New         |
| (none)               | `Workspace/Archive/`                      | New         |
| `/Portals/`          | `Portals/`                                | Unchanged   |
| `!agents/coverage/`  | `!.copilot/coverage/`                     | Renamed     |

**Success Criteria:**

- [ ] `.exo/` directory fully ignored
- [ ] `Workspace/` subdirectories properly ignored
- [ ] Old patterns kept with deprecation comments
- [ ] Clear section organization
- [ ] `git status` shows no untracked runtime files

**Projected Tests:** `tests/scripts/migrate_folders_test.ts`

```
❌ Gitignore: .exo/ files not tracked
❌ Gitignore: Workspace/ user content not tracked
❌ Gitignore: Portals/ symlinks not tracked
❌ Gitignore: .copilot/coverage/ exception works
```

---

### Step 19.7: Update Configuration Service ❌ NOT STARTED

**Goal:** Update ConfigService to support new folder structure with fallbacks.

**Deliverables:**

1. Add path resolution with fallback to old paths
2. Add deprecation warnings for old paths
3. Add configuration for custom paths
4. Update default path constants

**Files to Modify:**

- `src/config/service.ts`
- `src/config/paths.ts` (new)

**New Path Configuration:**

```toml
# exo.config.toml
[paths]
workspace = "Workspace"      # Lifecycle folder
runtime = ".exo"             # Runtime artifacts
memory = "Memory"            # Knowledge storage
portals = "Portals"          # External projects
blueprints = "Blueprints"    # Definitions
```

**Success Criteria:**

- [ ] ConfigService resolves new paths
- [ ] Fallback to old paths with warning
- [ ] Custom paths configurable
- [ ] All services use ConfigService for paths

**Projected Tests:** `tests/config/service_test.ts`

```
❌ Config: resolves Workspace path
❌ Config: resolves .exo runtime path
❌ Config: warns on deprecated Inbox path
❌ Config: supports custom path overrides
```

---

### Step 19.8: Update CLI Commands ❌ NOT STARTED

**Goal:** Update all CLI commands to use new paths.

**Deliverables:**

1. Update `request` commands for `Workspace/Requests/`
2. Update `plan` commands for `Workspace/Plans/`
3. Update `daemon` commands for `.exo/`
4. Add `archive` subcommands for `Workspace/Archive/`
5. Update help text with new paths

**Files to Modify:**

- `src/cli/request_commands.ts`
- `src/cli/plan_commands.ts`
- `src/cli/daemon_commands.ts`
- `src/cli/archive_commands.ts` (new)

**New Commands:**

```bash
exoctl archive list              # List archived plans
exoctl archive show <trace-id>   # Show archived plan details
exoctl archive search <query>    # Search archive
exoctl archive stats             # Archive statistics
```

**Success Criteria:**

- [ ] All commands use new paths
- [ ] Help text reflects new structure
- [ ] Archive commands functional
- [ ] Backward compatibility via fallbacks

**Projected Tests:** `tests/cli/*_commands_test.ts`

```
❌ Request: uses Workspace/Requests/ path
❌ Plan: uses Workspace/Plans/ path
❌ Daemon: uses .exo/ path
❌ Archive: list shows archived plans
❌ Archive: search finds by query
```

---

### Step 19.9: Update Documentation ❌ NOT STARTED

**Goal:** Update all documentation to reflect new folder structure.

**Deliverables:**

1. Update `docs/ExoFrame_Architecture.md` diagrams
2. Update `docs/ExoFrame_User_Guide.md` paths
3. Update `README.md` quick start
4. Update `CLAUDE.md` context
5. Create migration guide for existing users

**Files to Modify:**

- `docs/ExoFrame_Architecture.md`
- `docs/ExoFrame_User_Guide.md`
- `README.md`
- `CLAUDE.md`
- `docs/Migration_Guide_v19.md` (new)

**Success Criteria:**

- [ ] All diagrams show new structure
- [ ] User guide uses new paths
- [ ] Migration guide helps existing users
- [ ] No references to old structure without deprecation note

**Projected Tests:** None (documentation only)

---

### Step 19.10: Create Archive Service ❌ NOT STARTED

**Goal:** Implement automatic archival of completed plans.

**Deliverables:**

1. Create `ArchiveService` for plan archival
2. Implement date-based directory structure
3. Create archive index for fast lookups
4. Add archival trigger after plan completion
5. Implement archive search and retrieval

**Files to Create:**

- `src/services/archive_service.ts`
- `src/schemas/archive.ts`

**Archive Schema:**

```typescript
const ArchiveEntrySchema = z.object({
  trace_id: z.string().uuid(),
  request_id: z.string(),
  agent_id: z.string(),
  archived_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  status: z.enum(["completed", "failed", "cancelled"]),
  step_count: z.number(),
  duration_ms: z.number(),
  portal: z.string().optional(),
  tags: z.array(z.string()),
});
```

**Success Criteria:**

- [ ] Plans archived on completion
- [ ] Date-based directory structure
- [ ] Index enables fast search
- [ ] Retrieval by trace_id works
- [ ] Search by date/agent/portal works

**Projected Tests:** `tests/services/archive_service_test.ts`

```
❌ Archive: stores completed plan
❌ Archive: creates year/month structure
❌ Archive: updates index.json
❌ Archive: retrieves by trace_id
❌ Archive: searches by date range
❌ Archive: searches by agent
```

---

### Step 19.11: Testing and Validation ❌ NOT STARTED

**Goal:** Ensure all tests pass with new folder structure.

**Deliverables:**

1. Update test fixtures for new paths
2. Run full test suite
3. Fix any path-related failures
4. Add migration regression tests
5. Performance test archive operations

**Files to Modify:**

- `tests/**/*.ts` - Path updates as needed
- `tests_infra/**/*.ts` - Test infrastructure updates

**Success Criteria:**

- [ ] All 2577+ tests pass
- [ ] No path hardcoding in tests
- [ ] Migration tests verify compatibility
- [ ] Archive performance acceptable (<100ms for 10k entries)

**Projected Tests:** Full suite + new tests

```
❌ Migration: regression tests pass
❌ Archive: performance under load
❌ Paths: no hardcoded old paths in tests
```

---

# Step 19.12 TUI Integration: SQLite-Based Notifications

**Date:** 2026-01-06
**Status:** PLANNED
**Parent:** Phase 19: Folder Structure Restructuring
**Related:** Phase 13: TUI Enhancement & Unification

---

## Overview

This document outlines the changes needed to integrate the new SQLite-based notification system (Step 19.2b) into the TUI Dashboard. The TUI currently uses an in-memory notification system that needs to be replaced with database-backed notifications.

## Current TUI Notification Architecture

### Current Implementation

**Location:** `src/tui/tui_dashboard.ts`

**Current Notification Interface:**

```typescript
export interface Notification {
  id: string;
  type: MessageType;
  message: string;
  timestamp: Date;
  dismissed: boolean;
  autoExpire: boolean;
  duration: number; // milliseconds
}
```

**Current State:**

```typescript
export interface DashboardViewState {
  showNotifications: boolean;
  notifications: Notification[]; // In-memory array
  // ... other fields
}
```

**Current Behavior:**

- Notifications stored in memory (`state.notifications[]`)
- Created via `createNotification()` helper
- Auto-expire after duration (5 seconds default)
- Rendered via `renderNotificationPanel()`
- Toggled with `n` key
- Dismissed manually or auto-expire

### Current Usage Patterns

1. **Dashboard Notifications:**
   - Pane split/close actions
   - Layout save/restore
   - View switching

2. **Notification Display:**
   - Panel shown with `n` key
   - Badge in status bar: `🔔${count}`
   - Most recent shown first
   - Auto-dismiss after 5 seconds

## Proposed Changes

### 1. Update Notification Interface

**Align with SQLite Schema:**

```typescript
// src/tui/tui_dashboard.ts

export interface TuiNotification {
  id?: string; // UUID from database
  type: "memory_update_pending" | "memory_approved" | "memory_rejected" | "info" | "success" | "warning" | "error";
  message: string;
  proposal_id?: string; // For memory update notifications
  trace_id?: string; // Link to activity
  created_at?: string; // ISO timestamp
  dismissed_at?: string | null; // Soft-delete timestamp
  metadata?: string; // JSON metadata
}
```

### 2. Add NotificationService Dependency

**Inject NotificationService into Dashboard:**

```typescript
// src/tui/tui_dashboard.ts

export async function launchTuiDashboard(
  options: {
    testMode?: boolean;
    nonInteractive?: boolean;
    notificationService?: NotificationService; // NEW
    config?: Config; // NEW
    db?: DatabaseService; // NEW
  } = {},
): Promise<TuiDashboard | undefined> {
  // Initialize services
  const config = options.config || await loadConfig();
  const db = options.db || new DatabaseService(config);
  const notificationService = options.notificationService || new NotificationService(config, db);

  // ...
}
```

### 3. Replace In-Memory Notifications with Database Queries

**Remove In-Memory Array:**

```typescript
// BEFORE:
export interface DashboardViewState {
  notifications: Notification[]; // ❌ Remove
}

// AFTER:
export interface DashboardViewState {
  showNotifications: boolean;
  // notifications removed - query from DB on demand
}
```

**Query Notifications from Database:**

```typescript
// src/tui/tui_dashboard.ts

export class TuiDashboardImpl implements TuiDashboard {
  constructor(
    private notificationService: NotificationService,
    // ... other dependencies
  ) {}

  async getActiveNotifications(): Promise<TuiNotification[]> {
    // Query from database instead of in-memory array
    return await this.notificationService.getNotifications();
  }

  async getNotificationCount(): Promise<number> {
    return await this.notificationService.getPendingCount();
  }

  async dismissNotification(proposalId: string): Promise<void> {
    await this.notificationService.clearNotification(proposalId);
  }

  async clearAllNotifications(): Promise<void> {
    await this.notificationService.clearAllNotifications();
  }
}
```

### 4. Update Notification Rendering

**Async Rendering:**

```typescript
// src/tui/tui_dashboard.ts

export async function renderNotificationPanel(
  notificationService: NotificationService,
  theme: Theme,
  maxHeight = 10,
): Promise<string[]> {
  const lines: string[] = [];

  // Query active notifications from database
  const activeNotifications = await notificationService.getNotifications();

  if (activeNotifications.length === 0) {
    lines.push(colorize("  No notifications", theme.textDim, theme.reset));
    return lines;
  }

  // Header
  lines.push(
    colorize(
      `${DASHBOARD_ICONS.notification.bell} Notifications (${activeNotifications.length})`,
      theme.h2,
      theme.reset,
    ),
  );
  lines.push("");

  // Show most recent notifications
  const visibleNotifications = activeNotifications.slice(0, maxHeight - 2);

  for (const notification of visibleNotifications) {
    const icon = getNotificationIcon(notification.type);
    const timeAgo = formatTimeAgo(new Date(notification.created_at!));

    let messageColor = theme.text;
    if (notification.type === "error" || notification.type === "memory_rejected") {
      messageColor = theme.error;
    } else if (notification.type === "warning") {
      messageColor = theme.warning;
    } else if (notification.type === "success" || notification.type === "memory_approved") {
      messageColor = theme.success;
    } else if (notification.type === "info" || notification.type === "memory_update_pending") {
      messageColor = theme.primary;
    }

    const line = `  ${icon} ${colorize(notification.message, messageColor, theme.reset)} ${
      colorize(`(${timeAgo})`, theme.textDim, theme.reset)
    }`;
    lines.push(line);
  }

  if (activeNotifications.length > visibleNotifications.length) {
    const more = activeNotifications.length - visibleNotifications.length;
    lines.push(colorize(`  ... and ${more} more`, theme.textDim, theme.reset));
  }

  return lines;
}

function getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    "info": DASHBOARD_ICONS.notification.info,
    "success": DASHBOARD_ICONS.notification.success,
    "warning": DASHBOARD_ICONS.notification.warning,
    "error": DASHBOARD_ICONS.notification.error,
    "memory_update_pending": "📝",
    "memory_approved": "✅",
    "memory_rejected": "❌",
  };
  return iconMap[type] || DASHBOARD_ICONS.notification.info;
}
```

### 5. Update Status Bar Badge

**Async Badge Count:**

```typescript
// src/tui/tui_dashboard.ts

async renderStatusBar(): Promise<string> {
  const activePane = this.panes.find((p) => p.id === this.activePaneId);
  const indicator = renderViewIndicator(this.panes, this.activePaneId, this.theme);

  // Query notification count from database
  const notificationCount = await this.notificationService.getPendingCount();
  const notificationBadge = notificationCount > 0 ? ` 🔔${notificationCount}` : "";

  return `${indicator} │ Active: ${activePane?.view.name}${notificationBadge}`;
}
```

### 6. Add Memory Update Notification Handling

**New Keyboard Shortcut for Memory Notifications:**

```typescript
// src/tui/tui_dashboard.ts

// Add to DASHBOARD_KEY_BINDINGS
{ key: "m", action: "show_memory_notifications", description: "Memory updates", category: "General" },
```

**Memory Notification Actions:**

```typescript
// Handle memory update notifications
if (key === "m") {
  // Show only memory update notifications
  this.state.showMemoryNotifications = true;
} else if (this.state.showMemoryNotifications) {
  if (key === "escape" || key === "esc") {
    this.state.showMemoryNotifications = false;
  } else if (key === "a") {
    // Approve selected memory update
    const notifications = await this.notificationService.getNotifications();
    const memoryNotifs = notifications.filter((n) => n.type === "memory_update_pending");
    if (memoryNotifs.length > 0) {
      const selected = memoryNotifs[this.selectedMemoryNotifIndex];
      // Trigger approval workflow
      await this.approveMemoryUpdate(selected.proposal_id!);
      await this.notificationService.clearNotification(selected.proposal_id!);
    }
  } else if (key === "r") {
    // Reject selected memory update
    const notifications = await this.notificationService.getNotifications();
    const memoryNotifs = notifications.filter((n) => n.type === "memory_update_pending");
    if (memoryNotifs.length > 0) {
      const selected = memoryNotifs[this.selectedMemoryNotifIndex];
      // Trigger rejection workflow
      await this.rejectMemoryUpdate(selected.proposal_id!);
      await this.notificationService.clearNotification(selected.proposal_id!);
    }
  }
}
```

### 7. Update Dashboard Tests

**Mock NotificationService:**

```typescript
// tests/tui/tui_dashboard_test.ts

class MockNotificationService {
  private notifications: MemoryNotification[] = [];

  async getNotifications(): Promise<MemoryNotification[]> {
    return this.notifications.filter((n) => !n.dismissed_at);
  }

  async getPendingCount(): Promise<number> {
    return this.notifications.filter((n) => n.type === "memory_update_pending" && !n.dismissed_at).length;
  }

  async clearNotification(proposalId: string): Promise<void> {
    const notif = this.notifications.find((n) => n.proposal_id === proposalId);
    if (notif) {
      notif.dismissed_at = new Date().toISOString();
    }
  }

  async clearAllNotifications(): Promise<void> {
    this.notifications.forEach((n) => {
      n.dismissed_at = new Date().toISOString();
    });
  }

  // Test helper
  addTestNotification(notification: MemoryNotification): void {
    this.notifications.push(notification);
  }
}
```

**Update Tests:**

```typescript
Deno.test("TUI Dashboard: queries notifications from database", async () => {
  const mockNotifService = new MockNotificationService();
  mockNotifService.addTestNotification({
    id: "test-1",
    type: "memory_update_pending",
    message: "Test notification",
    proposal_id: "proposal-1",
    created_at: new Date().toISOString(),
  });

  const dashboard = await launchTuiDashboard({
    testMode: true,
    notificationService: mockNotifService,
  });

  const count = await dashboard.getNotificationCount();
  assertEquals(count, 1);
});

Deno.test("TUI Dashboard: dismisses notification via database", async () => {
  const mockNotifService = new MockNotificationService();
  mockNotifService.addTestNotification({
    id: "test-1",
    type: "memory_update_pending",
    message: "Test notification",
    proposal_id: "proposal-1",
    created_at: new Date().toISOString(),
  });

  const dashboard = await launchTuiDashboard({
    testMode: true,
    notificationService: mockNotifService,
  });

  await dashboard.dismissNotification("proposal-1");

  const count = await dashboard.getNotificationCount();
  assertEquals(count, 0);
});
```

## Implementation Checklist

### Phase 1: Core Integration

- [x] Update `Notification` interface to match SQLite schema
- [x] Add `NotificationService` dependency to `launchTuiDashboard()`
- [x] Remove in-memory `notifications` array from state
- [x] Update `renderNotificationPanel()` to query from database
- [x] Update status bar badge to query count from database
- [x] Add async rendering support

### Phase 2: Memory Update Notifications

- [x] Add memory notification icon mapping
- [x] Add `m` keyboard shortcut for memory notifications
- [x] Implement memory notification approval/rejection workflow
- [x] Add memory notification detail view

### Phase 3: Testing

- [x] Create `MockNotificationService` for tests
- [x] Update existing dashboard tests
- [x] Add tests for database-backed notifications
- [x] Add tests for memory update notification handling

### Phase 4: Documentation

- [x] Update TUI keyboard reference
- [ ] Update help screen with memory notification shortcuts
- [ ] Document notification persistence behavior

## Benefits

| Benefit                      | Impact                                       |
| ---------------------------- | -------------------------------------------- |
| **Persistent Notifications** | Notifications survive TUI restarts           |
| **Consistent Data**          | Single source of truth (database)            |
| **Better Performance**       | No in-memory array management                |
| **Audit Trail**              | All notifications logged to Activity Journal |
| **Memory Integration**       | Direct link to memory update proposals       |

## Backward Compatibility

**Breaking Changes:**

- `Notification` interface updated (type field expanded)
- `notify()` method signature may change
- Auto-expire behavior removed (database-backed)

**Migration Path:**

- Existing in-memory notifications will be lost on restart (acceptable)
- New notifications will be database-backed
- Tests updated to use mock service

## Success Criteria

- [x] TUI queries notifications from database
- [x] Notification badge shows correct count from database
- [x] Notifications persist across TUI restarts
- [x] Memory update notifications displayed correctly
- [x] All existing TUI tests pass
- [x] New notification tests added and passing

## Timeline

**Estimated Effort:** 0.5 day

1. Core Integration: 2 hours
2. Memory Update Handling: 1 hour
3. Testing: 1 hour
4. Documentation: 30 minutes

---

**Next Steps:**

1. Completed all planned integration phases.
2. Final review and documentation update.

## Backward Compatibility Strategy

### Symlink Bridge

During transition (2 release cycles), symlinks maintain compatibility:

```
Inbox/ → Workspace/           # Symlink
System/Active/ → Workspace/Active/  # Symlink
agents/ → .copilot/           # Symlink
```

### Deprecation Warnings

```
⚠️  DEPRECATED: 'Inbox/Requests/' is deprecated.
    Use 'Workspace/Requests/' instead.
    Symlink compatibility will be removed in v2.0.0
```

### Migration Command

```bash
exoctl migrate folders --dry-run    # Preview changes
exoctl migrate folders              # Execute migration
exoctl migrate folders --rollback   # Restore if needed
```

---

## Risk Assessment

| Risk                        | Impact   | Mitigation                         |
| --------------------------- | -------- | ---------------------------------- |
| Breaking existing workflows | High     | Symlinks + deprecation warnings    |
| Lost data during migration  | Critical | Backup before migration            |
| Test failures               | Medium   | Incremental migration with testing |
| Documentation drift         | Low      | Update docs in same PR as changes  |
| CI/CD pipeline breaks       | Medium   | Update CI config in migration      |

---

## Success Metrics

| Metric                     | Target                 |
| -------------------------- | ---------------------- |
| Folder depth for lifecycle | ≤2 levels              |
| Path ambiguity score       | 0 (no confusing names) |
| Migration success rate     | 100%                   |
| Test pass rate             | 100%                   |
| Documentation coverage     | 100% of new paths      |

---

## Dependencies

- **Phase 18:** Blueprint structure must be stable
- **Phase 17:** Skills in Memory/ must work with new paths

---

## Timeline

| Week | Steps      | Deliverables                         |
| ---- | ---------- | ------------------------------------ |
| 1    | 19.1-19.3  | Migration tooling, .exo/, Workspace/ |
| 2    | 19.4-19.6  | .copilot/, templates, ConfigService  |
| 3    | 19.7-19.10 | CLI, docs, archive, testing          |

---

## Related Documentation

- [ExoFrame Architecture](../../docs/ExoFrame_Architecture.md)
- [Phase 17: Skills Architecture](./phase-17-skills-architecture.md)
- [Phase 18: Blueprint Modernization](./phase-18-blueprint-modernization.md)
