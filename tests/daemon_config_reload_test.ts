import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ConfigService } from "../src/config/service.ts";
import { FileWatcher } from "../src/services/watcher.ts";
import { ExoPathDefaults } from "../src/config/constants.ts";

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
  const logs: any[] = [];
  const logger = {
    info: (action: string, target: string, payload: any) => {
      logs.push({ level: "info", action, target, payload });
      return Promise.resolve();
    },
    log: () => Promise.resolve(), // stub
  };

  // 3. Setup Config Watcher (Mimic main.ts logic)
  const configWatcher = new FileWatcher(
    config,
    async (event) => {
      console.log("Watcher event:", event.path);
      if (!event.path.endsWith("exo.config.toml")) {
        return;
      }

      const oldChecksum = configService.getChecksum();
      const newConfig = configService.reload();
      const newChecksum = configService.getChecksum();

      if (oldChecksum !== newChecksum) {
        // Use our mock logger
        await logger.info("config.updated", "exo.config.toml", {
          old_checksum: oldChecksum.slice(0, 8),
          new_checksum: newChecksum.slice(0, 8),
          portals_count: newConfig.portals?.length || 0,
        });
      }
    },
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
    assertEquals(updateLog.payload.portals_count, 1);

    console.log("Config reload verification passed!");
  } finally {
    await configWatcher.stop();
    await watcherPromise;
    await Deno.remove(tempDir, { recursive: true });
  }
});
