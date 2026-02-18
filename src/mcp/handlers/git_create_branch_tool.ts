/**
 * @module GitCreateBranchTool
 * @path src/mcp/handlers/git_create_branch_tool.ts
 * @description MCP tool handler for creating feature branches in a portal git repository.
 * @architectural-layer MCP
 * @dependencies [ToolHandler, GitService]
 * @related-files [src/mcp/tool_handler.ts, src/services/git_service.ts]
 */
import { ToolHandler } from "../tool_handler.ts";
import { type MCPToolResponse } from "../../schemas/mcp.ts";
import { PortalOperation } from "../../enums.ts";
import { GitCreateBranchToolArgsSchema } from "../../schemas/mcp.ts";

/**
 * GitCreateBranchTool - Creates feature branches in portal git repositories
 *
 * Security:
 * - Validates portal exists
 * - Validates branch name format (feat/, fix/, docs/, chore/, refactor/, test/)
 * - Checks if git repository exists
 * - Logs all operations to Activity Journal
 */
export class GitCreateBranchTool extends ToolHandler {
  async execute(args: unknown): Promise<MCPToolResponse> {
    const validatedArgs = GitCreateBranchToolArgsSchema.parse(args) as {
      portal: string;
      branch: string;
      agent_id: string;
    };
    const { portal, branch, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.GIT);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Check if git repository exists
      await this.validateGitRepository(portalPath, portal);

      // Create branch using git command
      const cmd = new Deno.Command("git", {
        args: ["checkout", "-b", branch],
        cwd: portalPath,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await cmd.output();

      if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(`Failed to create branch: ${error}`);
      }

      return this.formatSuccess(
        "git_create_branch",
        portal,
        `Branch '${branch}' created and checked out successfully in portal '${portal}'`,
        { branch, agent_id },
      );
    } catch (error) {
      this.formatError("git_create_branch", portal, error, { branch, agent_id });
    }
  }

  getToolDefinition() {
    return {
      name: "git_create_branch",
      description: "Create a new git branch in a portal repository",
      inputSchema: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "Portal name",
          },
          branch: {
            type: "string",
            description: "Branch name (must start with feat/, fix/, docs/, chore/, refactor/, or test/)",
          },
          agent_id: {
            type: "string",
            description: "Agent identifier for permission checks",
          },
        },
        required: ["portal", "branch", "agent_id"],
      },
    };
  }
}
