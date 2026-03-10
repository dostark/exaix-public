import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { GitCommitTool } from "../../../src/mcp/handlers/git_commit_tool.ts";
import { initToolPermissionTest } from "../helpers/test_setup.ts";
import { PortalOperation } from "../../../src/shared/enums.ts";
import { createStubConfig, createStubContext } from "../../test_helpers.ts";
import { PortalPermissionsService } from "../../../src/services/portal_permissions.ts";
import { join } from "@std/path";
import { SafeSubprocess } from "../../../src/helpers/subprocess.ts";

Deno.test("GitCommitTool: commits changes successfully", async () => {
  const env = await initToolPermissionTest({
    operations: [PortalOperation.GIT],
    initGit: true,
  });

  try {
    const context = createStubContext({
      config: createStubConfig(env.config),
    });

    // Create uncommitted change
    await Deno.writeTextFile(join(env.portalPath, "test_file.txt"), "some content");

    const handler = new GitCommitTool(context, new PortalPermissionsService([env.permissions]));
    const result = await handler.execute({
      portal: "TestPortal",
      message: "Test commit message",
      agent_id: "test-agent",
    });

    assertEquals(!!(result as any).isError, false);
    assertStringIncludes((result.content[0] as any).text, "Test commit message");
  } finally {
    await env.cleanup();
  }
});

Deno.test("GitCommitTool: commits specific files successfully", async () => {
  const env = await initToolPermissionTest({
    operations: [PortalOperation.GIT],
    initGit: true,
  });

  try {
    const context = createStubContext({
      config: createStubConfig(env.config),
    });

    // Create uncommitted changes
    await Deno.writeTextFile(join(env.portalPath, "test_file1.txt"), "some content 1");
    // Explicitly add first file
    await SafeSubprocess.run("git", ["add", "test_file1.txt"], { cwd: env.portalPath });

    await Deno.writeTextFile(join(env.portalPath, "test_file2.txt"), "some content 2");

    const handler = new GitCommitTool(context, new PortalPermissionsService([env.permissions]));
    const result = await handler.execute({
      portal: "TestPortal",
      message: "Test commit message",
      files: ["test_file2.txt"],
      agent_id: "test-agent",
    });

    assertEquals(!!(result as any).isError, false);
    assertStringIncludes((result.content[0] as any).text, "Test commit message");
  } finally {
    await env.cleanup();
  }
});

Deno.test("GitCommitTool: returns error when git commit fails", async () => {
  const env = await initToolPermissionTest({
    operations: [PortalOperation.GIT],
    initGit: true,
  });

  try {
    const context = createStubContext({
      config: createStubConfig(env.config),
    });

    const handler = new GitCommitTool(context, new PortalPermissionsService([env.permissions]));
    await assertRejects(
      () =>
        handler.execute({
          portal: "TestPortal",
          message: "Test commit message",
          agent_id: "test-agent",
        }),
      Error,
      "Failed to commit: ",
    );
  } finally {
    await env.cleanup();
  }
});

Deno.test("GitCommitTool: returns error when access is denied", async () => {
  const env = await initToolPermissionTest({
    operations: [PortalOperation.READ], // No GIT permission
    initGit: true,
  });

  try {
    const context = createStubContext({
      config: createStubConfig(env.config),
    });

    const handler = new GitCommitTool(context, new PortalPermissionsService([env.permissions]));
    await assertRejects(
      () =>
        handler.execute({
          portal: "TestPortal",
          message: "Test commit message",
          agent_id: "test-agent",
        }),
      Error,
      "Operation 'git' is not permitted",
    );
  } finally {
    await env.cleanup();
  }
});

Deno.test("GitCommitTool: getToolDefinition returns correct definition", () => {
  const context = createStubContext();
  const handler = new GitCommitTool(context);
  const def = handler.getToolDefinition();

  assertEquals(def.name, "git_commit");
  assertEquals(Array.isArray(def.inputSchema.required), true);
  assertStringIncludes(def.inputSchema.required.join(), "portal");
  assertStringIncludes(def.inputSchema.required.join(), "message");
});
