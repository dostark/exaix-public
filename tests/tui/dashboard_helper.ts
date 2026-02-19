import { launchTuiDashboard } from "../../src/tui/tui_dashboard.ts";
import { NotificationService } from "../../src/services/notification.ts";
import { initTestDbService } from "../helpers/db.ts";

import type { TuiDashboard } from "../../src/tui/tui_dashboard.ts";
import type { IDatabaseService } from "../../src/services/db.ts";

interface TestDashboardProps {
  nonInteractive?: boolean;
  databaseService?: IDatabaseService;
  [key: string]: unknown; // Allow other properties but stay safe
}

/**
 * Creates a TUI dashboard with a real NotificationService backed by an ephemeral test DB.
 */
export async function createTuiDashboardWithNotification(testProps: TestDashboardProps = {}) {
  const { db, config, cleanup } = await initTestDbService();
  const notificationService = new NotificationService(config, db);

  const dashboard = await launchTuiDashboard({
    testMode: true,
    notificationService,
    ...testProps,
  }) as TuiDashboard;

  return { dashboard, notificationService, db, cleanup };
}
