/**
 * @module CLIInit
 * @path src/cli/init.ts
 * @description Handles CLI service initialization, including configuration loading, database connection, and model provider setup, with specific handling for test modes.
 * @architectural-layer CLI
 * @dependencies [config_service, git_service, event_logger, provider_factory, constants, config_schema, db_schema, ai_types]
 * @related-files [src/cli/main.ts, src/cli/exoctl.ts]
 */

import { ConfigService } from "../config/service.ts";
import { GitService } from "../services/git_service.ts";
import { EventLogger } from "../services/event_logger.ts";
import { ProviderFactory } from "../ai/provider_factory.ts";
import { ExoPathDefaults } from "../config/constants.ts";
import type { Config } from "../config/schema.ts";
import { DatabaseService } from "../services/db.ts";
import type { IModelProvider } from "../ai/types.ts";

export interface ServiceContext {
  config: Config;
  db: DatabaseService;
  gitService: GitService;
  provider: IModelProvider;
  display: EventLogger;
  configService?: ConfigService;
  success: boolean;
  error?: string;
}

interface DatabaseLike {
  logActivity: (...args: unknown[]) => void;
  waitForFlush: () => Promise<void>;
  queryActivity: () => Promise<unknown[]>;
  close?: () => Promise<void>;
}

// Helper to create DatabaseService-compatible stub
function createDatabaseStub(): DatabaseService {
  const stub: DatabaseLike = {
    logActivity: () => {},
    waitForFlush: async () => {},
    queryActivity: () => Promise.resolve([]),
    close: async () => {},
  };
  return stub as unknown as DatabaseService;
}

// Helper to create GitService-compatible stub
function createGitServiceStub(): GitService {
  return {
    getStatus: () => Promise.resolve({ status: "unknown" }),
  } as unknown as GitService;
}

// Helper to create IModelProvider-compatible stub
function createProviderStub(): IModelProvider {
  return {
    generate: () => Promise.resolve({ text: "", usage: { total_tokens: 0 } }),
    countTokens: () => Promise.resolve(0),
  } as unknown as IModelProvider;
}

// Allow tests to run the CLI entrypoint without initializing heavy services
export function isTestMode(): boolean {
  return Deno.env.get("EXO_TEST_MODE") === "1" || Deno.args.includes("--test");
}

// Test helper: initialize the heavy services path (same logic used in non-test runtime)
// Returns an object describing whether initialization succeeded and the constructed services.
export async function initializeServices(
  opts?: { simulateFail?: boolean; instantiateDb?: boolean; configPath?: string },
): Promise<ServiceContext> {
  try {
    if (opts?.simulateFail) throw new Error("simulate-failure");
    let configPath = opts?.configPath;
    if (!configPath && isTestMode()) {
      // In test mode, use a temp directory to avoid polluting the root
      const tempDir = await Deno.makeTempDir({ prefix: "exoctl-test-" });
      configPath = `${tempDir}/exo.config.toml`;
    }
    const cfgService = new ConfigService(configPath);
    const cfg = cfgService.get();

    // Dynamically import DatabaseService as the runtime code does
    // Only import and instantiate DatabaseService if explicitly requested by caller.
    // Importing the DB module may load native dynamic libraries during module initialization,
    // which unit tests need to avoid unless they're prepared to close them.
    let dbLocal: DatabaseService;
    if (opts?.instantiateDb) {
      dbLocal = new DatabaseService(cfg);
      // Close DB if it exposes a close method to avoid leaking dynamic libraries during tests
      // Use intersection type to safely access optional close method
      type DbWithOptionalClose = DatabaseService & { close?: () => Promise<void> };
      const dbWithClose = dbLocal as DbWithOptionalClose;
      if (typeof dbWithClose.close === "function") {
        try {
          await dbWithClose.close();
        } catch {
          // ignore close errors in test helper
        }
      }
    } else if (!isTestMode()) {
      dbLocal = new DatabaseService(cfg);
    } else {
      // Stub db with no-op methods to prevent crashes
      dbLocal = createDatabaseStub();
    }

    const gitLocal = new GitService({ config: cfg, db: dbLocal });
    // For provider, ensure we have a valid model name or fallback
    const model = cfg.agents?.default_model || "mock:test";
    const providerLocal = await ProviderFactory.createByName(cfg, model);
    const displayLocal = new EventLogger({});

    return {
      success: true,
      config: cfg,
      db: dbLocal,
      gitService: gitLocal,
      provider: providerLocal,
      display: displayLocal,
      configService: cfgService,
    };
  } catch (err) {
    // Fallback minimal stubs (same as runtime fallback)
    const cfg = {
      system: { root: Deno.cwd() },
      paths: { ...ExoPathDefaults },
      agents: { default_model: "mock:test" },
    } as Config;

    // Attempt to create provider even in fallback, or stub
    let providerLocal: IModelProvider;
    try {
      providerLocal = await ProviderFactory.createByName(cfg, cfg.agents.default_model);
    } catch {
      // Create minimal provider stub
      providerLocal = createProviderStub();
    }

    const displayLocal = new EventLogger({});
    displayLocal.warn("cli.config_missing", "system", {
      message: "Configuration failed to load. Running in degraded mode (read-only/stub).",
      hint: "Ensure 'exo.config.toml' exists in current directory or root.",
    });

    return {
      success: false,
      error: String(err),
      config: cfg,
      // Stub db with no-op methods to prevent EventLogger crashes
      db: createDatabaseStub(),
      gitService: createGitServiceStub(),
      provider: providerLocal,
      display: displayLocal,
    };
  }
}
