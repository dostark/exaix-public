/**
 * RequestProcessor - Processes request files and generates plans
 * Implements Step 5.9 of the ExoFrame Implementation Plan
 * Integrates with RequestRouter for flow-aware request processing (Step 7.6)
 */

import { basename, join } from "@std/path";
import type { IModelProvider } from "../ai/providers.ts";
import type { DatabaseService } from "./db.ts";
import type { Config } from "../config/schema.ts";
import { AgentRunner, type Blueprint, type ParsedRequest } from "./agent_runner.ts";
import { buildParsedRequest } from "./request_common.ts";
import { BlueprintLoader } from "./blueprint_loader.ts";
import { PlanWriter, type RequestMetadata } from "./plan_writer.ts";
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
      rawContent: parsed.rawContent,
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
          parsed,
          filePath,
          requestId,
          traceId,
          traceLogger,
        );
      });

      return planPath;
    } catch (error: unknown) {
      await this.handleError(error, filePath, requestId, parsed.rawContent, traceLogger, frontmatter);
      return null;
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
    rawContent: string;
    traceLogger: any;
  }): Promise<"flow" | "agent" | null> {
    const { frontmatter, filePath, rawContent, traceLogger } = args;

    const hasFlow = !!frontmatter.flow;
    const hasAgent = !!frontmatter.agent;

    if (hasFlow && hasAgent) {
      traceLogger.error("request.invalid", filePath, {
        error: "Request cannot specify both 'flow' and 'agent' fields",
      });
      await this.statusManager.updateStatus(filePath, rawContent, RequestStatus.FAILED);
      return null;
    }

    if (!hasAgent && !hasFlow) {
      traceLogger.error("request.invalid", filePath, {
        error: "Request must specify either 'flow' or 'agent' field",
      });
      await this.statusManager.updateStatus(filePath, rawContent, RequestStatus.FAILED);
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
    parsed: any,
    filePath: string,
    requestId: string,
    traceId: string,
    traceLogger: any,
  ): Promise<string | null> {
    if (kind === "flow") {
      return this.processFlowRequest(frontmatter, parsed, filePath, requestId, traceId, traceLogger);
    }

    return this.processAgentRequest(frontmatter, body, parsed, filePath, requestId, traceId, traceLogger);
  }

  private async processFlowRequest(
    frontmatter: RequestFrontmatter,
    parsed: any,
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
        await this.statusManager.updateStatus(filePath, parsed.rawContent, RequestStatus.FAILED);
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

    return await this.writePlanAndReturnPath(result, metadata, filePath, parsed.rawContent, traceLogger, {
      flow: frontmatter.flow,
    });
  }

  private async processAgentRequest(
    frontmatter: RequestFrontmatter,
    body: string,
    parsed: any,
    filePath: string,
    requestId: string,
    traceId: string,
    traceLogger: any,
  ): Promise<string | null> {
    const blueprintLoader = new BlueprintLoader({ blueprintsPath: this.processorConfig.blueprintsPath });
    const loadedBlueprint = await blueprintLoader.load(frontmatter.agent!);
    if (!loadedBlueprint) {
      traceLogger.error("blueprint.not_found", frontmatter.agent!, {
        request: filePath,
      });
      await this.statusManager.updateStatus(filePath, parsed.rawContent, RequestStatus.FAILED);
      traceLogger.error("request.failed", filePath, {
        error: `Blueprint not found: ${frontmatter.agent}`,
      });
      return null;
    }
    const blueprint = blueprintLoader.toLegacyBlueprint(loadedBlueprint);

    const request: ParsedRequest = buildParsedRequest(body, frontmatter, requestId, traceId) as ParsedRequest;
    const portalContext = this.buildPortalContext(frontmatter.portal, traceLogger);
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
      const selectedProviderName = await this.providerSelector.selectProviderForTask(
        this.config,
        taskComplexity,
      );

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

    return await this.writePlanAndReturnPath(result, metadata, filePath, parsed.rawContent, traceLogger);
  }

  private async handleError(
    error: unknown,
    filePath: string,
    requestId: string,
    rawContent: string,
    traceLogger: any,
    frontmatter?: RequestFrontmatter,
  ) {
    let errorMessage = error instanceof Error ? error.message : String(error);

    if (error && typeof error === "object" && (error as any).name === "PlanValidationError") {
      const validationError = error as any;
      const rawDetails = validationError.details?.rawContent;
      if (rawDetails) {
        try {
          const rejectedDir = join(
            this.config.system.root,
            this.config.paths.workspace,
            this.config.paths.rejected,
          );
          await this.ioBreaker.execute(() => Deno.mkdir(rejectedDir, { recursive: true }));

          const rejectedPath = join(rejectedDir, `${requestId}_rejected.md`);
          const rejectedContent = this.formatRejectedPlan({
            frontmatter,
            requestId,
            traceId: frontmatter?.trace_id,
            errorMessage,
            rawDetails,
            validationError,
          });
          await this.ioBreaker.execute(() => Deno.writeTextFile(rejectedPath, rejectedContent));

          errorMessage += ` (Saved to ${rejectedPath})`;
          traceLogger.info("plan.saved_rejected", rejectedPath, { reason: "validation_failed" });
        } catch (writeErr) {
          traceLogger.warn("plan.save_rejected_failed", filePath, { error: String(writeErr) });
        }
      }
    }

    traceLogger.error("request.failed", filePath, {
      error: errorMessage,
    });

    await this.statusManager.updateStatus(filePath, rawContent, RequestStatus.FAILED);
  }

  private formatRejectedPlan(args: {
    frontmatter?: RequestFrontmatter;
    requestId: string;
    traceId?: string;
    errorMessage: string;
    rawDetails: string;
    validationError: any;
  }): string {
    const createdAt = args.frontmatter?.created ?? new Date().toISOString();
    const lines: string[] = [
      "---",
      `trace_id: "${args.traceId ?? "unknown"}"`,
      `request_id: "${args.requestId}"`,
      `status: ${PlanStatus.REJECTED}`,
      `created_at: "${createdAt}"`,
    ];

    if (args.frontmatter?.agent) {
      lines.push(`agent_id: "${args.frontmatter.agent}"`);
    }
    if (args.frontmatter?.portal) {
      lines.push(`portal: "${args.frontmatter.portal}"`);
    }
    if (args.frontmatter?.model) {
      lines.push(`model: "${args.frontmatter.model}"`);
    }
    if (args.frontmatter?.target_branch) {
      lines.push(`target_branch: "${args.frontmatter.target_branch}"`);
    }
    if (args.frontmatter?.flow) {
      lines.push(`flow: "${args.frontmatter.flow}"`);
    }

    lines.push(`error: "${args.errorMessage.replace(/"/g, "'")}"`);
    lines.push("---", "");

    const zodErrors = Array.isArray(args.validationError?.details?.zodErrors)
      ? args.validationError.details.zodErrors
      : [];
    const errorDetails = zodErrors.length > 0
      ? zodErrors.map((entry: any) => `- ${entry.path?.join(".") ?? ""}: ${entry.message}`)
        .join("\n")
      : "- Validation failed";

    return [
      ...lines,
      "# Rejected Plan Output",
      "",
      "## Error",
      args.errorMessage,
      "",
      "## Validation Details",
      errorDetails,
      "",
      "## Raw Output",
      "```text",
      args.rawDetails,
      "```",
      "",
    ].join("\n");
  }

  private async writePlanAndReturnPath(
    result: any,
    metadata: RequestMetadata,
    filePath: string,
    rawContent: string,
    traceLogger: any,
    extra?: Record<string, unknown>,
  ): Promise<string> {
    const planResult = await this.ioBreaker.execute(() => this.planWriter.writePlan(result, metadata));
    await this.statusManager.updateStatus(filePath, rawContent, RequestStatus.PLANNED);
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

  private buildPortalContext(portalAlias?: string, traceLogger?: any): string | null {
    if (!portalAlias) return null;

    const portal = this.config.portals.find((p) => p.alias === portalAlias);
    if (!portal) {
      traceLogger?.warn("portal.context.not_found", portalAlias, { portal: portalAlias });
      return null;
    }

    return buildPortalContextBlock({
      portalAlias,
      portalRoot: portal.target_path,
    });
  }
}
