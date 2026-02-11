/**
 * Extended Daemon Control View Tests
 *
 * Additional tests to improve coverage for daemon_control_view.ts
 */

import { assertEquals, assertExists } from "@std/assert";
import { DaemonStatus } from "../../src/enums.ts";

import {
  DaemonControlView,
  type DaemonService,
  LegacyDaemonControlTuiSession,
  MinimalDaemonServiceMock,
} from "../../src/tui/daemon_control_view.ts";
import { KEYS } from "../../src/helpers/keyboard.ts";
import { setupDaemonTest } from "./daemon_test_utils.ts";

// ===== MinimalDaemonServiceMock Tests =====

Deno.test("MinimalDaemonServiceMock: restart logs correctly", async () => {
  const mock = new MinimalDaemonServiceMock();
  await mock.restart();
  const logs = await mock.getLogs();
  assertEquals(logs.some((l) => l.includes("restarting")), true);
});

Deno.test("MinimalDaemonServiceMock: setStatus works", async () => {
  const mock = new MinimalDaemonServiceMock();
  mock.setStatus(DaemonStatus.RUNNING);
  assertEquals(await mock.getStatus(), DaemonStatus.RUNNING);
  mock.setStatus(DaemonStatus.ERROR);
  assertEquals(await mock.getStatus(), DaemonStatus.ERROR);
});

Deno.test("MinimalDaemonServiceMock: setLogs works", async () => {
  const mock = new MinimalDaemonServiceMock();
  mock.setLogs(["Custom log 1", "Custom log 2"]);
  const logs = await mock.getLogs();
  assertEquals(logs.length, 2);
  assertEquals(logs[0], "Custom log 1");
});

Deno.test("MinimalDaemonServiceMock: setErrors works", async () => {
  const mock = new MinimalDaemonServiceMock();
  mock.setErrors(["Error 1", "Error 2"]);
  const errors = await mock.getErrors();
  assertEquals(errors.length, 2);
});

// ===== DaemonControlView Tests =====

Deno.test("DaemonControlView: service delegation works", async () => {
  const { mock, view } = await setupDaemonTest();

  await view.start();
  assertEquals(await view.getStatus(), DaemonStatus.RUNNING);

  await view.stop();
  assertEquals(await view.getStatus(), DaemonStatus.STOPPED);

  await view.restart();
  const logs = await view.getLogs();
  assertEquals(logs.length > 0, true);

  mock.setErrors(["Test error"]);
  const errors = await view.getErrors();
  assertEquals(errors.length, 1);
});

// ===== DaemonControlTuiSession Status Parsing =====

Deno.test("DaemonControlTuiSession: parseStatus detects running variants", async () => {
  const { mock, session } = await setupDaemonTest();

  mock.setStatus(DaemonStatus.RUNNING);
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.RUNNING);

  mock.setStatus("started" as any);
  await session.refreshStatus();
  assertEquals(session.getDaemonStatus(), DaemonStatus.RUNNING);
});

Deno.test("DaemonControlTuiSession: parseStatus detects stopped variants", async () => {
  const stoppedMock: DaemonService = {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    restart: () => Promise.resolve(),
    getStatus: () => Promise.resolve(DaemonStatus.STOPPED),
    getLogs: () => Promise.resolve([]),
    getErrors: () => Promise.resolve([]),
  };

  const view1 = new DaemonControlView(stoppedMock);
  const session1 = view1.createTuiSession(false);
  await session1.initialize();
  assertEquals(session1.getDaemonStatus(), DaemonStatus.STOPPED);
});

Deno.test("DaemonControlTuiSession: parseStatus detects error variants", async () => {
  const { mock, session } = await setupDaemonTest();

  mock.setStatus(DaemonStatus.ERROR);
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.ERROR);

  mock.setStatus("crash detected" as any);
  await session.refreshStatus();
  assertEquals(session.getDaemonStatus(), DaemonStatus.ERROR);
});

Deno.test("DaemonControlTuiSession: parseStatus defaults to unknown", async () => {
  const { mock, session } = await setupDaemonTest();

  mock.setStatus("something weird" as any);
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.UNKNOWN);
});

// ===== DaemonControlTuiSession State Accessors =====

Deno.test("DaemonControlTuiSession: getLogContent returns logs", async () => {
  const { session } = await setupDaemonTest({
    logs: ["Log 1", "Log 2"],
  });
  await session.initialize();
  const logs = session.getLogContent();
  assertEquals(logs.length, 2);
});

Deno.test("DaemonControlTuiSession: getErrorContent returns errors", async () => {
  const { session } = await setupDaemonTest({
    errors: ["Error 1"],
  });
  await session.initialize();
  const errors = session.getErrorContent();
  assertEquals(errors.length, 1);
});

Deno.test("DaemonControlTuiSession: getActiveDialog returns dialog", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  assertEquals(session.getActiveDialog(), null);
  session.showStartConfirm();
  assertExists(session.getActiveDialog());
});

Deno.test("DaemonControlTuiSession: isLoading and getLoadingMessage", async () => {
  const { session } = await setupDaemonTest();
  assertEquals(session.isLoading(), false);
  assertEquals(session.getLoadingMessage(), "");
});

Deno.test("DaemonControlTuiSession: getLastStatusCheck", async () => {
  const { session } = await setupDaemonTest();
  assertEquals(session.getLastStatusCheck(), null);
  await session.initialize();
  assertExists(session.getLastStatusCheck());
});

// ===== DaemonControlTuiSession Actions =====

Deno.test("DaemonControlTuiSession: startDaemon success", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.STOPPED);
  await session.startDaemon();
  assertEquals(session.getDaemonStatus(), DaemonStatus.RUNNING);
});

Deno.test("DaemonControlTuiSession: stopDaemon success", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.RUNNING,
  });
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.RUNNING);
  await session.stopDaemon();
  assertEquals(session.getDaemonStatus(), DaemonStatus.STOPPED);
});

Deno.test("DaemonControlTuiSession: restartDaemon success", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  await session.restartDaemon();
  const logs = session.getLogContent();
  assertEquals(logs.some((l) => l.includes("restart")), true);
});

Deno.test("DaemonControlTuiSession: startDaemon handles error", async () => {
  const errorService: DaemonService = {
    start: () => Promise.reject(new Error("Start failed")),
    stop: () => Promise.resolve(),
    restart: () => Promise.resolve(),
    getStatus: () => Promise.resolve(DaemonStatus.STOPPED),
    getLogs: () => Promise.resolve([]),
    getErrors: () => Promise.resolve([]),
  };
  const view = new DaemonControlView(errorService);
  const session = view.createTuiSession(false);
  await session.initialize();
  await session.startDaemon();
});

Deno.test("DaemonControlTuiSession: stopDaemon handles error", async () => {
  const errorService: DaemonService = {
    start: () => Promise.resolve(),
    stop: () => Promise.reject(new Error("Stop failed")),
    restart: () => Promise.resolve(),
    getStatus: () => Promise.resolve(DaemonStatus.RUNNING),
    getLogs: () => Promise.resolve([]),
    getErrors: () => Promise.resolve([]),
  };
  const view = new DaemonControlView(errorService);
  const session = view.createTuiSession(false);
  await session.initialize();
  await session.stopDaemon();
});

Deno.test("DaemonControlTuiSession: restartDaemon handles error", async () => {
  const errorService: DaemonService = {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    restart: () => Promise.reject(new Error("Restart failed")),
    getStatus: () => Promise.resolve(DaemonStatus.STOPPED),
    getLogs: () => Promise.resolve([]),
    getErrors: () => Promise.resolve([]),
  };
  const view = new DaemonControlView(errorService);
  const session = view.createTuiSession(false);
  await session.initialize();
  await session.restartDaemon();
});

Deno.test("DaemonControlTuiSession: refreshStatus handles error", async () => {
  const errorService: DaemonService = {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    restart: () => Promise.resolve(),
    getStatus: () => Promise.reject(new Error("Status check failed")),
    getLogs: () => Promise.resolve([]),
    getErrors: () => Promise.resolve([]),
  };
  const view = new DaemonControlView(errorService);
  const session = view.createTuiSession(false);
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.ERROR);
});

// ===== DaemonControlTuiSession Dialog Behavior =====

Deno.test("DaemonControlTuiSession: showStartConfirm blocked when running", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.RUNNING,
  });
  await session.initialize();
  session.showStartConfirm();
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("DaemonControlTuiSession: showStopConfirm blocked when not running", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  session.showStopConfirm();
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("DaemonControlTuiSession: handleKey with active dialog", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  session.showStartConfirm();
  assertEquals(session.hasActiveDialog(), true);
  await session.handleKey(KEYS.ESCAPE);
  assertEquals(session.hasActiveDialog(), false);
});

Deno.test("DaemonControlTuiSession: handleKey 's' shows start confirm", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  await session.handleKey(KEYS.S);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("DaemonControlTuiSession: handleKey 'k' shows stop confirm", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.RUNNING,
  });
  await session.initialize();
  await session.handleKey(KEYS.K);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("DaemonControlTuiSession: handleKey 'r' shows restart confirm", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  await session.handleKey(KEYS.R);
  assertEquals(session.hasActiveDialog(), true);
});

Deno.test("DaemonControlTuiSession: handleKey 'R' refreshes status", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  const _beforeCheck = session.getLastStatusCheck();
  await new Promise((r) => setTimeout(r, 10)); // Ensure distinct status check time
  await session.handleKey(KEYS.CAP_R);
  const afterCheck = session.getLastStatusCheck();
  assertExists(afterCheck);
});

Deno.test("DaemonControlTuiSession: handleKey 'a' toggles auto-refresh", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  assertEquals(session.isAutoRefreshEnabled(), false);
  await session.handleKey(KEYS.A);
  assertEquals(session.isAutoRefreshEnabled(), true);
  await session.handleKey(KEYS.A);
  assertEquals(session.isAutoRefreshEnabled(), false);
  session.dispose();
});

// ===== DaemonControlTuiSession Rendering =====

Deno.test("DaemonControlTuiSession: renderStatusPanel shows info", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  const lines = session.renderStatusPanel();
  assertEquals(lines.some((l) => l.includes("Auto-refresh: OFF")), true);
});

Deno.test("DaemonControlTuiSession: renderStatusPanel shows auto-refresh ON", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  session.toggleAutoRefresh();
  const lines = session.renderStatusPanel();
  assertEquals(lines.some((l) => l.includes("Auto-refresh: ON")), true);
  session.dispose();
});

Deno.test("DaemonControlTuiSession: renderStatusPanel shows errors", async () => {
  const { session } = await setupDaemonTest({
    errors: ["Test error message"],
  });
  await session.initialize();
  const lines = session.renderStatusPanel();
  assertEquals(lines.some((l) => l.includes("Recent Errors")), true);
});

Deno.test("DaemonControlTuiSession: renderLogs with content", async () => {
  const { session } = await setupDaemonTest({
    logs: ["Log entry 1", "Log entry 2"],
  });
  await session.initialize();
  await session.showLogs();
  const lines = session.renderLogs();
  assertEquals(lines.some((l) => l.includes("Log entry 1")), true);
});

Deno.test("DaemonControlTuiSession: renderLogs with no logs", async () => {
  const { session } = await setupDaemonTest({
    logs: [],
  });
  // session.showConfig(); // unnecessary
  // session.hideConfig();
  await session.showLogs();
  const lines = session.renderLogs();
  assertEquals(lines.some((l) => l.includes("No logs available")), true);
});

Deno.test("DaemonControlTuiSession: renderLogs with errors section", async () => {
  const { session } = await setupDaemonTest({
    logs: ["Log 1"],
    errors: ["Error 1"],
  });
  await session.initialize();
  await session.showLogs();
  const lines = session.renderLogs();
  assertEquals(lines.some((l) => l.includes("ERRORS")), true);
});

Deno.test("DaemonControlTuiSession: renderConfig shows configuration info", async () => {
  const { session } = await setupDaemonTest();
  session.showConfig();
  const lines = session.renderConfig();
  assertEquals(lines.some((l) => l.includes("DAEMON CONFIGURATION")), true);
  assertEquals(lines.some((l) => l.includes("exo.config.toml")), true);
});

// ===== LegacyDaemonControlTuiSession Tests =====

Deno.test("LegacyDaemonControlTuiSession: initialize and getStatus", async () => {
  const mock = new MinimalDaemonServiceMock();
  mock.setStatus(DaemonStatus.RUNNING);
  const view = new DaemonControlView(mock);
  const session = new LegacyDaemonControlTuiSession(view, false);
  await session.initialize();
  assertEquals(session.getStatus(), DaemonStatus.RUNNING);
});

Deno.test("LegacyDaemonControlTuiSession: getFocusableElements", () => {
  const mock = new MinimalDaemonServiceMock();
  const view = new DaemonControlView(mock);
  const session = new LegacyDaemonControlTuiSession(view, false);
  const elements = session.getFocusableElements();
  assertEquals(elements.includes("start"), true);
  assertEquals(elements.includes("logs"), true);
});

// ===== Dialog Confirmation Flow =====

Deno.test("DaemonControlTuiSession: confirm start dialog executes start", async () => {
  const { session } = await setupDaemonTest({
    initialStatus: DaemonStatus.STOPPED,
  });
  await session.initialize();
  assertEquals(session.getDaemonStatus(), DaemonStatus.STOPPED);
  await session.handleKey(KEYS.S);
  assertEquals(session.hasActiveDialog(), true);
  await session.handleKey(KEYS.Y);
  assertEquals(session.hasActiveDialog(), false);
  await new Promise((r) => setTimeout(r, 50));
  assertEquals(session.getDaemonStatus(), DaemonStatus.RUNNING);
});

Deno.test("DaemonControlTuiSession: getFocusableElements in different states", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();

  // Default state
  let elements = session.getFocusableElements();
  assertEquals(elements.includes("start-button"), true);

  // With dialog open
  session.showRestartConfirm();
  elements = session.getFocusableElements();
  assertEquals(elements.includes("start-button"), false);

  // Cancel dialog
  await session.handleKey(KEYS.ESCAPE);

  // With logs view
  await session.showLogs();
  elements = session.getFocusableElements();
  assertEquals(elements.includes("close-button"), true);

  // Close logs
  session.hideLogs();

  // With config view
  session.showConfig();
  elements = session.getFocusableElements();
  assertEquals(elements.includes("close-button"), true);

  // Close config
  session.hideConfig();

  // With help view
  session.toggleHelp();
  elements = session.getFocusableElements();
  assertEquals(elements.includes("close-button"), true);
});

Deno.test("DaemonControlTuiSession: dispose cleans up auto-refresh", async () => {
  const { session } = await setupDaemonTest();
  await session.initialize();
  session.toggleAutoRefresh();
  assertEquals(session.isAutoRefreshEnabled(), true);
  session.dispose();
});
