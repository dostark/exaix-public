---
agent: claude
scope: dev
title: "Phase 29: Implementation of `exoctl journal` Command"
short_summary: "Comprehensive plan for implementing the `exoctl journal` command to query, filter, and inspect the activity journal."
version: "0.2"
topics: ["exoctl", "journal", "cli", "audit", "database"]
---

# Phase 29: `exoctl journal` Command

**Goal:** Implement the `exoctl journal` command to allow users to query, filter, and inspect the `journal.db` (Activity Journal) directly from the CLI. This is a critical observability feature for the "Governance-First" promise of ExoFrame.

**Status:** ✅ COMPLETE
**Timebox:** 1-2 days
**Entry Criteria:** Phase 28 complete (Config reloading working)
**Exit Criteria:** `exoctl journal` command working with all filters defined in MT-26. (✅ Complete)

## References
- **White Paper:** Section 2 "Activity Journal: Your AI Bill of Materials"
- **Test Scenarios:** Scenario MT-26 "Activity Journal Queries"

---

## Step 29.1: Journal Service Enhancements

**Action:** Update `DatabaseService` to support flexible querying.
- [x] Add `queryActivity(filter: JournalFilterOptions): Promise<ActivityRecord[]>` method.
- [x] `JournalFilterOptions`: `{ traceId?, actionType?, agentId?, limit?, since? }`.

**Success Criteria:**
- [x] `DatabaseService` can query with filters.
- [x] Unit tests for multi-filter queries pass.
- [x] Performance check: Queries under <100ms for standard limits.

---

## Step 29.2: CLI Command Structure

- **Goal:** Implement the `exoctl journal` command handler using Cliffy.
- **Location:** `src/cli/commands/journal.ts`, `src/cli/exoctl.ts`
- **Actions:**
    1.  Create `JournalCommands` class following the pattern of `PlanCommands`.
    2.  Implement the `journal` command definition with options:
        - `--filter <string[]>` (Allow multiple, e.g. `-f trace_id=... -f action_type=...`)
        - `--tail <number>` (Alias `-n`, default 50)
        - `--format <json|table>` (Default table)
        - `--follow, -f` (Future: Streaming support? For now, just static query). *Note: MT-26 mentions streaming, but let's scope strict query first, maybe adding generic watch later.* **Decision:** Static query first.
    3.  Register command in `exoctl.ts`.

**Success Criteria:**
- [x] `exoctl journal --help` shows usage.
- [x] Arguments parsed correctly (key-value pairs for filters).
- [x] Command calls `DatabaseService.queryActivity`.

---

## Step 29.3: Smart Output Formatting

- **Goal:** Present journal data in a human-readable table or machine-parsable JSON.
- **Location:** `src/cli/commands/journal.ts` (or `src/utils/formatting.ts`)
- **Actions:**
    1.  **Table View:**
        - Columns: `Timestamp`, `Action`, `Agent`, `Trace ID`, `Target`.
        - Truncate long values (like `Trace ID` or `Target`) to fit screen unless verbose.
        - Color-code `action_type` (e.g., `error` in red, `success` in green).
    2.  **JSON View:**
        - Output raw JSON array of `ActivityRecord` objects.

**Success Criteria:**
- [x] JSON output is valid and complete.
- [x] Table output is aligned and readable on standard terminal width.

---

## Step 29.4: Integration & Verification

- **Goal:** Verify the end-to-end flow against test scenarios.
- **Actions:**
    1.  Create verification script `tests/verification/verify_journal_cmd.ts` (or use manual steps).
    2.  Execute Scenario MT-26 manually.

**Verification Plan (MT-26 Mapping):**
1.  **Basic Queries:** `exoctl journal` (default tail), `exoctl journal --filter trace_id=...`
2.  **Combined Filters:** `exoctl journal --filter agent_id=mock --filter action_type=request.created`
3.  **Export:** `exoctl journal --format json > export.json`

---

## Implementation Checklist

- [x] **29.1** `DatabaseService` enhancements
  - [x] Interface definition
  - [x] Query builder
  - [x] Tests
- [x] **29.2** CLI Command
  - [x] `JournalCommands` class
  - [x] Argument parsing logic
  - [x] Registration in main CLI
- [x] **29.3** Formatting
  - [x] Table formatter
  - [x] JSON formatter
- [x] **29.4** Final Verification
  - [x] All MT-26 steps passing
- [x] **29.5** TUI Upgrade
  - [x] MonitorView filtering
  - [x] Filter dialogs
- [x] **29.6** Service Wiring
  - [x] DatabaseService injection
  - [x] LogService adapter
- [x] **29.7** TUI Verification
  - [x] Manual verification

---

## Step 29.5: TUI Upgrade (Monitor View)

**Goal:** Enable the TUI "Monitor" view to function as a full UI for `exoctl journal`.

**Action:** Refactor `src/tui/monitor_view.ts` to support database-level filtering.

- [x] Update `LogService` interface to include `queryActivity(filter: JournalFilterOptions)`.
- [x] Update `MonitorView` to use `queryActivity` instead of `getRecentActivity`.
- [x] Map TUI filter dialogs (Agent, Time) to `JournalFilterOptions`.
- [x] Add "Action Type" filter dialog.
- [x] Add "Trace ID" filter dialog.

## Step 29.6: Service Wiring (TUI)

**Action:** Connect real services to the TUI.

- [x] Update `launchTuiDashboard` in `src/tui/tui_dashboard.ts` to accept `DatabaseService`.
- [x] Create `DatabaseLogServiceAdapter` that implements `LogService` using `DatabaseService`.
- [x] Update `DashboardCommands` in `src/cli/dashboard_commands.ts` to pass the real `db` instance.

## Step 29.7: TUI Verification

- [x] Manual verification via `exoctl dashboard`.
- [x] Verify filtering by Agent, Trace ID, and Action Type works in TUI using real data.

