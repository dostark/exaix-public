/**
 * @module ListDirectoryTool
 * @path src/mcp/handlers/list_directory_tool.ts
 * @description MCP tool handler for listing directory contents in a portal with security validation.
 * @architectural-layer MCP
 * @dependencies [ToolHandler, Path, FS]
 * @related-files [src/mcp/tool_handler.ts]
 */
import { ToolHandler } from "../tool_handler.ts";
import { type MCPToolResponse } from "../../schemas/mcp.ts";
import { PortalOperation } from "../../enums.ts";

/**
 * ListDirectoryTool - Lists files and directories in a portal path
 *
 * Security:
 * - Validates portal exists
 * - Prevents path traversal
 * - Returns structured directory listing
 * - Logs all operations to Activity Journal
 */
export class ListDirectoryTool extends ToolHandler {
  async execute(args: unknown): Promise<MCPToolResponse> {
    // Import ListDirectory schema and types
    const { ListDirectoryToolArgsSchema } = await import("../../schemas/mcp.ts");
    const validatedArgs = ListDirectoryToolArgsSchema.parse(args) as {
      portal: string;
      path?: string;
      agent_id: string;
    };
    const { portal, path, agent_id } = validatedArgs;

    try {
      // All tools make permission checking for portal operations
      this.validatePermission(portal, agent_id, PortalOperation.READ);

      // Validate portal exists
      const portalPath = this.validatePortalExists(portal);

      // Resolve and validate path (defaults to portal root)
      const listPath = path || "";
      const absolutePath = this.resolvePortalPath(portalPath, listPath);

      // Read directory
      const entries: string[] = [];
      for await (const entry of Deno.readDir(absolutePath)) {
        const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;
        entries.push(displayName);
      }

      // Sort entries (directories first, then files)
      entries.sort((a, b) => {
        const aIsDir = a.endsWith("/");
        const bIsDir = b.endsWith("/");
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      // Format listing
      const listing = entries.length > 0 ? entries.join("\n") : "(Directory is empty)";

      // Log successful execution
      this.logToolExecution("list_directory", portal, {
        path: listPath || "/",
        agent_id,
        success: true,
        entry_count: entries.length,
      });

      return {
        content: [
          {
            type: "text",
            text: listing,
          },
        ],
      };
    } catch (error) {
      // Log failed execution
      this.logToolExecution("list_directory", portal, {
        path: path || "/",
        agent_id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  getToolDefinition() {
    return {
      name: "list_directory",
      description: "List files and directories in a portal path",
      inputSchema: {
        type: "object",
        properties: {
          portal: {
            type: "string",
            description: "Portal name",
          },
          path: {
            type: "string",
            description: "Relative path within portal (optional, defaults to root)",
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
