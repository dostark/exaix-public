import { assertEquals } from "@std/assert";
import { launchTuiDashboard } from "../../src/tui/tui_dashboard.ts";
import { NotificationService } from "../../src/services/notification.ts";
import { initTestDbService } from "../helpers/db.ts";
import { MemoryOperation, MemoryScope, MemoryStatus } from "../../src/enums.ts";
import { KEY_A, KEY_DOWN, KEY_M, KEY_R, KEY_UP } from "../../src/config/constants.ts";

Deno.test("TUI Dashboard + Memory: handles memory update notifications", async () => {
  const { db, config, cleanup } = await initTestDbService();
  const notificationService = new NotificationService(config, db);

  try {
    const dashboard = await launchTuiDashboard({
      testMode: true,
      notificationService,
    }) as any;

    // 1. Add some notifications (info and memory_update_pending)
    await notificationService.notify("Normal info", "info");
    await notificationService.notifyMemoryUpdate({
      id: "prop-1",
      created_at: new Date().toISOString(),
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.PROJECT,
      learning: { title: "Learning 1" } as any,
      reason: "Testing 1",
      status: MemoryStatus.PENDING,
    });
    await notificationService.notifyMemoryUpdate({
      id: "prop-2",
      created_at: new Date().toISOString(),
      agent: "test-agent",
      operation: MemoryOperation.ADD,
      target_scope: MemoryScope.PROJECT,
      learning: { title: "Learning 2" } as any,
      reason: "Testing 2",
      status: MemoryStatus.PENDING,
    });

    // 2. Toggle memory notification mode
    await dashboard.handleKey(KEY_M);
    assertEquals(dashboard.state.showMemoryNotifications, true);
    assertEquals(dashboard.state.selectedMemoryNotifIndex, 0);

    // 3. Verify renderNotificationPanel filters for memory notifications
    const memoryLines = await dashboard.renderNotifications();
    const hasLearning1 = memoryLines.some((l: string) => l.includes("Learning 1"));
    const hasLearning2 = memoryLines.some((l: string) => l.includes("Learning 2"));
    const hasNormalInfo = memoryLines.some((l: string) => l.includes("Normal info"));

    assertEquals(hasLearning1, true);
    assertEquals(hasLearning2, true);
    assertEquals(hasNormalInfo, false);

    // 4. Test navigation
    await dashboard.handleKey(KEY_DOWN);
    assertEquals(dashboard.state.selectedMemoryNotifIndex, 1);

    await dashboard.handleKey(KEY_UP);
    assertEquals(dashboard.state.selectedMemoryNotifIndex, 0);

    // 5. Test Approval (placeholder in test mode)
    await dashboard.handleKey(KEY_A);
    // In test mode it just notifies
    const allNotifs = await notificationService.getNotifications();
    const hasApprovalNotif = allNotifs.some((n) => n.message.includes(MemoryStatus.APPROVED) && n.type === "success");
    assertEquals(hasApprovalNotif, true);

    // 6. Test Rejection (placeholder in test mode)
    await dashboard.handleKey(KEY_R);
    const allNotifsAfter = await notificationService.getNotifications();
    const hasRejNotif = allNotifsAfter.some((n) => n.message.includes(MemoryStatus.REJECTED) && n.type === "error");
    assertEquals(hasRejNotif, true);

    // 7. Toggle off
    await dashboard.handleKey(KEY_M);
    assertEquals(dashboard.state.showMemoryNotifications, false);
  } finally {
    await cleanup();
  }
});
