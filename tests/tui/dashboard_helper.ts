import { launchTuiDashboard } from "../../src/tui/tui_dashboard.ts";
import { NotificationService } from "../../src/services/notification.ts";
import { initTestDbService } from "../helpers/db.ts";

/**
 * Creates a TUI dashboard with a real NotificationService backed by an ephemeral test DB.
 */
export async function createTuiDashboardWithNotification(testProps: any = {}) {
  const { db, config, cleanup } = await initTestDbService();
  const notificationService = new NotificationService(config, db);

  const dashboard = await launchTuiDashboard({
    testMode: true,
    notificationService,
    ...testProps,
  }) as any;

  return { dashboard, notificationService, db, cleanup };
}
