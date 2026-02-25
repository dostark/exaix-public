import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ConfigService } from "../src/config/service.ts";
import { FileWatcher } from "../src/services/watcher.ts";
import { ExoPathDefaults } from "../src/config/constants.ts";
import type { ConfigReloadLogger } from "../src/config/config_reload_handler.ts";
import { createConfigReloadHandler } from "../src/config/config_reload_handler.ts";
import { LogLevel } from "../src/enums.ts";

/**
 * Test for "Investigate why exoctl portal add not showing in daemon logs"
 * Verifies that modifying exo.config.toml triggers a config reload and log event.
 */
Deno.test("Daemon: Config Reloading on File Change", async () => {
  // 1. Setup Temp Environment
  const tempDir = await Deno.makeTempDir({ prefix: "daemon-config-reload-" });
  const configPath = join(tempDir, "exo.config.toml");

  // Write initial config
  const initialConfig = `
[system]
version = "1.0.0"
log_level = "info"

[paths]
workspace = "${ExoPathDefaults.workspace}"
portals = "${ExoPathDefaults.portals}"
# ... minimal required paths
runtime = "${ExoPathDefaults.runtime}"
memory = "${ExoPathDefaults.memory}"
blueprints = "${ExoPathDefaults.blueprints}"
active = "${ExoPathDefaults.active}"
requests = "${ExoPathDefaults.requests}"
archive = "${ExoPathDefaults.archive}"
plans = "${ExoPathDefaults.plans}"
rejected = "${ExoPathDefaults.rejected}"
agents = "${ExoPathDefaults.agents}"
flows = "${ExoPathDefaults.flows}"
memoryProjects = "${ExoPathDefaults.memoryProjects}"
memoryExecution = "${ExoPathDefaults.memoryExecution}"
memoryIndex = "${ExoPathDefaults.memoryIndex}"
memorySkills = "${ExoPathDefaults.memorySkills}"
memoryPending = "${ExoPathDefaults.memoryPending}"
memoryTasks = "${ExoPathDefaults.memoryTasks}"
memoryGlobal = "${ExoPathDefaults.memoryGlobal}"

[watcher]
debounce_ms = 50
stability_check = false
`;
  await Deno.writeTextFile(configPath, initialConfig.trim());

  // 2. Initialize Services
  const configService = new ConfigService(configPath);
  const config = configService.get();

  // Mock Logger to capture events
  interface IStructuredLogEntry {
    level: LogLevel;
    action: string;
    target: string;
    payload: any;
  }
  const logs: IStructuredLogEntry[] = [];
  const logger: ConfigReloadLogger = {
    info: (action: string, target: string, payload: any) => {
      logs.push({ level: LogLevel.INFO, action, target, payload });
      return Promise.resolve();
    },
  };

  // 3. Setup Config Watcher (shared handler used by main.ts)
  const configWatcher = new FileWatcher(
    config,
    createConfigReloadHandler(configService, logger),
    {
      customWatchPath: tempDir, // Watch the temp root
      extensions: [".toml"],
    },
  );

  const watcherPromise = configWatcher.start();

  try {
    // Wait for watcher initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 4. Simulate exoctl portal add (Modify config file)
    const updatedConfig = initialConfig +
      `\n[[portals]]\nalias = "test-portal"\ntarget_path = "/tmp/test"\ncreated = "2024-01-01"\n`;
    await Deno.writeTextFile(configPath, updatedConfig);

    // 5. Wait for watcher to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 6. Assertions

    // Assert configService has new state
    const currentConfig = configService.get();
    assertEquals(currentConfig.portals?.length, 1, "ConfigService should have reloaded portals");
    assertEquals(currentConfig.portals?.[0].alias, "test-portal");

    // Assert Log Event captured
    const updateLog = logs.find((l) => l.action === "config.updated");
    assert(updateLog, "Should have logged config.updated event");
    assertEquals(updateLog.target, "exo.config.toml");
    // Type-safe access for portals_count
    if (typeof updateLog.payload === "object" && updateLog.payload !== null && "portals_count" in updateLog.payload) {
      assertEquals((updateLog.payload as { portals_count: number }).portals_count, 1);
    } else {
      throw new Error("updateLog.payload missing portals_count");
    }

    console.log("Config reload verification passed!");
  } finally {
    await configWatcher.stop();
    await watcherPromise;
    await Deno.remove(tempDir, { recursive: true });
  }
});
