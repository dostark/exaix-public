/**
 * @module PortalCommands
 * @path src/cli/commands/portal_commands.ts
 * @description Provides CLI commands for managing portals, including adding, removing, listing, and verifying repository links and context cards.
 * @architectural-layer CLI
 * @dependencies [path, config_schema, db_schema, config_service, context_card_generator, event_logger, enums, constants]
 * @related-files [src/services/context_card_generator.ts, src/cli/main.ts]
 */

import { join, resolve } from "@std/path";
import { ensureDir } from "@std/fs";
import { BaseCommand, type ICommandContext } from "../base.ts";
import { PortalAnalysisMode, PortalExecutionStrategy, PortalStatus, VerificationStatus } from "../../shared/enums.ts";
import { ExoPathDefaults, PORTAL_ALIAS_MAX_LENGTH } from "../../shared/constants.ts";
import type { JSONValue } from "../../shared/types/json.ts";
import type { IPortalKnowledge } from "../../shared/schemas/portal_knowledge.ts";
import { PortalKnowledgeSchema } from "../../shared/schemas/portal_knowledge.ts";

import type { IPortalDetails, IPortalInfo, IVerificationResult } from "../../shared/types/portal.ts";

export interface IPortalCommandsContext extends ICommandContext {}

export class PortalCommands extends BaseCommand {
  private portalsDir: string;
  private reservedNames = ["System", "Workspace", "Memory", "Blueprints", "Active", "Archive", "Portals"];

  constructor(context: ICommandContext) {
    super(context);
    // Resolve paths relative to system root
    const config = context.config.getAll();
    this.portalsDir = join(config.system.root as string, config.paths.portals as string);
  }

  /**
   * Add a new portal
   */
  async add(
    targetPath: string,
    alias: string,
    options?: { defaultBranch?: string; executionStrategy?: PortalExecutionStrategy },
  ): Promise<void> {
    // Validate alias
    this.validateAlias(alias);

    if (options?.defaultBranch !== undefined) {
      await this.validateBranchName(options.defaultBranch, { label: "default_branch" });
    }

    // Resolve target path to absolute
    const absoluteTarget = resolve(targetPath);

    // Check target exists
    try {
      const stat = await Deno.stat(absoluteTarget);
      if (!stat.isDirectory) {
        throw new Error(`Target path is not a directory: ${absoluteTarget}`);
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new Error(`Target path does not exist: ${absoluteTarget}`);
      }
      throw error;
    }

    // Check for duplicate alias
    const symlinkPath = join(this.portalsDir, alias);
    try {
      await Deno.lstat(symlinkPath);
      throw new Error(`Portal '${alias}' already exists`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    // Ensure portals directory exists
    await Deno.mkdir(this.portalsDir, { recursive: true });

    try {
      // Create symlink
      await Deno.symlink(absoluteTarget, symlinkPath);

      // Generate context card
      await this.contextCardGenerator.generate({
        alias,
        path: absoluteTarget,
        techStack: [],
      });

      // Trigger portal knowledge analysis post-mount (fire-and-forget on failure)
      if (this.context.portalKnowledge && this.context.portalKnowledgeConfig?.autoAnalyzeOnMount) {
        const sysRoot = this.config.system.root as string;
        const projectsDir = join(sysRoot, ExoPathDefaults.memoryProjects);
        try {
          const knowledge = await this.context.portalKnowledge.analyze(alias, absoluteTarget);
          // Atomically persist knowledge.json under Memory/Projects/{alias}/
          const portalDir = join(projectsDir, alias);
          await ensureDir(portalDir);
          const knowledgePath = join(portalDir, "knowledge.json");
          const tmpPath = `${knowledgePath}.tmp`;
          await Deno.writeTextFile(tmpPath, JSON.stringify(knowledge, null, 2));
          await Deno.rename(tmpPath, knowledgePath);
        } catch {
          // Analysis failure must not block mount
        }
      }

      // Update config file
      if (this.context.config) {
        await this.context.config.addPortal(alias, absoluteTarget, {
          defaultBranch: options?.defaultBranch,
          executionStrategy: options?.executionStrategy,
        });
      }

      // Log to activity journal (also outputs to console)
      await this.logActivity("portal.added", {
        alias,
        target: absoluteTarget,
        symlink: `Portals/${alias}`,
        context_card: "generated",
        hint: "Restart daemon to apply changes: exoctl daemon restart",
      });
    } catch (error) {
      // Rollback on failure
      try {
        await Deno.remove(symlinkPath);
      } catch {
        // Ignore cleanup errors
      }

      // Try to rollback config if it was added
      if (this.context.config) {
        try {
          await this.context.config.removePortal(alias);
        } catch {
          // Ignore config rollback errors
        }
      }

      throw error;
    }
  }

  private async validateBranchName(branch: string, opts?: { label?: string }): Promise<void> {
    const label = opts?.label ?? "branch";

    if (typeof branch !== "string") {
      throw new Error(`Invalid ${label}: must be a string`);
    }

    const trimmed = branch.trim();
    if (trimmed.length === 0) {
      throw new Error(`Invalid ${label}: must be non-empty`);
    }
    if (trimmed !== branch) {
      throw new Error(`Invalid ${label}: must not include leading/trailing whitespace`);
    }

    // Use git's own ref-format validator (works without a repo).
    const cmd = new Deno.Command("git", {
      args: ["check-ref-format", "--branch", branch],
      stdout: "null",
      stderr: "piped",
    });

    const { success, stderr } = await cmd.output();
    if (!success) {
      const msg = new TextDecoder().decode(stderr).trim();
      throw new Error(
        `Invalid ${label}: '${branch}' is not a safe git branch name` +
          (msg ? ` (${msg})` : ""),
      );
    }
  }

  /**
   * List all portals with their status
   */
  async list(): Promise<IPortalInfo[]> {
    const portals: IPortalInfo[] = [];

    try {
      for await (const entry of Deno.readDir(this.portalsDir)) {
        if (!entry.isSymlink) continue;

        const symlinkPath = join(this.portalsDir, entry.name);
        const contextCardPath = join(
          this.config.system.root!,
          this.config.paths.memory!,
          "Projects",
          entry.name,
          "portal.md",
        );

        let targetPath: string;
        let status: PortalStatus;

        try {
          targetPath = await Deno.readLink(symlinkPath);
          // Check if target still exists
          await Deno.stat(targetPath);
          status = PortalStatus.ACTIVE;
        } catch {
          targetPath = "(unknown)";
          status = PortalStatus.BROKEN;
        }

        // Get created timestamp from config
        const configPortal = this.context.config?.getPortal(entry.name);

        portals.push({
          alias: entry.name,
          targetPath,
          symlinkPath,
          contextCardPath,
          status,
          created: configPortal?.created,
          defaultBranch: configPortal?.default_branch,
          executionStrategy: configPortal?.execution_strategy,
        });
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
      // Portals directory doesn't exist yet - return empty array
    }

    return portals;
  }

  /**
   * Show detailed information about a specific portal
   */
  async show(alias: string): Promise<IPortalDetails> {
    const symlinkPath = join(this.portalsDir, alias);
    const contextCardPath = join(
      this.config.system.root!,
      this.config.paths.memory!,
      "Projects",
      alias,
      "portal.md",
    );

    let targetPath: string;
    let status: PortalStatus;
    let permissions: string | undefined;

    try {
      await Deno.lstat(symlinkPath);
    } catch {
      throw new Error(`Portal '${alias}' not found`);
    }

    try {
      targetPath = await Deno.readLink(symlinkPath);
      const stat = await Deno.stat(targetPath);
      status = stat.isDirectory ? PortalStatus.ACTIVE : PortalStatus.BROKEN;

      // Try to determine permissions
      try {
        for await (const _ of Deno.readDir(targetPath)) {
          break; // Just check if we can read
        }
        permissions = "Read/Write";
      } catch {
        permissions = "Read Only";
      }
    } catch {
      targetPath = await Deno.readLink(symlinkPath).catch(() => "(unknown)");
      status = PortalStatus.BROKEN;
    }

    // Get created timestamp from config
    const configPortal = this.context.config?.getPortal(alias);

    return {
      alias,
      targetPath,
      symlinkPath,
      contextCardPath,
      status,
      permissions,
      created: configPortal?.created,
      defaultBranch: configPortal?.default_branch,
      executionStrategy: configPortal?.execution_strategy,
    };
  }

  /**
   * Remove a portal
   */
  async remove(alias: string, options?: { keepCard?: boolean }): Promise<void> {
    const symlinkPath = join(this.portalsDir, alias);
    const contextCardPath = join(
      this.config.system.root!,
      this.config.paths.memory!,
      "Projects",
      alias,
      "portal.md",
    );

    // Check portal exists
    try {
      await Deno.lstat(symlinkPath);
    } catch {
      throw new Error(`Portal '${alias}' not found`);
    }

    // Remove symlink
    await Deno.remove(symlinkPath);

    // Remove from config
    if (this.context.config) {
      await this.context.config.removePortal(alias);
    }

    // Archive context card (unless keepCard is true)
    if (!options?.keepCard) {
      const archivedDir = join(
        this.config.system.root,
        this.config.paths.memory,
        "Projects",
        "_archived",
      );
      await Deno.mkdir(archivedDir, { recursive: true });

      const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const archivedPath = join(archivedDir, `${alias}_${timestamp}.md`);

      try {
        await Deno.rename(contextCardPath, archivedPath);
      } catch (error) {
        // If card doesn't exist, that's okay
        if (!(error instanceof Deno.errors.NotFound)) {
          throw error;
        }
      }
    }

    // Log to activity journal (also outputs to console)
    await this.logActivity("portal.removed", {
      alias,
      context_card: options?.keepCard ? "kept" : "archived",
      hint: "Restart daemon to apply changes: exoctl daemon restart",
    });
  }

  /**
   * Verify portal integrity
   */
  async verify(alias?: string): Promise<IVerificationResult[]> {
    const results: IVerificationResult[] = [];
    const portalsToVerify = alias ? [alias] : (await this.list()).map((p) => p.alias);

    for (const portalAlias of portalsToVerify) {
      const issues: string[] = [];
      const symlinkPath = join(this.portalsDir, portalAlias);
      const contextCardPath = join(
        this.config.system.root!,
        this.config.paths.memory!,
        "Projects",
        portalAlias,
        "portal.md",
      );

      // Check symlink exists
      try {
        await Deno.lstat(symlinkPath);
      } catch {
        issues.push("Symlink does not exist");
      }

      // Check target exists
      let targetPath: string | null = null;
      try {
        targetPath = await Deno.readLink(symlinkPath);
        await Deno.stat(targetPath);
      } catch {
        issues.push("Target directory not found");
      }

      // Check context card exists
      try {
        await Deno.stat(contextCardPath);
      } catch {
        issues.push("Context card missing");
      }

      // Check target is readable
      if (targetPath) {
        try {
          for await (const _ of Deno.readDir(targetPath)) {
            break; // Just check if we can read
          }
        } catch {
          issues.push("Target directory not readable");
        }
      }

      // Check config consistency
      if (this.context.config) {
        const configPortal = this.context.config.getPortal(portalAlias);
        if (!configPortal) {
          issues.push("Portal not found in configuration");
        } else if (targetPath && configPortal.target_path !== targetPath) {
          issues.push(`Config mismatch: expected ${configPortal.target_path}, found ${targetPath}`);
        }
      }

      results.push({
        alias: portalAlias,
        status: issues.length === 0 ? VerificationStatus.OK : VerificationStatus.FAILED,
        issues: issues.length > 0 ? issues : undefined,
      });
    }

    // Log verification
    await this.logActivity("portal.verified", {
      portals_checked: results.length,
      failed: results.filter((r) => r.status === "failed").length,
    });

    return results;
  }

  /**
   * Refresh context card for a portal
   */
  async refresh(alias: string): Promise<void> {
    const symlinkPath = join(this.portalsDir, alias);

    // Check portal exists
    try {
      await Deno.lstat(symlinkPath);
    } catch {
      throw new Error(`Portal '${alias}' not found`);
    }

    // Get target path
    const targetPath = await Deno.readLink(symlinkPath);

    // Regenerate context card
    await this.contextCardGenerator.generate({
      alias,
      path: targetPath,
      techStack: [],
    });

    // Log to activity journal (also outputs to console)
    await this.logActivity("portal.refreshed", {
      alias,
      target: targetPath,
    });
  }

  /**
   * Trigger codebase knowledge analysis for a portal.
   * Returns a human-readable summary of the analysis.
   */
  async analyze(
    alias: string,
    options?: { mode?: PortalAnalysisMode; force?: boolean },
  ): Promise<string> {
    const symlinkPath = join(this.portalsDir, alias);

    try {
      await Deno.lstat(symlinkPath);
    } catch {
      throw new Error(`Portal '${alias}' not found`);
    }

    const portalPath = await Deno.readLink(symlinkPath);

    if (!this.context.portalKnowledge) {
      throw new Error("Portal knowledge service is not available");
    }

    const mode = options?.mode;
    let knowledge;
    if (options?.force) {
      knowledge = await this.context.portalKnowledge.analyze(alias, portalPath, mode);
    } else {
      knowledge = await this.context.portalKnowledge.analyze(alias, portalPath, mode);
    }

    // Persist knowledge.json
    const sysRoot = this.config.system.root as string;
    const projectsDir = join(sysRoot, ExoPathDefaults.memoryProjects);
    const portalDir = join(projectsDir, alias);
    await ensureDir(portalDir);
    const knowledgePath = join(portalDir, "knowledge.json");
    const tmpPath = `${knowledgePath}.tmp`;
    await Deno.writeTextFile(tmpPath, JSON.stringify(knowledge, null, 2));
    await Deno.rename(tmpPath, knowledgePath);

    await this.logActivity("portal.analyzed", {
      alias,
      mode: knowledge.metadata.mode,
      filesScanned: knowledge.metadata.filesScanned,
      durationMs: knowledge.metadata.durationMs,
    });

    return [
      `Portal: ${alias}`,
      `Mode:   ${knowledge.metadata.mode}`,
      `Files scanned: ${knowledge.metadata.filesScanned}`,
      `Duration: ${knowledge.metadata.durationMs}ms`,
    ].join("\n");
  }

  /**
   * Display gathered knowledge for a portal.
   * Returns formatted Markdown by default, or raw JSON with `--json`.
   */
  async knowledge(
    alias: string,
    options?: { json?: boolean },
  ): Promise<string> {
    const symlinkPath = join(this.portalsDir, alias);

    try {
      await Deno.lstat(symlinkPath);
    } catch {
      throw new Error(`Portal '${alias}' not found`);
    }

    const sysRoot = this.config.system.root as string;
    const projectsDir = join(sysRoot, ExoPathDefaults.memoryProjects);
    const data = await loadKnowledgeFile(projectsDir, alias);

    if (!data) {
      return `No knowledge available for '${alias}'.\nRun \`exoctl portal analyze ${alias}\` to gather it.`;
    }

    if (options?.json) {
      return JSON.stringify(data, null, 2);
    }

    return formatKnowledgeText(data).join("\n");
  }

  /**
   * Validate portal alias
   */
  private validateAlias(alias: string): void {
    // Check length
    if (alias.length === 0) {
      throw new Error("Alias cannot be empty");
    }
    if (alias.length > PORTAL_ALIAS_MAX_LENGTH) {
      throw new Error(`Alias cannot exceed ${PORTAL_ALIAS_MAX_LENGTH} characters`);
    }

    // Check for invalid characters
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(alias)) {
      if (/^[0-9]/.test(alias)) {
        throw new Error("Alias cannot start with a number");
      }
      throw new Error("Alias contains invalid characters. Use alphanumeric, dash, underscore only.");
    }

    // Check for reserved names
    if (this.reservedNames.includes(alias)) {
      throw new Error(`Alias '${alias}' is reserved`);
    }
  }

  /**
   * Log activity to database using DisplayService
   */
  private async logActivity(actionType: string, payload: Record<string, JSONValue>): Promise<void> {
    try {
      await this.logger.info(actionType, "portal", {
        ...payload,
        via: "cli",
        command: `exoctl ${Deno.args.join(" ")}`,
      });
    } catch (error) {
      // Log errors but don't fail the operation
      console.error("Failed to log activity:", error);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Module-level helpers (no boundary violations)
// ──────────────────────────────────────────────────────────────────────────────

/** Read and validate knowledge.json from the projects directory. */
async function loadKnowledgeFile(
  projectsDir: string,
  portalAlias: string,
): Promise<IPortalKnowledge | null> {
  const knowledgePath = `${projectsDir}/${portalAlias}/knowledge.json`;
  try {
    const raw = await Deno.readTextFile(knowledgePath);
    const result = PortalKnowledgeSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Render an IPortalKnowledge record into lines for CLI output. */
function formatKnowledgeText(knowledge: IPortalKnowledge): string[] {
  const lines: string[] = [];

  if (knowledge.architectureOverview) {
    lines.push("=== Architecture Overview ===");
    for (const line of knowledge.architectureOverview.split("\n").slice(0, 20)) {
      lines.push(line);
    }
  }

  if (knowledge.keyFiles.length > 0) {
    lines.push("", "=== Key Files ===");
    for (const kf of knowledge.keyFiles) {
      lines.push(`  ${kf.path} [${kf.role}]: ${kf.description}`);
    }
  }

  if (knowledge.conventions.length > 0) {
    lines.push("", "=== Conventions ===");
    const byCategory = new Map<string, typeof knowledge.conventions>();
    for (const conv of knowledge.conventions) {
      const existing = byCategory.get(conv.category) ?? [];
      existing.push(conv);
      byCategory.set(conv.category, existing);
    }
    for (const [category, items] of byCategory) {
      lines.push(`  [${category}]`);
      for (const item of items) {
        lines.push(`    • ${item.name}: ${item.description}`);
      }
    }
  }

  if (knowledge.dependencies.length > 0) {
    lines.push("", "=== Dependencies ===");
    for (const dep of knowledge.dependencies) {
      for (const kd of dep.keyDependencies) {
        const purpose = kd.purpose ? ` — ${kd.purpose}` : "";
        lines.push(`  ${kd.name}${purpose}`);
      }
    }
  }

  return lines;
}
