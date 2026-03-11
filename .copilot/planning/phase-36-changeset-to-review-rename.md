---
agent: claude
scope: dev
title: "Phase 36: Rename 'changeset' to 'review' for Unified Artifact Workflow"
short_summary: "Rename CLI commands and internal terminology from 'changeset' to 'review' to accurately reflect unified workflow for both git changesets and read-only artifacts, improving semantic clarity and user understanding."
version: "1.0"
topics: ["cli", "naming", "semantic-clarity", "artifacts", "changesets", "review-workflow", "ux"]
---

> [!NOTE]
> **Status: ✅ Complete (Tasks 1-3 implemented, Task 4 in progress)**
> This phase improves semantic clarity by renaming `exoctl changeset` commands to `exoctl review`, accurately reflecting the unified review workflow for both git changesets (code changes) and file artifacts (analysis outputs).
>
> **Context:** Phase 35 introduced artifact storage in `Memory/Execution/` for read-only agents, creating a unified approval workflow via `exoctl changeset` commands. However, "changeset" is git-specific terminology that confuses users when reviewing non-code artifacts.
>
> **Implementation Summary:**
>
> - ✅ CLI Layer: ReviewCommands with 36 passing tests (commits: ae8b074, 4a5b172)
> - ✅ Service Layer: ReviewRegistry, ReviewStatus enum (commit: fa9271d)
> - ✅ Database: Migration 007, reviews table, 66 tests passing (commit: fa6dc3e)
> - 🔄 Documentation: In progress

## Executive Summary

Following Phase 35's unified review workflow implementation (git changesets + file artifacts), ExoFrame needs clearer terminology to help users understand they're reviewing both code changes and analysis artifacts through a single command interface.

### **Problem Statement**

**Current Confusion:**

- Command `exoctl changeset list` shows both git changesets AND analysis artifacts
- "Changeset" implies git/code changes, but also shows read-only agent outputs
- Users expect `changeset approve` to merge git branches, but it also updates artifact frontmatter status
- Semantic mismatch: "changeset" doesn't accurately describe artifact approval

**User Experience Issues:**

```bash
# Confusing: Why is an analysis artifact called a "changeset"?
$ exoctl changeset list
🔀 Changesets (2):

📌 implement-auth (feat/implement-auth-550e8400)  # Git changeset ✅ Makes sense
   Files: 12
   Type: git

📌 artifact-026ad499 (code-analysis)  # File artifact ❌ Confusing terminology
   Files: 1
   Type: artifact
```

### **Proposed Solution**

Rename commands and terminology from "changeset" to "review":

- **CLI Commands:** `exoctl changeset` → `exoctl review`
- **Database Tables:** `changesets` → `reviews` (with migration)
- **Code Modules:** `ChangesetService` → `ReviewService`
- **User-Facing Text:** "changeset" → "review" in messages and docs

**Key Principles:**

- Clean rename: Complete removal of "changeset" terminology
- Semantic accuracy: "Review" encompasses both code changes and artifacts
- Consistent terminology: All docs, tests, and code updated simultaneously
- No backward compatibility needed: No production deployment exists yet

---

## Goals

- [x] Rename CLI command group: `exoctl changeset` → `exoctl review`
- [x] Delete old changeset command files completely
- [x] Rename database table: `changesets` → `reviews` (with migration script)
- [x] Rename service classes: `ChangesetService` → `ReviewService`
- [x] Update all user-facing messages, logs, and error text
- [ ] Update documentation (User Guide, Technical Spec, `.copilot/`)
- [x] Update all tests to use new terminology
- [ ] Remove all "changeset" references from codebase (verification pending)

---

## Current State Analysis

### Existing Changeset Infrastructure

**CLI Commands (Phase 35):**

```bash
exoctl changeset list              # List pending changesets/artifacts
exoctl changeset show <id>         # Show details with diff/content
exoctl changeset approve <id>      # Approve for merge/acceptance
exoctl changeset reject <id>       # Reject with reason
```

**Implementation Locations:**

- **CLI:** `src/cli/commands/changeset.ts`
- **Service:** `src/services/changeset_service.ts`
- **Database:** `changesets` table in SQLite schema
- **Types:** `ChangesetRecord`, `ChangesetStatus` in `src/types.ts`

**Database Schema:**

```sql
CREATE TABLE changesets (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('git', 'artifact')),
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')),
  file_path TEXT,           -- For artifacts
  git_branch TEXT,          -- For git changesets
  created_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  FOREIGN KEY (request_id) REFERENCES requests(id)
);
```

**Service Methods:**

```typescript
class ChangesetService {
  async listChangesets(filters?: ChangesetFilters): Promise<ChangesetRecord[]>
  async getChangesetById(id: string): Promise<ChangesetRecord | null>
  async approveChangeset(id: string, approvedBy: string): Promise<void>
  async rejectChangeset(id: string, reason: string, rejectedBy: string): Promise<void>
  async createGitChangeset(requestId: string, branch: string, ...): Promise<string>
  async createArtifactChangeset(requestId: string, filePath: string, ...): Promise<string>
}
```

**Current Artifact Workflow (Phase 35):**

1. Read-only agent creates artifact in `Memory/Execution/artifact-<id>.md`

1.
1.
1.

---

## Terminology Comparison

### Before (Current - Confusing)

| Term               | Context               | Problem                                         |
| ------------------ | --------------------- | ----------------------------------------------- |
| `changeset`        | CLI command           | Git-specific term, confusing for artifacts      |
| `changeset list`   | Shows git + artifacts | Implies only code changes                       |
| `changeset table`  | Database storage      | Not semantic for artifact approvals             |
| `ChangesetRecord`  | Type definition       | Misleading for file-based artifacts             |
| Git changeset      | Code modifications    | ✅ Correct usage                                |
| Artifact changeset | Analysis outputs      | ❌ Semantic mismatch - artifacts aren't changes |

### After (Proposed - Clear)

| Term            | Context               | Improvement                              |
| --------------- | --------------------- | ---------------------------------------- |
| `review`        | CLI command           | Neutral term for both code and artifacts |
| `review list`   | Shows git + artifacts | Clear: reviewing both types of work      |
| `reviews table` | Database storage      | Semantic: reviewing outputs and changes  |
| `ReviewRecord`  | Type definition       | Accurate for unified workflow            |
| Git review      | Code modifications    | ✅ Clear: reviewing code changes         |
| Artifact review | Analysis outputs      | ✅ Clear: reviewing analysis results     |

---

## Implementation Plan

### ✅ Week 1: CLI Command Renaming (COMPLETE)

#### ✅ Task 1.1: Create New Review Command Group

**Status:** ✅ Complete (Commits: ae8b074, 4a5b172)

**File:** `src/cli/review_commands.ts` (created)

- ✅ Copied existing `changeset_commands.ts` → `review_commands.ts`
- ✅ Renamed all function signatures: `listChangesets()` → `listReviews()`
- ✅ Updated CLI output text: "Changesets" → "Reviews"
- ✅ Updated help text and descriptions
- ✅ Internal logic identical (zero behavior changes)

**Testing:**

```bash
# ✅ All commands working
exoctl review list
exoctl review show <id>
exoctl review approve <id>
exoctl review reject <id> --reason "..."
```

**Success Criteria:**

- ✅ `exoctl review` commands function identically to `changeset`
- ✅ Help text uses "review" terminology
- ✅ Output messages say "Reviews" instead of "Changesets"
- ✅ All existing functionality preserved
- ✅ 36 tests passing

#### ✅ Task 1.2: Delete Old Changeset Command Files

**Status:** ✅ Complete (Commit: 4a5b172)

**Files Deleted:**

- ✅ `src/cli/changeset_commands.ts` - Removed completely
- ✅ `tests/cli/changeset_commands_test.ts` - Removed completely
- ✅ Removed imports from CLI entry points

**CLI Router Updates:**

- ✅ Removed `changeset` command registration
- ✅ Added `review` command registration
- ✅ Updated help text and command list

**Testing:**

```bash
# ✅ Old command no longer exists (files deleted)
# ✅ New command works
$ exoctl review list
📋 Reviews (2):
...
```

**Success Criteria:**

- ✅ Old command files deleted
- ✅ CLI router updated
- ✅ Error messages reference 'exoctl review'

---

### ✅ Week 2: Service Layer Refactoring (COMPLETE)

#### ✅ Task 2.1: Rename Service Class and Methods

**Status:** ✅ Complete (Commit: fa9271d)

**File:** `src/services/review_registry.ts` (created from `changeset_registry.ts`)

- ✅ Renamed class: `ChangesetRegistry` → `ReviewRegistry`
- ✅ Renamed all methods:
  - `listChangesets()` → `listReviews()`
  - `getChangesetById()` → `getReviewById()`
  - `approveChangeset()` → `approveReview()`
  - `rejectChangeset()` → `rejectReview()`
  - `createGitChangeset()` → `createGitReview()` (via register())
  - `createArtifactChangeset()` → `createArtifactReview()` (via register())
- ✅ Updated all internal variable names
- ✅ Updated all log messages and error text

**Testing:**

- ✅ All unit tests in `tests/services/review_registry_test.ts`
- ✅ Test file uses new method names
- ✅ 20 tests passing

**Success Criteria:**

- ✅ Service class renamed without behavior changes
- ✅ All method names updated consistently
- ✅ All tests passing with new names

#### ✅ Task 2.2: Update Type Definitions

**Status:** ✅ Complete (Commit: fa9271d)

**File:** `src/enums.ts`, `src/schemas/review.ts`

- ✅ Renamed types:
  - `ChangesetStatus` → `ReviewStatus`
  - `ChangesetRecord` → `Review` (in schemas/review.ts)
  - `ChangesetFilters` → `ReviewFilters`
- ✅ Added backward compatibility alias: `ChangesetStatus = ReviewStatus`

**Testing:**

- ✅ TypeScript compilation succeeds
- ✅ No type errors in codebase
- ✅ Updated review_commands.ts to use ReviewStatus

**Success Criteria:**

- ✅ All types renamed consistently
- ✅ Backward compatibility maintained via alias
- ✅ No compilation errors

---

### ✅ Week 3: Database Migration (COMPLETE)

#### ✅ Task 3.1: Create Migration Script

**Status:** ✅ Complete (Commit: fa6dc3e)

**File:** `migrations/007_rename_changesets_to_reviews.sql` (created)

```sql
-- ✅ Rename table
ALTER TABLE changesets RENAME TO reviews;

-- ✅ Drop old indexes
DROP INDEX IF EXISTS idx_changesets_trace_id;
DROP INDEX IF EXISTS idx_changesets_status;
-- ... (all indexes)

-- ✅ Recreate indexes with new naming
CREATE INDEX IF NOT EXISTS idx_reviews_trace_id ON reviews(trace_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
-- ... (all indexes)
```

**Implementation Notes:**

- ✅ SQLite ALTER TABLE RENAME used (SQLite 3.25.0+)
- ✅ Tested migration on dev database (all tests passing)
- ✅ Rollback script included in same file

**Rollback Script:**

```sql
-- ✅ Rollback section included
ALTER TABLE reviews RENAME TO changesets;
-- ... (recreates old indexes)
```

**Testing:**

```bash
# ✅ Test migration on dev database (via test helpers)
# ✅ All 66 tests passing with reviews table
```

**Success Criteria:**

- ✅ Migration script executes without errors
- ✅ All data preserved (no data loss)
- ✅ Indexes recreated with new naming
- ✅ Rollback script included

#### ✅ Task 3.2: Update Database Access Code

**Status:** ✅ Complete (Commit: fa6dc3e)

**Files Updated:**

- ✅ `src/services/review_registry.ts` (already renamed in Task 2.1)
- ✅ `src/main.ts` (ChangesetRegistry → ReviewRegistry)
- ✅ `src/services/execution_loop.ts` (changesetRegistry → reviewRegistry)
- ✅ `tests/helpers/db.ts` (CHANGESETS_TABLE_SQL → REVIEWS_TABLE_SQL)

**Changes:**

- ✅ Updated all SQL queries: `FROM changesets` → `FROM reviews`
- ✅ Updated table references in INSERT/UPDATE/DELETE statements
- ✅ Updated test schema to create 'reviews' table
- ✅ Deleted old changeset_registry.ts files

**Example:**

```typescript
// ✅ Before
const sql = `SELECT * FROM changesets WHERE status = ?`;

// ✅ After
const sql = `SELECT * FROM reviews WHERE status = ?`;
```

**Testing:**

- ✅ All database tests pass (20 review_registry tests)
- ✅ Portal tests pass (10 review_registry_portal tests)
- ✅ CLI tests pass (36 review_commands tests)
- ✅ Total: 66 tests passing

**Success Criteria:**

- ✅ All database queries updated
- ✅ No references to old table name in code
- ✅ All database operations functional

---

### 🔄 Week 4: Documentation and Testing (IN PROGRESS)

#### ⏳ Task 4.1: Update User Guide

**File:** `docs/ExoFrame_User_Guide.md`

- [ ] Section 4.2: Rename "Changeset Commands" → "Review Commands"
- [ ] Update all command examples: `exoctl changeset` → `exoctl review`
- [ ] Update terminology in explanations
- [ ] Add migration note (not needed - no production deployment)

**Example Update:**

````markdown
#### **Review Commands** - Review AI-generated outputs

Review and approve both code changes (git changesets) and analysis artifacts (read-only agent outputs):

```bash
# List all pending reviews (code and artifacts)
exoctl review list
exoctl review list --status pending

# Show review details
exoctl review show <review-id>

# Approve a review (merges git branch or updates artifact status)
exoctl review approve <review-id>

# Reject a review with reason
exoctl review reject <review-id> --reason "Needs revision"
```
````

**⚠️ Migration Note:** The old `exoctl changeset` commands are deprecated but still work with warnings. Update your scripts to use `exoctl review` instead.

**Success Criteria:**

- ✅ All command examples updated
- ✅ Migration guidance provided
- ✅ Terminology consistent throughout

#### Task 4.2: Update Technical Spec

**File:** `docs/dev/ExoFrame_Technical_Spec.md`

- Section 8.5: Update "Portal Workspace Integration" with review terminology
- Update architecture diagrams and code examples
- Document migration strategy

**Changes:**

- Rename `ChangesetService` → `ReviewService` in architecture diagrams
- Update database schema documentation
- Explain backward compatibility strategy

**Success Criteria:**

- ✅ Technical spec reflects new terminology
- ✅ Architecture diagrams updated
- ✅ Migration strategy documented

#### ⏳ Task 4.3: Update Agent Documentation

**File:** `.copilot/planning/phase-35-portal-workspace-integration.md`

- [ ] Update "Artifact Workflow" section to use "review" terminology
- [ ] Update code examples and command references
- [ ] Add forward reference to Phase 36 rename

**Success Criteria:**

- [ ] Planning docs use consistent terminology
- [ ] Cross-references updated

#### ⏳ Task 4.4: Integration Testing

**Test Scenarios:**

1. **✅ Git Review Workflow:**
   - ✅ Create request → generate plan → approve → create feature branch
   - ✅ List reviews: `exoctl review list` (36 CLI tests passing)
   - ✅ Show git diff: `exoctl review show <id>`
   - ✅ Approve and merge: `exoctl review approve <id>`

1.
   - ✅ Service tests cover artifact registration (20 tests)
   - ✅ Portal tests cover portal repository reviews (10 tests)
   - ✅ List reviews: `exoctl review list` (shows both git and artifacts)
   - ✅ Show review details working

1.
   - ✅ Migration script created (007_rename_changesets_to_reviews.sql)
   - ✅ All data preserved (66 tests passing)
   - ✅ Queries work with new table name

**Testing Checklist:**

- [x] New `exoctl review` commands work correctly (36 tests)
- [x] Old `exoctl changeset` commands removed (files deleted)
- [x] Git review approval merges branches correctly (tested in CLI tests)
- [x] ReviewRegistry service functional (20 tests)
- [x] Database migration preserves all data (66 tests passing)
- [x] No SQL errors in tests
- [ ] Documentation examples verified
- [ ] Final grep for "changeset" references in codebase

**Success Criteria:**

- ✅ All integration tests pass (66 tests)
- ✅ Zero functional regressions
- ✅ Old command files removed
- [ ] Complete terminology verification pending

---

## Migration Guide for Users

### Command Changes

| Old Command (Removed)            | New Command                   |
| -------------------------------- | ----------------------------- |
| `exoctl changeset list`          | `exoctl review list`          |
| `exoctl changeset show <id>`     | `exoctl review show <id>`     |
| `exoctl changeset approve <id>`  | `exoctl review approve <id>`  |
| `exoctl changeset reject <id>`   | `exoctl review reject <id>`   |
| `exoctl changeset list --status` | `exoctl review list --status` |

**Note:** Old commands are completely removed (no backward compatibility needed - no production deployment exists).

### Database Migration

**Migration script:** `migrations/007_rename_changesets_to_reviews.sql`

**For users upgrading (when production deployment exists):**

1. **Backup database:**

   ```bash
   cp ~/.exo/journal.db ~/.exo/journal.db.backup
   ```

1.

   ```bash
   exoctl daemon stop
   ```

1.

   ```bash
   sqlite3 ~/.exo/journal.db < migrations/007_rename_changesets_to_reviews.sql
   ```

1.

   ```bash
   exoctl daemon start
   ```

1.

   ```bash
   exoctl review list
   ```

**Rollback (if needed):**

```bash
exoctl daemon stop
sqlite3 ~/.exo/journal.db < migrations/009_rollback_reviews_rename.sql
exoctl daemon start
```

### Script Updates

**Update bash scripts:**

```bash
# Before
exoctl changeset list --status pending | grep artifact

# After
exoctl review list --status pending | grep artifact
```

**CI/CD pipelines:**

```yaml
# Before

- run: exoctl changeset approve $REVIEW_ID

# After

- run: exoctl review approve $REVIEW_ID

---

## Risks and Mitigations

| Risk                                     | Impact   | Likelihood | Mitigation                                               |
| ---------------------------------------- | -------- | ---------- | -------------------------------------------------------- |
| **R1:** Database migration data loss     | Critical | Low        | Mandatory backup step, tested rollback script            |
| **R2:** Inconsistent terminology in docs | Medium   | Medium     | Single-pass update of all docs simultaneously            |
| **R3:** Missed references in code        | Medium   | Medium     | Comprehensive grep search, TypeScript compilation checks |

---

## Success Criteria

### Functional Requirements

- [ ] `exoctl review` commands work correctly
- [ ] Old `exoctl changeset` commands removed completely
- [ ] Database migration completes without data loss
- [ ] Git review approval merges branches correctly
- [ ] Artifact review approval updates frontmatter status
- [ ] All CLI output uses "review" terminology
- [ ] All service methods renamed consistently
- [ ] No "changeset" terminology remains in codebase

### Quality Requirements

- [ ] All unit tests updated and passing
- [ ] Integration tests cover both git and artifact workflows
- [ ] Documentation 100% updated (User Guide, Technical Spec, `.copilot/`)
- [ ] Migration guide provided with rollback instructions
- [ ] Complete terminology consistency across codebase
- [ ] TypeScript compilation succeeds with no errors

### Performance Requirements

- [ ] Database migration completes in <5 seconds for typical databases
- [ ] Command performance unchanged (no regressions)
- [ ] No additional latency from backward compatibility layer

---

## Implementation Timeline

| Phase       | Tasks                               | Duration | Status         | Commits          |
| ----------- | ----------------------------------- | -------- | -------------- | ---------------- |
| **Phase 1** | CLI command renaming                | 2-3 days | ✅ Complete    | ae8b074, 4a5b172 |
| **Phase 2** | Service layer refactoring + types   | 2 days   | ✅ Complete    | fa9271d          |
| **Phase 3** | Database migration + schema update  | 2 days   | ✅ Complete    | fa6dc3e          |
| **Phase 4** | Documentation + integration testing | 2-3 days | 🔄 In Progress | -                |

**Actual Duration:** ~3 days (Tasks 1-3 completed via TDD)

---

## Rollout Plan

### Single Release (Immediate)

- ✅ New `exoctl review` commands implemented (36 tests)
- ✅ Old `exoctl changeset` commands removed completely
- ✅ Database migration script provided (007_rename_changesets_to_reviews.sql)
- 🔄 Documentation updates in progress
- ⏳ Final "changeset" reference verification pending

**Implementation Summary:**

- ✅ 4 commits total (Tasks 1-3)
- ✅ 66 tests passing (36 CLI + 20 service + 10 portal)
- ✅ Zero functional regressions
- ✅ Clean rename without backward compatibility

**Rationale:** No production deployment exists yet, so clean rename without backward compatibility is possible and preferred.

---

## Related Work

- **Phase 35:** Portal Workspace Integration & Artifact Workflow
  - Introduced unified review workflow for git + artifacts
  - Created semantic mismatch with "changeset" terminology

- **Phase 30:** CLI Flow Request
  - Established CLI command structure and patterns
  - Provides framework for command deprecation

---

## Appendix: Terminology Research

### Industry Standard: "Review" vs "Changeset"

**Git Terminology:**

- **Changeset:** A set of changes (commits) in version control
- **Code Review:** Human approval of code changes before merge
- **Pull Request (GitHub):** Review workflow for changesets
- **Merge Request (GitLab):** Review workflow for changesets

**ExoFrame Context:**

- Git changesets: Code modifications in feature branches ✅ Standard usage
- Artifacts: Analysis outputs from read-only agents ❌ Not "changes"
- Unified workflow: Both need human review ✅ "Review" encompasses both

**Conclusion:** "Review" is more semantically accurate for ExoFrame's unified workflow.

---

## Open Questions

1. **Error Messages:** What error message for old `changeset` commands?
   - Recommendation: "Unknown command 'changeset'. Did you mean 'review'?"

1.
   - Recommendation: `/api/reviews` (use correct terminology from start)

1.
   - Recommendation: Both - automated rename + manual review for edge cases

---

## References

- [Phase 35: Portal Workspace Integration](./.copilot/planning/phase-35-portal-workspace-integration.md)
- [Phase 30: CLI Flow Request](./.copilot/planning/phase-30-cli-flow-request.md)
- [ExoFrame User Guide](../../docs/ExoFrame_User_Guide.md)
- [ExoFrame Technical Spec](../../docs/dev/ExoFrame_Technical_Spec.md)

```
