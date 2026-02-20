import { assertEquals, assertExists } from "@std/assert";
import { makePane, testProdRender } from "../renderer_test_utils.ts";
import { Pane } from "../../../src/tui/tui_dashboard.ts";

Deno.test("prodRender: falls back to 80x24 when consoleSize throws", async () => {
  const originalConsoleSize = (Deno as Partial<{ consoleSize: () => { columns: number; rows: number } }> as {
    consoleSize: () => { columns: number; rows: number };
  }).consoleSize;
  (Deno as Partial<{ consoleSize: () => { columns: number; rows: number } }> as {
    consoleSize: () => { columns: number; rows: number };
  }).consoleSize = () => {
    throw new Error("no tty");
  };

  try {
    const panes: Pane[] = [
      makePane("main", "AnyView", { flexX: 0.5, flexY: 0.25, flexWidth: 0.5, flexHeight: 0.5 }),
    ];

    const { captured } = await testProdRender(panes);

    // header border implies we rendered something
    assertEquals(captured.clears, 1);
    assertExists(captured.logs.find((l) => l.includes("╔")));

    // Pane coords should be updated based on fallback size
    assertEquals(panes[0].width, Math.floor(0.5 * 80));
  } finally {
    (Deno as Partial<{ consoleSize: unknown }> as { consoleSize: unknown }).consoleSize = originalConsoleSize;
  }
});

Deno.test("prodRender: renders help overlay and returns early", async () => {
  const panes: Pane[] = [makePane("main", "AnyView")];
  const { captured } = await testProdRender(panes, { showHelp: true });

  assertExists(captured.logs.find((l) => l.includes("Press") || l.includes("close")));
});

Deno.test("prodRender: renders notification panel and writes close hint", async () => {
  const panes: Pane[] = [makePane("main", "AnyView")];
  const { captured, writes } = await testProdRender(panes, {
    showNotifications: true,
    notifications: [
      {
        id: "n1",
        type: "info",
        message: "hello",
        dismissed_at: null,
        created_at: new Date().toISOString(),
      },
    ],
  });

  // Panel lines are rendered via console.log; close hint via stdout.write.
  assertExists(
    captured.logs.find((l) => l.includes("Notifications") || l.includes("No notifications") || l.includes("🔔")),
  );
  assertEquals(writes.length > 0, true);
});

Deno.test("prodRender: PortalManagerView prints empty state", async () => {
  const panes: Pane[] = [makePane("main", "PortalManagerView")];
  const { captured } = await testProdRender(panes);

  assertExists(captured.logs.find((l) => l.includes("No portals configured.")));
});
