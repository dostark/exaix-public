/**
 * @module GitStatusTool
 * @path src/mcp/handlers/git_status_tool.ts
 * @description MCP tool handler for checking git status in a portal.
 * @architectural-layer MCP
 * @dependencies [ToolHandler, GitService]
 * @related-files [src/mcp/tool_handler.ts, src/services/git_service.ts]
 */
import { ToolHandler } from "../tool_handler.ts";
import { type MCPToolResponse } from "../../schemas/mcp.ts";
import type { JSONValue } from "../../types.ts";
import { PortalOperation } from "../../enums.ts";
import { GitStatusToolArgsSchema } from "../../schemas/mcp.ts";

/**
 * GitStatusTool - Queries git repository status in portals
 *
 * Security:
 * - Validates portal exists
 * - Checks if git repository exists
 * - Returns formatted status output
 * - Logs all operations to Activity Journal
 */
export class GitStatusTool extends ToolHandler {
  async execute(args: Record<string, JSONValue>): Promise<MCPToolResponse> {
    const validatedArgs = GitStatusToolArgsSchema.parse(args) as {
      portal: string;
      agent_id: string;
    };
    const { portal, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.GIT);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Check if git repository exists
      await this.validateGitRepository(portalPath, portal);

      // Get git status
      const cmd = new Deno.Command("git", {
        args: ["status", "--porcelain"],
        cwd: portalPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await cmd.output();

      if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(`Failed to get status: ${error}`);
      }

      const output = new TextDecoder().decode(stdout);
      const statusText = output.trim() ? output : "Working tree clean - no changes detected";

      return this.formatSuccess(
        "git_status",
        portal,
        statusText,
        { agent_id, has_changes: output.trim().length > 0 },
      );
    } catch (error) {
      this.formatError("git_status", portal, error, { agent_id });
    }
  }

  getToolDefinition() {
    return {
      name: "git_status",
      description: "Query git repository status in a portal",
      inputSchema: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "Portal name",
          },
          agent_id: {
            type: "string",
            description: "Agent identifier for permission checks",
          },
        },
        required: ["portal", "agent_id"],
      },
    };
  }
}
