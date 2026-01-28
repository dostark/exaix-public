import { DatabaseService } from "./src/services/db.ts";
import { ChangesetRegistry } from "./src/services/changeset_registry.ts";
import { EventLogger } from "./src/services/event_logger.ts";
import { ConfigService } from "./src/config/service.ts";

async function main() {
  const configService = new ConfigService();
  const config = configService.get();

  // Initialize DB
  const db = new DatabaseService(config);

  // Mock Logger
  const logger = new EventLogger({ db, defaultActor: "system" });

  const registry = new ChangesetRegistry(db, logger);

  const traceId = crypto.randomUUID();
  const requestId = "test-request-" + traceId.slice(0, 8);

  console.log("Registering test changeset...");
  try {
    const id = await registry.register({
      trace_id: traceId,
      portal: "TestApp",
      branch: "feat/" + requestId,
      description: "Test changeset",
      commit_sha: "0000000000000000000000000000000000000000",
      files_changed: 1,
      created_by: "tester",
    });

    console.log(`Changeset created with ID: ${id}`);

    console.log("Listing changesets...");
    const list = registry.list();
    console.log(`Found ${list.length} changesets.`);
    const found = list.find((c) => c.id === id);

    if (found) {
      console.log("✅ Successfully verified changeset persistence.");
      console.log(found);
    } else {
      console.error("❌ Changeset not found in list!");
    }

    // Cleanup
    registry.delete(id);
    console.log("Cleanup complete.");
  } catch (error) {
    console.error("❌ Failed:", error);
  }
}

if (import.meta.main) {
  main();
}
