/**
 * @module ToolHandler
 * @path src/mcp/tool_handler.ts
 * @description Base class for all MCP tool handlers, providing common validation, security, and logging.
 * @architectural-layer MCP
 * @dependencies [Path, Config, DatabaseService, PortalPermissionsService, PortalOperation]
 * @related-files [src/services/portal_permissions.ts, src/mcp/handlers/read_file_tool.ts, src/mcp/handlers/write_file_tool.ts]
 */
import { join, normalize, relative } from "@std/path";
import type { Config } from "../config/schema.ts";
import type { DatabaseService } from "../services/db.ts";
import { type MCPToolResponse } from "../schemas/mcp.ts";
import { PortalPermissionsService } from "../services/portal_permissions.ts";
import { PortalOperation } from "../enums.ts";
import { type JsonValue, toSafeJson } from "../flows/transforms.ts";

/**
 * Base class for all MCP tool handlers
 * Provides common validation and logging functionality
 */
export abstract class ToolHandler {
  protected config: Config;
  protected db: DatabaseService;
  protected permissions: PortalPermissionsService | null;

  constructor(config: Config, db: DatabaseService, permissions?: PortalPermissionsService) {
    this.config = config;
    this.db = db;
    this.permissions = permissions || null;
  }

  /**
   * Validates that a portal exists in configuration
   * @throws Error if portal not found
   */
  protected validatePortalExists(portalName: string): string {
    const portal = this.config.portals.find((p) => p.alias === portalName);
    if (!portal) {
      throw new Error(`Portal '${portalName}' not found in configuration`);
    }
    return portal.target_path;
  }

  /**
   * Validates that an agent has permission for an operation on a portal
   * @throws Error if permission denied
   */
  protected validatePermission(
    portalName: string,
    agentId: string,
    operation: PortalOperation,
  ): void {
    if (!this.permissions) {
      // No permissions service configured, allow all operations
      return;
    }

    const result = this.permissions.checkOperationAllowed(portalName, agentId, operation);
    if (!result.allowed) {
      throw new Error(
        result.reason || `Permission denied for ${operation} on portal ${portalName}`,
      );
    }
  }

  /**
   * Validates path doesn't contain traversal attempts (../)
   * @throws Error if path traversal detected
   */
  protected validatePathSafety(path: string): void {
    const normalized = normalize(path);
    if (normalized.includes("..") || normalized.startsWith("/")) {
      throw new Error("Path traversal not allowed. Use relative paths within portal.");
    }
  }

  /**
   * Resolves a portal-relative path to absolute filesystem path
   * Validates the resolved path stays within portal bounds
   */
  protected resolvePortalPath(portalPath: string, relativePath: string): string {
    this.validatePathSafety(relativePath);
    const absolutePath = join(portalPath, relativePath);
    const relativeFromPortal = relative(portalPath, absolutePath);

    // Ensure resolved path is still within portal
    if (relativeFromPortal.startsWith("..")) {
      throw new Error("Path traversal not allowed. Resolved path escapes portal.");
    }

    return absolutePath;
  }

  /**
   * Logs tool execution to Activity Journal
   */
  protected logToolExecution(
    toolName: string,
    portal: string,
    metadata: Record<string, unknown>,
  ): void {
    this.db.logActivity(
      "mcp.tool",
      `mcp.tool.${toolName}`,
      portal,
      toSafeJson(metadata) as Record<string, JsonValue>,
    );
  }

  /**
   * Formats a successful tool response with logging
   */
  protected formatSuccess(
    toolName: string,
    portal: string,
    message: string,
    metadata: Record<string, unknown>,
  ): MCPToolResponse {
    this.logToolExecution(toolName, portal, { ...metadata, success: true });
    return {
      content: [{ type: "text", text: message }],
    };
  }

  /**
   * Formats an error response with logging and re-throws
   */
  protected formatError(
    toolName: string,
    portal: string,
    error: unknown,
    metadata: Record<string, unknown>,
  ): never {
    this.logToolExecution(toolName, portal, {
      ...metadata,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  /**
   * Validates that a portal has a git repository
   * @throws Error if .git directory doesn't exist
   */
  protected async validateGitRepository(portalPath: string, portalName: string): Promise<void> {
    try {
      await Deno.stat(join(portalPath, ".git"));
    } catch {
      throw new Error(`Not a git repository: ${portalName}`);
    }
  }

  /**
   * Execute the tool with validated arguments
   * Implemented by subclasses
   */
  abstract execute(args: unknown): Promise<MCPToolResponse>;

  /**
   * Returns the tool's JSON schema definition
   */
  abstract getToolDefinition(): {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  };
}
