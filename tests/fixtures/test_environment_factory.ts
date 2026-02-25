import type { Config } from "../../src/config/schema.ts";
import { MemoryCommands } from "../../src/cli/commands/memory_commands.ts";
import { MemoryBankService } from "../../src/services/memory_bank.ts";
import { MemoryExtractorService } from "../../src/services/memory_extractor.ts";
import { DatabaseService as DatabaseService } from "../../src/services/db.ts";
import { initTestDbService } from "../helpers/db.ts";
import {
  getMemoryExecutionDir,
  getMemoryGlobalDir,
  getMemoryIndexDir,
  getMemoryPendingDir,
  getMemoryProjectsDir,
  getMemorySkillsDir,
  getMemoryTasksDir,
} from "../helpers/paths_helper.ts";

export interface IMemoryTestEnvironment {
  tempRoot: string;
  config: Config;
  db: DatabaseService;
  commands: MemoryCommands;
  memoryBank: MemoryBankService;
  extractor: MemoryExtractorService;
  cleanup: () => Promise<void>;
}

export interface EnvironmentOptions {
  prefix?: string;
  withExtractor?: boolean;
}

/**
 * Factory for creating standardized test environments
 */
export class TestEnvironmentFactory {
  /**
   * Creates a complete memory test environment with all required services and directories
   */
  public static async createMemoryEnvironment(_options: EnvironmentOptions = {}): Promise<IMemoryTestEnvironment> {
    // Initialize DB and base environment
    const { db, cleanup: dbCleanup, tempDir, config: baseConfig } = await initTestDbService();

    // We already have a tempDir from initTestDbService, but if the caller implies
    // a specific prefix semantic that initTestDbService (exo-test-) doesn't match,
    // we might want to respect it. However, initTestDbService does a lot of heavy lifting.
    // For simplicity and reusing existing helpers, we'll stick with what initTestDbService provides
    // but we can potentially rename or move it if strictly needed.
    // For now, let's use the provided tempDir.

    // Verify directory structure exists (initTestDbService creates .exo)
    // We need to ensure Memory directories exist as per tests
    await Deno.mkdir(getMemoryProjectsDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemoryExecutionDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemoryIndexDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemoryGlobalDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemoryPendingDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemorySkillsDir(tempDir), { recursive: true });
    await Deno.mkdir(getMemoryTasksDir(tempDir), { recursive: true });

    // Re-create config if we need specific overrides, but baseConfig should be fine for most.
    // Use the config returned by initTestDbService
    const config = baseConfig;

    const memoryBank = new MemoryBankService(config, db);
    const commands = new MemoryCommands({ config, db });

    // Extractor is optional but often needed
    const extractor = new MemoryExtractorService(config, db, memoryBank);

    const cleanup = async () => {
      await dbCleanup();
      // initTestDbService's cleanup handles dir removal
    };

    return {
      tempRoot: tempDir,
      config,
      db,
      commands,
      memoryBank,
      extractor,
      cleanup,
    };
  }
}
