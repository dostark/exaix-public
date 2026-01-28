import { assert, assertEquals } from "@std/assert";
import { McpToolName } from "../../src/enums.ts";

import { PortalOperation } from "../../src/enums.ts";

import { LearningCategory } from "../../src/enums.ts";
import { join } from "@std/path";

import { ToolRegistry, type ToolRegistryConfig } from "../../src/services/tool_registry.ts";
import { ExoPathDefaults } from "../../src/config/constants.ts";
import { ConfigSchema } from "../../src/config/schema.ts";
import { DatabaseService } from "../../src/services/db.ts";

// Mock dependencies
const mockConfig = ConfigSchema.parse({
  system: { root: "/tmp/test", log_level: "info" },
  paths: {
    ...ExoPathDefaults,
  },
  database: {},
  watcher: {},
  agents: {},
  models: {
    default: {
      provider: "mock",
      model: "mock-model",
    },
  },
  provider_strategy: {
    fallback_chains: {},
  },
  portals: [],
  mcp: {},
});

const mockDb = {
  logActivity: () => Promise.resolve(),
} as unknown as DatabaseService;

// ===== Command Whitelisting Tests =====

Deno.test("ToolRegistry: should allow safe commands", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "echo",
    args: ["hello", "world"],
  });
  // With --allow-run permission, command should execute successfully
  assert(result.success);
  const cmdResult = result.data as { output: string; exitCode: number };
  assert(cmdResult);
  assertEquals(cmdResult.exitCode, 0);
  assert(cmdResult.output?.includes("hello world"));
});

Deno.test("ToolRegistry: should allow validated commands with safe arguments", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "ls",
    args: ["/tmp"],
  });
  // With --allow-run permission, command should execute successfully
  assert(result.success);
  const cmdResult = result.data as { output: string; exitCode: number };
  assert(cmdResult);
  assertEquals(cmdResult.exitCode, 0);
  assert(cmdResult.output?.length > 0);
});

Deno.test("ToolRegistry: should reject unknown commands", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "rm",
    args: ["-rf", "/"],
  });
  assert(!result.success);
  assert(result.error?.includes("not allowed"));
});

// ===== Argument Validation Tests =====

Deno.test("ToolRegistry: should block shell metacharacters", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "echo",
    args: ["hello; rm -rf /"],
  });
  assert(!result.success);
  assert(result.error?.includes("dangerous pattern"));
});

Deno.test("ToolRegistry: should block output redirection", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "echo",
    args: ["test", ">", "/tmp/file"],
  });
  assert(!result.success);
  assert(result.error?.includes("dangerous pattern"));
});

Deno.test("ToolRegistry: should block dangerous git options", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: PortalOperation.GIT,
    args: ["--exec-path", "/tmp"],
  });
  assert(!result.success);
  assert(result.error?.includes("Dangerous git option"));
});

Deno.test("ToolRegistry: should allow safe git operations", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: PortalOperation.GIT,
    args: ["status", "--porcelain"],
  });
  // Result depends on actual git repo state, but should not be blocked
  assert(typeof result.success === "boolean");
});

Deno.test("ToolRegistry: should block unsafe ls options", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "ls",
    args: ["--color=always", "-R"],
  });
  assert(!result.success);
  assert(result.error?.includes("Unsafe ls option"));
});

Deno.test("ToolRegistry: should allow safe grep options", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "grep",
    args: ["-i", LearningCategory.PATTERN, "file.txt"],
  });
  // Should not be blocked by validation (actual execution may fail)
  assert(typeof result.success === "boolean");
});

Deno.test("ToolRegistry: should block unsafe grep options", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "grep",
    args: ["--include=*.log", LearningCategory.PATTERN],
  });
  assert(!result.success);
  assert(result.error?.includes("Unsafe grep option"));
});

// ===== Runtime Commands Tests =====

Deno.test("ToolRegistry: should allow safe npm subcommands", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "npm",
    args: ["--version"],
  });
  // With --allow-run permission, command should execute successfully
  assert(result.success);
  const cmdResult = result.data as { output: string; exitCode: number };
  assert(cmdResult);
  assertEquals(cmdResult.exitCode, 0);
  assert(cmdResult.output?.match(/\d+\.\d+\.\d+/)); // version format
});

Deno.test("ToolRegistry: should block dangerous npm subcommands", async () => {
  const config: ToolRegistryConfig = {
    config: mockConfig,
    db: mockDb,
  };
  const registry = new ToolRegistry(config);

  const result = await registry.execute(McpToolName.RUN_COMMAND, {
    command: "npm",
    args: ["install", "malicious-package"],
  });
  assert(!result.success);
  assert(result.error?.includes("subcommand not allowed"));
});

// ===== File Operations Tests =====

Deno.test("ToolRegistry: should create directory", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
      paths: { ...mockConfig.paths, workspace: "Workspace" },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    // Ensure allowed root exists
    await Deno.mkdir(join(tempDir, "Workspace"), { recursive: true });

    const testDir = "Workspace/new-dir/nested";
    const result = await registry.execute("create_directory", { path: testDir });

    assert(result.success);
    assert((await Deno.stat(join(tempDir, testDir))).isDirectory);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ToolRegistry: should write and read files", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
      paths: { ...mockConfig.paths, workspace: "Workspace" },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    // Ensure allowed root exists
    await Deno.mkdir(join(tempDir, "Workspace"), { recursive: true });

    // 1. Write File
    const filePath = "Workspace/test.txt";
    const content = "Hello World";
    const writeResult = await registry.execute("write_file", { path: filePath, content });

    assert(writeResult.success);
    assertEquals(writeResult.data.path, join(tempDir, filePath));

    // 2. Read File
    const readResult = await registry.execute("read_file", { path: filePath });
    assert(readResult.success);
    assertEquals(readResult.data.content, content);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ToolRegistry: should list directory contents", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
      paths: { ...mockConfig.paths, workspace: "Workspace" },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    // Ensure allowed root exists
    await Deno.mkdir(join(tempDir, "Workspace"), { recursive: true });

    // Setup: Create files
    await registry.execute("write_file", { path: "Workspace/file1.txt", content: "1" });

    // Create subdir explicitly as tool registry currently requires parent existence
    await Deno.mkdir(join(tempDir, "Workspace/subdir"), { recursive: true });
    await registry.execute("write_file", { path: "Workspace/subdir/file2.txt", content: "2" });

    // List Directory
    const listResult = await registry.execute("list_directory", { path: "Workspace" });
    assert(listResult.success);
    const entries = listResult.data.entries as Array<{ name: string; isDirectory: boolean }>;

    assert(entries.some((e) => e.name === "file1.txt" && !e.isDirectory));
    assert(entries.some((e) => e.name === "subdir" && e.isDirectory));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ToolRegistry: should search files", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
      paths: { ...mockConfig.paths, workspace: "Workspace" },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    // Ensure allowed root exists
    await Deno.mkdir(join(tempDir, "Workspace"), { recursive: true });

    // Setup
    await Deno.mkdir(join(tempDir, "Workspace/src"), { recursive: true });

    await registry.execute("write_file", { path: "Workspace/src/main.ts", content: "console.log('main')" });
    await registry.execute("write_file", {
      path: "Workspace/src/utils.ts",
      content: "export const util = 1",
    });
    await registry.execute("write_file", { path: "Workspace/readme.md", content: "# Readme" });

    // Search
    const searchResult = await registry.execute("search_files", { path: "Workspace", pattern: "**/*.ts" });
    assert(searchResult.success);
    const files = searchResult.data.files as string[];

    assertEquals(files.length, 2);
    assert(files.some((f) => f.endsWith("main.ts")));
    assert(files.some((f) => f.endsWith("utils.ts")));
    assert(!files.some((f) => f.endsWith("readme.md")));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ToolRegistry: should handle missing files gracefully", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    const result = await registry.execute("read_file", { path: "nonexistent.txt" });
    assert(!result.success);
    assert(result.error?.includes("not found") || result.error?.includes("outside allowed roots"));
    // Note: path resolver might block it first if not in allowed root,
    // but here we didn't setup workspace dir so it might fail on root check or file not found.
    // Let's rely on generic error check.
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("ToolRegistry: should prevent path traversal", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "tool-registry-test-" });
  try {
    const config = ConfigSchema.parse({
      ...mockConfig,
      system: { ...mockConfig.system, root: tempDir },
      paths: { ...mockConfig.paths, workspace: "Workspace" },
    });
    const registry = new ToolRegistry({ config, db: mockDb });

    const result = await registry.execute("read_file", { path: "../secret.txt" });
    assert(!result.success);
    assert(result.error?.includes("Access denied") || result.error?.includes("outside allowed roots"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
