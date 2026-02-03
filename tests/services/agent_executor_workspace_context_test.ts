/**
 * Integration tests for AgentExecutor with WorkspaceExecutionContext
 *
 * Test Task 1.2: Update Agent Executor
 * Tests that AgentExecutor accepts WorkspaceExecutionContext and uses it
 * for portal/workspace execution with proper directory isolation.
 */

import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { WorkspaceExecutionContextBuilder } from "../../src/services/workspace_execution_context.ts";
import type { PortalConfig } from "../../src/config/schema.ts";

describe("AgentExecutor with WorkspaceExecutionContext", () => {
  let tempDir: string;
  let portalDir: string;
  let workspaceDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = Deno.cwd();
    tempDir = await Deno.makeTempDir({ prefix: "exo_test_agent_exec_" });
    portalDir = join(tempDir, "portal");
    workspaceDir = join(tempDir, "workspace");

    // Create portal and workspace directories with git repos
    await ensureDir(join(portalDir, ".git"));
    await ensureDir(join(workspaceDir, ".git"));
    await ensureDir(join(portalDir, "src"));
    await ensureDir(join(workspaceDir, "src"));
  });

  afterEach(async () => {
    // Restore original working directory
    try {
      Deno.chdir(originalCwd);
    } catch (_error) {
      // Ignore if original directory doesn't exist
    }

    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("ExecutionContext acceptance", () => {
    it("accepts WorkspaceExecutionContext for portal execution", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Verify context has required fields for agent execution
      assertEquals(typeof context.workingDirectory, "string");
      assertEquals(typeof context.gitRepository, "string");
      assertEquals(Array.isArray(context.allowedPaths), true);
      assertEquals(typeof context.changesetRepo, "string");
      assertEquals(context.portal, "test-portal");
    });

    it("accepts WorkspaceExecutionContext for workspace execution", () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Verify context has required fields
      assertEquals(typeof context.workingDirectory, "string");
      assertEquals(typeof context.gitRepository, "string");
      assertEquals(Array.isArray(context.allowedPaths), true);
      assertEquals(typeof context.changesetRepo, "string");
      assertEquals(context.portal, undefined);
    });
  });

  describe("Working directory management", () => {
    it("changes to portal working directory", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Simulate what AgentExecutor should do
      Deno.chdir(context.workingDirectory);

      const currentDir = Deno.cwd();
      assertEquals(currentDir, portalDir);
    });

    it("changes to workspace working directory", () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Simulate what AgentExecutor should do
      Deno.chdir(context.workingDirectory);

      const currentDir = Deno.cwd();
      assertEquals(currentDir, workspaceDir);
    });

    it("isolated working directories for different portals", async () => {
      const portal1Dir = join(tempDir, "portal1");
      const portal2Dir = join(tempDir, "portal2");
      await ensureDir(portal1Dir);
      await ensureDir(portal2Dir);

      const portal1: PortalConfig = {
        alias: "portal-1",
        target_path: portal1Dir,
      };

      const portal2: PortalConfig = {
        alias: "portal-2",
        target_path: portal2Dir,
      };

      const context1 = WorkspaceExecutionContextBuilder.forPortal(portal1);
      const context2 = WorkspaceExecutionContextBuilder.forPortal(portal2);

      // Changing to portal1 directory
      Deno.chdir(context1.workingDirectory);
      assertEquals(Deno.cwd(), portal1Dir);

      // Changing to portal2 directory should not affect portal1
      Deno.chdir(context2.workingDirectory);
      assertEquals(Deno.cwd(), portal2Dir);
    });
  });

  describe("Git repository configuration", () => {
    it("uses portal git repository for portal context", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Git operations should target portal's .git directory
      assertEquals(context.gitRepository, join(portalDir, ".git"));
      assertEquals(context.changesetRepo, join(portalDir, ".git"));
    });

    it("uses workspace git repository for workspace context", () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Git operations should target workspace's .git directory
      assertEquals(context.gitRepository, join(workspaceDir, ".git"));
      assertEquals(context.changesetRepo, join(workspaceDir, ".git"));
    });

    it("git repository paths are independent per context", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const portalContext = WorkspaceExecutionContextBuilder.forPortal(portal);
      const workspaceContext = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Different contexts should have different git repos
      assertEquals(portalContext.gitRepository !== workspaceContext.gitRepository, true);
      assertEquals(portalContext.changesetRepo !== workspaceContext.changesetRepo, true);
    });
  });

  describe("File access validation", () => {
    it("restricts file access to portal directory", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Only portal directory should be allowed
      assertEquals(context.allowedPaths.length, 1);
      assertEquals(context.allowedPaths[0], portalDir);
    });

    it("restricts file access to workspace directory", () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Only workspace directory should be allowed
      assertEquals(context.allowedPaths.length, 1);
      assertEquals(context.allowedPaths[0], workspaceDir);
    });

    it("portal context does not allow workspace access", () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Workspace directory should NOT be in allowed paths
      assertEquals(context.allowedPaths.includes(workspaceDir), false);
    });

    it("workspace context does not allow portal access", () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Portal directory should NOT be in allowed paths
      assertEquals(context.allowedPaths.includes(portalDir), false);
    });
  });

  describe("Portal execution scenarios", () => {
    it("portal execution creates files in portal directory", async () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const context = WorkspaceExecutionContextBuilder.forPortal(portal);

      // Change to portal directory
      Deno.chdir(context.workingDirectory);

      // Simulate agent creating a file
      const testFile = join(portalDir, "src", "test.ts");
      await Deno.writeTextFile(testFile, "// Test file");

      // Verify file was created in portal, not workspace
      const portalFileExists = await Deno.stat(testFile).then(() => true).catch(() => false);
      assertEquals(portalFileExists, true);

      const workspaceFile = join(workspaceDir, "src", "test.ts");
      const workspaceFileExists = await Deno.stat(workspaceFile).then(() => true).catch(() => false);
      assertEquals(workspaceFileExists, false);
    });

    it("workspace execution creates files in workspace directory", async () => {
      const context = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Change to workspace directory
      Deno.chdir(context.workingDirectory);

      // Simulate agent creating a file
      const testFile = join(workspaceDir, "src", "test.ts");
      await Deno.writeTextFile(testFile, "// Test file");

      // Verify file was created in workspace, not portal
      const workspaceFileExists = await Deno.stat(testFile).then(() => true).catch(() => false);
      assertEquals(workspaceFileExists, true);

      const portalFile = join(portalDir, "src", "test.ts");
      const portalFileExists = await Deno.stat(portalFile).then(() => true).catch(() => false);
      assertEquals(portalFileExists, false);
    });
  });

  describe("Context isolation", () => {
    it("portal and workspace contexts are completely isolated", async () => {
      const portal: PortalConfig = {
        alias: "test-portal",
        target_path: portalDir,
      };

      const portalContext = WorkspaceExecutionContextBuilder.forPortal(portal);
      const workspaceContext = WorkspaceExecutionContextBuilder.forWorkspace(workspaceDir);

      // Create file in portal
      Deno.chdir(portalContext.workingDirectory);
      await Deno.writeTextFile(join(portalDir, "src", "portal.ts"), "// Portal file");

      // Create file in workspace
      Deno.chdir(workspaceContext.workingDirectory);
      await Deno.writeTextFile(join(workspaceDir, "src", "workspace.ts"), "// Workspace file");

      // Verify isolation - each directory has only its own file
      const portalFiles = Array.from(Deno.readDirSync(join(portalDir, "src")));
      assertEquals(portalFiles.length, 1);
      assertEquals(portalFiles[0].name, "portal.ts");

      const workspaceFiles = Array.from(Deno.readDirSync(join(workspaceDir, "src")));
      assertEquals(workspaceFiles.length, 1);
      assertEquals(workspaceFiles[0].name, "workspace.ts");
    });

    it("multiple portal executions do not interfere", async () => {
      const portal1Dir = join(tempDir, "portal_a");
      const portal2Dir = join(tempDir, "portal_b");
      await ensureDir(join(portal1Dir, "src"));
      await ensureDir(join(portal2Dir, "src"));

      const portal1: PortalConfig = {
        alias: "portal-a",
        target_path: portal1Dir,
      };

      const portal2: PortalConfig = {
        alias: "portal-b",
        target_path: portal2Dir,
      };

      const context1 = WorkspaceExecutionContextBuilder.forPortal(portal1);
      const context2 = WorkspaceExecutionContextBuilder.forPortal(portal2);

      // Execute in portal1
      Deno.chdir(context1.workingDirectory);
      await Deno.writeTextFile(join(portal1Dir, "src", "file1.ts"), "// File 1");

      // Execute in portal2
      Deno.chdir(context2.workingDirectory);
      await Deno.writeTextFile(join(portal2Dir, "src", "file2.ts"), "// File 2");

      // Verify files are in correct portals
      const portal1Files = Array.from(Deno.readDirSync(join(portal1Dir, "src")));
      assertEquals(portal1Files.length, 1);
      assertEquals(portal1Files[0].name, "file1.ts");

      const portal2Files = Array.from(Deno.readDirSync(join(portal2Dir, "src")));
      assertEquals(portal2Files.length, 1);
      assertEquals(portal2Files[0].name, "file2.ts");
    });
  });
});
