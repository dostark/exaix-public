/**
 * Daemon Control View - TUI for managing the ExoFrame daemon
 *
 * Phase 13.8: Enhanced with modern patterns including:
 * - Status visualization with health indicators
 * - Log tail view
 * - Confirm dialogs for stop/restart
 * - Configuration viewer
 * - Help screen
 */

import { TuiSessionBase } from "./tui_common.ts";
import { createSpinnerState, type SpinnerState, startSpinner, stopSpinner } from "./utils/spinner.ts";
import { type HelpSection, renderHelpScreen } from "./utils/help_renderer.ts";
import { ConfirmDialog, InputDialog } from "./utils/dialog_base.ts";
import type { KeyBinding } from "./utils/keyboard.ts";
import { DaemonStatus, GeneralStatus } from "../enums.ts";
import { TUI_DAEMON_STATUS_ICONS, TUI_LAYOUT_MEDIUM_WIDTH } from "./utils/constants.ts";
import { MONITOR_AUTO_REFRESH_INTERVAL_MS } from "./tui.config.ts";

// ===== Service Interfaces =====

/**
 * Service interface for controlling the ExoFrame daemon.
 */
export interface DaemonService {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getStatus(): Promise<string>;
  getLogs(): Promise<string[]>;
  getErrors(): Promise<string[]>;
}

// ===== View State =====

/**
 * State interface for Daemon Control View
 */
export interface DaemonViewState {
  /** Current daemon status */
  status: DaemonStatus;
  /** Whether help is visible */
  showHelp: boolean;
  /** Whether logs view is shown */
  showLogs: boolean;
  /** Whether config view is shown */
  showConfig: boolean;
  /** Log content */
  logContent: string[];
  /** Error content */
  errorContent: string[];
  /** Active dialog */
  activeDialog: ConfirmDialog | InputDialog | null;
  /** Last status check time */
  lastStatusCheck: Date | null;
  /** Whether auto-refresh is enabled */
  autoRefresh: boolean;
  /** Auto-refresh interval in ms */
  autoRefreshInterval: number;
}

// ===== Icons and Visual Constants =====

export const DAEMON_STATUS_ICONS: Record<string, string> = {
  [DaemonStatus.RUNNING]: TUI_DAEMON_STATUS_ICONS.running,
  [DaemonStatus.STOPPED]: TUI_DAEMON_STATUS_ICONS.stopped,
  [DaemonStatus.ERROR]: TUI_DAEMON_STATUS_ICONS.error,
  [DaemonStatus.UNKNOWN]: TUI_DAEMON_STATUS_ICONS.unknown,
};

export const DAEMON_STATUS_COLORS: Record<string, string> = {
  [DaemonStatus.RUNNING]: "green",
  [DaemonStatus.STOPPED]: "red",
  [DaemonStatus.ERROR]: "yellow",
  [DaemonStatus.UNKNOWN]: "gray",
};

export const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "white",
  warn: "yellow",
  error: "red",
};

// ===== Key Bindings =====

export const DAEMON_KEY_BINDINGS: KeyBinding[] = [
  { key: "s", action: "start", description: "Start daemon", category: "Actions" },
  { key: "k", action: "stop", description: "Stop daemon (with confirm)", category: "Actions" },
  { key: "r", action: "restart", description: "Restart daemon (with confirm)", category: "Actions" },
  { key: "l", action: "view-logs", description: "View logs", category: "View" },
  { key: "c", action: "view-config", description: "View config", category: "View" },
  { key: "R", action: "refresh", description: "Refresh status", category: "View" },
  { key: "a", action: "auto-refresh", description: "Toggle auto-refresh", category: "View" },
  { key: "?", action: "help", description: "Toggle help", category: "Help" },
  { key: "q", action: "quit", description: "Close/Back", category: "Help" },
  { key: "escape", action: "cancel", description: "Close dialog/view", category: "Help" },
];

// ===== CLI Daemon Service Implementation =====

/**
 * CLI-backed implementation of DaemonService.
 */
export class CLIDaemonService implements DaemonService {
  #cliScript = new URL("../../src/cli/exoctl.ts", import.meta.url).pathname;

  async start(): Promise<void> {
    await this.#runDaemonCmd(["start"]);
  }
  async stop(): Promise<void> {
    await this.#runDaemonCmd(["stop"]);
  }
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
  async getStatus(): Promise<string> {
    const cmd = new Deno.Command("deno", {
      args: ["run", "--allow-all", this.#cliScript, "daemon", "status"],
      stdout: "piped",
      stderr: "null",
    });
    const { stdout } = await cmd.output();
    return new TextDecoder().decode(stdout).trim();
  }
  getLogs(): Promise<string[]> {
    // TODO: Implement real log fetching from CLI or file
    return Promise.resolve(["Daemon started", "No errors detected"]);
  }
  getErrors(): Promise<string[]> {
    // TODO: Implement real error fetching from CLI or file
    return Promise.resolve([]);
  }
  async #runDaemonCmd(args: string[]): Promise<void> {
    const cmd = new Deno.Command("deno", {
      args: ["run", "--allow-all", this.#cliScript, "daemon", ...args],
      stdout: "null",
      stderr: "null",
    });
    await cmd.output();
  }
}

// ===== Daemon Control View Class =====

/**
 * View/controller for daemon control. Delegates to injected DaemonService.
 */
export class DaemonControlView {
  constructor(public readonly service: DaemonService) {}

  /** Get daemon status. */
  getStatus(): Promise<string> {
    return this.service.getStatus();
  }
  /** Get daemon logs. */
  getLogs(): Promise<string[]> {
    return this.service.getLogs();
  }
  /** Get daemon errors. */
  getErrors(): Promise<string[]> {
    return this.service.getErrors();
  }
  /** Start the daemon. */
  start(): Promise<void> {
    return this.service.start();
  }
  /** Stop the daemon. */
  stop(): Promise<void> {
    return this.service.stop();
  }
  /** Restart the daemon. */
  restart(): Promise<void> {
    return this.service.restart();
  }

  /**
   * Create TUI session for interactive mode
   */
  createTuiSession(useColors = true): DaemonControlTuiSession {
    return new DaemonControlTuiSession(this, useColors);
  }
}

// ===== Minimal Mock for Tests =====

/**
 * Minimal DaemonService mock for TUI session tests
 */
export class MinimalDaemonServiceMock implements DaemonService {
  private status = DaemonStatus.STOPPED;
  private logs: string[] = [];
  private errors: string[] = [];

  start(): Promise<void> {
    this.status = DaemonStatus.RUNNING;
    this.logs.push(`[${new Date().toISOString()}] Daemon started`);
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.status = DaemonStatus.STOPPED;
    this.logs.push(`[${new Date().toISOString()}] Daemon stopped`);
    return Promise.resolve();
  }

  restart(): Promise<void> {
    this.logs.push(`[${new Date().toISOString()}] Daemon restarting...`);
    return Promise.resolve();
  }

  getStatus(): Promise<string> {
    return Promise.resolve(this.status);
  }

  getLogs(): Promise<string[]> {
    return Promise.resolve([...this.logs]);
  }

  getErrors(): Promise<string[]> {
    return Promise.resolve([...this.errors]);
  }

  setStatus(status: DaemonStatus): void {
    this.status = status;
  }

  setLogs(logs: string[]): void {
    this.logs = logs;
  }

  setErrors(errors: string[]): void {
    this.errors = errors;
  }
}

// ===== TUI Session Class =====

/**
 * Interactive TUI session for Daemon Control View
 */
export class DaemonControlTuiSession extends TuiSessionBase {
  private readonly daemonView: DaemonControlView;
  private state: DaemonViewState;
  private localSpinnerState: SpinnerState;
  private autoRefreshTimer: number | null = null;

  constructor(daemonView: DaemonControlView, useColors = true) {
    super(useColors);
    this.daemonView = daemonView;
    this.localSpinnerState = createSpinnerState();
    this.state = {
      status: DaemonStatus.UNKNOWN,
      showHelp: false,
      showLogs: false,
      showConfig: false,
      logContent: [],
      errorContent: [],
      activeDialog: null,
      lastStatusCheck: null,
      autoRefresh: false,
      autoRefreshInterval: MONITOR_AUTO_REFRESH_INTERVAL_MS,
    };
  }

  // ===== Initialization =====

  /**
   * Initialize the session by fetching daemon status
   */
  async initialize(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Checking daemon status...");
    try {
      await this.refreshStatus();
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  // ===== State Accessors =====

  override getViewName(): string {
    return "Daemon Control";
  }

  getDaemonStatus(): DaemonStatus {
    return this.state.status;
  }

  override isHelpVisible(): boolean {
    return this.state.showHelp;
  }

  isLogsVisible(): boolean {
    return this.state.showLogs;
  }

  isConfigVisible(): boolean {
    return this.state.showConfig;
  }

  getLogContent(): string[] {
    return this.state.logContent;
  }

  getErrorContent(): string[] {
    return this.state.errorContent;
  }

  hasActiveDialog(): boolean {
    return this.state.activeDialog !== null;
  }

  getActiveDialog(): ConfirmDialog | InputDialog | null {
    return this.state.activeDialog;
  }

  isAutoRefreshEnabled(): boolean {
    return this.state.autoRefresh;
  }

  isLoading(): boolean {
    return this.localSpinnerState.active;
  }

  getLoadingMessage(): string {
    return this.localSpinnerState.message;
  }

  getLastStatusCheck(): Date | null {
    return this.state.lastStatusCheck;
  }

  override getKeyBindings(): KeyBinding[] {
    return DAEMON_KEY_BINDINGS;
  }

  // ===== Status Operations =====

  async refreshStatus(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Refreshing...");
    try {
      const rawStatus = await this.daemonView.getStatus();
      this.state.status = this.parseStatus(rawStatus);
      this.state.lastStatusCheck = new Date();

      // Also refresh logs and errors
      this.state.logContent = await this.daemonView.getLogs();
      this.state.errorContent = await this.daemonView.getErrors();

      this.setStatus("Status refreshed", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Refresh failed: ${msg}`, "error");
      this.state.status = DaemonStatus.ERROR;
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  private parseStatus(rawStatus: string): DaemonStatus {
    const lower = rawStatus.toLowerCase();
    if (lower.includes("running") || lower.includes(GeneralStatus.ACTIVE) || lower.includes("started")) {
      return DaemonStatus.RUNNING;
    }
    if (lower.includes("stopped") || lower.includes("inactive") || lower.includes("not running")) {
      return DaemonStatus.STOPPED;
    }
    if (lower.includes("error") || lower.includes("failed") || lower.includes("crash")) {
      return DaemonStatus.ERROR;
    }
    return DaemonStatus.UNKNOWN;
  }

  // ===== Daemon Actions =====

  showStartConfirm(): void {
    if (this.state.status === DaemonStatus.RUNNING) {
      this.setStatus("Daemon is already running", "warning");
      return;
    }
    this.state.activeDialog = new ConfirmDialog({
      title: "Start Daemon",
      message: "Are you sure you want to start the daemon?",
      confirmText: "Start",
      cancelText: "Cancel",
    });
  }

  showStopConfirm(): void {
    if (this.state.status !== DaemonStatus.RUNNING) {
      this.setStatus("Daemon is not running", "warning");
      return;
    }
    this.state.activeDialog = new ConfirmDialog({
      title: "Stop Daemon",
      message: [
        "Are you sure you want to stop the daemon?",
        "All active operations will be terminated.",
      ],
      confirmText: "Stop",
      cancelText: "Cancel",
      destructive: true,
    });
  }

  showRestartConfirm(): void {
    this.state.activeDialog = new ConfirmDialog({
      title: "Restart Daemon",
      message: [
        "Are you sure you want to restart the daemon?",
        "All active operations will be temporarily interrupted.",
      ],
      confirmText: "Restart",
      cancelText: "Cancel",
      destructive: true,
    });
  }

  async startDaemon(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Starting daemon...");
    try {
      await this.daemonView.start();
      await this.refreshStatus();
      this.setStatus("Daemon started successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to start daemon: ${msg}`, "error");
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  async stopDaemon(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Stopping daemon...");
    try {
      await this.daemonView.stop();
      await this.refreshStatus();
      this.setStatus("Daemon stopped successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to stop daemon: ${msg}`, "error");
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  async restartDaemon(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Restarting daemon...");
    try {
      await this.daemonView.restart();
      await this.refreshStatus();
      this.setStatus("Daemon restarted successfully", "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to restart daemon: ${msg}`, "error");
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  // ===== Logs View =====

  async showLogs(): Promise<void> {
    this.localSpinnerState = startSpinner(this.localSpinnerState, "Loading logs...");
    try {
      this.state.logContent = await this.daemonView.getLogs();
      this.state.errorContent = await this.daemonView.getErrors();
      this.state.showLogs = true;
    } finally {
      this.localSpinnerState = stopSpinner(this.localSpinnerState);
    }
  }

  hideLogs(): void {
    this.state.showLogs = false;
  }

  // ===== Config View =====

  showConfig(): void {
    this.state.showConfig = true;
  }

  hideConfig(): void {
    this.state.showConfig = false;
  }

  // ===== Auto-Refresh =====

  toggleAutoRefresh(): void {
    this.state.autoRefresh = !this.state.autoRefresh;
    if (this.state.autoRefresh) {
      this.startDaemonAutoRefresh();
    } else {
      this.stopDaemonAutoRefresh();
    }
  }

  private startDaemonAutoRefresh(): void {
    if (this.autoRefreshTimer === null) {
      this.autoRefreshTimer = setInterval(() => {
        this.refreshStatus();
      }, this.state.autoRefreshInterval);
    }
  }

  private stopDaemonAutoRefresh(): void {
    if (this.autoRefreshTimer !== null) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  // ===== Help Screen =====

  override toggleHelp(): void {
    this.state.showHelp = !this.state.showHelp;
  }

  getHelpSections(): HelpSection[] {
    return [
      {
        title: "Daemon Actions",
        items: [
          { key: "s", description: "Start daemon" },
          { key: "k", description: "Stop daemon (with confirm)" },
          { key: "r", description: "Restart daemon (with confirm)" },
        ],
      },
      {
        title: "View",
        items: [
          { key: "l", description: "View logs" },
          { key: "c", description: "View config" },
          { key: "R", description: "Refresh status" },
          { key: "a", description: "Toggle auto-refresh" },
        ],
      },
      {
        title: "General",
        items: [
          { key: "?", description: "Toggle this help" },
          { key: "q/Esc", description: "Close/Back" },
        ],
      },
    ];
  }

  // ===== Dialog Handling =====

  private pendingDialogAction: "start" | "stop" | "restart" | null = null;

  closeDialog(): void {
    if (this.state.activeDialog) {
      const result = this.state.activeDialog.getResult();
      if (result.type === "confirmed" && this.pendingDialogAction) {
        // Execute the pending action
        const action = this.pendingDialogAction;
        this.pendingDialogAction = null;
        this.state.activeDialog = null;

        switch (action) {
          case "start":
            this.startDaemon();
            break;
          case "stop":
            this.stopDaemon();
            break;
          case "restart":
            this.restartDaemon();
            break;
        }
      } else {
        this.pendingDialogAction = null;
        this.state.activeDialog = null;
      }
    }
  }

  // ===== Key Handling =====

  async handleKey(key: string): Promise<boolean> {
    // Handle active dialog first
    if (this.state.activeDialog) {
      this.state.activeDialog.handleKey(key);
      if (!this.state.activeDialog.isActive()) {
        this.closeDialog();
      }
      return true;
    }

    // Handle logs view
    if (this.state.showLogs) {
      if (key === "escape" || key === "q") {
        this.hideLogs();
      }
      return true;
    }

    // Handle config view
    if (this.state.showConfig) {
      if (key === "escape" || key === "q") {
        this.hideConfig();
      }
      return true;
    }

    // Handle help view
    if (this.state.showHelp) {
      if (key === "escape" || key === "q" || key === "?") {
        this.state.showHelp = false;
      }
      return true;
    }

    // Main view key handling
    switch (key) {
      case "s":
        this.pendingDialogAction = "start";
        this.showStartConfirm();
        return true;
      case "k":
        this.pendingDialogAction = "stop";
        this.showStopConfirm();
        return true;
      case "r":
        this.pendingDialogAction = "restart";
        this.showRestartConfirm();
        return true;
      case "l":
        await this.showLogs();
        return true;
      case "c":
        this.showConfig();
        return true;
      case "R":
        await this.refreshStatus();
        return true;
      case "a":
        this.toggleAutoRefresh();
        return true;
      case "?":
        this.state.showHelp = true;
        return true;
    }
    return false;
  }

  // ===== Rendering =====

  renderStatusPanel(): string[] {
    const lines: string[] = [];
    const statusIcon = DAEMON_STATUS_ICONS[this.state.status] || "❓";
    const statusLabel = this.state.status.charAt(0).toUpperCase() + this.state.status.slice(1);

    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                    DAEMON STATUS                              ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push(`║  Status: ${statusIcon} ${statusLabel.padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 9)} ║`);

    if (this.state.lastStatusCheck) {
      const timeStr = this.state.lastStatusCheck.toLocaleTimeString();
      lines.push(`║  Last Check: ${timeStr.padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 12)} ║`);
    }

    if (this.state.autoRefresh) {
      lines.push(
        `║  Auto-refresh: ON (every ${Math.floor(this.state.autoRefreshInterval / 1000)}s)${
          "".padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 26)
        } ║`,
      );
    } else {
      lines.push(`║  Auto-refresh: OFF${"".padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 16)} ║`);
    }

    lines.push("║                                                               ║");

    // Show errors if any
    if (this.state.errorContent.length > 0) {
      lines.push("║  ⚠️  Recent Errors:                                            ║");
      for (const error of this.state.errorContent.slice(0, 3)) {
        const truncated = error.length > TUI_LAYOUT_MEDIUM_WIDTH - 3
          ? error.substring(0, TUI_LAYOUT_MEDIUM_WIDTH - 6) + "..."
          : error;
        lines.push(`║    ${truncated.padEnd(TUI_LAYOUT_MEDIUM_WIDTH - 1)} ║`);
      }
      lines.push("║                                                               ║");
    }

    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  [s] Start  [k] Stop  [r] Restart  [l] Logs  [R] Refresh      ║");
    lines.push("╚═══════════════════════════════════════════════════════════════╝");

    return lines;
  }

  renderLogs(): string[] {
    const lines: string[] = [];
    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                      DAEMON LOGS                              ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");

    if (this.state.logContent.length > 0) {
      for (const log of this.state.logContent.slice(-15)) {
        const truncated = log.length > TUI_LAYOUT_MEDIUM_WIDTH + 1
          ? log.substring(0, TUI_LAYOUT_MEDIUM_WIDTH - 2) + "..."
          : log;
        lines.push(`║ ${truncated.padEnd(TUI_LAYOUT_MEDIUM_WIDTH + 3)} ║`);
      }
    } else {
      lines.push("║  (No logs available)                                          ║");
    }

    if (this.state.errorContent.length > 0) {
      lines.push("╠═══════════════════════════════════════════════════════════════╣");
      lines.push("║                       ERRORS                                  ║");
      lines.push("╠═══════════════════════════════════════════════════════════════╣");
      for (const error of this.state.errorContent.slice(-5)) {
        const truncated = error.length > TUI_LAYOUT_MEDIUM_WIDTH + 1
          ? error.substring(0, TUI_LAYOUT_MEDIUM_WIDTH - 2) + "..."
          : error;
        lines.push(`║ ⚠️ ${truncated.padEnd(TUI_LAYOUT_MEDIUM_WIDTH)} ║`);
      }
    }

    lines.push("╚═══════════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push("[ESC] Close logs");
    return lines;
  }

  renderConfig(): string[] {
    const lines: string[] = [];
    lines.push("╔═══════════════════════════════════════════════════════════════╗");
    lines.push("║                    DAEMON CONFIGURATION                       ║");
    lines.push("╠═══════════════════════════════════════════════════════════════╣");
    lines.push("║  Config File: exo.config.toml                                 ║");
    lines.push("║                                                               ║");
    lines.push("║  (Configuration viewer coming soon)                           ║");
    lines.push("║                                                               ║");
    lines.push("╚═══════════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push("[ESC] Close config");
    return lines;
  }

  renderHelp(): string[] {
    return renderHelpScreen({
      title: "Daemon Control Help",
      sections: this.getHelpSections(),
      useColors: this.useColors,
    });
  }

  // ===== Focusable Elements =====

  getFocusableElements(): string[] {
    if (this.state.activeDialog) {
      return this.state.activeDialog.getFocusableElements();
    }
    if (this.state.showLogs || this.state.showConfig || this.state.showHelp) {
      return ["close-button"];
    }
    return ["start-button", "stop-button", "restart-button", "logs-button", "refresh-button"];
  }

  // ===== Lifecycle =====

  override dispose(): void {
    this.stopDaemonAutoRefresh();
    super.dispose();
  }
}

// ===== Legacy Support =====

/**
 * Legacy TUI session for backwards compatibility
 * @deprecated Use DaemonControlTuiSession instead
 */
export class LegacyDaemonControlTuiSession extends TuiSessionBase {
  private readonly daemonView: DaemonControlView;
  private status = "unknown";

  constructor(daemonView: DaemonControlView, useColors = true) {
    super(useColors);
    this.daemonView = daemonView;
  }

  async initialize(): Promise<void> {
    this.status = await this.daemonView.getStatus();
  }

  getStatus(): string {
    return this.status;
  }

  getFocusableElements(): string[] {
    return ["start", "stop", "restart", "logs", "status"];
  }
}
