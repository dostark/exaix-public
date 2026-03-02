/**
 * @module PortalCommands
 * @path src/cli/commands/portal_commands.ts
 * @description Provides CLI commands for managing portals, including adding, removing, listing, and verifying repository links and context cards.
 * @architectural-layer CLI
 * @dependencies [path, config_schema, db_schema, config_service, context_card_generator, event_logger, enums, constants]
 * @related-files [src/services/context_card_generator.ts, src/cli/main.ts]
 */

import { join, resolve } from "@std/path";
import { exists } from "@std/fs";
import type { ICliApplicationContext } from "../cli_context.ts";
import { PortalStatus } from "../../shared/enums.ts";
import { PortalExecutionStrategy } from "../../shared/enums.ts";
import { PORTAL_ALIAS_MAX_LENGTH } from "../../shared/constants.ts";

import type { IPortalDetails, IPortalInfo, IVerificationResult } from "../../shared/types/portal.ts";
import type { IPortalInfo as IContextCardPortalInfo } from "../../shared/interfaces/i_context_card_generator_service.ts";

export interface IPortalCommandsContext extends ICliApplicationContext {}

export class PortalCommands {
  private context: ICliApplicationContext;
  private portalsDir: string;
  private reservedNames = ["System", "Workspace", "Memory", "Blueprints", "Active", "Archive", "Portals"];

  constructor(context: IPortalCommandsContext) {
    this.context = context;
    // Resolve paths relative to system root
    const config = context.config.getAll();
    this.portalsDir = join(config.system.root as string, config.paths.portals as string);
  }

  /**
   * Get the configuration.
   */
  private get config() {
    return this.context.config.getAll();
  }

  /**
   * Get the config service.
   */
  private get configService() {
    return this.context.config;
  }

  /**
   * Get the context card generator.
   */
  private get contextCardGenerator() {
    return this.context.contextCards;
  }

  /**
   * Get the portal service.
   */
  private get portalService() {
    return this.context.portals;
  }

  /**
   * Get the display service (logger).
   */
  private get logger() {
    return this.context.display;
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

      // Update config file
      if (this.configService) {
        await this.configService.addPortal(alias, absoluteTarget, {
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
      if (this.configService) {
        try {
          await this.configService.removePortal(alias);
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
        const configPortal = this.configService?.getPortal(entry.name);

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
    const configPortal = this.configService?.getPortal(alias);

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
    if (this.configService) {
      await this.configService.removePortal(alias);
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
      if (this.configService) {
        const configPortal = this.configService.getPortal(portalAlias);
        if (!configPortal) {
          issues.push("Portal not found in configuration");
        } else if (targetPath && configPortal.target_path !== targetPath) {
          issues.push(`Config mismatch: expected ${configPortal.target_path}, found ${targetPath}`);
        }
      }

      results.push({
        alias: portalAlias,
        status: issues.length === 0 ? "ok" : "failed",
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
  private async logActivity(actionType: string, payload: Record<string, any>): Promise<void> {
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
