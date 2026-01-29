/**
 * TUI Dashboard - Unified Dashboard Entry Point
 *
 * Part of Phase 13.9: Dashboard Integration
 *
 * This is the main entry point for the ExoFrame TUI, integrating all
 * enhanced views into a unified dashboard with:
 * - Multi-pane split view support
 * - Global help overlay
 * - View switching indicators
 * - Notification system
 * - Layout persistence
 */

import { NotificationService } from "../services/notification.ts";
import { colorize, getTheme, type TuiTheme } from "./utils/colors.ts";
import {
  handleMemoryNotifications as _handleMemoryNotifications,
  renderNotificationPanel,
} from "./tui_helpers/notifications.ts";
import {
  resetToDefault as helperResetToDefault,
  restoreLayout as helperRestoreLayout,
  saveLayout as helperSaveLayout,
} from "./tui_helpers/layout_persistence.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import type { DatabaseService } from "../services/db.ts";
import { initDashboardViews } from "./dashboard/view_registry.ts";
import { prodRender } from "./dashboard/renderer.ts";
import {
  closePane as helperClosePane,
  maximizePane as helperMaximizePane,
  resizePane as helperResizePane,
  splitPane as helperSplitPane,
  switchPane as helperSwitchPane,
} from "./dashboard/pane_manager.ts";

// Type alias for convenience
type Theme = TuiTheme;

// ===== Dashboard View State =====

export interface DashboardViewState {
  showHelp: boolean;
  showNotifications: boolean;
  showViewPicker: boolean;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  currentTheme: string;
  highContrast: boolean;
  screenReader: boolean;
  showMemoryNotifications: boolean;
  selectedMemoryNotifIndex: number;
}

// ===== Dashboard Icons =====

export const DASHBOARD_ICONS = {
  views: {
    PortalManagerView: "🌀",
    PlanReviewerView: "📋",
    MonitorView: "📊",
    StructuredLogViewer: "🔍",
    DaemonControlView: "⚙️",
    AgentStatusView: "🤖",
    RequestManagerView: "📥",
    MemoryView: "💾",
    SkillsManagerView: "🎯",
  } as Record<string, string>,
  pane: {
    focused: "●",
    unfocused: "○",
    split: "│",
    horizontal: "─",
    corner: "┼",
  },
  notification: {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    bell: "🔔",
    memory_update_pending: "📝",
    memory_approved: "✅",
    memory_rejected: "❌",
  },
  layout: {
    single: "□",
    vertical: "▯▯",
    horizontal: "▭▭",
    quad: "⊞",
    save: "💾",
    load: "📂",
    reset: "🔄",
  },
} as const;

// ===== Dashboard Key Bindings =====

type DashboardAction =
  | "next_pane"
  | "prev_pane"
  | "split_vertical"
  | "split_horizontal"
  | "close_pane"
  | "maximize_pane"
  | "save_layout"
  | "restore_layout"
  | "reset_layout"
  | "show_help"
  | "show_notifications"
  | "show_view_picker"
  | "quit"
  | "view_1"
  | "view_2"
  | "view_3"
  | "view_4"
  | "view_5"
  | "view_6"
  | "view_7"
  | "show_memory_notifications"
  | "resize_left"
  | "resize_right"
  | "resize_up"
  | "resize_down";

export const DASHBOARD_KEY_BINDINGS: KeyBinding<DashboardAction>[] = [
  // Navigation
  { key: "Tab", action: "next_pane", description: "Next pane", category: "Navigation" },
  { key: "Shift+Tab", action: "prev_pane", description: "Previous pane", category: "Navigation" },
  { key: "1-7", action: "view_1", description: "Jump to pane 1-7", category: "Navigation" },

  // Layout
  { key: "v", action: "split_vertical", description: "Split pane vertically", category: "Layout" },
  { key: "h", action: "split_horizontal", description: "Split pane horizontally", category: "Layout" },
  { key: "c", action: "close_pane", description: "Close current pane", category: "Layout" },
  { key: "z", action: "maximize_pane", description: "Maximize/restore pane", category: "Layout" },
  { key: "s", action: "save_layout", description: "Save layout", category: "Layout" },
  { key: "r", action: "restore_layout", description: "Restore layout", category: "Layout" },
  { key: "d", action: "reset_layout", description: "Reset to default", category: "Layout" },

  // Resizing
  { key: "Ctrl+Left", action: "resize_left", description: "Resize left", category: "Layout" },
  { key: "Ctrl+Right", action: "resize_right", description: "Resize right", category: "Layout" },
  { key: "Ctrl+Up", action: "resize_up", description: "Resize up", category: "Layout" },
  { key: "Ctrl+Down", action: "resize_down", description: "Resize down", category: "Layout" },

  // Dialogs
  { key: "?", action: "show_help", description: "Show help", category: "General" },
  { key: "n", action: "show_notifications", description: "Toggle notifications", category: "General" },
  { key: "m", action: "show_memory_notifications", description: "Memory updates", category: "General" },
  { key: "p", action: "show_view_picker", description: "View picker", category: "General" },
  { key: "Esc/q", action: "quit", description: "Quit dashboard", category: "General" },
];

// ===== Help Sections =====

export function getDashboardHelpSections(): HelpSection[] {
  return [
    {
      title: "Navigation",
      items: [
        { key: "Tab", description: "Switch to next pane" },
        { key: "Shift+Tab", description: "Switch to previous pane" },
        { key: "1-7", description: "Jump directly to pane" },
      ],
    },
    {
      title: "Layout Management",
      items: [
        { key: "v", description: "Split pane vertically (left/right)" },
        { key: "h", description: "Split pane horizontally (top/bottom)" },
        { key: "c", description: "Close current pane" },
        { key: "z", description: "Maximize/restore pane (zoom)" },
      ],
    },
    {
      title: "Layout Persistence",
      items: [
        { key: "s", description: "Save current layout" },
        { key: "r", description: "Restore saved layout" },
        { key: "d", description: "Reset to default layout" },
      ],
    },
    {
      title: "View Navigation",
      items: [
        { key: "p", description: "Open view picker dialog" },
        { key: "n", description: "Toggle notification panel" },
        { key: "m", description: "Toggle memory update notifications" },
        { key: "?", description: "Show this help screen" },
      ],
    },
    {
      title: "Available Views",
      items: [
        { key: "🌀 Portal Manager", description: "Manage portal aliases" },
        { key: "📋 Plan Reviewer", description: "Review and approve plans" },
        { key: "📊 Monitor", description: "View system logs" },
        { key: "⚙️ Daemon Control", description: "Manage daemon" },
        { key: "🤖 Agent Status", description: "View agent status" },
        { key: "📥 Request Manager", description: "Manage requests" },
        { key: "💾 Memory", description: "Memory management" },
      ],
    },
    {
      title: "Exit",
      items: [
        { key: "Esc/q", description: "Quit dashboard" },
      ],
    },
  ];
}

// ===== Pane and Dashboard Interfaces =====

export interface Pane {
  id: string;
  view: any;
  /** Relative flex position and size (0.0 to 1.0) */
  flexX: number;
  flexY: number;
  flexWidth: number;
  flexHeight: number;
  /** Calculated screen coordinates (pixels/chars) */
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
  maximized?: boolean;
  previousBounds?: {
    flexX: number;
    flexY: number;
    flexWidth: number;
    flexHeight: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TuiDashboard {
  // State
  panes: Pane[];
  activePaneId: string;
  views: any[];
  state: DashboardViewState;
  theme: Theme;

  // Core methods
  handleKey(key: string): Promise<number>;
  render(): Promise<void>;
  renderStatusBar(): Promise<string>;
  renderViewIndicator(): string;
  renderGlobalHelp(): string[];
  renderNotifications(): Promise<string[]>;
  destroy(): void;

  // Pane management
  splitPane(direction: "vertical" | "horizontal"): Promise<void>;
  closePane(paneId: string): Promise<void>;
  resizePane(paneId: string, deltaWidth: number, deltaHeight: number): void;
  switchPane(paneId: string): void;
  maximizePane(paneId: string): void;
  restorePane(paneId: string): void;

  // Layout persistence
  saveLayout(): Promise<void>;
  restoreLayout(): Promise<void>;
  resetToDefault(): Promise<void>;

  // Notifications
  notificationService: NotificationService;
  notify(message: string, type?: string): Promise<void>;
  dismissNotification(id: string): Promise<void>;
  clearNotifications(): Promise<void>;
  approveMemoryUpdate(proposalId: string): Promise<void>;
  rejectMemoryUpdate(proposalId: string): Promise<void>;

  // Legacy support
  portalManager: {
    service: any;
    renderPortalList: (portals: any[]) => string;
  };
  accessibility: {
    highContrast: boolean;
    screenReader: boolean;
  };
  keybindings: {
    nextView: string;
    prevView: string;
    notify: string;
    splitVertical: string;
    splitHorizontal: string;
    closePane: string;
  };
}

export function tryEnableRawMode(): boolean {
  try {
    const stdinAny = Deno.stdin as any;
    if (typeof stdinAny.isTerminal === "function" && stdinAny.isTerminal()) {
      if (typeof stdinAny.setRaw === "function") {
        stdinAny.setRaw(true);
        return true;
      }
    }
  } catch (_err) {
    // best-effort: ignore errors
  }
  return false;
}

export function tryDisableRawMode(): boolean {
  try {
    const stdinAny = Deno.stdin as any;
    if (typeof stdinAny.setRaw === "function") {
      stdinAny.setRaw(false);
      return true;
    }
  } catch (_err) {
    // ignore
  }
  return false;
}

// Notification helpers are now handled by NotificationService

// ===== Default Dashboard State =====

export function createDefaultDashboardState(): DashboardViewState {
  return {
    showHelp: false,
    showNotifications: false,
    showViewPicker: false,
    isLoading: false,
    loadingMessage: "",
    error: null,
    currentTheme: "dark",
    highContrast: false,
    screenReader: false,
    showMemoryNotifications: false,
    selectedMemoryNotifIndex: 0,
  };
}

// ===== View Indicator Rendering =====

export function renderViewIndicator(panes: Pane[], activePaneId: string, theme: Theme): string {
  const indicators: string[] = [];

  for (let i = 0; i < panes.length; i++) {
    const pane = panes[i];
    const icon = DASHBOARD_ICONS.views[pane.view.name] || "📦";
    const focusIndicator = pane.id === activePaneId ? DASHBOARD_ICONS.pane.focused : DASHBOARD_ICONS.pane.unfocused;

    const paneLabel = `${focusIndicator} ${i + 1}:${icon}`;

    if (pane.id === activePaneId) {
      indicators.push(colorize(paneLabel, theme.primary, theme.reset));
    } else {
      indicators.push(colorize(paneLabel, theme.textDim, theme.reset));
    }
  }

  return indicators.join("  ");
}

// ===== Global Help Overlay Rendering =====

export function renderGlobalHelpOverlay(_theme: Theme): string[] {
  const sections = getDashboardHelpSections();
  return renderHelpScreen({
    title: "ExoFrame Dashboard Help",
    sections,
    footer: "Press ? or Esc to close help",
    width: 70,
    useColors: true,
  });
}

// ===== Notification Panel Rendering =====

// `renderNotificationPanel` and `handleMemoryNotifications` moved to `src/tui/tui_helpers/notifications.ts`.

// ===== View Picker Rendering =====

export function renderViewPicker(
  views: any[],
  currentViewIndex: number,
  theme: Theme,
): string[] {
  const lines: string[] = [];

  lines.push(colorize("┌────────────────────────────────────┐", theme.border, theme.reset));
  lines.push(
    colorize("│", theme.border, theme.reset) +
      colorize("          Select View             ", theme.h1, theme.reset) +
      colorize("│", theme.border, theme.reset),
  );
  lines.push(colorize("├────────────────────────────────────┤", theme.border, theme.reset));

  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    const icon = DASHBOARD_ICONS.views[view.name] || "📦";
    const shortName = view.name.replace("View", "");

    const isSelected = i === currentViewIndex;
    const prefix = isSelected ? "▶ " : "  ";
    const suffix = isSelected ? " ◀" : "  ";

    let line = `${prefix}${i + 1}. ${icon} ${shortName}${suffix}`;
    line = line.padEnd(34);

    if (isSelected) {
      line = colorize(line, theme.primary, theme.reset);
    }

    lines.push(colorize("│", theme.border, theme.reset) + " " + line + " " + colorize("│", theme.border, theme.reset));
  }

  lines.push(colorize("├────────────────────────────────────┤", theme.border, theme.reset));
  lines.push(
    colorize("│", theme.border, theme.reset) +
      colorize(" Enter to select, Esc to cancel   ", theme.textDim, theme.reset) +
      colorize("│", theme.border, theme.reset),
  );
  lines.push(colorize("└────────────────────────────────────┘", theme.border, theme.reset));

  return lines;
}

// ===== Pane Title Bar Rendering =====

export function renderPaneTitleBar(pane: Pane, theme: Theme): string {
  const icon = DASHBOARD_ICONS.views[pane.view.name] || "📦";
  const name = pane.view.name.replace("View", "");
  const focusIndicator = pane.focused ? "●" : "○";
  const maxIndicator = pane.maximized ? " [MAX]" : "";

  const title = `${focusIndicator} ${icon} ${name}${maxIndicator}`;

  if (pane.focused) {
    return colorize(title, theme.primary, theme.reset);
  }
  return colorize(title, theme.textDim, theme.reset);
}

// Helper handlers extracted from the large dashboard key handler to reduce complexity
function _handleHelpOverlay(self: any, key: string, panes: Pane[]) {
  if (key === "?" || key === "escape" || key === "esc") {
    self.state.showHelp = false;
  }
  return panes.findIndex((p) => p.id === self.activePaneId);
}

async function _handleMemoryNotificationsLocal(
  self: any,
  key: string,
  panes: Pane[],
  notificationService: NotificationService,
) {
  return await _handleMemoryNotifications(self, key, panes, notificationService);
}

function _handleViewPicker(self: any, key: string, views: any[], panes: Pane[], viewPickerIndexRef: { index: number }) {
  if (key === "escape" || key === "esc") {
    self.state.showViewPicker = false;
  } else if (key === "up" || key === "k") {
    viewPickerIndexRef.index = (viewPickerIndexRef.index - 1 + views.length) % views.length;
  } else if (key === "down" || key === "j") {
    viewPickerIndexRef.index = (viewPickerIndexRef.index + 1) % views.length;
  } else if (key === "enter") {
    const activePane = panes.find((p) => p.id === self.activePaneId);
    if (activePane) {
      activePane.view = views[viewPickerIndexRef.index];
    }
    self.state.showViewPicker = false;
  } else if (key >= "1" && key <= "7") {
    const idx = parseInt(key) - 1;
    if (idx < views.length) {
      const activePane = panes.find((p) => p.id === self.activePaneId);
      if (activePane) {
        activePane.view = views[idx];
      }
      self.state.showViewPicker = false;
    }
  }

  return panes.findIndex((p) => p.id === self.activePaneId);
}

export async function launchTuiDashboard(
  options: {
    testMode?: boolean;
    nonInteractive?: boolean;
    notificationService?: NotificationService;
    databaseService?: DatabaseService;
  } = {},
): Promise<TuiDashboard | undefined> {
  // Initialize views using registry
  const views = initDashboardViews({ testMode: options.testMode, databaseService: options.databaseService });
  const portalView = views[0];

  // Initialize with single pane
  const initialPane: Pane = {
    id: "main",
    view: views[0],
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    focused: true,
    maximized: false,
  };
  const panes: Pane[] = [initialPane];
  let activePaneId = "main";

  // Initialize state
  const state: DashboardViewState = createDefaultDashboardState();
  const theme: Theme = getTheme(true);

  // View picker state
  let viewPickerIndex = 0;

  if (options.testMode) {
    // Initialize notification service if not provided
    const localNotifs: any[] = [];
    const notificationService = options.notificationService || {
      async notify(message: string, type = "info") {
        localNotifs.unshift({ // Newest first
          id: crypto.randomUUID(),
          type,
          message,
          created_at: new Date().toISOString(),
        });
        await Promise.resolve();
      },
      async getNotifications() {
        return await Promise.resolve(localNotifs.filter((n) => !n.dismissed_at));
      },
      async getPendingCount() {
        return await Promise.resolve(localNotifs.filter((n) => !n.dismissed_at).length);
      },
      async clearNotification(id: string) {
        const notif = localNotifs.find((n) => n.id === id);
        if (notif) notif.dismissed_at = new Date().toISOString();
        await Promise.resolve();
      },
      async clearAllNotifications() {
        localNotifs.forEach((n) => n.dismissed_at = new Date().toISOString());
        await Promise.resolve();
      },
    } as unknown as NotificationService;

    return {
      panes,
      activePaneId,
      views,
      state,
      theme,
      notificationService,
      // Expose extracted helpers so test-mode key handler can call them
      handleHelpOverlay: _handleHelpOverlay,
      handleViewPicker: _handleViewPicker,
      handleMemoryNotifications: _handleMemoryNotificationsLocal,
      async handleKey(key: string) {
        const viewPickerRef = { index: viewPickerIndex };
        const idx = await import("./tui_helpers/handle_key.ts").then((m) =>
          m.testModeHandleKey(this, key, panes, views, viewPickerRef)
        );
        viewPickerIndex = viewPickerRef.index;
        return idx;
      },
      async render() {
        // Test mode render - does nothing
      },
      async renderStatusBar() {
        const activePane = panes.find((p) => p.id === this.activePaneId);
        const indicator = renderViewIndicator(panes, this.activePaneId, this.theme);
        const notificationCount = await this.notificationService.getPendingCount();
        const notificationBadge = notificationCount > 0 ? ` 🔔${notificationCount}` : "";
        return `${indicator} │ Active: ${activePane?.view.name}${notificationBadge}`;
      },
      renderViewIndicator() {
        return renderViewIndicator(panes, this.activePaneId, this.theme);
      },
      renderGlobalHelp() {
        return renderGlobalHelpOverlay(this.theme);
      },
      async renderNotifications() {
        return await renderNotificationPanel(this.notificationService, this.theme, this.state);
      },
      async approveMemoryUpdate(_proposalId: string) {
        await this.notify("Memory update approved (test)", "success");
      },
      async rejectMemoryUpdate(_proposalId: string) {
        await this.notify("Memory update rejected (test)", "error");
      },
      portalManager: {
        service: (portalView as any).service,
        renderPortalList: (portalView as any).renderPortalList.bind(portalView),
      },
      async notify(message: string, type = "info") {
        await this.notificationService.notify(message, type);
      },
      async dismissNotification(id: string) {
        await this.notificationService.clearNotification(id);
      },
      async clearNotifications() {
        await this.notificationService.clearAllNotifications();
      },
      accessibility: {
        highContrast: false,
        screenReader: false,
      },
      keybindings: {
        nextView: "Tab",
        prevView: "Shift+Tab",
        notify: "n",
        splitVertical: "v",
        splitHorizontal: "h",
        closePane: "c",
      },
      async splitPane(direction: "vertical" | "horizontal") {
        const result = await helperSplitPane(panes, this.activePaneId, views, direction, this.notify.bind(this));
        this.activePaneId = result.activePaneId;
      },
      async closePane(paneId: string) {
        const result = await helperClosePane(panes, this.activePaneId, paneId, this.notify.bind(this));
        this.activePaneId = result.activePaneId;
      },
      resizePane(paneId: string, deltaWidth: number, deltaHeight: number) {
        helperResizePane(panes, paneId, deltaWidth, deltaHeight);
      },
      switchPane(paneId: string) {
        const newId = helperSwitchPane(panes, paneId);
        if (newId) this.activePaneId = newId;
      },
      maximizePane(paneId: string) {
        helperMaximizePane(panes, paneId, this.notify.bind(this));
      },
      restorePane(paneId: string) {
        const pane = panes.find((p) => p.id === paneId);
        if (pane && pane.maximized) {
          this.maximizePane(paneId);
        }
      },
      saveLayout() {
        // Mock save - in production this would write to file
        // For testing, we can override this method
        return Promise.resolve();
      },
      restoreLayout() {
        // Mock restore - in production this would read from file
        // For testing, we can override this method
        return Promise.resolve();
      },
      async resetToDefault() {
        // Reset to single pane with PortalManagerView
        panes.length = 0;
        panes.push({
          id: "main",
          view: views[0],
          x: 0,
          y: 0,
          width: 80,
          height: 24,
          focused: true,
          maximized: false,
        });
        this.activePaneId = "main";
        await this.clearNotifications();
        await this.notify("Layout reset to default", "info");
      },
      destroy() {
        // Clean up all views to prevent interval leaks in tests
        for (const view of views) {
          if (typeof view.dispose === "function") {
            view.dispose();
          } else if (typeof view.destroy === "function") {
            view.destroy();
          }
        }
      },
    } as TuiDashboard;
  }
  // Production TUI integration using console-based rendering
  // TODO: Replace with full deno-tui integration when available

  // Production state
  // Initialize services for production
  const _db = {} as any; // TODO: Initialize real DB service
  const notificationService = options.notificationService || {
    async getNotifications() {
      return await Promise.resolve([]);
    },
    async getPendingCount() {
      return await Promise.resolve(0);
    },
    async notify() {
      await Promise.resolve();
    },
    async clearNotification() {
      await Promise.resolve();
    },
    async clearAllNotifications() {
      await Promise.resolve();
    },
  } as unknown as NotificationService;

  const prodState: DashboardViewState = createDefaultDashboardState();

  // Helper to add notification (accepts generic string to match helper signature)
  const addNotification = (message: string, type?: string) => {
    const t = type ?? "info";
    console.log(`[${t}] ${message}`);
  };

  // Layout persistence delegated to helper module
  const saveLayout = async () => await helperSaveLayout(panes, activePaneId, addNotification);
  const restoreLayout = async () => {
    const result = await helperRestoreLayout(panes, views, addNotification);
    if (result?.activePaneId) activePaneId = result.activePaneId;
  };
  const resetToDefault = () => {
    const newId = helperResetToDefault(panes, views, addNotification);
    activePaneId = newId;
  };

  // Restore layout on startup
  await restoreLayout();

  console.clear();
  console.log("ExoFrame TUI Dashboard");
  console.log("======================");

  async function prodRenderWrapper() {
    await prodRender(panes, activePaneId, prodState, theme, notificationService, portalView);
  }
  const render = prodRenderWrapper;
  await render();

  async function runProdInteractiveLoop() {
    // Interactive mode: attempt to enable raw mode when possible and provide a line-based fallback
    let rawEnabled = false;
    try {
      const stdinAny = Deno.stdin as any;
      const isTty = typeof stdinAny.isTerminal === "function" && stdinAny.isTerminal();
      if (isTty) {
        rawEnabled = tryEnableRawMode();
        if (!rawEnabled) console.warn("Warning: terminal raw mode not available; keyboard keys will require Enter.");
      } else {
        console.log("Non-tty stdin detected; using line-based input (press Enter after commands).");
      }

      const decoder = new TextDecoder();

      if (rawEnabled) {
        // Raw-mode loop - immediate key sequences
        for await (const chunk of Deno.stdin.readable) {
          const input = decoder.decode(chunk);
          const key = input; // preserve escape sequences

          const activePaneRef = { id: activePaneId };
          const res = await import("./tui_helpers/prod_handle_key.ts").then((m) =>
            m.prodHandleKey(key, {
              prodState,
              panes,
              views,
              activePaneRef,
              notificationService,
              addNotification,
              saveLayout,
              restoreLayout,
              resetToDefault,
            })
          );

          activePaneId = activePaneRef.id;
          if (res?.exit) break;
          if (res?.reRender) await render();
          continue;
        }
      } else {
        // Non-raw fallback: read lines from stdin (Enter-terminated commands)
        const { readLines } = await import("https://deno.land/std@0.203.0/io/mod.ts");
        for await (const line of readLines(Deno.stdin)) {
          const cmd = line.trim().toLowerCase();
          if (!cmd) continue;

          const activePaneRef = { id: activePaneId };
          const res = await import("./tui_helpers/prod_handle_key.ts").then((m) =>
            m.prodHandleKey(cmd, {
              prodState,
              panes,
              views,
              activePaneRef,
              notificationService,
              addNotification,
              saveLayout,
              restoreLayout,
              resetToDefault,
            })
          );

          activePaneId = activePaneRef.id;
          if (res?.exit) break;
          if (res?.reRender) await render();
        }
      }
    } finally {
      if (rawEnabled) {
        tryDisableRawMode();
      }
    }
  }

  if (!options.nonInteractive) {
    await runProdInteractiveLoop();
  }

  // Save layout on exit
  await saveLayout();

  console.log("Exiting dashboard.");
}

if (import.meta.main) {
  launchTuiDashboard();
}
