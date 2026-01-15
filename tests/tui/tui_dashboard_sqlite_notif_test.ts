import { assertEquals } from "@std/assert";
import { launchTuiDashboard } from "../../src/tui/tui_dashboard.ts";
import { NotificationService } from "../../src/services/notification.ts";
import { initTestDbService } from "../helpers/db.ts";
import { MemoryOperation, MemoryScope, MemoryStatus } from "../../src/enums.ts";

Deno.test("TUI Dashboard + SQLite: handles notification service integration", async () => {
  const { db, config, cleanup } = await initTestDbService();
  const notificationService = new NotificationService(config, db);

  try {
    const dashboard = await launchTuiDashboard({
      testMode: true,
      notificationService,
    }) as any;

    // Phase 1: Verify NotificationService is integrated
    // This will initially fail if launchTuiDashboard doesn't accept or store the service
    assertEquals(dashboard.notificationService, notificationService);

    // Phase 1: Verify in-memory notifications are gone
    assertEquals(dashboard.state.notifications, undefined);

    // Phase 1: Verify async rendering of notifications
    await notificationService.notifyMemoryUpdate({
      id: "prop-1",
      created_at: new Date().toISOString(),
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.PROJECT,
      learning: { title: "Test Learning" } as any,
      reason: "Testing",
      status: MemoryStatus.PENDING,
    });

    const notifLines = await dashboard.renderNotifications();
    const hasNotif = notifLines.some((l: string) => l.includes("Test Learning"));
    assertEquals(hasNotif, true);

    // Phase 1: Verify async status bar with count from DB
    const statusBar = await dashboard.renderStatusBar();
    assertEquals(statusBar.includes("🔔1"), true);

    // Phase 1: Verify async dismissal
    await dashboard.dismissNotification("prop-1");
    const countAfterDismiss = await notificationService.getPendingCount();
    assertEquals(countAfterDismiss, 0);

    const statusBarEmpty = await dashboard.renderStatusBar();
    assertEquals(statusBarEmpty.includes("🔔"), false);
  } finally {
    await cleanup();
  }
});
