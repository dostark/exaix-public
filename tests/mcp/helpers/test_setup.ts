/**
 * MCP Test Helpers
 *
 * Consolidated test utilities to reduce duplication across MCP test files.
 * Provides standardized setup, request creation, and assertion helpers.
 */

import { join } from "@std/path";
import { MCPTransport, PortalOperation } from "../../../src/enums.ts";
import { ensureDir } from "@std/fs";
import { assertEquals, assertExists } from "@std/assert";
import { MCPServer } from "../../../src/mcp/server.ts";
import type { PortalPermissions } from "../../../src/schemas/portal_permissions.ts";
import { initTestDbService } from "../../helpers/db.ts";
import { createMockConfig } from "../../helpers/config.ts";
import type { JSONValue } from "../../../src/types.ts";

export interface IToolPermissionOptions {
  portalAlias?: string;
  operations?: PortalOperation[];
  agentId?: string;
  fileContent?: Record<string, string>;
  initGit?: boolean;
}

export interface IMCPTestContext {
  tempDir: string;
  portalPath: string;
  server: MCPServer;
  db: Awaited<ReturnType<typeof initTestDbService>>["db"];
  cleanup: () => Promise<void>;
}

export interface IPortalTestOptions {
  portalAlias?: string;
  createFiles?: boolean;
  fileContent?: Record<string, string>;
  permissions?: {
    agents_allowed?: string[];
    operations?: string[];
  };
  initGit?: boolean;
}

import { setupGitRepo } from "../../helpers/git_test_helper.ts";
export { setupGitRepo };

/**
 * Helper to initialize common test environment (files, git, db, config)
 */
async function initTestEnv(options: IPortalTestOptions & { prefix?: string }) {
  const {
    portalAlias = "TestPortal",
    createFiles = false,
    fileContent = {},
    permissions = {},
    initGit = false,
    prefix = "mcp-test-",
  } = options;

  const tempDir = await Deno.makeTempDir({ prefix });
  const portalPath = join(tempDir, portalAlias);
  await ensureDir(portalPath);

  if (initGit) {
    await setupGitRepo(portalPath);
  }

  if (createFiles) {
    await Deno.writeTextFile(join(portalPath, "test.txt"), "content");
  }

  for (const [filename, content] of Object.entries(fileContent)) {
    const filePath = join(portalPath, filename);
    const dir = join(filePath, "..");
    await ensureDir(dir);
    await Deno.writeTextFile(filePath, content);
  }

  const { db, cleanup: dbCleanup } = await initTestDbService();

  const portalConfig = {
    alias: portalAlias,
    target_path: portalPath,
    agents_allowed: permissions.agents_allowed,
    operations: permissions.operations,
  };

  const config = createMockConfig(tempDir, {
    portals: [portalConfig],
  });

  const cleanup = async () => {
    await dbCleanup();
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  };

  return { tempDir, portalPath, config, db, cleanup };
}

/**
 * Initialize MCP server test environment with portal
 */
export async function initMCPTest(
  options: IPortalTestOptions = {},
): Promise<IMCPTestContext> {
  const env = await initTestEnv(options);
  const server = new MCPServer({ config: env.config, db: env.db, transport: MCPTransport.STDIO });
  await server.start();

  const cleanup = async () => {
    await server.stop();
    await env.cleanup();
  };

  return {
    tempDir: env.tempDir,
    portalPath: env.portalPath,
    server,
    db: env.db,
    cleanup,
  };
}

// ... initMCPTestWithoutPortal ...

// ...

export async function initToolPermissionTest(
  options: IToolPermissionOptions = {},
): Promise<ToolPermissionTestContext> {
  const {
    portalAlias = "TestPortal",
    operations = [PortalOperation.READ],
    agentId = "test-agent",
    fileContent = {},
    initGit = false,
  } = options;

  const env = await initTestEnv({
    portalAlias,
    fileContent,
    initGit,
    permissions: {
      agents_allowed: [agentId],
      operations,
    },
    prefix: "mcp-perm-test-",
  });

  const permissions: PortalPermissions = {
    alias: portalAlias,
    target_path: env.portalPath,
    agents_allowed: [agentId],
    operations,
  };

  return {
    tempDir: env.tempDir,
    portalPath: env.portalPath,
    config: env.config,
    db: env.db,
    permissions,
    cleanup: env.cleanup,
  };
}

/**
 * Initialize MCP server without any portals (for testing portal errors)
 */
export async function initMCPTestWithoutPortal(): Promise<
  Omit<IMCPTestContext, "portalPath">
> {
  const tempDir = await Deno.makeTempDir({ prefix: "mcp-test-" });
  const { db, cleanup: dbCleanup } = await initTestDbService();

  const config = createMockConfig(tempDir);
  const server = new MCPServer({ config, db, transport: MCPTransport.STDIO });
  await server.start();

  const cleanup = async () => {
    await server.stop();
    await dbCleanup();
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  };

  return { tempDir, server, db, cleanup };
}

/**
 * Alias for initMCPTestWithoutPortal to maintain compatibility
 */
export const initSimpleMCPServer = initMCPTestWithoutPortal;

/**
 * Create MCP tool call request
 *
 * @example
 * const request = createToolCallRequest(McpToolName.READ_FILE, {
 *   portal: "TestPortal",
 *   path: "test.txt"
 * });
 */
export function createToolCallRequest(
  toolName: string,
  args: Record<string, JSONValue>,
  id: number | string = 1,
) {
  return {
    jsonrpc: "2.0" as const,
    id,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };
}

/**
 * Create MCP request for any method
 *
 * @example
 * const request = createMCPRequest("initialize", {
 *   protocolVersion: "2024-11-05",
 *   clientInfo: { name: "test", version: "1.0.0" }
 * });
 */
export function createMCPRequest(
  method: string,
  params?: Record<string, JSONValue>,
  id: number | string = 1,
) {
  return {
    jsonrpc: "2.0" as const,
    id,
    method,
    params: params || {},
  };
}

/**
 * Assert MCP error response with specific code
 *
 * @throws AssertionError if response is not an error or code doesn't match
 */
export function assertMCPError(
  response: any,
  expectedCode: number,
  messageContains?: string,
): void {
  assertExists(response.error, "Expected error in response");
  assertEquals(
    response.error.code,
    expectedCode,
    `Expected error code ${expectedCode}, got ${response.error.code}: ${response.error.message}`,
  );

  if (messageContains) {
    const message = response.error.message as string;
    if (!message.includes(messageContains)) {
      throw new Error(
        `Expected error message to contain "${messageContains}", got: "${message}"`,
      );
    }
  }
}

/**
 * Assert MCP success response and return result
 *
 * @throws AssertionError if response contains an error
 * @returns The result object from the response
 */
export function assertMCPSuccess<T = any>(response: any): T {
  if (response.error) {
    throw new Error(
      `Expected success, got error ${response.error.code}: ${response.error.message}`,
    );
  }

  assertExists(response.result, "Expected result in response");
  return response.result as T;
}

/**
 * Assert that response result has content array with text
 */
export function assertMCPContentIncludes(response: any, text: string): void {
  const result = assertMCPSuccess(response);
  assertExists(result.content, "Expected content array in result");

  const content = result.content as Array<{ type: string; text: string }>;
  const hasText = content.some((item) => item.text?.includes(text));

  if (!hasText) {
    throw new Error(
      `Expected content to include "${text}", got: ${JSON.stringify(content)}`,
    );
  }
}

/**
 * Create a test portal with git initialization
 * @deprecated Use setupGitRepo instead
 */
export async function createGitPortal(
  tempDir: string,
  portalName: string = "TestPortal",
): Promise<string> {
  const portalPath = join(tempDir, portalName);
  await ensureDir(portalPath);
  await setupGitRepo(portalPath);
  return portalPath;
}

/**
 * Initialize test environment for tool permission tests
 * Creates portal with specific permissions for testing tool authorization
 *
 * @example
 * const ctx = await initToolPermissionTest({
 *   operations: [ PortalOperation.READ],
 *   agentId: "test-agent"
 * });
 * const tool = new ReadFileTool(ctx.config, ctx.db, ctx.permissions);
 */
export interface ToolPermissionTestContext {
  tempDir: string;
  portalPath: string;
  config: ReturnType<typeof createMockConfig>;
  db: Awaited<ReturnType<typeof initTestDbService>>["db"];
  permissions: PortalPermissions;
  cleanup: () => Promise<void>;
}
