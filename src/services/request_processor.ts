/**
 * RequestProcessor - Processes request files and generates plans
 * Implements Step 5.9 of the ExoFrame Implementation Plan
 * Integrates with RequestRouter for flow-aware request processing (Step 7.6)
 */

import { basename, dirname, join } from "@std/path";
import type { IModelProvider } from "../ai/providers.ts";
import type { DatabaseService } from "./db.ts";
import type { Config } from "../config/schema.ts";
import { AgentRunner, type Blueprint, type ParsedRequest } from "./agent_runner.ts";
import { buildParsedRequest } from "./request_common.ts";
import { BlueprintLoader } from "./blueprint_loader.ts";
import { PlanWriter, type RequestMetadata } from "./plan_writer.ts";
import { PlanValidationError } from "./plan_adapter.ts";
import { TaskComplexity } from "../enums.ts";
import { RequestStatus } from "../requests/request_status.ts";
import { PlanStatus } from "../plans/plan_status.ts";
import { PORTAL_CONTEXT_KEY } from "../config/constants.ts";
import { buildPortalContextBlock } from "./prompt_context.ts";
import { EventLogger } from "./event_logger.ts";
import { FlowValidatorImpl } from "./flow_validator.ts";
import { ProviderFactory } from "../ai/provider_factory.ts";
import { ProviderSelector } from "../ai/provider_selector.ts";
import { ProviderRegistry } from "../ai/provider_registry.ts";
import { CostTracker } from "./cost_tracker.ts";
import { HealthCheckService } from "./health_check_service.ts";
import { CircuitBreaker, CircuitBreakerProvider } from "../ai/circuit_breaker.ts";
import { LogMethod } from "./decorators/logging.ts";
import { RequestParser } from "./request_processing/request_parser.ts";
import { StatusManager } from "./request_processing/status_manager.ts";
import type { RequestFrontmatter } from "./request_processing/types.ts";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RequestProcessorConfig {
  workspacePath: string;
  requestsDir: string;
  blueprintsPath: string;
  includeReasoning: boolean;
}

// ============================================================================
// RequestProcessor Implementation
// ============================================================================

export class RequestProcessor {
  private readonly planWriter: PlanWriter;
  private readonly plansDir: string;
  private readonly logger: EventLogger;
  private readonly flowValidator: FlowValidatorImpl;
  private readonly providerSelector: ProviderSelector;
  private readonly costTracker: CostTracker;
  private readonly ioBreaker: CircuitBreaker;
  private readonly requestParser: RequestParser;
  private readonly statusManager: StatusManager;

  constructor(
    private readonly config: Config,
    private readonly db: DatabaseService,
    private readonly processorConfig: RequestProcessorConfig,
    private readonly testProvider?: IModelProvider,
    costTracker?: CostTracker,
  ) {
    // Initialize services
    this.costTracker = costTracker ?? new CostTracker(db, config);
    const healthChecker = new HealthCheckService("1.0.0", config);
    this.providerSelector = new ProviderSelector(
      ProviderRegistry,
      this.costTracker,
      healthChecker,
    );

    this.logger = new EventLogger({
      db,
      defaultActor: "agent:request-processor",
    });

    this.plansDir = join(config.system.root, config.paths.workspace, "Plans");
    this.planWriter = new PlanWriter({
      plansDirectory: this.plansDir,
      includeReasoning: processorConfig.includeReasoning,
      generateWikiLinks: true,
      runtimeRoot: join(config.system.root, config.paths.runtime),
      db,
    });

    this.flowValidator = null as any; // Temporary for testing

    this.ioBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 60_000,
      halfOpenSuccessThreshold: 2,
    });

    // Initialize extracted components
    this.requestParser = new RequestParser(this.logger);
    this.statusManager = new StatusManager(this.logger);
  }

  @LogMethod(new EventLogger({ prefix: "[RequestProcessor]" }), "request.process")
  async process(filePath: string): Promise<string | null> {
    const parsed = await this.requestParser.parse(filePath);
    if (!parsed) {
      return null;
    }

    const { frontmatter, body } = parsed;
    const traceId = frontmatter.trace_id;
    const requestId = basename(filePath, ".md");
    const traceLogger = this.logger.child({ traceId });

    traceLogger.info("request.processing", filePath, {
      flow: frontmatter.flow,
      agent: frontmatter.agent,
      priority: frontmatter.priority,
    });

    if (this.shouldSkipRequest(frontmatter, traceLogger, filePath)) {
      traceLogger.info("request.skipped", filePath, {
        reason: `Request already has status '${frontmatter.status}'`,
      });
      return null;
    }

    const requestKind = await this.getRequestKindOrFail({
      frontmatter,
      filePath,
      traceLogger,
    });
    if (!requestKind) {
      return null;
    }

    const pipeline = await this.createRequestProcessingPipeline();

    const context: any = {
      filePath,
      parsed,
      frontmatter,
      body,
      traceLogger,
      requestId,
      requestKind,
    };

    try {
      const planPath = await pipeline.execute<string | null>(context, () => {
        return this.processRequestByKind(
          requestKind,
          frontmatter,
          body,
          filePath,
          requestId,
          traceId,
          traceLogger,
        );
      });

      return planPath;
    } catch (error: unknown) {
      // Read the current content of the file before handling the error

      await this.handleError(error, filePath, requestId, traceLogger, frontmatter);
      return null;
    } finally {
      try {
        await this.costTracker.flush();
      } catch {
        // Ignore flush errors during processing
      }
    }
  }

  private shouldSkipRequest(frontmatter: RequestFrontmatter, _traceLogger: any, _filePath: string): boolean {
    switch (frontmatter.status) {
      case RequestStatus.PLANNED:
      case RequestStatus.COMPLETED:
      case RequestStatus.FAILED:
      case RequestStatus.CANCELLED:
        return true;
      default:
        return false;
    }
  }

  private async getRequestKindOrFail(args: {
    frontmatter: RequestFrontmatter;
    filePath: string;
    traceLogger: any;
  }): Promise<"flow" | "agent" | null> {
    const { frontmatter, filePath, traceLogger } = args;

    const hasFlow = !!frontmatter.flow;
    const hasAgent = !!frontmatter.agent;

    if (hasFlow && hasAgent) {
      traceLogger.error("request.invalid", filePath, {
        error: "Request cannot specify both 'flow' and 'agent' fields",
      });
      await this.statusManager.updateStatus(
        filePath,
        RequestStatus.FAILED,
        "Request cannot specify both 'flow' and 'agent' fields",
      );
      return null;
    }

    if (!hasAgent && !hasFlow) {
      traceLogger.error("request.invalid", filePath, {
        error: "Request must specify either 'flow' or 'agent' field",
      });
      await this.statusManager.updateStatus(
        filePath,
        RequestStatus.FAILED,
        "Request must specify either 'flow' or 'agent' field",
      );
      return null;
    }

    return hasFlow ? "flow" : "agent";
  }

  private async createRequestProcessingPipeline(): Promise<import("./middleware/pipeline.ts").MiddlewarePipeline<any>> {
    const { MiddlewarePipeline } = await import("./middleware/pipeline.ts");
    const pipeline = new MiddlewarePipeline<any>();

    pipeline.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        try {
          ctx.traceLogger?.error("request.processing.error", ctx.filePath, {
            error: err instanceof Error ? err.message : String(err),
          });
        } catch {
          // Ignore logging errors
        }
        throw err;
      }
    });

    pipeline.use(async (ctx, next) => {
      const start = (typeof performance !== "undefined") ? performance.now() : Date.now();
      await next();
      const duration = Math.round(((typeof performance !== "undefined") ? performance.now() : Date.now()) - start);
      try {
        ctx.traceLogger?.info("request.processing.duration", ctx.filePath, { duration_ms: duration });
      } catch {
        // Ignore logging errors
      }
    });

    return pipeline;
  }

  private processRequestByKind(
    kind: "flow" | "agent",
    frontmatter: RequestFrontmatter,
    body: string,
    filePath: string,
    requestId: string,
    traceId: string,
    traceLogger: any,
  ): Promise<string | null> {
    if (kind === "flow") {
      return this.processFlowRequest(frontmatter, filePath, requestId, traceId, traceLogger);
    }

    return this.processAgentRequest(frontmatter, body, filePath, requestId, traceId, traceLogger);
  }

  private async processFlowRequest(
    frontmatter: RequestFrontmatter,
    filePath: string,
    requestId: string,
    traceId: string,
    traceLogger: any,
  ): Promise<string | null> {
    if (this.flowValidator) {
      const validation = await this.flowValidator.validateFlow(frontmatter.flow!);
      if (!validation.valid) {
        traceLogger.error("flow.validation.failed", frontmatter.flow!, {
          error: validation.error,
        });
        await this.statusManager.updateStatus(
          filePath,
          RequestStatus.FAILED,
          `Flow validation failed: ${validation.error}`,
        );
        return null;
      }
    }

    const planContent = JSON.stringify({
      title: `Flow Execution: ${frontmatter.flow}`,
      description: `Execute the ${frontmatter.flow} flow`,
      steps: [{
        step: 1,
        title: "Execute Flow",
        description: `Execute the ${frontmatter.flow} flow with the provided request`,
        flow: frontmatter.flow,
      }],
    });

    const result = {
      thought: `Prepared flow ${frontmatter.flow} for execution`,
      content: planContent,
      raw: planContent,
    };

    const metadata: RequestMetadata = {
      requestId,
      traceId,
      createdAt: new Date(frontmatter.created),
      contextFiles: [],
      contextWarnings: [],
      model: frontmatter.model,
      portal: frontmatter.portal,
      targetBranch: frontmatter.target_branch,
    };

    return await this.writePlanAndReturnPath(result, metadata, filePath, traceLogger, {
      flow: frontmatter.flow,
    });
  }

  private async processAgentRequest(
    frontmatter: RequestFrontmatter,
    body: string,
    filePath: string,
    requestId: string,
    traceId: string,
    traceLogger: any,
  ): Promise<string | null> {
    const loadedBlueprint = await this.loadBlueprintWithFallback(frontmatter.agent!, traceLogger);

    if (!loadedBlueprint) {
      traceLogger.error("blueprint.not_found", frontmatter.agent!, {
        request: filePath,
      });
      await this.statusManager.updateStatus(
        filePath,
        RequestStatus.FAILED,
        `Blueprint not found: ${frontmatter.agent}`,
      );
      traceLogger.error("request.failed", filePath, {
        error: `Blueprint not found: ${frontmatter.agent}`,
      });
      return null;
    }

    const blueprintLoader = new BlueprintLoader({ blueprintsPath: this.processorConfig.blueprintsPath });
    const blueprint = blueprintLoader.toLegacyBlueprint(loadedBlueprint);

    const request: ParsedRequest = buildParsedRequest(body, frontmatter, requestId, traceId) as ParsedRequest;
    const portalContext = await this.buildPortalContext(frontmatter.portal, traceLogger);
    if (portalContext) {
      request.context[PORTAL_CONTEXT_KEY] = portalContext;
    }

    const taskComplexity = this.classifyTaskComplexity(blueprint, request);
    let selectedProvider: IModelProvider;

    if (this.testProvider) {
      selectedProvider = this.testProvider;
      traceLogger.info("provider.selected", "test-provider", {
        taskComplexity,
        trace_id: traceId,
      });
    } else {
      let selectedProviderName: string;
      try {
        selectedProviderName = await this.providerSelector.selectProviderForTask(
          this.config,
          taskComplexity,
        );
      } catch (selErr) {
        traceLogger.warn("provider.selection_failed", String(selErr), { fallback: "mock" });
        selectedProviderName = "mock";
      }

      const rawProvider = await ProviderFactory.createByName(
        this.config,
        selectedProviderName,
        this.db,
        traceLogger,
        this.costTracker,
      );
      selectedProvider = new CircuitBreakerProvider(rawProvider, {
        failureThreshold: 5,
        resetTimeout: 60_000,
        halfOpenSuccessThreshold: 2,
      });

      traceLogger.info("provider.selected", selectedProviderName, {
        taskComplexity,
        trace_id: traceId,
        provider_wrapped: selectedProvider.id,
      });
    }

    const agentRunner = new AgentRunner(selectedProvider, { db: this.db });
    const result = await agentRunner.run(blueprint, request);

    const metadata: RequestMetadata = {
      requestId,
      traceId,
      createdAt: new Date(frontmatter.created),
      contextFiles: [],
      contextWarnings: [],
      agentId: frontmatter.agent,
      model: frontmatter.model,
      portal: frontmatter.portal,
      targetBranch: frontmatter.target_branch,
    };

    return await this.writePlanAndReturnPath(result, metadata, filePath, traceLogger);
  }

  private async loadBlueprintWithFallback(agentId: string, traceLogger: any): Promise<any | null> {
    const blueprintLoader = new BlueprintLoader({ blueprintsPath: this.processorConfig.blueprintsPath });
    let loadedBlueprint = await blueprintLoader.load(agentId);

    if (!loadedBlueprint) {
      loadedBlueprint = await this.findBlueprintInWorktree(agentId, traceLogger);
    }
    if (!loadedBlueprint) {
      loadedBlueprint = await this.findBlueprintInRepoRoots(agentId, traceLogger);
    }
    return loadedBlueprint;
  }

  private async findBlueprintInWorktree(agentId: string, traceLogger: any): Promise<any | null> {
    let dir = Deno.cwd();
    while (true) {
      const candidatePath = join(dir, "Blueprints", "Agents");
      try {
        const candidateFile = join(candidatePath, `${agentId}.md`);
        try {
          const stat = await Deno.stat(candidateFile);
          if (stat && stat.isFile) {
            const fallbackLoader = new BlueprintLoader({ blueprintsPath: candidatePath });
            const loadedBlueprint = await fallbackLoader.load(agentId);
            if (loadedBlueprint) {
              traceLogger.info("blueprint.loaded_fallback", agentId, { from: candidatePath });
              return loadedBlueprint;
            }
          }
        } catch {
          // File doesn't exist
        }
      } catch {
        // ignore
      }

      const parent = dir.replace(/\/[^\/]*$/, "");
      if (!parent || parent === dir) break;
      dir = parent;
    }
    return null;
  }

  private async findBlueprintInRepoRoots(agentId: string, traceLogger: any): Promise<any | null> {
    // Try the repository root (cwd) directly
    const repoAgentsPath = join(Deno.cwd(), "Blueprints", "Agents");
    const fallbackLoader = new BlueprintLoader({ blueprintsPath: repoAgentsPath });
    const loadedBlueprint = await fallbackLoader.load(agentId);
    if (loadedBlueprint) {
      traceLogger.info("blueprint.loaded_fallback", agentId, { from: repoAgentsPath });
      return loadedBlueprint;
    }

    // Also try locating Blueprints relative to this module (repo root)
    try {
      const repoRoot = join(dirname(dirname(dirname(new URL(import.meta.url).pathname))));
      const repoModuleAgents = join(repoRoot, "Blueprints", "Agents");
      const moduleLoader = new BlueprintLoader({ blueprintsPath: repoModuleAgents });
      const moduleLoaded = await moduleLoader.load(agentId);
      if (moduleLoaded) {
        traceLogger.info("blueprint.loaded_fallback", agentId, { from: repoModuleAgents });
        return moduleLoaded;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private async handleError(
    error: unknown,
    filePath: string,
    requestId: string,
    traceLogger: any,
    frontmatter?: RequestFrontmatter,
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    let persistedRejectedPath = false;
    if (error instanceof PlanValidationError) {
      const validationError = error;
      const rawDetails = validationError.details?.rawContent;
      const fullRawResponse = validationError.details?.fullRawResponse;

      traceLogger.info("plan.validation.error.detected", requestId, {
        hasRawDetails: !!rawDetails,
        rawDetailsLength: typeof rawDetails === "string" ? rawDetails.length : "not-string",
        hasFullRawResponse: !!fullRawResponse,
      });

      // Always attempt to save rejected plan for debugging, even if raw content is missing
      try {
        const rejectedDir = join(
          this.config.system.root,
          this.config.paths.workspace,
          this.config.paths.rejected,
        );
        await Deno.mkdir(rejectedDir, { recursive: true });

        const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);

        // Use fullRawResponse as fallback if rawDetails is empty or missing
        const rawToSave = (typeof rawDetails === "string" && rawDetails)
          ? rawDetails
          : (typeof fullRawResponse === "string" && fullRawResponse)
          ? fullRawResponse
          : "No raw content available";

        const rejectedContent = this.formatRejectedPlan({
          frontmatter,
          requestId,
          traceId: frontmatter?.trace_id,
          errorMessage,
          rawDetails: rawToSave,
          validationError,
        });
        await Deno.writeTextFile(rejectedPath, rejectedContent);

        // Log the saved path for debugging, but keep the original error message
        // unchanged for storage in the request frontmatter (tests expect the
        // raw error string without appended path info).
        traceLogger.info("plan.saved_rejected", rejectedPath, { reason: "validation_failed" });

        // Persist rejected_path into the request frontmatter so CLI/TUI can
        // expose the location to users for manual review. Use workspace-relative
        // path (e.g. Workspace/Rejected/...) for portability.
        const rejectedRelative = join(
          this.config.paths.workspace,
          this.config.paths.rejected,
          `${requestId}_rejected.md`,
        );
        await this.statusManager.updateStatus(Deno.realPathSync(filePath), RequestStatus.FAILED, errorMessage, {
          rejected_path: rejectedRelative,
        });
        persistedRejectedPath = true;
      } catch (writeErr) {
        traceLogger.warn("plan.save_rejected_failed", filePath, { error: String(writeErr) });
      }
    }

    traceLogger.error("request.failed", filePath, {
      error: errorMessage,
    });

    // If we didn't already persist rejected_path above (e.g. non-validation errors),
    // persist the original error message without path metadata.
    if (!persistedRejectedPath) {
      await this.statusManager.updateStatus(Deno.realPathSync(filePath), RequestStatus.FAILED, errorMessage);
    }
  }

  private formatRejectedPlan(args: {
    frontmatter?: RequestFrontmatter;
    requestId: string;
    traceId?: string;
    errorMessage: string;
    rawDetails: string;
    validationError: any;
  }): string {
    return `---
trace_id: "${args.traceId ?? "unknown"}"
request_id: "${args.requestId}"
status: ${PlanStatus.REJECTED}
error: "${args.errorMessage.replace(/"/g, '\\"')}"
---

Rejected Plan: ${args.errorMessage}
Raw Details: ${args.rawDetails}
`;
  }

  private async writePlanAndReturnPath(
    result: any,
    metadata: RequestMetadata,
    filePath: string,
    traceLogger: any,
    extra?: Record<string, unknown>,
  ): Promise<string> {
    const planResult = await this.ioBreaker.execute(() => this.planWriter.writePlan(result, metadata));
    await this.statusManager.updateStatus(filePath, RequestStatus.PLANNED);
    const logObj: Record<string, unknown> = { plan_path: planResult.planPath, ...(extra ?? {}) };
    traceLogger.info("request.planned", filePath, logObj);
    return planResult.planPath;
  }

  private classifyTaskComplexity(blueprint: Blueprint, _request: ParsedRequest): TaskComplexity {
    const agentId = blueprint.agentId || "";
    if (agentId.includes("analyzer") || agentId.includes("summarizer")) return TaskComplexity.SIMPLE;
    if (agentId.includes("coder") || agentId.includes("planner") || agentId.includes("architect")) {
      return TaskComplexity.COMPLEX;
    }
    return TaskComplexity.MEDIUM;
  }

  private async buildPortalContext(portalAlias?: string, traceLogger?: any): Promise<string | null> {
    if (!portalAlias) return null;

    const portal = this.config.portals.find((p) => p.alias === portalAlias);
    if (!portal) {
      traceLogger?.warn("portal.context.not_found", portalAlias, { portal: portalAlias });
      return null;
    }

    const fileSummary = await this.getPortalFileSummary(portal.target_path);

    return buildPortalContextBlock({
      portalAlias,
      portalRoot: portal.target_path,
      fileList: fileSummary,
    });
  }

  private async getPortalFileSummary(portalPath: string): Promise<string> {
    const files: string[] = [];
    try {
      // List top-level files
      for await (const entry of Deno.readDir(portalPath)) {
        if (entry.name.startsWith(".")) continue;
        files.push(`${entry.isDirectory ? "[DIR] " : "- "}${entry.name}`);

        if (entry.isDirectory && files.length < 50) {
          try {
            const subPath = join(portalPath, entry.name);
            for await (const subEntry of Deno.readDir(subPath)) {
              if (subEntry.name.startsWith(".")) continue;
              files.push(`  ${subEntry.isDirectory ? "[DIR] " : "- "}${subEntry.name}`);
              if (files.length > 100) break;
            }
          } catch {
            // Ignore sub-directory errors
          }
        }
        if (files.length > 100) break;
      }
    } catch {
      return "Unable to list portal directory.";
    }

    if (files.length === 0) return "Portal directory is empty.";
    return files.join("\n");
  }
}
