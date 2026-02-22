import { type Config, ConfigSchema } from "../../src/config/schema.ts";
import { ConfigService } from "../../src/config/service.ts";
import { join } from "@std/path";
import * as DEFAULTS from "../../src/config/constants.ts";
import { SqliteJournalMode } from "../../src/enums.ts";

/**
 * Creates a mock configuration for testing.
 * @param root The root directory for the mock system.
 * @param overrides Optional overrides for specific config sections.
 */
export function createMockConfig(root: string, overrides: Partial<Config> = {}): Config {
  const defaultModels = {
    default: { provider: "mock", model: "gpt-5.2-pro", timeout_ms: 30000 },
    fast: { provider: "mock", model: "gpt-5.2-pro-mini", timeout_ms: 30000 },
    local: { provider: "ollama", model: "llama3.2", timeout_ms: 30000 },
  };

  return ConfigSchema.parse({
    ...overrides,
    system: {
      ...(overrides.system ?? {}),
      root,
      version: overrides.system?.version ?? "1.0.0",
    },
    // Provide an object so nested defaults apply
    paths: overrides.paths ?? {},
    // Provide stable defaults used by many tests, while still allowing overrides.
    database: overrides.database ?? {
      batch_flush_ms: 100,
      batch_max_size: 100,
      sqlite: {
        journal_mode: SqliteJournalMode.WAL,
        foreign_keys: true,
        busy_timeout_ms: 5000,
      },
      failure_threshold: 5,
      reset_timeout_ms: 60000,
      half_open_success_threshold: 2,
    },
    models: overrides.models ?? defaultModels,
    provider_strategy: {
      ...(overrides.provider_strategy ?? {}),
      fallback_chains: overrides.provider_strategy?.fallback_chains ?? {},
    },
  });
}

/**
 * Creates a test config file and ConfigService for testing
 */
export async function createTestConfigService(root: string): Promise<ConfigService> {
  const configPath = join(root, "exo.config.toml");

  const configContent = `[system]
version = "1.0.0"
log_level = "info"
root = "${root}"

[paths]
memory = "${DEFAULTS.ExoPathDefaults.memory}"
blueprints = "${DEFAULTS.ExoPathDefaults.blueprints}"
runtime = "${DEFAULTS.ExoPathDefaults.runtime}"
portals = "${DEFAULTS.ExoPathDefaults.portals}"
workspace = "${DEFAULTS.ExoPathDefaults.workspace}"
active = "${DEFAULTS.ExoPathDefaults.active}"
archive = "${DEFAULTS.ExoPathDefaults.archive}"
plans = "${DEFAULTS.ExoPathDefaults.plans}"
requests = "${DEFAULTS.ExoPathDefaults.requests}"
rejected = "${DEFAULTS.ExoPathDefaults.rejected}"
agents = "${DEFAULTS.ExoPathDefaults.agents}"
flows = "${DEFAULTS.ExoPathDefaults.flows}"
memoryProjects = "${DEFAULTS.ExoPathDefaults.memoryProjects}"
memoryExecution = "${DEFAULTS.ExoPathDefaults.memoryExecution}"
memoryIndex = "${DEFAULTS.ExoPathDefaults.memoryIndex}"
memorySkills = "${DEFAULTS.ExoPathDefaults.memorySkills}"
memoryPending = "${DEFAULTS.ExoPathDefaults.memoryPending}"
memoryTasks = "${DEFAULTS.ExoPathDefaults.memoryTasks}"
memoryGlobal = "${DEFAULTS.ExoPathDefaults.memoryGlobal}"

[database]
batch_flush_ms = 100
batch_max_size = 100

[database.sqlite]
journal_mode = "WAL"
foreign_keys = true
busy_timeout_ms = 5000

[watcher]
debounce_ms = 200
stability_check = true

[agents]
default_model = "default"
timeout_sec = 60
  max_iterations = 10

[models.default]
provider = "mock"
model = "gpt-5.2-pro"

[models.fast]
provider = "mock"
model = "gpt-5.2-pro-mini"

[models.local]
provider = "ollama"
model = "llama3.2"

[ai_endpoints]
ollama = ""
anthropic = ""
openai = ""
google = ""

[ai_retry]
max_attempts = 3
backoff_base_ms = 1000
timeout_per_request_ms = 30000

[ai_anthropic]
api_version = "2023-06-01"
default_model = "claude-opus-4-6"
max_tokens_default = 4096

[mcp_defaults]
agent_id = "system"

[git]
branch_prefix_pattern = "^(feat|fix|docs|chore|refactor|test)/"
allowed_prefixes = ["feat", "fix", "docs", "chore", "refactor", "test"]

[provider_strategy.fallback_chains]
# Empty to avoid validation errors with default chains referencing non-existent models
`;

  await Deno.writeTextFile(configPath, configContent);

  // Create service with absolute path
  const service = new ConfigService(configPath);

  return service;
}
