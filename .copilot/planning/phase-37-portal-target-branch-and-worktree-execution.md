---
agent: claude
scope: dev
title: "Phase 37: Portal Target Branches + Git Worktree Execution"
short_summary: "Add portal-scoped target-branch support and support two portal-configurable execution strategies (branch default, worktree optional) for write-capable changes in multi-branch portal workflows."
version: "0.1"
topics: ["portals", "git", "worktree", "branches", "reviews", "cli", "execution", "workflow"]
---

**Goal:** Support real-world portal workflows where users work on multiple long-lived branches concurrently (e.g., `main`, `release_1`, `release_1.2`, feature branches) by:

1. Allowing a request to specify the **target/base branch** inside a portal.
1. Supporting two portal-configurable **execution strategies** for write-capable changes:

- **branch** (default): create a feature branch in the portal repo checkout (simple workflows)
- **worktree** (optional): create a per-request worktree + feature branch (parallel workflows)

1. Making review approval merge into the **request’s target branch** (not “whatever default branch happens to exist”).

**Status:** [ ] PLANNED
**Timebox:** 2–4 weeks
**Entry Criteria:** Phase 35 (portal execution root) and Phase 36 (review command) in place
**Exit Criteria:** A request can target `portal + branch`, execution does not disturb the user’s checkout, and review approve merges into the intended portal branch reliably.

---

## Context & Problem

### Current behavior (limitations)

- Write-capable portal execution creates a `feat/...` branch and commits in the portal repository.
- This typically requires checking out branches in the _same working directory_ as the user’s portal repo checkout.
- `exoctl review approve` merges into a detected “default branch” (heuristic) and currently **requires** the repo to be checked out on that branch.

In practice, a portal repo may have multiple concurrently active bases (`release/*`, `develop`, etc.), and “default branch” may not be the intended target for a given request.

### Desired behavior

- The request can say: “apply this change to portal `X` on base branch `release_1.2`”.
- ExoFrame executes changes without disrupting the user’s working tree.
- Review approval merges into `release_1.2` (or whichever was specified), not always `main`.

---

## Review of the argument (weak points & drawbacks)

Your argument is directionally correct (multi-branch portals are real; avoiding checkout conflicts is important), but there are a few important caveats:

1. **Worktrees do not replace branches — they complement them.**
   - A worktree is an additional checkout of (usually) a branch.
   - The review/merge model still fundamentally needs a branch (or at least a named ref) to diff, review, and merge.
   - So the right framing is: _“use per-request worktrees to avoid checkout conflicts while still using feature branches for review.”_

1. **Worktrees add operational complexity.**
   - You must manage lifecycle: `worktree add`, `worktree remove`, recovery after crashes, and periodic cleanup.
   - They consume extra disk space and can confuse users if left behind.
   - Some environments (Windows, restricted filesystems) can make worktree management trickier.

1. **Approval semantics become “merge into target branch”, which can be risky if automated.**
   - If `exoctl review approve` auto-checkouts and merges into arbitrary branches, it may surprise users.
   - Safer: require explicit target branch and enforce “must be on target branch” (or provide a guarded `--checkout-target` flag).

1. **Portal “default branch” isn’t the key problem — “target branch per request” is.**
   - Even with a portal-specific default branch setting, you still need to handle requests targeting non-default bases.
   - Default branch is useful as a fallback, not as the primary mechanism.

1. **There is already some default-branch detection today.**
   - `ReviewCommands.getDefaultBranch()` uses heuristics (`origin/HEAD` then common names).
   - But heuristics are insufficient for multi-branch workflows.

Conclusion: agree in general with the need; implement **request-scoped target branch** and support **worktrees as an opt-in portal strategy** to avoid checkout conflicts.

---

## Proposed Design

### 1) New user-facing concept: target/base branch

- Add a request flag (CLI):
  - `exoctl request --portal <alias> --target-branch <branch> ...`

- Persist into request frontmatter:
  - `portal: "portal-exoframe"`
  - `target_branch: "release_1.2"` (optional)

- Propagate to plan frontmatter:
  - `portal: "portal-exoframe"`
  - `target_branch: "release_1.2"`

### 2) Portal config: optional per-portal default branch + execution strategy

Add to portal config entries:

- `default_branch = "main"` (optional; used when request doesn’t specify `target_branch`)
- `execution_strategy = "branch" | "worktree"` (optional; defaults to `"branch"`)

CLI support (to be added)

- Extend `exoctl portal add <target-path> <alias>` with options:
  - `--default-branch <branch>`
  - `--execution-strategy <branch|worktree>`

This matches the intent of “exoctl add portal … with worktree option” while keeping the actual command name consistent with the current CLI (`exoctl portal add`).

Notes:

- Still keep auto-detection as fallback when neither request nor portal config provides it.
- `execution_strategy` is portal-specific because different repos/teams have different tolerance for extra checkouts and background automation.

### 3) Execution model for write-capable portal tasks

For write-capable plans with `portal: <alias>`:

- Resolve portal repo root: `portal.target_path`.
- Determine base branch:
  1. plan/request `target_branch`
  1. portal config `default_branch`
  1. auto-detect (`origin/HEAD` or fallback)

- Determine execution strategy:
  1. portal config `execution_strategy` (default: `branch`)

#### Strategy A (default): `execution_strategy = "branch"`

- Create feature branch in the portal repo checkout:
  - `git -C <portalRepoRoot> checkout -b feat/<requestId>-<shortTrace> <baseBranch>`
- Execute actions with `repoPath = <portalRepoRoot>`.
- Commit in the portal repo checkout.

This keeps the current simple workflow and is appropriate for single-user or low-concurrency portal usage.

#### Strategy B (opt-in): `execution_strategy = "worktree"`

- Create a unique worktree for the trace/request:
  - Canonical location (runtime, safe to prune):
    - `.exo/worktrees/<portalAlias>/<traceId>/`
  - Execution pointer (discoverability; keeps “execution owns execution” mental model):
    - `Memory/Execution/<traceId>/worktree/` (symlink to canonical path, or a small text file containing the canonical path if symlinks are unavailable)
  - Add worktree from the portal repo root:
    - `git -C <portalRepoRoot> worktree add <worktreePath> <baseBranch>`

- Create feature branch _in that worktree_:
  - `git -C <worktreePath> checkout -b feat/<requestId>-<shortTrace> <baseBranch>`

- Execute actions with `repoPath = <worktreePath>`.
- Commit in the worktree.

- Register review metadata including:
  - `portal` alias
  - `branch` name
  - `repository` should remain the **portal repo root** (for discovery)
  - `worktree_path` (new, optional) pointing to the execution checkout (only for `worktree` strategy)
  - `base_branch` (new) so approve merges into the right branch

### 4) Review approval: merge into base branch, not “default branch”

Change `exoctl review approve <id>` behavior for code reviews:

- Determine `repoPath` via existing portal discovery (`Portals/<alias>` symlinks + workspace).
- Determine `targetBranch`:
  - prefer `review.base_branch` (new field)
  - fallback to repo default branch detection

- Enforce safety:
  - require current branch is `targetBranch`, or provide an explicit option (e.g. `--checkout-target`) to do it automatically.

- Merge:
  - `git merge --no-ff <featureBranch>` while on `targetBranch`

### 5) Worktree lifecycle & cleanup

- On successful merge (approve): optionally delete worktree and/or the feature branch.
- On rejection:
  - delete feature branch
  - remove worktree if it exists

- Add a maintenance CLI:
  - `exoctl git worktrees list`
  - `exoctl git worktrees prune` (remove dead worktrees)

---

## Step-by-step Implementation Plan

This phase is intentionally incremental: add `target_branch` first, then make merging target-aware, then add optional worktree execution.

### Step 37.1: Add `--target-branch` to `exoctl request`

- **Dependencies:** Existing request command + request frontmatter writer
- **Action:** Add CLI option `exoctl request --target-branch <branch>` and persist it to request frontmatter as `target_branch: "..."`.

Success criteria

- [x] Creating a request with `--target-branch release_1.2` produces a request markdown file containing `target_branch: "release_1.2"`.
- [x] Request listing/show surfaces `target_branch` (if those commands print request metadata).
- [x] Request without `--target-branch` behaves exactly as before.

Projected tests

- [x] Integration: extend existing CLI integration tests to assert frontmatter contains `target_branch` when provided.
- [x] Regression: `[regression] request stores target_branch frontmatter`.

### Step 37.2: Extend `exoctl portal add` with execution strategy + default branch

- **Dependencies:** Config schema + config service portal add
- **Action:** Extend `exoctl portal add <target-path> <alias>` with:
  - `--default-branch <branch>` → writes portal config `default_branch`
  - `--execution-strategy <branch|worktree>` → writes portal config `execution_strategy`

Success criteria

- [x] `exoctl portal add ... --execution-strategy worktree` persists `execution_strategy = "worktree"` for that portal.
- [x] `exoctl portal show <alias>` displays configured `default_branch` and `execution_strategy`.
- [x] Omitting both options keeps behavior unchanged (strategy defaults to `branch`).

Projected tests

- [x] Integration: CLI portal add/show roundtrip, verify config persisted.
- [x] Negative: invalid strategy value fails with clear error.

### Step 37.3: Plumb `target_branch` request → plan

- **Dependencies:** RequestProcessor/plan writer
- **Action:** When generating a plan from a request, copy `target_branch` into plan frontmatter.

Success criteria

- [x] A request containing `target_branch` leads to a plan containing the same `target_branch`.
- [x] Plans without `target_branch` remain valid.

Projected tests

- [x] Integration: request → plan generation includes `target_branch`.

### Step 37.4: Record `base_branch` and merge into it on approve

- **Dependencies:** Review registry/schema, review approve implementation
- **Action:**
  - Add `base_branch` (string, nullable) to review records.
  - When creating a code review, store the resolved base branch as `base_branch`.
  - Update `exoctl review approve` to prefer merging into `review.base_branch` when present.

Success criteria

- [x] If a review has `base_branch = "release_1.2"`, `review approve` merges the feature branch into `release_1.2` (not heuristically chosen `main`).
- [x] If `base_branch` is absent (older reviews), behavior remains unchanged.

Projected tests

- [x] Integration: create review with `base_branch=release_1.2` and assert merge lands on `release_1.2`.
- [x] Negative: approving while checked out on the wrong target branch fails with a clear error message.

### Step 37.5: Baseline execution strategy (`branch`) becomes target-aware

- **Dependencies:** ExecutionLoop portal execution
- **Action:** For portal write-capable execution in `execution_strategy = "branch"`:
  - Resolve base branch using `target_branch` (plan/request) → `default_branch` (portal) → auto-detect.
  - Create feature branch from that base.

Success criteria

- [x] When `target_branch` is specified, created feature branches are based on that branch.
- [x] When `target_branch` is not specified, portal `default_branch` is used if configured.

Projected tests

- [x] Integration: seed portal with `release_1.2`, run a write-capable plan with `target_branch: release_1.2`, verify branch ancestry (e.g., merge-base equals `release_1.2`).

### Step 37.6: Implement optional worktree execution strategy (`worktree`)

- **Dependencies:** Step 37.5 (base branch resolution)
- **Action:** If portal `execution_strategy = "worktree"`:
- **Action:** If portal `execution_strategy = "worktree"`:
  - Create a per-trace worktree under `.exo/worktrees/<portalAlias>/<traceId>/` (canonical runtime location).
  - Create an execution pointer under `Memory/Execution/<traceId>/worktree/` for discoverability (symlink or path file).
  - Execute the plan in the canonical worktree path.
  - Record `worktree_path` on the review for observability + cleanup.

Success criteria

- Executing a write-capable portal plan does not change the user’s main portal checkout branch.
- Multiple concurrent traces against the same portal do not block each other on git checkout.
- Worktree path is discoverable and can be cleaned up.

Projected tests

- E2E: execute two write plans targeting the same portal concurrently (or sequentially without cleanup) and verify both worktrees exist and are isolated.
- Negative: if worktree creation fails, execution fails with an actionable error.

### Step 37.7: Worktree lifecycle cleanup (approve/reject)

- **Dependencies:** Step 37.6
- **Action:**
  - On approve: optionally remove worktree and/or delete feature branch (policy decision).
  - On reject: remove worktree (if created) and delete the branch.

Success criteria

- Rejecting a worktree-based review removes the worktree directory and deletes the branch.
- Approving a worktree-based review does not leave the repository in a conflicted state.

Projected tests

- Integration: reject removes worktree.
- Negative: merge conflict leaves no orphaned worktrees after `merge --abort` cleanup.

### Step 37.8: Update portal E2E suite for `target_branch` + strategy matrix

- **Dependencies:** Steps 37.1–37.7
- **Action:** Extend portal E2E tests to cover:
  - `execution_strategy=branch` + `target_branch` merge
  - `execution_strategy=worktree` + `target_branch` merge
  - negative cases (wrong checkout, missing portal discovery, merge conflict)

Success criteria

- Portal E2E tests cover both strategies and confirm merges land on the specified target branch.

Projected tests

- Extend existing portal E2E integration test file(s) with strategy-based scenarios.

---

## Data Model Changes

### Reviews table / schema additions

- `base_branch` (string, nullable)
- `worktree_path` (string, nullable)

Rationale:

- `base_branch` is required to merge into the correct target branch.
- `worktree_path` improves debugging and supports worktree cleanup.

---

## Compatibility & Migration

- Existing branch-based reviews (without `base_branch`) should continue to work.
- For existing portals:
  - If `default_branch` isn’t set, behavior remains heuristic.
- Worktree migration can be phased:
  1. Add `--target-branch` and plumb through request → plan → execution metadata.
  1. Add portal `execution_strategy` setting and implement the `worktree` path.
  1. Change approve to merge into `base_branch` (if present).

---

## Risks & Open Questions

- Worktree directory location: canonical under `.exo/worktrees/` (prunable runtime) with a per-trace pointer under `Memory/Execution/` (discoverability).
- Concurrency: multiple traces might target same portal+base; worktrees isolate checkouts.
- Security: ensure no path traversal in worktree paths (strict join + validation).
- UX: decide whether approve auto-checkouts target branch or requires user to do it.
- Portal discovery: current CLI finds repos via `Portals/*` symlinks; ensure reviews store portal alias so discovery is stable.

---

## Testing Plan

Add integration tests mirroring the new workflow:

- `[e2e]` Request with `--target-branch release_1.2` executes changes and review approve merges into `release_1.2`.
- `[e2e][negative]` Approve fails when on wrong target branch.
- `[e2e]` Worktree exists during execution; cleaned up on approve/reject.

---

## Implementation Checklist

### CLI / UX

- [x] Add `exoctl request --target-branch <branch>`
- [x] Persist `target_branch` into request frontmatter
- [x] Propagate `target_branch` to generated plan frontmatter

### Config

- [x] Add portal config field `default_branch` to schema and sample config
- [x] Add portal config field `execution_strategy` to schema and sample config
- [ ] Validate it (non-empty, safe branch name)

### Execution

- [x] Resolve base branch via request/plan/config fallback chain
- [x] Implement `execution_strategy = branch` (baseline)
- [ ] Implement `execution_strategy = worktree` (opt-in)
- [ ] If `worktree`: implement `git worktree add` and run execution in worktree path
- [x] Ensure review registration stores `repository` = portal repo root and records `base_branch`
- [ ] If `worktree`: record `worktree_path` on review

### Review

- [ ] `review show` unchanged (diff still computed from repo + branch)
- [x] `review approve` merges into `base_branch` if present
- [ ] `review reject` removes worktree and deletes branch (with robust handling)

### Maintenance

- [ ] Add `exoctl git worktrees prune` (optional but recommended)

### Tests

- [ ] New integration tests for branch targeting + worktree lifecycle
- [x] Update portal E2E tests to cover `target_branch`

---

## Notes (current code hotspots)

- Review approval currently relies on default branch heuristics and requires being checked out on that branch.
- Branch deletion helper has hard-coded `master` fallback; this should be revisited in the worktree migration.
