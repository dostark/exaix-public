/**
 * MCP Tools Permission Tests
 *
 * Tests that MCP tools respect portal permissions and operation restrictions.
 */

import { assertExists, assertRejects } from "@std/assert";
import { PortalOperation } from "../../src/enums.ts";

import { GitStatusTool } from "../../src/mcp/handlers/git_status_tool.ts";
import { ReadFileTool } from "../../src/mcp/handlers/read_file_tool.ts";
import { WriteFileTool } from "../../src/mcp/handlers/write_file_tool.ts";
import { PortalPermissionsService } from "../../src/services/portal_permissions.ts";
import { initToolPermissionTest } from "./helpers/test_setup.ts";

// ============================================================================
// Read Operation Permission Tests
// ============================================================================

// Helper for tool permission tests
async function withToolPermission(
  options: {
    operations?: PortalOperation[];
    fileContent?: Record<string, string>;
    initGit?: boolean;
    agentId?: string;
  },
  fn: (ctx: { config: any; db: any; permissions: PortalPermissionsService }) => Promise<void>,
) {
  const ctx = await initToolPermissionTest(options);
  try {
    const permissions = new PortalPermissionsService([ctx.permissions]);
    await fn({ ...ctx, permissions });
  } finally {
    await ctx.cleanup();
  }
}

// ============================================================================
// Read Operation Permission Tests
// ============================================================================

Deno.test("MCP Tools: read_file requires read permission", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.READ],
      fileContent: { "test.txt": "content" },
    },
    async ({ config, db, permissions }) => {
      const tool = new ReadFileTool(config, db, permissions);

      const result = await tool.execute({
        portal: "TestPortal",
        path: "test.txt",
        agent_id: "test-agent",
      });

      assertExists(result.content);
    },
  );
});

Deno.test("MCP Tools: read_file rejects when read permission denied", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.WRITE], // No read permission
      fileContent: { "test.txt": "content" },
    },
    async ({ config, db, permissions }) => {
      const tool = new ReadFileTool(config, db, permissions);

      await assertRejects(
        async () => {
          await tool.execute({
            portal: "TestPortal",
            path: "test.txt",
            agent_id: "test-agent",
          });
        },
        Error,
        "not permitted",
      );
    },
  );
});

// ============================================================================
// Write Operation Permission Tests
// ============================================================================

Deno.test("MCP Tools: write_file requires write permission", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.READ, PortalOperation.WRITE],
    },
    async ({ config, db, permissions }) => {
      const tool = new WriteFileTool(config, db, permissions);

      const result = await tool.execute({
        portal: "TestPortal",
        path: "test.txt",
        content: "new content",
        agent_id: "test-agent",
      });

      assertExists(result.content);
    },
  );
});

Deno.test("MCP Tools: write_file rejects when write permission denied", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.READ], // No write permission
    },
    async ({ config, db, permissions }) => {
      const tool = new WriteFileTool(config, db, permissions);

      await assertRejects(
        async () => {
          await tool.execute({
            portal: "TestPortal",
            path: "test.txt",
            content: "new content",
            agent_id: "test-agent",
          });
        },
        Error,
        "not permitted",
      );
    },
  );
});

// ============================================================================
// Git Operation Permission Tests
// ============================================================================

Deno.test("MCP Tools: git_status requires git permission", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.READ, PortalOperation.GIT],
      initGit: true,
    },
    async ({ config, db, permissions }) => {
      const tool = new GitStatusTool(config, db, permissions);

      const result = await tool.execute({
        portal: "TestPortal",
        agent_id: "test-agent",
      });

      assertExists(result.content);
    },
  );
});

Deno.test("MCP Tools: git_status rejects when git permission denied", async () => {
  await withToolPermission(
    {
      operations: [PortalOperation.READ, PortalOperation.WRITE], // No git permission
    },
    async ({ config, db, permissions }) => {
      const tool = new GitStatusTool(config, db, permissions);

      await assertRejects(
        async () => {
          await tool.execute({
            portal: "TestPortal",
            agent_id: "test-agent",
          });
        },
        Error,
        "not permitted",
      );
    },
  );
});

// ============================================================================
// Agent Whitelist Tests
// ============================================================================

Deno.test("MCP Tools: rejects non-whitelisted agent", async () => {
  await withToolPermission(
    {
      agentId: "allowed-agent",
      operations: [PortalOperation.READ, PortalOperation.WRITE, PortalOperation.GIT],
      fileContent: { "test.txt": "content" },
    },
    async ({ config, db, permissions }) => {
      const tool = new ReadFileTool(config, db, permissions);

      await assertRejects(
        async () => {
          await tool.execute({
            portal: "TestPortal",
            path: "test.txt",
            agent_id: "unauthorized-agent",
          });
        },
        Error,
        "not allowed",
      );
    },
  );
});

Deno.test("MCP Tools: allows wildcard agent access", async () => {
  await withToolPermission(
    {
      agentId: "*",
      operations: [PortalOperation.READ, PortalOperation.WRITE, PortalOperation.GIT],
      fileContent: { "test.txt": "content" },
    },
    async ({ config, db, permissions }) => {
      const tool = new ReadFileTool(config, db, permissions);

      const result = await tool.execute({
        portal: "TestPortal",
        path: "test.txt",
        agent_id: "any-agent",
      });

      assertExists(result.content);
    },
  );
});
