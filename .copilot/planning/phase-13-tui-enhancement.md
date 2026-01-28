# Phase 13: TUI Enhancement & Unification

**Document Version:** 1.1.0
**Date:** 2026-01-04
**Author:** Architecture Agent
**Status:** COMPLETED ✅
**Completed:** 2026-01-04
**Target Release:** v1.2

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Gap Analysis: Current TUI State](#2-gap-analysis)
3. [Design Principles from Memory View](#3-design-principles-from-memory-view)
4. [Split View Enhancements](#4-split-view-enhancements)
5. [Enhancement Roadmap](#5-enhancement-roadmap)
6. [Implementation Phases](#6-implementation-phases)
7. [User Documentation Updates](#7-user-documentation-updates)
8. [Success Metrics](#8-success-metrics)
9. [Rollback Plan](#9-rollback-plan)

---

## 1. Executive Summary

This document outlines the enhancement of ExoFrame's TUI components to achieve feature parity with the recently implemented Memory View (Phase 12.12-12.14). The Memory View established new standards for:

- **Async loading states** with spinner animations
- **Rich markdown rendering** in detail panels
- **Color-coded visual indicators** for status and categories
- **Hierarchical tree navigation** with expand/collapse
- **Dialog-based confirmations** for destructive actions
- **Comprehensive keyboard shortcuts** with discoverable help
- **Refresh mechanisms** (manual and auto-stale detection)

These patterns should be propagated to all TUI views for a consistent, polished user experience.

### Key Deliverables

| Deliverable                | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| **Unified TuiSessionBase** | Enhanced base class with loading states, colors, refresh |
| **Shared Utils**           | Reusable rendering utilities in `src/tui/utils/`         |
| **Enhanced Views**         | All 7 views upgraded with consistent patterns            |
| **Split View System**      | Enhanced multi-pane layouts with presets and persistence |
| **Dialog System**          | Reusable dialog components for all views                 |
| **User Guide Update**      | Complete TUI documentation refresh                       |
| **Keyboard Reference**     | Unified keyboard shortcut reference                      |

### Dependencies

- Phase 12.12-12.14: TUI Memory View (COMPLETED ✅)
- `src/tui/utils/markdown_renderer.ts`: Reusable renderer (AVAILABLE ✅)
- `src/tui/dialogs/memory_dialogs.ts`: Dialog patterns (AVAILABLE ✅)

---

## 2. Gap Analysis

### 2.1 Current TUI View Comparison

| Feature                | Memory View    | Portal Manager | Plan Reviewer  | Monitor   | Request Manager | Agent Status | Daemon Control |
| ---------------------- | -------------- | -------------- | -------------- | --------- | --------------- | ------------ | -------------- |
| **Loading States**     | ✅ Spinner     | ❌ None        | ❌ None        | ❌ None   | ❌ None         | ❌ None      | ❌ None        |
| **Tree Navigation**    | ✅ Full        | ❌ List only   | ❌ List only   | ❌ None   | ❌ List only    | ❌ List only | ❌ Buttons     |
| **Detail Panel**       | ✅ Markdown    | ⚠️ Basic       | ⚠️ Diff view   | ❌ None   | ❌ None         | ⚠️ Basic     | ❌ None        |
| **Color Coding**       | ✅ Rich        | ⚠️ Status only | ⚠️ Status only | ✅ Logs   | ❌ None         | ✅ Status    | ⚠️ Status      |
| **Keyboard Shortcuts** | ✅ g/p/e/s/n/? | ⚠️ Enter/r/d   | ⚠️ a/r         | ❌ None   | ⚠️ c/v/d        | ❌ None      | ❌ None        |
| **Help Screen**        | ✅ ? key       | ❌ None        | ❌ None        | ❌ None   | ❌ None         | ❌ None      | ❌ None        |
| **Dialogs**            | ✅ Confirm     | ❌ None        | ❌ None        | ❌ None   | ❌ None         | ❌ None      | ❌ None        |
| **Search**             | ✅ Full        | ❌ None        | ❌ None        | ⚠️ Filter | ❌ None         | ❌ None      | ❌ None        |
| **Refresh**            | ✅ R + auto    | ⚠️ Manual      | ⚠️ Manual      | ✅ Auto   | ⚠️ Manual       | ⚠️ Manual    | ⚠️ Manual      |
| **Progress Bar**       | ✅ Available   | ❌ None        | ❌ None        | ❌ None   | ❌ None         | ❌ None      | ❌ None        |

### 2.2 Code Quality Comparison

| Metric            | Memory View    | Other Views     |
| ----------------- | -------------- | --------------- |
| Lines of Code     | ~1200          | 100-275         |
| Test Coverage     | 50+ tests      | 5-15 tests      |
| Service Interface | Well-defined   | Inconsistent    |
| Error Handling    | Try/finally    | Basic try/catch |
| State Management  | Centralized    | Scattered       |
| Documentation     | JSDoc complete | Partial         |

### 2.3 Feature Gap Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                      TUI Enhancement Gap Analysis                     │
├──────────────────────────────────────────────────────────────────────┤
│  MEMORY VIEW (Target)     │  OTHER VIEWS (Current)                   │
├──────────────────────────────────────────────────────────────────────┤
│  ✅ MemoryViewState       │  ❌ No unified state interface           │
│  ✅ Loading spinner       │  ❌ No loading indicators                │
│  ✅ Tree navigation       │  ❌ Flat list navigation                 │
│  ✅ Markdown detail       │  ❌ Plain text or none                   │
│  ✅ Dialog confirmations  │  ❌ Direct actions (dangerous)           │
│  ✅ Help screen (?)       │  ❌ No discoverability                   │
│  ✅ Color themes          │  ⚠️ Inconsistent colors                  │
│  ✅ Refresh (R + stale)   │  ⚠️ Manual refresh only                  │
│  ✅ 50+ unit tests        │  ⚠️ 5-15 tests per view                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Design Principles from Memory View

### 3.1 State Management Pattern

The Memory View established a centralized state pattern that should be adopted:

```typescript
interface ViewState {
  // Data state
  items: T[];
  selectedId: string | null;

  // UI state
  isLoading: boolean;
  loadingMessage: string;
  spinnerFrame: number;
  useColors: boolean;

  // Navigation state
  searchActive: boolean;
  searchQuery: string;
  activeDialog: DialogBase | null;

  // Refresh state
  lastRefresh: number;
}
```

### 3.2 Rendering Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Raw Data     │ -> │ State Update │ -> │ Render       │
│ (Service)    │    │ (handleKey)  │    │ (renderX)    │
└──────────────┘    └──────────────┘    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │   Dialogs   │
                    │   (modal)   │
                    └─────────────┘
```

### 3.3 Keyboard Hierarchy

| Level      | Keys                               | Purpose                |
| ---------- | ---------------------------------- | ---------------------- |
| Global     | `Tab`, `Shift+Tab`                 | Pane switching         |
| View       | `g`, `p`, `e`, `n`, `s`, `?`, `R`  | Scope/action shortcuts |
| Navigation | `↑`, `↓`, `Home`, `End`            | List/tree navigation   |
| Item       | `Enter`, `←`, `→`                  | Expand/collapse/select |
| Action     | `a`, `r`, `d`                      | Item-specific actions  |
| Dialog     | `y`, `n`, `Tab`, `Enter`, `Escape` | Dialog interactions    |

### 3.4 Visual Hierarchy

| Element            | Style                    | Example                    |
| ------------------ | ------------------------ | -------------------------- |
| **Headers**        | Bold + Cyan/Blue/Magenta | `\x1b[1;36m`               |
| **Status OK**      | Green                    | `\x1b[32m●`                |
| **Status Warning** | Yellow                   | `\x1b[33m●`                |
| **Status Error**   | Red                      | `\x1b[31m●`                |
| **Selected**       | Inverse/Bold             | `\x1b[7m`                  |
| **Badges**         | `[category]` with color  | `\x1b[36m[pattern]\x1b[0m` |
| **Dim/Secondary**  | Dim                      | `\x1b[2m`                  |

---

## 4. Split View Enhancements

### 4.1 Current Split View Implementation

The current split view in `tui_dashboard.ts` provides:

- Basic vertical (`v`) and horizontal (`h`) splitting
- Tab/Shift+Tab pane switching
- Close pane (`c`)
- Basic resize with `resizePane()`
- Layout save/restore to `~/.exoframe/tui_layout.json`

### 4.2 Enhanced Split View Features

#### 4.2.1 Layout Presets

```
┌─────────────────────────────────────────────────────────────┐
│                      LAYOUT PRESETS                         │
├─────────────────────────────────────────────────────────────┤
│  [1] Single     │  [2] Side-by-Side  │  [3] Top-Bottom     │
│  ┌───────────┐  │  ┌─────┬─────┐     │  ┌───────────┐      │
│  │           │  │  │     │     │     │  │           │      │
│  │   View    │  │  │  A  │  B  │     │  │     A     │      │
│  │           │  │  │     │     │     │  ├───────────┤      │
│  └───────────┘  │  └─────┴─────┘     │  │     B     │      │
│                 │                    │  └───────────┘      │
├─────────────────────────────────────────────────────────────┤
│  [4] Main+Side  │  [5] Quad          │  [6] Main+2         │
│  ┌───────┬───┐  │  ┌─────┬─────┐     │  ┌───────┬───┐      │
│  │       │   │  │  │  A  │  B  │     │  │       │ B │      │
│  │   A   │ B │  │  ├─────┼─────┤     │  │   A   ├───┤      │
│  │       │   │  │  │  C  │  D  │     │  │       │ C │      │
│  └───────┴───┘  │  └─────┴─────┘     │  └───────┴───┘      │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 View Picker Dialog

When creating a new pane, show a picker:

```
┌─────────────────────────────────────────┐
│        Select View for New Pane         │
├─────────────────────────────────────────┤
│  [1] Memory View                        │
│  [2] Portal Manager                     │
│  [3] Plan Reviewer                      │
│  [4] Monitor                            │
│  [5] Request Manager                    │
│  [6] Agent Status                       │
│  [7] Daemon Control                     │
├─────────────────────────────────────────┤
│  [Enter] Select   [Esc] Cancel          │
└─────────────────────────────────────────┘
```

#### 4.2.3 Pane Management Features

| Feature          | Keyboard | Description                    |
| ---------------- | -------- | ------------------------------ |
| Split vertical   | `v`      | Split active pane left/right   |
| Split horizontal | `h`      | Split active pane top/bottom   |
| Close pane       | `c`      | Close active pane              |
| Maximize pane    | `z`      | Toggle zoom (maximize/restore) |
| Swap panes       | `x`      | Swap active with next pane     |
| Resize left      | `Ctrl+←` | Shrink width                   |
| Resize right     | `Ctrl+→` | Grow width                     |
| Resize up        | `Ctrl+↑` | Shrink height                  |
| Resize down      | `Ctrl+↓` | Grow height                    |
| Layout picker    | `L`      | Open layout preset picker      |
| Save layout      | `Ctrl+S` | Save current layout            |
| Named layouts    | `Ctrl+L` | Manage named layouts           |

#### 4.2.4 Pane State Interface

```typescript
interface EnhancedPane extends Pane {
  id: string;
  view: TuiView;
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;

  // NEW: Enhanced features
  minimumWidth: number; // Prevent over-shrinking
  minimumHeight: number;
  isMaximized: boolean; // Zoom state
  savedBounds?: { // For restore after maximize
    x: number;
    y: number;
    width: number;
    height: number;
  };
  syncGroup?: string; // For linked scrolling
}

interface LayoutPreset {
  id: string;
  name: string;
  paneConfig: {
    x: number; // Percentage 0-100
    y: number;
    width: number;
    height: number;
    defaultView?: string;
  }[];
}

interface SavedLayout {
  name: string;
  createdAt: string;
  panes: {
    viewName: string;
    bounds: { x: number; y: number; width: number; height: number };
  }[];
}
```

#### 4.2.5 Visual Indicators

```
┌─ Memory View ──────────────────────┬─ Monitor ─────────────────┐
│ ► Global Memory                    │ 2026-01-04 10:23:45       │
│   Projects                         │ [agent] Plan approved     │
│   Executions                       │ [daemon] Task started     │
│                                    │ [agent] Execution done    │
├────────────────────────────────────┼───────────────────────────┤
│ [Tab] Switch │ [v/h] Split │ [z] Zoom │ [?] Help │ Pane 1/2   │
└────────────────────────────────────┴───────────────────────────┘

^ Title bar shows view name          ^ Status bar shows pane info
^ Active pane has highlighted border
```

---

## 5. Enhancement Roadmap

### 5.1 Shared Infrastructure (Phase 13.1)

Create reusable utilities in `src/tui/utils/`:

```
src/tui/utils/
├── markdown_renderer.ts    # ✅ Exists (Phase 12.14)
├── spinner.ts              # NEW: Spinner utilities
├── colors.ts               # NEW: Color theme system
├── dialog_base.ts          # Extract from memory_dialogs.ts
├── tree_view.ts            # NEW: Tree rendering component
├── status_bar.ts           # NEW: Consistent status bar
├── help_renderer.ts        # NEW: Help screen generator
└── keyboard.ts             # NEW: Keyboard handler utilities
```

### 5.2 Enhanced TuiSessionBase (Phase 13.2)

Upgrade `src/tui/tui_common.ts`:

```typescript
export abstract class TuiSessionBase {
  // Existing
  protected selectedIndex = 0;
  protected statusMessage = "";

  // NEW: Loading state
  protected isLoading = false;
  protected loadingMessage = "";
  protected spinnerFrame = 0;

  // NEW: Colors
  protected useColors = true;

  // NEW: Refresh
  protected lastRefresh = Date.now();
  protected staleThresholdMs = 30000;

  // NEW: Dialog support
  protected activeDialog: DialogBase | null = null;

  // NEW: Abstract methods
  abstract initialize(): Promise<void>;
  abstract refresh(): Promise<void>;
  abstract renderHelp(): string;
}
```

### 5.3 View-Specific Enhancements

#### Portal Manager View (Phase 13.3)

- Add tree view for portal hierarchy (by status, by path)
- Add detail panel with portal info, activity log
- Add loading spinner during operations
- Add confirm dialog for remove action
- Add search/filter by alias
- Add help screen

#### Plan Reviewer View (Phase 13.4)

- Add tree view grouping plans by status/author
- Enhance diff rendering with syntax highlighting
- Add confirm dialogs for approve/reject
- Add inline comments/notes
- Add bulk approve/reject
- Add help screen

#### Monitor View (Phase 13.5)

- Add tree view for log grouping (by agent, by action type)
- Add detail panel for log entry expansion
- Add search with highlighting
- Add export functionality
- Add bookmarking important entries
- Add help screen

#### Request Manager View (Phase 13.6)

- Add tree view grouping by status/priority/agent
- Add detail panel with request content
- Add progress tracking for in-flight requests
- Add confirm dialog for cancel action
- Add search/filter
- Add help screen

#### Agent Status View (Phase 13.7)

- Add tree view for agent hierarchy
- Add detail panel with health metrics
- Add live updating status
- Add log viewer integration
- Add help screen

#### Daemon Control View (Phase 13.8)

- Add status visualization
- Add log tail view
- Add confirm dialogs for stop/restart
- Add configuration viewer
- Add help screen

---

## 6. Implementation Phases

### Phase 13.1: Shared Infrastructure (1 day) ✅

**Goal:** Extract and create reusable TUI utilities.

**Commit:** 62abbbf

**Tasks:**

- [x] Extract `DialogBase` to `src/tui/utils/dialog_base.ts`
- [x] Create `src/tui/utils/colors.ts` with theme system
- [x] Create `src/tui/utils/spinner.ts` with animation utilities
- [x] Create `src/tui/utils/tree_view.ts` for tree rendering
- [x] Create `src/tui/utils/status_bar.ts` for consistent status
- [x] Create `src/tui/utils/help_renderer.ts` for help screens
- [x] Create `src/tui/utils/keyboard.ts` for key handlers
- [x] Add unit tests for all utilities (~50 tests)

**Deliverables:**

- `src/tui/utils/dialog_base.ts` (~100 LOC)
- `src/tui/utils/colors.ts` (~80 LOC)
- `src/tui/utils/spinner.ts` (~50 LOC)
- `src/tui/utils/tree_view.ts` (~150 LOC)
- `src/tui/utils/status_bar.ts` (~60 LOC)
- `src/tui/utils/help_renderer.ts` (~80 LOC)
- `src/tui/utils/keyboard.ts` (~100 LOC)
- `tests/tui/utils/` (~50 tests)

---

### Phase 13.2: Enhanced TuiSessionBase (0.5 day) ✅

**Goal:** Upgrade base class with modern patterns.

**Commit:** 02091ca

**Tasks:**

- [x] Add loading state fields to `TuiSessionBase`
- [x] Add color support to `TuiSessionBase`
- [x] Add refresh mechanism to `TuiSessionBase`
- [x] Add dialog support to `TuiSessionBase`
- [x] Add abstract methods for consistency
- [x] Update existing views to use new base
- [x] Add tests for base class (~20 tests)

**Deliverables:**

- Updated `src/tui/tui_common.ts` (~200 LOC)
- `tests/tui/tui_common_test.ts` (~20 tests)

---

### Phase 13.3: Portal Manager Enhancement (1 day) ✅

**Goal:** Bring Portal Manager to Memory View standards.

**Commit:** e28c7ec

**Tasks:**

- [x] Add `PortalViewState` interface
- [x] Implement tree view (by status: active/broken/inactive)
- [x] Add detail panel with portal info
- [x] Add loading spinner for operations
- [x] Add confirm dialog for remove action
- [x] Add search/filter by alias
- [x] Add help screen (? key)
- [x] Add refresh mechanism (R key)
- [x] Add color theming
- [x] Update tests (~30 tests)

**Deliverables:**

- Updated `src/tui/portal_manager_view.ts` (~500 LOC)
- `src/tui/dialogs/portal_dialogs.ts` (~150 LOC)
- Updated `tests/tui/portal_manager_view_test.ts` (~30 tests)

**Keyboard Shortcuts:**

| Key     | Action                       |
| ------- | ---------------------------- |
| `↑/↓`   | Navigate                     |
| `Enter` | Open portal / expand         |
| `r`     | Refresh portal               |
| `d`     | Delete portal (with confirm) |
| `s`     | Search/filter                |
| `R`     | Refresh view                 |
| `?`     | Help                         |

---

### Phase 13.4: Plan Reviewer Enhancement (1 day) ✅

**Goal:** Enhance Plan Reviewer with modern patterns.

**Commit:** bfa8e8c

**Tasks:**

- [x] Add `PlanViewState` interface
- [x] Implement tree view (by status: pending/approved/rejected)
- [x] Enhance diff rendering with markdown
- [x] Add confirm dialogs for approve/reject
- [x] Add inline comments
- [x] Add bulk operations (Shift+A = approve all)
- [x] Add search plans
- [x] Add help screen
- [x] Add refresh mechanism
- [x] Update tests (~30 tests)

**Deliverables:**

- Updated `src/tui/plan_reviewer_view.ts` (~500 LOC)
- `src/tui/dialogs/plan_dialogs.ts` (~150 LOC)
- Updated `tests/tui/plan_reviewer_view_test.ts` (~30 tests)

**Keyboard Shortcuts:**

| Key     | Action                      |
| ------- | --------------------------- |
| `↑/↓`   | Navigate plans              |
| `Enter` | View diff                   |
| `a`     | Approve (with confirm)      |
| `r`     | Reject (with reason dialog) |
| `A`     | Approve all pending         |
| `c`     | Add comment                 |
| `s`     | Search plans                |
| `R`     | Refresh                     |
| `?`     | Help                        |

---

### Phase 13.5: Monitor View Enhancement (1 day) ✅

**Goal:** Enhance Monitor View with tree navigation.

**Commit:** 9def473

**Tasks:**

- [x] Add `MonitorViewState` interface
- [x] Implement tree view (by agent, by action type)
- [x] Add detail panel for log expansion
- [x] Add search with highlighting
- [x] Add bookmarking (mark important entries)
- [x] Add export to file
- [x] Add time range filtering
- [x] Add help screen
- [x] Add auto-refresh toggle
- [x] Update tests (~25 tests)

**Deliverables:**

- Updated `src/tui/monitor_view.ts` (~500 LOC)
- Updated `tests/tui/monitor_view_test.ts` (~25 tests)

**Keyboard Shortcuts:**

| Key     | Action           |
| ------- | ---------------- |
| `↑/↓`   | Navigate logs    |
| `Enter` | Expand log entry |
| `Space` | Toggle pause     |
| `b`     | Bookmark entry   |
| `e`     | Export logs      |
| `s`     | Search logs      |
| `f`     | Filter by agent  |
| `t`     | Filter by time   |
| `R`     | Force refresh    |
| `?`     | Help             |

---

### Phase 13.6: Request Manager Enhancement (1 day) ✅

**Goal:** Enhance Request Manager with tree and details.

**Commit:** a721eb8

**Tasks:**

- [x] Add `RequestViewState` interface
- [x] Implement tree view (by status/priority/agent)
- [x] Add detail panel with request content
- [x] Add progress tracking for in-flight
- [x] Add confirm dialog for cancel
- [x] Add search/filter
- [x] Add priority badges
- [x] Add help screen
- [x] Update tests (~25 tests)

**Deliverables:**

- Updated `src/tui/request_manager_view.ts` (~500 LOC)
- `src/tui/dialogs/request_dialogs.ts` (~100 LOC)
- Updated `tests/tui/request_manager_view_test.ts` (~25 tests)

**Keyboard Shortcuts:**

| Key     | Action                        |
| ------- | ----------------------------- |
| `↑/↓`   | Navigate requests             |
| `Enter` | View details                  |
| `c`     | Create new request            |
| `d`     | Cancel request (with confirm) |
| `p`     | Change priority               |
| `s`     | Search requests               |
| `R`     | Refresh                       |
| `?`     | Help                          |

---

### Phase 13.7: Agent Status Enhancement (0.5 day) ✅

**Goal:** Enhance Agent Status with live monitoring.

**Commit:** 75f2f02

**Tasks:**

- [x] Add `AgentViewState` interface
- [x] Implement tree view for agent hierarchy
- [x] Add detail panel with health metrics
- [x] Add live updating (auto-refresh)
- [x] Add log viewer integration
- [x] Add health indicators
- [x] Add help screen
- [x] Update tests (~20 tests)

**Deliverables:**

- Updated `src/tui/agent_status_view.ts` (~400 LOC)
- Updated `tests/tui/agent_status_view_test.ts` (~20 tests)

**Keyboard Shortcuts:**

| Key     | Action          |
| ------- | --------------- |
| `↑/↓`   | Navigate agents |
| `Enter` | View details    |
| `l`     | View logs       |
| `R`     | Refresh         |
| `?`     | Help            |

---

### Phase 13.8: Daemon Control Enhancement (0.5 day) ✅

**Goal:** Enhance Daemon Control with status visualization.

**Commit:** f4c21dd

**Tasks:**

- [x] Add `DaemonViewState` interface
- [x] Add status visualization
- [x] Add log tail view
- [x] Add confirm dialogs for stop/restart
- [x] Add configuration viewer
- [x] Add help screen
- [x] Update tests (~15 tests)

**Deliverables:**

- Updated `src/tui/daemon_control_view.ts` (~300 LOC)
- `src/tui/dialogs/daemon_dialogs.ts` (~80 LOC)
- Updated `tests/tui/daemon_control_view_test.ts` (~15 tests)

**Keyboard Shortcuts:**

| Key | Action                        |
| --- | ----------------------------- |
| `s` | Start daemon                  |
| `k` | Stop daemon (with confirm)    |
| `r` | Restart daemon (with confirm) |
| `l` | View logs                     |
| `c` | View config                   |
| `R` | Refresh status                |
| `?` | Help                          |

---

### Phase 13.9: Dashboard Integration (0.5 day) ✅

**Goal:** Integrate all enhanced views into dashboard.

**Commit:** 86f134b

**Tasks:**

- [x] Update `tui_dashboard.ts` with new view interfaces
- [x] Add global help overlay
- [x] Add view switching indicators
- [x] Add notification system
- [x] Add layout persistence
- [x] Update integration tests (~20 tests)

**Deliverables:**

- Updated `src/tui/tui_dashboard.ts` (~800 LOC)
- Updated `tests/tui/tui_dashboard_test.ts` (~20 tests)

---

### Phase 13.10: User Documentation (0.5 day) ✅

**Goal:** Complete TUI documentation refresh.

**Commit:** 2aece8c

**Tasks:**

- [x] Update `docs/ExoFrame_User_Guide.md` TUI section
- [x] Create `docs/TUI_Keyboard_Reference.md`
- [x] Update `docs/ExoFrame_Architecture.md` TUI section
- [x] Add inline help content to all views
- [x] Create TUI screenshots for docs
- [x] Update README with TUI highlights

**Deliverables:**

- Updated `docs/ExoFrame_User_Guide.md`
- New `docs/TUI_Keyboard_Reference.md`
- Updated `docs/ExoFrame_Architecture.md`

---

### Phase 13.11: Split View Enhancement (1 day) ✅

**Goal:** Enhance split view functionality with presets, view picker, and advanced pane management.

**Commit:** ad8757d

**Tasks:**

- [x] Create `src/tui/utils/layout_manager.ts` for layout logic
- [x] Implement layout presets (single, side-by-side, top-bottom, quad, etc.)
- [x] Create `ViewPickerDialog` for selecting view when splitting
- [x] Add maximize/restore (zoom) functionality
- [x] Add pane swap feature
- [x] Implement Ctrl+Arrow resizing with visual feedback
- [x] Add pane title bars with view names
- [x] Enhance status bar with pane indicators
- [x] Implement named layout save/restore
- [x] Add layout preset picker dialog
- [x] Update split view tests (~30 tests)

**Deliverables:**

- `src/tui/utils/layout_manager.ts` (~300 LOC)
- `src/tui/dialogs/layout_dialogs.ts` (~150 LOC)
- Updated `src/tui/tui_dashboard.ts`
- `tests/tui/layout_manager_test.ts` (~30 tests)

**Keyboard Shortcuts:**

| Key            | Action                |
| -------------- | --------------------- |
| `v`            | Split vertical        |
| `h`            | Split horizontal      |
| `c`            | Close pane            |
| `z`            | Maximize/restore pane |
| `x`            | Swap with next pane   |
| `L`            | Layout preset picker  |
| `Ctrl+←/→/↑/↓` | Resize pane           |
| `Ctrl+S`       | Save layout           |
| `Ctrl+L`       | Named layouts manager |
| `1-6`          | Quick layout preset   |

---

## 6. User Documentation Updates

### 6.1 User Guide TUI Section

The following sections need updates in `docs/ExoFrame_User_Guide.md`:

#### 4.1a Working with the TUI Dashboard (Expanded)

````markdown
## TUI Dashboard Overview

The ExoFrame TUI Dashboard is a powerful terminal interface for managing your development workflow.

### Launching the Dashboard

```bash
exoctl dashboard
```
````

### Views

The dashboard includes 7 integrated views:

1. **Memory View** - Browse and manage Memory Banks
2. **Portal Manager** - Manage project portals
3. **Plan Reviewer** - Review and approve agent plans
4. **Monitor** - Real-time activity log streaming
5. **Request Manager** - Track and manage requests
6. **Agent Status** - Monitor agent health
7. **Daemon Control** - Manage the ExoFrame daemon

### Global Navigation

| Key         | Action                       |
| ----------- | ---------------------------- |
| `Tab`       | Switch to next view/pane     |
| `Shift+Tab` | Switch to previous view/pane |
| `?`         | Show help for current view   |
| `R`         | Refresh current view         |
| `v`         | Split pane vertical          |
| `h`         | Split pane horizontal        |
| `z`         | Maximize/restore pane        |
| `L`         | Layout presets               |
| `q`         | Quit dashboard               |

### View-Specific Features

Each view supports:

- **Tree Navigation** - Hierarchical data browsing
- **Search** - Find items quickly (press `s` or `/`)
- **Details Panel** - Rich markdown-formatted details
- **Confirmations** - Safe dialogs for destructive actions
- **Loading States** - Visual feedback during operations

````
### 6.2 New Keyboard Reference Document

Create `docs/TUI_Keyboard_Reference.md`:

```markdown
# TUI Keyboard Reference

## Global Keys

| Key | Action |
|-----|--------|
| `Tab` | Next view/pane |
| `Shift+Tab` | Previous view/pane |
| `?` | Help |
| `R` | Refresh |
| `q` | Quit |

## Navigation Keys

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Home` | First item |
| `End` | Last item |
| `Enter` | Select/expand |
| `←` | Collapse/parent |
| `→` | Expand |

## Search & Filter

| Key | Action |
|-----|--------|
| `s` / `/` | Start search |
| `Enter` | Execute search |
| `Escape` | Cancel search |

## Memory View

| Key | Action |
|-----|--------|
| `g` | Jump to Global |
| `p` | Jump to Projects |
| `e` | Jump to Executions |
| `n` | Jump to Pending |
| `a` | Approve pending |
| `r` | Reject pending |
| `A` | Approve all |
| `P` | Promote learning |
| `L` | Add learning |

## Portal Manager

| Key | Action |
|-----|--------|
| `Enter` | Open portal |
| `r` | Refresh portal |
| `d` | Delete portal |

## Plan Reviewer

| Key | Action |
|-----|--------|
| `a` | Approve plan |
| `r` | Reject plan |
| `A` | Approve all |
| `c` | Add comment |

## Monitor

| Key | Action |
|-----|--------|
| `Space` | Pause/resume |
| `b` | Bookmark entry |
| `e` | Export logs |
| `f` | Filter by agent |
| `t` | Filter by time |

## Request Manager

| Key | Action |
|-----|--------|
| `c` | Create request |
| `d` | Cancel request |
| `p` | Change priority |

## Agent Status

| Key | Action |
|-----|--------|
| `l` | View logs |

## Daemon Control

| Key | Action |
|-----|--------|
| `s` | Start daemon |
| `k` | Stop daemon |
| `r` | Restart daemon |
| `l` | View logs |
| `c` | View config |

## Split View / Panes

| Key | Action |
|-----|--------|
| `Tab` | Next pane |
| `Shift+Tab` | Previous pane |
| `v` | Split vertical |
| `h` | Split horizontal |
| `c` | Close pane |
| `z` | Maximize/restore |
| `x` | Swap panes |
| `L` | Layout presets |
| `Ctrl+←` | Shrink width |
| `Ctrl+→` | Grow width |
| `Ctrl+↑` | Shrink height |
| `Ctrl+↓` | Grow height |
| `Ctrl+S` | Save layout |
| `Ctrl+L` | Named layouts |
| `1-6` | Quick presets |
````

---

## 7. Success Metrics

### 7.1 Quantitative Metrics

| Metric             | Initial | Target | Final        |
| ------------------ | ------- | ------ | ------------ |
| Total TUI Tests    | 225     | 400+   | **656** ✅   |
| Test Coverage      | ~60%    | 80%+   | **85%+** ✅  |
| Lines of Code      | ~2500   | ~5000  | **~6000** ✅ |
| Views with Loading | 1/7     | 7/7    | **7/7** ✅   |
| Views with Help    | 1/7     | 7/7    | **7/7** ✅   |
| Views with Search  | 2/7     | 7/7    | **7/7** ✅   |
| Views with Dialogs | 1/7     | 6/7    | **7/7** ✅   |

### 7.2 Qualitative Metrics

| Metric              | Success Criteria                         | Status      |
| ------------------- | ---------------------------------------- | ----------- |
| **Consistency**     | All views follow same patterns           | ✅ Achieved |
| **Discoverability** | ? key shows comprehensive help           | ✅ Achieved |
| **Safety**          | Destructive actions require confirmation | ✅ Achieved |
| **Responsiveness**  | Loading states for all async ops         | ✅ Achieved |
| **Documentation**   | Complete user guide and keyboard ref     | ✅ Achieved |

### 7.3 Test Requirements per Phase (Actual Results)

| Phase                | Planned | Actual  | Status |
| -------------------- | ------- | ------- | ------ |
| 13.1 Shared Utils    | 50      | 53      | ✅     |
| 13.2 TuiSessionBase  | 20      | 27      | ✅     |
| 13.3 Portal Manager  | 30      | 63      | ✅     |
| 13.4 Plan Reviewer   | 30      | 71      | ✅     |
| 13.5 Monitor         | 25      | 73      | ✅     |
| 13.6 Request Manager | 25      | 73      | ✅     |
| 13.7 Agent Status    | 20      | 63      | ✅     |
| 13.8 Daemon Control  | 15      | 61      | ✅     |
| 13.9 Dashboard       | 20      | 107     | ✅     |
| 13.10 Documentation  | 0       | 0       | ✅     |
| 13.11 Split View     | 30      | 65      | ✅     |
| **Total**            | **265** | **656** | ✅     |

---

## 8. Rollback Plan

| Phase | Rollback Strategy                     | Status            |
| ----- | ------------------------------------- | ----------------- |
| 13.1  | Delete `src/tui/utils/` new files     | N/A - Complete ✅ |
| 13.2  | Revert `tui_common.ts` changes        | N/A - Complete ✅ |
| 13.3  | Revert `portal_manager_view.ts`       | N/A - Complete ✅ |
| 13.4  | Revert `plan_reviewer_view.ts`        | N/A - Complete ✅ |
| 13.5  | Revert `monitor_view.ts`              | N/A - Complete ✅ |
| 13.6  | Revert `request_manager_view.ts`      | N/A - Complete ✅ |
| 13.7  | Revert `agent_status_view.ts`         | N/A - Complete ✅ |
| 13.8  | Revert `daemon_control_view.ts`       | N/A - Complete ✅ |
| 13.9  | Revert `tui_dashboard.ts`             | N/A - Complete ✅ |
| 13.10 | Revert documentation changes          | N/A - Complete ✅ |
| 13.11 | Revert layout_manager, layout_dialogs | N/A - Complete ✅ |

**All phases completed successfully. No rollback needed.**

---

## 9. Timeline Summary

| Phase                      | Planned    | Actual       | Status |
| -------------------------- | ---------- | ------------ | ------ |
| 13.1 Shared Infrastructure | 1 day      | Completed    | ✅     |
| 13.2 TuiSessionBase        | 0.5 day    | Completed    | ✅     |
| 13.3 Portal Manager        | 1 day      | Completed    | ✅     |
| 13.4 Plan Reviewer         | 1 day      | Completed    | ✅     |
| 13.5 Monitor               | 1 day      | Completed    | ✅     |
| 13.6 Request Manager       | 1 day      | Completed    | ✅     |
| 13.7 Agent Status          | 0.5 day    | Completed    | ✅     |
| 13.8 Daemon Control        | 0.5 day    | Completed    | ✅     |
| 13.9 Dashboard Integration | 0.5 day    | Completed    | ✅     |
| 13.10 Documentation        | 0.5 day    | Completed    | ✅     |
| 13.11 Split View           | 1 day      | Completed    | ✅     |
| **Total**                  | **9 days** | **Complete** | ✅     |

---

## 10. Completion Summary

### Commits

| Phase | Commit Hash | Description                 |
| ----- | ----------- | --------------------------- |
| 13.1  | 62abbbf     | Shared TUI Infrastructure   |
| 13.2  | 02091ca     | Enhanced TuiSessionBase     |
| 13.3  | e28c7ec     | Portal Manager Enhancement  |
| 13.4  | bfa8e8c     | Plan Reviewer Enhancement   |
| 13.5  | 9def473     | Monitor View Enhancement    |
| 13.6  | a721eb8     | Request Manager Enhancement |
| 13.7  | 75f2f02     | Agent Status Enhancement    |
| 13.8  | f4c21dd     | Daemon Control Enhancement  |
| 13.9  | 86f134b     | Dashboard Integration       |
| 13.10 | 2aece8c     | User Documentation          |
| 13.11 | ad8757d     | Split View Enhancement      |

### Final Test Count: 656 TUI tests

### Key Accomplishments

1. **Unified TUI Infrastructure** - Shared utilities across all views
2. **Consistent UX** - All 7 views follow same patterns
3. **Full Documentation** - Keyboard reference, user guide, architecture docs
4. **Extensive Testing** - 656 tests with 85%+ coverage
5. **Split View System** - 6 layout presets, named layouts, pane management

---

## 11. References

- [Phase 12.5+ Memory Banks v2](phase-12.5-memory-bank-enhanced.md)
- [ExoFrame User Guide - TUI Section](../docs/ExoFrame_User_Guide.md#41a-working-with-the-tui-dashboard)
- [ExoFrame Architecture - TUI](../docs/ExoFrame_Architecture.md#tui-dashboard-architecture)
- [TUI Keyboard Reference](../docs/TUI_Keyboard_Reference.md)
- [Memory View Implementation](../src/tui/memory_view.ts)
- [Markdown Renderer](../src/tui/utils/markdown_renderer.ts)
- [Layout Manager](../src/tui/utils/layout_manager.ts)
