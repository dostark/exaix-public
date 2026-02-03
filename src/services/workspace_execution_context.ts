/**
 * Workspace Execution Context
 *
 * Defines execution context for agent operations, determining where agents run
 * and where git operations happen. Supports both portal-based execution
 * (agents work in external project repositories) and workspace-based execution
 * (agents work in deployed workspace).
 *
 * Key Concepts:
 * - Portal Execution: Agents execute in portal workspace (e.g., ~/git/ExoFrame)
 * - Workspace Execution: Agents execute in deployed workspace (e.g., ~/ExoFrame)
 * - Git operations always target the configured repository
 * - File access restricted to allowed paths
 */

import { join, normalize } from "@std/path";
import type { PortalConfig } from "../config/schema.ts";
import { existsSync } from "@std/fs";

/**
 * Execution context for agent operations
 * Determines where agents run and where git operations happen
 */
export interface WorkspaceExecutionContext {
  /** Working directory for agent execution */
  workingDirectory: string;

  /** Git repository for version control operations */
  gitRepository: string;

  /** Allowed file paths for agent access */
  allowedPaths: string[];

  /** Repository for changeset tracking */
  changesetRepo: string;

  /** Portal alias (if executing in portal) */
  portal?: string;

  /** Portal target path (resolved symlink) */
  portalTarget?: string;
}

/**
 * Builder for creating execution contexts
 */
export class WorkspaceExecutionContextBuilder {
  /**
   * Build execution context for portal-based request
   *
   * Portal execution means:
   * - Agent runs in portal workspace (e.g., ~/git/ExoFrame)
   * - Git operations happen in portal's repository
   * - File access limited to portal directory
   * - Changesets track portal modifications
   *
   * @param portal Portal configuration
   * @returns Execution context for portal
   */
  static forPortal(portal: PortalConfig): WorkspaceExecutionContext {
    const portalTarget = normalize(portal.target_path.replace(/\/$/, ""));
    const gitDir = join(portalTarget, ".git");

    return {
      workingDirectory: portalTarget,
      gitRepository: gitDir,
      allowedPaths: [portalTarget],
      changesetRepo: gitDir,
      portal: portal.alias,
      portalTarget,
    };
  }

  /**
   * Build execution context for workspace request (no portal)
   *
   * Workspace execution means:
   * - Agent runs in deployed workspace (e.g., ~/ExoFrame)
   * - Git operations happen in workspace repository
   * - File access limited to workspace directory
   * - Changesets track workspace modifications
   *
   * @param workspacePath Path to deployed workspace
   * @returns Execution context for workspace
   */
  static forWorkspace(workspacePath: string): WorkspaceExecutionContext {
    const normalizedPath = normalize(workspacePath.replace(/\/$/, ""));
    const gitDir = join(normalizedPath, ".git");

    return {
      workingDirectory: normalizedPath,
      gitRepository: gitDir,
      allowedPaths: [normalizedPath],
      changesetRepo: gitDir,
    };
  }

  /**
   * Validate that portal target path exists
   *
   * @param portal Portal configuration
   * @throws Error if path doesn't exist
   */
  static validatePortalExists(portal: PortalConfig): void {
    const portalTarget = normalize(portal.target_path.replace(/\/$/, ""));
    if (!existsSync(portalTarget)) {
      throw new Error(`Portal target path does not exist: ${portalTarget}`);
    }
  }

  /**
   * Validate that portal contains a git repository
   *
   * @param portal Portal configuration
   * @throws Error if .git directory doesn't exist
   */
  static validatePortalGitRepo(portal: PortalConfig): void {
    const portalTarget = normalize(portal.target_path.replace(/\/$/, ""));
    const gitDir = join(portalTarget, ".git");
    if (!existsSync(gitDir)) {
      throw new Error(`Portal does not contain a git repository: ${portalTarget}`);
    }
  }

  /**
   * Validate that workspace directory exists
   *
   * @param workspacePath Path to workspace
   * @throws Error if path doesn't exist
   */
  static validateWorkspaceExists(workspacePath: string): void {
    const normalizedPath = normalize(workspacePath.replace(/\/$/, ""));
    if (!existsSync(normalizedPath)) {
      throw new Error(`Workspace directory does not exist: ${normalizedPath}`);
    }
  }

  /**
   * Validate that workspace contains a git repository
   *
   * @param workspacePath Path to workspace
   * @throws Error if .git directory doesn't exist
   */
  static validateWorkspaceGitRepo(workspacePath: string): void {
    const normalizedPath = normalize(workspacePath.replace(/\/$/, ""));
    const gitDir = join(normalizedPath, ".git");
    if (!existsSync(gitDir)) {
      throw new Error(`Workspace does not contain a git repository: ${normalizedPath}`);
    }
  }

  /**
   * Resolve symlinks in portal path
   *
   * @param portal Portal configuration
   * @returns Portal config with resolved path
   */
  static async resolvePortalSymlink(portal: PortalConfig): Promise<PortalConfig> {
    const realPath = await Deno.realPath(portal.target_path);
    return {
      ...portal,
      target_path: realPath,
    };
  }
}
