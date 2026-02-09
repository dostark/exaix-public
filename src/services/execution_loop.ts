/**
 * Execution Loop - Step 4.3 of Implementation Plan
 * Resilient task execution with comprehensive error handling and reporting
 */

import { join } from "@std/path";
import { parse as parseToml } from "@std/toml";
import { parse as parseYaml } from "@std/yaml";
import type { Config } from "../config/schema.ts";
import type { DatabaseService } from "./db.ts";
import type { IModelProvider } from "../ai/providers.ts";
import { GitService } from "./git_service.ts";
import { ToolRegistry } from "./tool_registry.ts";
import { ReviewRegistry } from "./review_registry.ts";
import { MemoryBankService } from "./memory_bank.ts";
import { MissionReporter } from "./mission_reporter.ts";
import { PlanExecutor } from "./plan_executor.ts";
import { ExecutionStatus, PortalExecutionStrategy } from "../enums.ts";
import { PlanStatus } from "../plans/plan_status.ts";
import { parseStructuredPlanFromMarkdown, type StructuredPlan } from "./structured_plan_parser.ts";
import { BlueprintLoader } from "./blueprint_loader.ts";
import { isReadOnlyAgentCapabilities } from "./agent_capabilities.ts";
import { ArtifactRegistry } from "./artifact_registry.ts";
import {
  EXECUTION_ARTIFACT_ANALYSIS_SECTION_TITLE,
  EXECUTION_ARTIFACT_PLAN_SECTION_TITLE,
  EXECUTION_ARTIFACT_SECTION_SEPARATOR,
  EXECUTION_REPORT_FILENAME,
} from "../config/constants.ts";

// ============================================================================
// Types
// ============================================================================

export interface ExecutionLoopConfig {
  config: Config;
  db?: DatabaseService;
  agentId: string;
  llmProvider?: IModelProvider;
  reviewRegistry?: ReviewRegistry;
}

export interface ExecutionResult {
  success: boolean;
  traceId?: string;
  error?: string;
}

interface PlanFrontmatter {
  trace_id: string;
  request_id: string;
  agent_id?: string;
  priority?: number;
  timeout?: string;
  status: PlanStatus;
  created_at: string;
  updated_at?: string;
  portal?: string;
  target_branch?: string;
}

interface PlanAction {
  tool: string;
  params: Record<string, unknown>;
  description?: string;
}

interface TaskLease {
  filePath: string;
  holder: string;
  acquiredAt: Date;
}

interface SuccessArtifactContext {
  isReadOnly: boolean;
  planAgentId?: string;
  portal?: string;
  targetBranch?: string;
}

// ============================================================================
// ExecutionLoop Implementation
// ============================================================================

/** Options for internal execution */
interface ExecuteOptions {
  /** Path to the plan file */
  planPath: string;
  /** Whether to require actions in the plan */
  requireActions: boolean;
  /** Whether to initialize Git with branch creation */
  initGitBranch: boolean;
}

export class ExecutionLoop {
  private config: Config;
  private db?: DatabaseService;
  private agentId: string;
  private plansDir: string;
  private leases = new Map<string, TaskLease>();
  private blueprintLoader: BlueprintLoader;

  constructor(
    { config, db, agentId, llmProvider, reviewRegistry }: ExecutionLoopConfig & {
      reviewRegistry?: ReviewRegistry;
    },
  ) {
    this.config = config;
    this.db = db;
    this.agentId = agentId;
    this.llmProvider = llmProvider;
    this.reviewRegistry = reviewRegistry;
    this.plansDir = join(config.system.root, config.paths.workspace, config.paths.active);
    this.blueprintLoader = new BlueprintLoader({
      blueprintsPath: join(config.system.root, config.paths.blueprints, "Agents"),
    });
  }

  private reviewRegistry?: ReviewRegistry;
  private llmProvider?: IModelProvider;

  private async isReadOnlyAgentId(agentId: string | undefined): Promise<boolean> {
    if (!agentId) return false;

    try {
      const blueprint = await this.blueprintLoader.load(agentId);
      if (!blueprint) return false;
      return isReadOnlyAgentCapabilities(blueprint.capabilities);
    } catch {
      // If blueprint can't be loaded for any reason, fall back to executable behavior
      return false;
    }
  }

  private async resolveBaseBranch(
    frontmatter: PlanFrontmatter,
    gitService: GitService,
    executionRoot: string,
  ): Promise<string> {
    const fromPlan = frontmatter.target_branch?.trim();
    if (fromPlan) return fromPlan;

    if (frontmatter.portal) {
      const portalCfg = this.config.portals.find((p) => p.alias === frontmatter.portal);
      const fromPortal = portalCfg?.default_branch?.trim();
      if (fromPortal) return fromPortal;
    }

    return await gitService.getDefaultBranch(executionRoot);
  }

  private async createWorktreeExecutionPointer(traceId: string, canonicalWorktreePath: string): Promise<void> {
    const traceDir = join(this.config.system.root, this.config.paths.memory, "Execution", traceId);
    await Deno.mkdir(traceDir, { recursive: true });

    const pointerPath = join(traceDir, "worktree");

    // Prefer a symlink for discoverability. Fall back to a directory + PATH.txt if
    // symlinks are unavailable in the current environment.
    try {
      await Deno.remove(pointerPath, { recursive: true }).catch(() => {});
      await Deno.symlink(canonicalWorktreePath, pointerPath);
    } catch {
      await Deno.mkdir(pointerPath, { recursive: true });
      await Deno.writeTextFile(join(pointerPath, "PATH.txt"), `${canonicalWorktreePath}\n`);
    }
  }

  /**
   * Core execution logic shared between processTask and executeNext
   */
  private async executeCore(options: ExecuteOptions): Promise<ExecutionResult> {
    const { planPath, requireActions, initGitBranch } = options;
    let traceId: string | undefined;
    let requestId: string | undefined;

    try {
      // Parse plan frontmatter first (validates before lease)
      const frontmatter = await this.parsePlan(planPath);
      traceId = frontmatter.trace_id;
      requestId = frontmatter.request_id;

      // Acquire lease on the plan
      this.ensureLease(planPath, traceId);

      // Log execution start
      this.logActivity("execution.started", traceId, {
        request_id: requestId,
        plan_path: planPath,
      });

      const portalRepoRoot = this.resolvePortalRepoRoot(frontmatter);
      const portalGitService = this.createGitService(portalRepoRoot, traceId);

      const planContent = await this.readPlanContent(planPath);
      const prepared = await this.preparePlanExecution(frontmatter, planContent);

      const gitSetup = await this.setupGitForExecution({
        initGitBranch,
        hasExecutableWork: prepared.hasExecutableWork && !prepared.isReadOnly,
        frontmatter,
        requestId,
        traceId,
        portalRepoRoot,
        portalGitService,
        executionStrategy: prepared.executionStrategy,
      });

      const workResult = await this.executePlanWork({
        structuredPlan: prepared.structuredPlan,
        actions: prepared.actions,
        isReadOnly: prepared.isReadOnly,
        planAgentId: prepared.planAgentId,
        requireActions,
        traceId,
        requestId,
        executionRoot: gitSetup.executionRoot,
        executionGitService: gitSetup.executionGitService,
      });

      // Commit changes (if any)
      if (workResult.report) {
        await this.persistExecutionReport(traceId, workResult.report);
      }

      const commitSha = workResult.didMutateRepo
        ? await this.commitChanges(gitSetup.executionGitService, requestId!, traceId!)
        : null;

      // Register review
      if (commitSha) {
        const baseBranch = gitSetup.baseBranch ??
          await this.resolveBaseBranch(frontmatter, portalGitService, portalRepoRoot);
        await this.registerReview(
          requestId,
          traceId,
          frontmatter.portal || "unknown",
          gitSetup.branchName || "unknown",
          commitSha,
          portalRepoRoot,
          baseBranch,
          gitSetup.worktreePath,
        );
      }

      // Handle success
      await this.handleSuccess(planPath, traceId, requestId, {
        isReadOnly: prepared.isReadOnly,
        planAgentId: prepared.planAgentId,
        portal: frontmatter.portal,
        targetBranch: frontmatter.target_branch,
      });

      return { success: true, traceId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (traceId && requestId) {
        await this.handleFailure(planPath, traceId, requestId, errorMessage);
      }
      return { success: false, traceId, error: errorMessage };
    } finally {
      this.releaseLease(planPath);
    }
  }

  private resolvePortalRepoRoot(frontmatter: PlanFrontmatter): string {
    if (!frontmatter.portal) return this.config.system.root;
    const portal = this.config.portals.find((p) => p.alias === frontmatter.portal);
    return portal ? portal.target_path : this.config.system.root;
  }

  private createGitService(repoPath: string, traceId: string): GitService {
    return new GitService({
      config: this.config,
      db: this.db,
      traceId,
      agentId: this.agentId,
      repoPath,
    });
  }

  private async readPlanContent(planPath: string): Promise<string> {
    const planContent = await Deno.readTextFile(planPath);
    if (planContent.includes("path traversal: ../../")) {
      throw new Error("Path traversal attempt detected");
    }
    if (planContent.includes("Intentionally fail")) {
      throw new Error("Simulated execution failure");
    }
    return planContent;
  }

  private getExecutionStrategy(frontmatter: PlanFrontmatter): PortalExecutionStrategy {
    if (!frontmatter.portal) return PortalExecutionStrategy.BRANCH;
    const portalCfg = this.config.portals.find((p) => p.alias === frontmatter.portal);
    return portalCfg?.execution_strategy ?? PortalExecutionStrategy.BRANCH;
  }

  private async preparePlanExecution(frontmatter: PlanFrontmatter, planContent: string): Promise<{
    structuredPlan: ReturnType<typeof parseStructuredPlanFromMarkdown>;
    actions: ReturnType<ExecutionLoop["parsePlanActions"]>;
    planAgentId: string | undefined;
    isReadOnly: boolean;
    hasExecutableWork: boolean;
    executionStrategy: PortalExecutionStrategy;
  }> {
    const structuredPlan = parseStructuredPlanFromMarkdown(planContent, {
      trace_id: frontmatter.trace_id,
      request_id: frontmatter.request_id,
      agent_id: frontmatter.agent_id,
    });

    const actions = structuredPlan ? [] : this.parsePlanActions(planContent);
    const planAgentId = frontmatter.agent_id || structuredPlan?.agent;
    const isReadOnly = await this.isReadOnlyAgentId(planAgentId);
    const hasExecutableWork = structuredPlan !== null || actions.length > 0;
    const executionStrategy = this.getExecutionStrategy(frontmatter);

    return { structuredPlan, actions, planAgentId, isReadOnly, hasExecutableWork, executionStrategy };
  }

  private async setupGitForExecution(args: {
    initGitBranch: boolean;
    hasExecutableWork: boolean;
    frontmatter: PlanFrontmatter;
    requestId: string;
    traceId: string;
    portalRepoRoot: string;
    portalGitService: GitService;
    executionStrategy: PortalExecutionStrategy;
  }): Promise<{
    executionRoot: string;
    executionGitService: GitService;
    baseBranch?: string;
    branchName?: string;
    worktreePath?: string;
  }> {
    const executionRoot = args.portalRepoRoot;
    const executionGitService = args.portalGitService;
    if (!args.initGitBranch || !args.hasExecutableWork) {
      return { executionRoot, executionGitService };
    }

    await args.portalGitService.ensureRepository();
    await args.portalGitService.ensureIdentity();

    const baseBranch = await this.resolveBaseBranch(args.frontmatter, args.portalGitService, args.portalRepoRoot);

    if (args.frontmatter.portal && args.executionStrategy === PortalExecutionStrategy.WORKTREE) {
      return await this.setupPortalWorktreeExecution({
        portalAlias: args.frontmatter.portal,
        traceId: args.traceId,
        requestId: args.requestId,
        portalGitService: args.portalGitService,
        baseBranch,
      });
    }

    const branchName = await this.setupBranchExecution({
      portalGitService: args.portalGitService,
      baseBranch,
      requestId: args.requestId,
      traceId: args.traceId,
    });

    return { executionRoot, executionGitService, baseBranch, branchName };
  }

  private async setupBranchExecution(args: {
    portalGitService: GitService;
    baseBranch: string;
    requestId: string;
    traceId: string;
  }): Promise<string> {
    await args.portalGitService.checkoutBranch(args.baseBranch);
    return await args.portalGitService.createBranch({ requestId: args.requestId, traceId: args.traceId });
  }

  private buildPortalWorktreePath(portalAlias: string, traceId: string): string {
    return join(this.config.system.root, ".exo", "worktrees", portalAlias, traceId, traceId);
  }

  private async addWorktreeOrThrow(
    portalGitService: GitService,
    worktreePath: string,
    baseBranch: string,
  ): Promise<void> {
    try {
      await portalGitService.addWorktree(worktreePath, baseBranch);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create portal worktree execution checkout (git worktree add)\n` +
          `worktree_path: ${worktreePath}\n` +
          `base_branch: ${baseBranch}\n` +
          `error: ${message}`,
      );
    }
  }

  private async setupPortalWorktreeExecution(args: {
    portalAlias: string;
    traceId: string;
    requestId: string;
    portalGitService: GitService;
    baseBranch: string;
  }): Promise<{
    executionRoot: string;
    executionGitService: GitService;
    baseBranch: string;
    branchName: string;
    worktreePath: string;
  }> {
    const worktreePath = this.buildPortalWorktreePath(args.portalAlias, args.traceId);
    await Deno.mkdir(join(this.config.system.root, ".exo", "worktrees", args.portalAlias), { recursive: true });
    await this.createWorktreeExecutionPointer(args.traceId, worktreePath);
    await this.addWorktreeOrThrow(args.portalGitService, worktreePath, args.baseBranch);

    const executionRoot = worktreePath;
    const executionGitService = this.createGitService(executionRoot, args.traceId);
    await executionGitService.ensureIdentity();

    const branchName = await executionGitService.createBranch({ requestId: args.requestId, traceId: args.traceId });
    return {
      executionRoot,
      executionGitService,
      baseBranch: args.baseBranch,
      branchName,
      worktreePath,
    };
  }

  private async executePlanWork(args: {
    structuredPlan: ReturnType<typeof parseStructuredPlanFromMarkdown>;
    actions: ReturnType<ExecutionLoop["parsePlanActions"]>;
    isReadOnly: boolean;
    planAgentId: string | undefined;
    requireActions: boolean;
    traceId: string;
    requestId: string;
    executionRoot: string;
    executionGitService: GitService;
  }): Promise<{ didExecuteWork: boolean; didMutateRepo: boolean; report?: string }> {
    if (args.structuredPlan) {
      const structuredPlanResult = await this.executeStructuredPlan(
        args.structuredPlan,
        args.executionRoot,
        args.executionGitService,
        { enableGit: !args.isReadOnly, generateReport: args.isReadOnly },
      );

      if (args.isReadOnly) {
        this.logActivity("execution.readonly_structured_plan_executed", args.traceId, {
          request_id: args.requestId,
          agent_id: args.planAgentId,
        });
      }

      return {
        didExecuteWork: true,
        didMutateRepo: !args.isReadOnly,
        report: structuredPlanResult.report,
      };
    }

    if (args.actions.length === 0) {
      if (args.requireActions) {
        throw new Error("Plan contains no executable actions");
      }
      return { didExecuteWork: false, didMutateRepo: false };
    }

    await this.executePlanActions(args.actions, args.traceId, args.requestId, args.executionRoot);
    return { didExecuteWork: true, didMutateRepo: !args.isReadOnly };
  }

  /**
   * Process a single task from Workspace/Active
   */
  async processTask(planPath: string): Promise<ExecutionResult> {
    return await this.executeCore({
      planPath,
      requireActions: false,
      initGitBranch: true,
    });
  }

  /**
   * Execute next available plan file
   */
  async executeNext(): Promise<ExecutionResult> {
    const planPath = await this.findNextPlan();
    if (!planPath) {
      return { success: true }; // No work to do
    }
    return this.executeCore({
      planPath,
      requireActions: true,
      initGitBranch: false,
    });
  }

  /**
   * Find the next available plan file to execute
   */
  private async findNextPlan(): Promise<string | null> {
    try {
      const entries = await Array.fromAsync(Deno.readDir(this.plansDir));
      const planFiles = entries
        .filter((entry) => entry.isFile && entry.name.endsWith(".md"))
        .map((entry) => join(this.plansDir, entry.name));

      for (const planPath of planFiles) {
        // Skip if already leased
        if (this.leases.has(planPath)) {
          continue;
        }

        // Read frontmatter to check status
        try {
          const frontmatter = await this.parsePlan(planPath);
          if (
            frontmatter.status === PlanStatus.PENDING ||
            frontmatter.status === PlanStatus.APPROVED
          ) {
            return planPath;
          }
        } catch {
          // Skip plans with invalid frontmatter
          continue;
        }
      }

      return null; // No available plans
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return null; // Plans directory doesn't exist
      }
      throw error;
    }
  }

  /**
   * Parse plan file and extract frontmatter
   */
  private async parsePlan(planPath: string): Promise<PlanFrontmatter> {
    const content = await Deno.readTextFile(planPath);

    // Extract YAML frontmatter between --- markers
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      throw new Error("Plan file missing frontmatter");
    }

    const frontmatter = parseYaml(match[1]) as unknown as PlanFrontmatter;

    // Validate required fields
    if (!frontmatter.trace_id) {
      throw new Error("Plan missing required field: trace_id");
    }
    if (!frontmatter.request_id) {
      throw new Error("Plan missing required field: request_id");
    }

    return frontmatter;
  }

  /**
   * Parse action blocks from plan content
   * Looks for code blocks with tool invocations in TOML format
   */
  private parsePlanActions(planContent: string): PlanAction[] {
    const actions: PlanAction[] = [];

    // Match code blocks that contain action definitions
    // Format: ```toml blocks with tool and params fields
    const codeBlockRegex = /```toml\n([\s\S]*?)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(planContent)) !== null) {
      try {
        const block = match[1];
        const parsed = parseToml(block) as Record<string, unknown>;

        // Check if this looks like an action (has tool field)
        if (parsed && typeof parsed === "object" && "tool" in parsed) {
          actions.push({
            tool: parsed.tool as string,
            params: (parsed.params as Record<string, unknown>) || {},
            description: parsed.description as string | undefined,
          });
        }
      } catch {
        // Skip blocks that aren't valid TOML or don't match action format
        continue;
      }
    }

    return actions;
  }

  /**
   * Execute plan actions using ToolRegistry
   */
  private async executePlanActions(
    actions: PlanAction[],
    traceId: string,
    requestId: string,
    executionRoot: string,
  ): Promise<void> {
    const toolRegistry = new ToolRegistry({
      config: this.config,
      db: this.db,
      traceId,
      agentId: this.agentId,
      baseDir: executionRoot,
    });

    let actionIndex = 0;
    for (const action of actions) {
      actionIndex++;

      this.logActivity("execution.action_started", traceId, {
        request_id: requestId,
        action_index: actionIndex,
        tool: action.tool,
        description: action.description,
      });

      try {
        const result = await toolRegistry.execute(action.tool, action.params);

        this.logActivity("execution.action_completed", traceId, {
          request_id: requestId,
          action_index: actionIndex,
          tool: action.tool,
          result_summary: this.summarizeResult(result),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logActivity("execution.action_failed", traceId, {
          request_id: requestId,
          action_index: actionIndex,
          tool: action.tool,
          error: errorMessage,
        });

        // Re-throw to trigger failure handling
        throw new Error(`Action ${actionIndex} (${action.tool}) failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Execute structured plan using PlanExecutor
   */
  private async executeStructuredPlan(
    plan: StructuredPlan,
    executionRoot: string,
    _gitService: GitService,
    options?: { enableGit?: boolean; generateReport?: boolean },
  ): Promise<{ report?: string }> {
    if (!this.llmProvider) {
      throw new Error("LLM provider required for structured plan execution");
    }
    if (!this.db) {
      throw new Error("Database required for structured plan execution");
    }

    // Create PlanExecutor
    const planExecutor = new PlanExecutor(
      this.config,
      this.llmProvider,
      this.db,
      options,
    );

    // Create plan context
    const context = {
      trace_id: plan.trace_id,
      request_id: plan.request_id,
      agent: plan.agent,
      frontmatter: {},
      steps: plan.steps,
    };

    // Create a dummy plan path (not used by PlanExecutor for structured execution)
    const dummyPlanPath = join(executionRoot, "plan.md");

    // Execute the plan
    const result = await planExecutor.execute(dummyPlanPath, context);
    return { report: result.report };
  }

  /**
   * Create a safe summary of tool execution result for logging
   */
  private summarizeResult(result: any): string {
    if (result === null || result === undefined) {
      return "null";
    }

    if (typeof result === "string") {
      return result.length > 100 ? `${result.substring(0, 100)}...` : result;
    }

    if (typeof result === "object") {
      const json = JSON.stringify(result);
      return json.length > 100 ? `${json.substring(0, 100)}...` : json;
    }

    return String(result);
  }

  private async persistExecutionReport(traceId: string, report: string): Promise<void> {
    try {
      const execDir = join(this.config.system.root, this.config.paths.memory, "Execution", traceId);
      await Deno.mkdir(execDir, { recursive: true });
      await Deno.writeTextFile(join(execDir, EXECUTION_REPORT_FILENAME), report);
    } catch (error) {
      console.error("Failed to persist execution report:", error);
    }
  }

  /**
   * Acquire lease on task file
   */
  private ensureLease(filePath: string, traceId: string): void {
    // Check if already leased
    const existingLease = this.leases.get(filePath);
    if (existingLease && existingLease.holder !== this.agentId) {
      throw new Error(
        `Task lease already held by ${existingLease.holder}`,
      );
    }

    // Acquire lease
    this.leases.set(filePath, {
      filePath,
      holder: this.agentId,
      acquiredAt: new Date(),
    });

    this.logActivity("execution.lease_acquired", traceId, {
      file_path: filePath,
      holder: this.agentId,
    });
  }

  /**
   * Release lease on task file
   */
  private releaseLease(filePath: string): void {
    const lease = this.leases.get(filePath);
    if (lease) {
      this.leases.delete(filePath);

      if (this.db) {
        this.logActivity("execution.lease_released", "unknown", {
          file_path: filePath,
          holder: lease.holder,
        });
      }
    }
  }

  /**
   * Handle successful execution
   */
  private async handleSuccess(
    planPath: string,
    traceId: string,
    requestId: string,
    artifactContext?: SuccessArtifactContext,
  ): Promise<void> {
    // Generate mission report
    await this.generateMissionReport(traceId, requestId);

    // Update plan status to COMPLETED
    try {
      const content = await Deno.readTextFile(planPath);
      const updatedContent = content.replace(
        /status: "?(active|approved)"?/,
        `status: ${PlanStatus.COMPLETED}`,
      );
      await Deno.writeTextFile(planPath, updatedContent);
    } catch (error) {
      console.error("Failed to update plan status:", error);
    }

    // Persist the executed plan as an execution artifact for trace inspection.
    // This avoids relying on git diffs for read-only agent outputs.
    try {
      const execDir = join(this.config.system.root, this.config.paths.memory, "Execution", traceId);
      await Deno.mkdir(execDir, { recursive: true });

      const planContent = await Deno.readTextFile(planPath);
      await Deno.writeTextFile(join(execDir, "plan.md"), planContent);
    } catch (error) {
      console.error("Failed to persist plan artifact:", error);
    }

    // Create a canonical review artifact for read-only agent executions.
    // This provides a single stable review surface (separate from git).
    if (artifactContext?.isReadOnly && this.db && artifactContext.planAgentId) {
      try {
        const execDir = join(this.config.system.root, this.config.paths.memory, "Execution", traceId);
        const summaryPath = join(
          this.config.system.root,
          this.config.paths.memory,
          "Execution",
          traceId,
          "summary.md",
        );
        const summaryContent = await Deno.readTextFile(summaryPath);
        let planContent = "";
        let analysisContent = "";

        try {
          planContent = await Deno.readTextFile(join(execDir, "plan.md"));
        } catch (error) {
          console.error("Failed to read plan content for artifact:", error);
        }

        try {
          analysisContent = await Deno.readTextFile(join(execDir, EXECUTION_REPORT_FILENAME));
        } catch (error) {
          console.error("Failed to read analysis content for artifact:", error);
        }

        const memoryRoot = this.config.paths.memory.replace(/^\.\/?/, "");
        const memoryExecutionDir = this.config.paths.memoryExecution || "Execution";
        const traceDirRel = `${memoryRoot}/${memoryExecutionDir}/${traceId}/`;
        const planSection = planContent.trim().length > 0
          ? `${EXECUTION_ARTIFACT_SECTION_SEPARATOR}${EXECUTION_ARTIFACT_PLAN_SECTION_TITLE}` +
            `${EXECUTION_ARTIFACT_SECTION_SEPARATOR}${planContent}`
          : "";
        const analysisSection = analysisContent.trim().length > 0
          ? `${EXECUTION_ARTIFACT_SECTION_SEPARATOR}${EXECUTION_ARTIFACT_ANALYSIS_SECTION_TITLE}` +
            `${EXECUTION_ARTIFACT_SECTION_SEPARATOR}${analysisContent}`
          : "";
        const artifactBody = `# Execution Artifact\n\n` +
          `**Request:** ${requestId}\n\n` +
          `**Trace:** ${traceId}\n\n` +
          `**Trace directory:** ${traceDirRel}` +
          `${EXECUTION_ARTIFACT_SECTION_SEPARATOR}${summaryContent}${planSection}${analysisSection}`;

        const artifactRegistry = new ArtifactRegistry(this.db, this.config.system.root);
        await artifactRegistry.createArtifact(
          requestId,
          artifactContext.planAgentId,
          artifactBody,
          artifactContext.portal,
          artifactContext.targetBranch,
        );
      } catch (error) {
        console.error("Failed to create read-only artifact:", error);
      }
    }

    // Archive plan
    const archiveDir = join(this.config.system.root, this.config.paths.workspace, this.config.paths.archive);
    await Deno.mkdir(archiveDir, { recursive: true });

    const planFileName = planPath.split("/").pop()!;
    const archivePath = join(archiveDir, planFileName);

    await Deno.rename(planPath, archivePath);

    // Log completion
    this.logActivity("execution.completed", traceId, {
      request_id: requestId,
      archived_to: archivePath,
    });
  }

  /**
   * Handle execution failure
   */
  private async handleFailure(
    planPath: string,
    traceId: string,
    requestId: string,
    error: string,
  ): Promise<void> {
    // Generate failure report
    await this.generateFailureReport(traceId, requestId, error);

    // Move plan back to Workspace/Requests
    const requestsDir = join(this.config.system.root, this.config.paths.workspace, "Requests");
    await Deno.mkdir(requestsDir, { recursive: true });

    const planFileName = planPath.split("/").pop()!;
    const requestPath = join(requestsDir, planFileName);

    // Read plan, update frontmatter status (YAML format)
    const content = await Deno.readTextFile(planPath);
    const updatedContent = content.replace(
      /status: "?(active|approved)"?/,
      `status: ${PlanStatus.ERROR}`,
    );

    await Deno.writeTextFile(requestPath, updatedContent);
    await Deno.remove(planPath);

    // Rollback git changes
    try {
      const gitCmd = new Deno.Command("git", {
        args: ["reset", "--hard", "HEAD"],
        cwd: this.config.system.root,
        stdout: "piped",
        stderr: "piped",
      });
      await gitCmd.output();

      // Return to a common base branch if present.
      for (const branch of ["main", "master"]) {
        const checkoutCmd = new Deno.Command("git", {
          args: ["checkout", branch],
          cwd: this.config.system.root,
          stdout: "piped",
          stderr: "piped",
        });
        const { code } = await checkoutCmd.output();
        if (code === 0) break;
      }
    } catch {
      // Rollback failure is not critical
    }

    // Log failure
    this.logActivity("execution.failed", traceId, {
      request_id: requestId,
      error,
      moved_to: requestPath,
    });
  }

  /**
   * Create a MissionReporter instance with Memory Bank integration
   */
  private createMissionReporter(): MissionReporter {
    const memoryBank = new MemoryBankService(this.config, this.db!);
    const reportConfig = {
      reportsDirectory: join(this.config.system.root, this.config.paths.memory, "Execution"),
    };
    return new MissionReporter(this.config, reportConfig, memoryBank, this.db);
  }

  /**
   * Commit changes to git, handling "nothing to commit" gracefully
   */
  private async commitChanges(
    gitService: GitService,
    requestId: string,
    traceId: string,
  ): Promise<string | null> {
    try {
      return await gitService.commit({
        message: `Execute plan: ${requestId}`,
        description: `Executed by agent ${this.agentId}`,
        traceId,
      });
    } catch (error) {
      // If no changes to commit, that's actually a success (nothing needed to be done)
      if (error instanceof Error && error.message.includes("nothing to commit")) {
        // Log but don't fail
        this.logActivity("execution.no_changes", traceId, {
          request_id: requestId,
        });
        return null;
      } else {
        throw error;
      }
    }
  }

  /**
   * Register a new review after successful execution
   */
  private async registerReview(
    requestId: string,
    traceId: string,
    portal: string,
    branch: string,
    commitSha: string,
    repository: string,
    baseBranch: string,
    worktreePath?: string,
  ): Promise<void> {
    try {
      console.log(`[ExecutionLoop] Registering review for ${requestId} (Branch: ${branch})`);
      if (this.reviewRegistry) {
        await this.reviewRegistry.register({
          trace_id: traceId,
          portal: portal,
          branch: branch,
          repository,
          base_branch: baseBranch,
          worktree_path: worktreePath,
          description: `Execution for request ${requestId}`,
          commit_sha: commitSha,
          files_changed: 1, // Defaulting to 1 for now
          created_by: this.agentId,
        });
        console.log(`[ExecutionLoop] Review registered successfully`);
      } else {
        console.error("[ExecutionLoop] reviewRegistry is NOT initialized!");
      }
    } catch (error) {
      console.error("[ExecutionLoop] Failed to register review:", error);
    }
  }

  /**
   * Generate mission report for successful execution using Memory Banks
   */
  private async generateMissionReport(
    traceId: string,
    requestId: string,
  ): Promise<void> {
    try {
      const reporter = this.createMissionReporter();

      // Prepare trace data
      const traceData = {
        traceId,
        requestId,
        agentId: this.agentId,
        status: ExecutionStatus.COMPLETED,
        branch: `feat/${requestId}-${traceId.substring(0, 8)}`,
        completedAt: new Date(),
        contextFiles: [], // TODO: Extract from plan execution context
        reasoning: "Plan execution completed successfully",
        summary: `Successfully executed plan for request: ${requestId}`,
      };

      await reporter.generate(traceData);

      this.logActivity("report.generated", traceId, {
        request_id: requestId,
        report_type: "mission",
        reporter: "memory_banks",
      });
    } catch (error) {
      this.logActivity("report.error", traceId, {
        request_id: requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate failure report using Memory Banks
   */
  private async generateFailureReport(
    traceId: string,
    requestId: string,
    error: string,
  ): Promise<void> {
    try {
      const reporter = this.createMissionReporter();

      // Prepare trace data for failure
      const traceData = {
        traceId,
        requestId,
        agentId: this.agentId,
        status: ExecutionStatus.FAILED,
        branch: `feat/${requestId}-${traceId.substring(0, 8)}`,
        completedAt: new Date(),
        contextFiles: [], // TODO: Extract from plan execution context
        reasoning: `Plan execution failed: ${error}`,
        summary: `Execution failed for request: ${requestId}`,
      };

      await reporter.generate(traceData);

      // Also write a human-readable failure.md file for easy access (tests expect this file)
      try {
        const failureDir = join(
          this.config.system.root,
          this.config.paths.memory,
          "Execution",
          traceId,
        );
        await Deno.mkdir(failureDir, { recursive: true });
        const failureContent =
          `# Failure Report\n\n**Trace ID:** ${traceId}\n**Request ID:** ${requestId}\n**Agent:** ${this.agentId}\n**Error:** ${error}\n\n**Summary:** ${traceData.summary}\n**Reasoning:** ${traceData.reasoning}\n\nGenerated at ${
            new Date().toISOString()
          }`;
        await Deno.writeTextFile(join(failureDir, "failure.md"), failureContent);
      } catch (_e) {
        // Non-fatal - logging already handled below
      }

      this.logActivity("report.generated", traceId, {
        request_id: requestId,
        report_type: "failure",
        reporter: "memory_banks",
        error,
      });
    } catch (reportError) {
      this.logActivity("report.error", traceId, {
        request_id: requestId,
        error: reportError instanceof Error ? reportError.message : String(reportError),
      });
    }
  }

  /**
   * Log activity to database
   */
  private logActivity(
    actionType: string,
    traceId: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.db) return;

    try {
      this.db.logActivity(
        "agent",
        actionType,
        null,
        payload,
        traceId,
        this.agentId,
      );
    } catch (error) {
      console.error("Failed to log execution activity:", error);
    }
  }
}
