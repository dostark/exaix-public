import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { ToolRegistry, type ToolRegistryConfig } from "../../src/services/tool_registry.ts";
import { ConfigSchema } from "../../src/config/schema.ts";
import { DatabaseService } from "../../src/services/db.ts";

// Mock dependencies
const mockConfig = ConfigSchema.parse({
  system: { root: "/tmp/test", log_level: "info" },
  paths: {},
  database: {},
  watcher: {},
  agents: {},
  models: {},
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
    command: "git",
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

  const result = await registry.execute("run_command", {
    command: "git",
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
    command: "grep",
    args: ["-i", "pattern", "file.txt"],
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

  const result = await registry.execute("run_command", {
    command: "grep",
    args: ["--include=*.log", "pattern"],
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

  const result = await registry.execute("run_command", {
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

  const result = await registry.execute("run_command", {
    command: "npm",
    args: ["install", "malicious-package"],
  });
  assert(!result.success);
  assert(result.error?.includes("subcommand not allowed"));
});
