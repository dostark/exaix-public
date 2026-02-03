---
agent: claude
scope: dev
title: "Phase 36: Rename 'changeset' to 'review' for Unified Artifact Workflow"
short_summary: "Rename CLI commands and internal terminology from 'changeset' to 'review' to accurately reflect unified workflow for both git changesets and read-only artifacts, improving semantic clarity and user understanding."
version: "1.0"
topics: ["cli", "naming", "semantic-clarity", "artifacts", "changesets", "review-workflow", "ux"]
---

# Phase 36: Rename 'changeset' to 'review' for Unified Artifact Workflow

> [!NOTE]
> **Status: Planning**
> This phase improves semantic clarity by renaming `exoctl changeset` commands to `exoctl review`, accurately reflecting the unified review workflow for both git changesets (code changes) and file artifacts (analysis outputs).
>
> **Context:** Phase 35 introduced artifact storage in `Memory/Execution/` for read-only agents, creating a unified approval workflow via `exoctl changeset` commands. However, "changeset" is git-specific terminology that confuses users when reviewing non-code artifacts.

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

- [ ] Rename CLI command group: `exoctl changeset` → `exoctl review`
- [ ] Delete old changeset command files completely
- [ ] Rename database table: `changesets` → `reviews` (with migration script)
- [ ] Rename service classes: `ChangesetService` → `ReviewService`
- [ ] Update all user-facing messages, logs, and error text
- [ ] Update documentation (User Guide, Technical Spec, `.copilot/`)
- [ ] Update all tests to use new terminology
- [ ] Remove all "changeset" references from codebase

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
2. `ChangesetService.createArtifactChangeset()` records it in `changesets` table
3. User runs `exoctl changeset list` to see pending artifacts
4. User runs `exoctl changeset approve <id>` to update frontmatter status
5. Artifact frontmatter updated: `status: pending` → `status: approved`

---

## Terminology Comparison

### Before (Current - Confusing)

| Term              | Context                | Problem                                         |
| ----------------- | ---------------------- | ----------------------------------------------- |
| `changeset`       | CLI command            | Git-specific term, confusing for artifacts      |
| `changeset list`  | Shows git + artifacts  | Implies only code changes                       |
| `changeset table` | Database storage       | Not semantic for artifact approvals             |
| `ChangesetRecord` | Type definition        | Misleading for file-based artifacts             |
| Git changeset     | Code modifications     | ✅ Correct usage                                |
| Artifact changeset | Analysis outputs      | ❌ Semantic mismatch - artifacts aren't changes |

### After (Proposed - Clear)

| Term            | Context                | Improvement                               |
| --------------- | ---------------------- | ----------------------------------------- |
| `review`        | CLI command            | Neutral term for both code and artifacts  |
| `review list`   | Shows git + artifacts  | Clear: reviewing both types of work       |
| `reviews table` | Database storage       | Semantic: reviewing outputs and changes   |
| `ReviewRecord`  | Type definition        | Accurate for unified workflow             |
| Git review      | Code modifications     | ✅ Clear: reviewing code changes          |
| Artifact review | Analysis outputs       | ✅ Clear: reviewing analysis results      |

---

## Implementation Plan

### Week 1: CLI Command Renaming

#### Task 1.1: Create New Review Command Group

**File:** `src/cli/commands/review.ts` (new)

- Copy existing `src/cli/commands/changeset.ts` → `review.ts`
- Rename all function signatures: `listChangesets()` → `listReviews()`
- Update CLI output text: "Changesets" → "Reviews"
- Update help text and descriptions
- Keep internal logic identical (zero behavior changes)

**Testing:**

```bash
# Verify new commands work
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

#### Task 1.2: Delete Old Changeset Command Files

**Files to Delete:**

- `src/cli/commands/changeset.ts` - Remove completely
- Any imports of changeset commands in CLI entry points

**Update CLI Router:**

- Remove `changeset` command registration
- Add `review` command registration
- Update help text and command list

**Testing:**

```bash
# Old command should not exist
$ exoctl changeset list
Error: Unknown command 'changeset'. Did you mean 'review'?

# New command works
$ exoctl review list
📋 Reviews (2):
...
```

**Success Criteria:**

- ✅ Old command files deleted
- ✅ CLI router updated
- ✅ Error message suggests correct command

---

### Week 2: Service Layer Refactoring

#### Task 2.1: Rename Service Class and Methods

**File:** `src/services/changeset_service.ts` → `src/services/review_service.ts`

- Rename class: `ChangesetService` → `ReviewService`
- Rename all methods:
  - `listChangesets()` → `listReviews()`
  - `getChangesetById()` → `getReviewById()`
  - `approveChangeset()` → `approveReview()`
  - `rejectChangeset()` → `rejectReview()`
  - `createGitChangeset()` → `createGitReview()`
  - `createArtifactChangeset()` → `createArtifactReview()`
- Update all internal variable names
- Update all log messages and error text

**Testing:**

- ✅ All unit tests in `tests/services/changeset_service_test.ts` → `review_service_test.ts`
- ✅ Update test file to use new method names
- ✅ Verify all service tests pass

**Success Criteria:**

- ✅ Service class renamed without behavior changes
- ✅ All method names updated consistently
- ✅ All tests passing with new names

#### Task 2.2: Update Type Definitions

**File:** `src/types.ts`

- Rename types:
  - `ChangesetRecord` → `ReviewRecord`
  - `ChangesetStatus` → `ReviewStatus`
  - `ChangesetType` → `ReviewType`
  - `ChangesetFilters` → `ReviewFilters`
- Remove all old type definitions completely (no aliases)

**Testing:**

- ✅ TypeScript compilation succeeds
- ✅ No type errors in codebase
- ✅ No references to old type names remain

**Success Criteria:**

- ✅ All types renamed consistently
- ✅ Backward compatibility maintained via aliases
- ✅ No compilation errors

---

### Week 3: Database Migration

#### Task 3.1: Create Migration Script

**File:** `migrations/009_rename_changesets_to_reviews.sql` (new)

```sql
-- Rename table
ALTER TABLE changesets RENAME TO reviews;

-- Update any references in other tables (if needed)
-- Note: SQLite doesn't support renaming columns in foreign keys directly
-- May need to recreate foreign key constraints
```

**Implementation Notes:**

- SQLite limitations: `ALTER TABLE RENAME COLUMN` requires SQLite 3.25.0+
- Test migration on copy of production database first
- Provide rollback script: `009_rollback_reviews_rename.sql`

**Rollback Script:**

```sql
-- Rollback: Rename back to changesets
ALTER TABLE reviews RENAME TO changesets;

-- Drop compatibility view
DROP VIEW IF EXISTS changesets;
```

**Testing:**

```bash
# Test migration on dev database
sqlite3 test.db < migrations/009_rename_changesets_to_reviews.sql

# Verify schema
sqlite3 test.db ".schema reviews"

# Test rollback
sqlite3 test.db < migrations/009_rollback_reviews_rename.sql
```

**Success Criteria:**

- ✅ Migration script executes without errors
- ✅ All data preserved (no data loss)
- ✅ Foreign key constraints maintained
- ✅ Rollback script works correctly

#### Task 3.2: Update Database Access Code

**Files:**

- `src/services/db_service.ts`
- `src/services/review_service.ts` (already renamed in Task 2.1)

**Changes:**

- Update all SQL queries: `FROM changesets` → `FROM reviews`
- Update table references in INSERT/UPDATE/DELETE statements
- Update indexes and constraints

**Example:**

```typescript
// Before
const sql = `SELECT * FROM changesets WHERE status = ?`;

// After
const sql = `SELECT * FROM reviews WHERE status = ?`;
```

**Testing:**

- ✅ All database tests pass
- ✅ CRUD operations work correctly
- ✅ No SQL errors in logs

**Success Criteria:**

- ✅ All database queries updated
- ✅ No references to old table name in code
- ✅ All database operations functional

---

### Week 4: Documentation and Testing

#### Task 4.1: Update User Guide

**File:** `docs/ExoFrame_User_Guide.md`

- Section 4.2: Rename "Changeset Commands" → "Review Commands"
- Update all command examples: `exoctl changeset` → `exoctl review`
- Update terminology in explanations
- Add migration note for existing users

**Example Update:**

```markdown
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

> **⚠️ Migration Note:** The old `exoctl changeset` commands are deprecated but still work with warnings. Update your scripts to use `exoctl review` instead.

```

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

#### Task 4.3: Update Agent Documentation

**File:** `.copilot/planning/phase-35-portal-workspace-integration.md`

- Update "Artifact Workflow" section to use "review" terminology
- Update code examples and command references
- Add forward reference to Phase 36 rename

**Success Criteria:**

- ✅ Planning docs use consistent terminology
- ✅ Cross-references updated

#### Task 4.4: Integration Testing

**Test Scenarios:**

1. **Git Review Workflow:**
   - Create request → generate plan → approve → create feature branch
   - List reviews: `exoctl review list`
   - Show git diff: `exoctl review show <id>`
   - Approve and merge: `exoctl review approve <id>`

2. **Artifact Review Workflow:**
   - Create request with read-only agent → generate artifact
   - List reviews: `exoctl review list` (shows artifact)
   - Show artifact content: `exoctl review show artifact-<id>`
   - Approve artifact: `exoctl review approve artifact-<id>`
   - Verify frontmatter updated: `status: approved`

3. **Database Migration:**
   - Run migration script
   - Verify all data preserved
   - Verify queries work with new table name

**Testing Checklist:**

- [ ] New `exoctl review` commands work correctly
- [ ] Old `exoctl changeset` commands return error with suggestion
- [ ] Git review approval merges branches correctly
- [ ] Artifact review approval updates frontmatter
- [ ] Database migration preserves all data
- [ ] No SQL errors in logs
- [ ] Documentation examples verified
- [ ] No "changeset" references remain in codebase

**Success Criteria:**

- ✅ All integration tests pass
- ✅ Zero functional regressions
- ✅ Complete terminology migration
- ✅ Old commands properly removed

---

## Migration Guide for Users

### Command Changes

| Old Command (Removed)            | New Command                     |
| -------------------------------- | ------------------------------- |
| `exoctl changeset list`          | `exoctl review list`            |
| `exoctl changeset show <id>`     | `exoctl review show <id>`       |
| `exoctl changeset approve <id>`  | `exoctl review approve <id>`    |
| `exoctl changeset reject <id>`   | `exoctl review reject <id>`     |
| `exoctl changeset list --status` | `exoctl review list --status`   |

**Note:** Old commands are completely removed. CLI will show helpful error message suggesting the new command.

### Database Migration

**For users upgrading from Phase 35:**

1. **Backup database:**
   ```bash
   cp ~/.exo/journal.db ~/.exo/journal.db.backup
   ```

1. **Stop daemon:**

   ```bash
   exoctl daemon stop
   ```

2. **Run migration:**

   ```bash
   sqlite3 ~/.exo/journal.db < migrations/009_rename_changesets_to_reviews.sql
   ```

3. **Restart daemon:**

   ```bash
   exoctl daemon start
   ```

4. **Verify migration:**

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
```

---

## Risks and Mitigations

| Risk                                      | Impact | Likelihood | Mitigation                                                |
| ----------------------------------------- | ------ | ---------- | --------------------------------------------------------- |
| **R1:** Database migration data loss      | Critical | Low      | Mandatory backup step, tested rollback script            |
| **R2:** Inconsistent terminology in docs  | Medium | Medium     | Single-pass update of all docs simultaneously            |
| **R3:** Missed references in code         | Medium | Medium     | Comprehensive grep search, TypeScript compilation checks |

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

| Phase       | Tasks                                  | Duration | Dependencies      |
| ----------- | -------------------------------------- | -------- | ----------------- |
| **Phase 1** | CLI command renaming + deprecation     | 2-3 days | None              |
| **Phase 2** | Service layer refactoring + types      | 2 days   | Phase 1           |
| **Phase 3** | Database migration + schema update     | 2 days   | Phase 2           |
| **Phase 4** | Documentation + integration testing    | 2-3 days | Phase 1, 2, 3     |
| **Phase 5** | User communication + rollout plan      | 1 day    | Phase 4           |

**Total Estimated Duration:** 2-3 weeks

---

## Rollout Plan

### Single Release (Immediate)

- ✅ New `exoctl review` commands implemented
- ✅ Old `exoctl changeset` commands removed completely
- ✅ Database migration script provided
- ✅ Documentation updated
- ✅ All "changeset" terminology removed from codebase

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

2. **API Endpoints:** If future REST API exists, what endpoint names?
   - Recommendation: `/api/reviews` (use correct terminology from start)

3. **Search and Replace:** Use automated tool or manual review?
   - Recommendation: Both - automated rename + manual review for edge cases

---

## References

- [Phase 35: Portal Workspace Integration](./.copilot/planning/phase-35-portal-workspace-integration.md)
- [Phase 30: CLI Flow Request](./.copilot/planning/phase-30-cli-flow-request.md)
- [ExoFrame User Guide](../../docs/ExoFrame_User_Guide.md)
- [ExoFrame Technical Spec](../../docs/dev/ExoFrame_Technical_Spec.md)
