/**
 * @module Daemon
 * @path src/main.ts
 * @description Entry point for the ExoFrame daemon. Orchestrates system startup, service initialization,
 * and component lifecycle management. Handles configuration loading, database connection,
 * and signal handling for graceful shutdown.
 * @architectural-layer Core System
 * @dependencies [ConfigService, DatabaseService, FileWatcher, RequestProcessor, ExecutionLoop, GracefulShutdown]
 * @related-files [src/services/execution_loop.ts, src/services/watcher.ts, src/cli/daemon_commands.ts]
 */
import { ConfigService } from "./config/service.ts";
import { DaemonStatus } from "./enums.ts";
import { FileWatcher } from "./services/watcher.ts";
import { DatabaseService } from "./services/db.ts";
import { ProviderFactory } from "./ai/provider_factory.ts";
import { RequestProcessor } from "./services/request_processor.ts";
import { ReviewRegistry } from "./services/review_registry.ts";
import { EventLogger } from "./services/event_logger.ts";
import { ExecutionLoop } from "./services/execution_loop.ts";
import { createConfigReloadHandler } from "./config/config_reload_handler.ts";
import {
  ConsoleOutput,
  FileOutput,
  getGlobalLogger,
  initializeGlobalLogger,
  logInfo,
  type LogOutput,
} from "./services/structured_logger.ts";
import { GracefulShutdown } from "./services/graceful_shutdown.ts";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";

if (import.meta.main) {
  // Simple argument handling for the compiled binary
  if (Deno.args.includes("--version") || Deno.args.includes("-v")) {
    console.log("ExoFrame Daemon v0.1.0");
    Deno.exit(0);
  }

  try {
    const configService = new ConfigService();
    const config = configService.get();
    const checksum = configService.getChecksum();

    // Initialize Database Service first (needed for EventLogger)
    const dbService = new DatabaseService(config);

    // Create main EventLogger with database connection
    const logger = new EventLogger({
      db: dbService,
      prefix: "",
      defaultActor: "system",
    });

    // Initialize StructuredLogger for audit and performance tracking
    const logsDir = join(config.system.root, "logs");
    const structuredLogsDir = join(logsDir, "structured");

    const structuredOutputs: LogOutput[] = [new FileOutput(structuredLogsDir)];

    // Add console output for debug level to help with development
    if (config.system.log_level === "debug") {
      structuredOutputs.unshift(new ConsoleOutput());
    }

    initializeGlobalLogger({
      minLevel: config.system.log_level as "debug" | "info" | "warn" | "error" | "fatal",
      outputs: structuredOutputs,
      enablePerformanceTracking: true,
      serviceName: "exoframe-daemon",
      version: config.system.version,
    });

    // Initialize GracefulShutdown service
    const gracefulShutdown = new GracefulShutdown(getGlobalLogger());

    await logger.log({
      action: "daemon.starting",
      target: "exoframe",
      payload: {
        config_checksum: checksum.slice(0, 8),
        root: config.system.root,
        log_level: config.system.log_level,
      },
      icon: "🚀",
    });

    // Log daemon startup as audit event
    logInfo("ExoFrame daemon starting", {
      audit_event: true,
      event_type: "daemon_startup",
      config_checksum: checksum.slice(0, 8),
      root: config.system.root,
      log_level: config.system.log_level,
      service: "exoframe-daemon",
      version: config.system.version,
    });

    await logger.info("config.loaded", "exo.config.toml", {
      checksum: checksum.slice(0, 8),
      root: config.system.root,
      log_level: config.system.log_level,
    });

    await logger.info("database.connected", "journal.db", { mode: "WAL" });

    // Initialize LLM Provider
    const defaultModelName = config.agents.default_model;
    const providerInfo = ProviderFactory.getProviderInfoByName(config, defaultModelName);
    const llmProvider = await ProviderFactory.createByName(config, defaultModelName);

    await logger.info("llm.provider.initialized", providerInfo.id, {
      type: providerInfo.type,
      model: providerInfo.model,
      source: providerInfo.source,
      named_model: defaultModelName,
    });

    // Ensure required directories exist
    const requestsPath = join(config.system.root, config.paths.workspace, "Requests");
    const plansPath = join(config.system.root, config.paths.workspace, "Plans");
    const activePath = join(config.system.root, config.paths.workspace, "Active");
    await ensureDir(requestsPath);
    await ensureDir(plansPath);
    await ensureDir(activePath);

    // Initialize Request Processor
    const requestProcessor = new RequestProcessor(
      config,
      dbService,
      {
        workspacePath: join(config.system.root, config.paths.workspace),
        requestsDir: join(config.system.root, config.paths.workspace, "Requests"),
        blueprintsPath: join(config.system.root, config.paths.blueprints, "Agents"),
        includeReasoning: true,
      },
      // Note: testProvider parameter removed - provider selection handled by ProviderSelector
    );

    await logger.info("request_processor.initialized", "RequestProcessor", {
      requestsDir: requestsPath,
      blueprints: join(config.system.root, config.paths.blueprints, "Agents"),
    });

    // Create child logger for watcher events
    const watcherLogger = logger.child({ actor: "system" });

    // Start file watcher for new requests (Workspace/Requests)
    const requestWatcher = new FileWatcher(config, async (event) => {
      await watcherLogger.info("file.detected", event.path, {
        size: event.content.length,
      });

      // Process the request and generate a plan
      try {
        const planPath = await requestProcessor.process(event.path);
        if (planPath) {
          watcherLogger.info("plan.generated", planPath, {
            source: event.path,
          });
        } else {
          watcherLogger.warn("request.skipped", event.path, {
            reason: "processing returned null",
          });
        }
      } catch (error) {
        watcherLogger.error("request.failed", event.path, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Initialize Review Registry
    const reviewRegistry = new ReviewRegistry(dbService, logger);

    const executionLoop = new ExecutionLoop({
      config,
      db: dbService,
      agentId: "daemon",
      llmProvider,
      reviewRegistry,
    });

    // Start file watcher for approved plans (Workspace/Active)
    // Detection for Step 5.12: Plan Execution Flow
    const planWatcher = new FileWatcher(
      config,
      async (event) => {
        // Only process plan files (_plan.md suffix)
        if (!event.path.includes("_plan.md")) {
          return;
        }

        watcherLogger.info("plan.detected", event.path, {
          size: event.content.length,
        });

        // Delegate execution to ExecutionLoop
        // It handles parsing, validation, execution, reporting, and lifecycle management (success/failure)
        const result = await executionLoop.processTask(event.path);

        if (result.success) {
          watcherLogger.info("plan.execution_managed", event.path, {
            trace_id: result.traceId,
            status: "completed",
          });
        } else {
          watcherLogger.error("plan.execution_managed_failure", event.path, {
            trace_id: result.traceId,
            error: result.error,
          });
        }
      },
      { customWatchPath: activePath }, // Custom watch path
    );

    // Dynamic Config Reloading (Task: Investigate missing portal logs)
    // Watch for changes to exo.config.toml to reload config and log changes
    const configWatcher = new FileWatcher(
      config,
      createConfigReloadHandler(configService, logger),
      {
        customWatchPath: config.system.root,
        extensions: [".toml"],
      },
    );

    // Register cleanup tasks for graceful shutdown
    gracefulShutdown.registerCleanup("stop_request_watcher", async () => {
      await requestWatcher.stop();
      await logger.info("shutdown.watchers_stopped", "request and plan watchers", {});
    });

    gracefulShutdown.registerCleanup("stop_plan_watcher", async () => {
      await planWatcher.stop();
    });

    gracefulShutdown.registerCleanup("stop_config_watcher", async () => {
      await configWatcher.stop();
    });

    gracefulShutdown.registerCleanup("close_database", async () => {
      dbService.close();
      await logger.info("shutdown.database_closed", "journal.db", {});
    });

    // Register signal handlers
    gracefulShutdown.registerSignalHandlers();

    // Register error handlers
    gracefulShutdown.registerErrorHandlers();

    await logger.log({
      action: "daemon.started",
      target: "exoframe",
      payload: {
        provider: providerInfo.id,
        model: providerInfo.model,
        watching_requests: requestsPath,
        watching_plans: activePath,
        status: DaemonStatus.RUNNING,
      },
      icon: "✅",
    });

    // Start watching directories
    await Promise.all([
      requestWatcher.start(),
      planWatcher.start(),
      configWatcher.start(),
    ]);
  } catch (error) {
    console.error("❌ Fatal Error:", error);
    Deno.exit(1);
  }
}
