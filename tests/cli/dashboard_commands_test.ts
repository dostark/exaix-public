import { assertEquals } from "@std/assert";
import { DashboardCommands } from "../../src/cli/commands/dashboard_commands.ts";
import { createCliTestContext } from "./helpers/test_setup.ts";

Deno.test("DashboardCommands.show delegates to dashboard launcher", async () => {
  const { config, db, cleanup } = await createCliTestContext();
  try {
    const calls: unknown[] = [];

    const commands = DashboardCommands.create(
      { config, db },
      {
        launchDashboard: (options) => {
          calls.push(options);
          return Promise.resolve(undefined);
        },
      },
    );

    await commands.show();

    assertEquals(calls.length, 1);
    assertEquals(calls[0], { databaseService: db });
  } finally {
    await cleanup();
  }
});
