import { DaemonStatus } from "../../src/enums.ts";
import { DaemonControlView, MinimalDaemonServiceMock } from "../../src/tui/daemon_control_view.ts";

export function setupDaemonTest(options: {
  autoRefresh?: boolean;
  initialStatus?: DaemonStatus;
  logs?: string[];
  errors?: string[];
} = {}) {
  // await Promise.resolve(); // Satisfy linter for async function if needed, but not strictly required
  const mock = new MinimalDaemonServiceMock();
  if (options.initialStatus) mock.setStatus(options.initialStatus);
  if (options.logs) mock.setLogs(options.logs);
  if (options.errors) mock.setErrors(options.errors);

  const view = new DaemonControlView(mock);
  const session = view.createTuiSession(options.autoRefresh ?? false);

  if (options.initialStatus) {
    // Logic from original test helper
  }

  return { mock, view, session };
}
