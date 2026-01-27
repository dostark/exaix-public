import type { Config } from "../../src/config/schema.ts";
import { MCPTransport } from "../../src/enums.ts";
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
  return {
    system: {
      root,
      log_level: DEFAULTS.DEFAULT_LOG_LEVEL,
      version: "1.0.0",
      ...overrides.system,
    },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      blueprints: "Blueprints",
      portals: "Portals",
      active: "Active",
      archive: "Archive",
      plans: "Plans",
      requests: "Requests",
      rejected: "Rejected",
      agents: "Agents",
      flows: "Flows",
      memoryProjects: "Projects",
      memoryExecution: "Execution",
      memoryIndex: "Index",
      memorySkills: "Skills",
      memoryPending: "Pending",
      memoryTasks: "Tasks",
      memoryGlobal: "Global",
      ...overrides.paths,
    },
    database: {
      batch_flush_ms: 100,
      batch_max_size: 100,
      sqlite: {
        journal_mode: SqliteJournalMode.WAL,
        foreign_keys: true,
        busy_timeout_ms: 5000,
      },
    },
    watcher: {
      debounce_ms: overrides.watcher?.debounce_ms ?? 200,
      stability_check: overrides.watcher?.stability_check ?? true,
    },
    agents: {
      default_model: "default",
      timeout_sec: 60,
      max_iterations: 10,
    },
    models: overrides.models || {
      default: { provider: "mock", model: "gpt-5.2-pro", timeout_ms: 30000 },
      fast: { provider: "mock", model: "gpt-5.2-pro-mini", timeout_ms: 30000 },
      local: { provider: "ollama", model: "llama3.2", timeout_ms: 30000 },
    },
    portals: overrides.portals || [],
    mcp: overrides.mcp || {
      enabled: true,
      transport: MCPTransport.STDIO,
      server_name: "exoframe",
      version: "1.0.0",
    },
    // Added fields required by Config schema
    ai_endpoints: overrides.ai_endpoints || {},
    ai_retry: overrides.ai_retry || {
      max_attempts: DEFAULTS.DEFAULT_AI_RETRY_MAX_ATTEMPTS,
      backoff_base_ms: DEFAULTS.DEFAULT_AI_RETRY_BACKOFF_BASE_MS,
      timeout_per_request_ms: DEFAULTS.DEFAULT_AI_RETRY_TIMEOUT_PER_REQUEST_MS,
    },
    ai_anthropic: overrides.ai_anthropic || {
      api_version: DEFAULTS.DEFAULT_ANTHROPIC_API_VERSION,
      default_model: DEFAULTS.DEFAULT_ANTHROPIC_MODEL,
      max_tokens_default: DEFAULTS.DEFAULT_ANTHROPIC_MAX_TOKENS,
    },
    mcp_defaults: overrides.mcp_defaults || {
      agent_id: DEFAULTS.DEFAULT_MCP_AGENT_ID,
    },
    git: overrides.git || {
      branch_prefix_pattern: DEFAULTS.DEFAULT_GIT_BRANCH_PREFIX_PATTERN,
      allowed_prefixes: DEFAULTS.DEFAULT_GIT_ALLOWED_PREFIXES,
      operations: {
        status_timeout_ms: DEFAULTS.DEFAULT_GIT_STATUS_TIMEOUT_MS,
        ls_files_timeout_ms: DEFAULTS.DEFAULT_GIT_LS_FILES_TIMEOUT_MS,
        checkout_timeout_ms: DEFAULTS.DEFAULT_GIT_CHECKOUT_TIMEOUT_MS,
        clean_timeout_ms: DEFAULTS.DEFAULT_GIT_CLEAN_TIMEOUT_MS,
        log_timeout_ms: DEFAULTS.DEFAULT_GIT_LOG_TIMEOUT_MS,
        diff_timeout_ms: DEFAULTS.DEFAULT_GIT_DIFF_TIMEOUT_MS,
        command_timeout_ms: DEFAULTS.DEFAULT_GIT_COMMAND_TIMEOUT_MS,
        max_retries: DEFAULTS.DEFAULT_GIT_MAX_RETRIES,
        retry_backoff_base_ms: DEFAULTS.DEFAULT_GIT_RETRY_BACKOFF_BASE_MS,
        branch_name_collision_max_retries: DEFAULTS.DEFAULT_GIT_BRANCH_NAME_COLLISION_MAX_RETRIES,
        trace_id_short_length: DEFAULTS.DEFAULT_GIT_TRACE_ID_SHORT_LENGTH,
        branch_suffix_length: DEFAULTS.DEFAULT_GIT_BRANCH_SUFFIX_LENGTH,
      },
    },
    rate_limiting: overrides.rate_limiting || {
      enabled: true,
      max_calls_per_minute: 60,
      max_tokens_per_hour: 100000,
      max_cost_per_day: 50,
      cost_per_1k_tokens: 0.03,
    },
    ai_timeout: overrides.ai_timeout || {
      default_ms: DEFAULTS.DEFAULT_AI_TIMEOUT_MS,
      providers: {
        ollama: DEFAULTS.DEFAULT_OLLAMA_TIMEOUT_MS,
        anthropic: DEFAULTS.DEFAULT_ANTHROPIC_TIMEOUT_MS,
        openai: DEFAULTS.DEFAULT_OPENAI_TIMEOUT_MS,
        google: DEFAULTS.DEFAULT_GOOGLE_TIMEOUT_MS,
      },
    },
    provider_strategy: overrides.provider_strategy || {
      prefer_free: DEFAULTS.DEFAULT_PROVIDER_STRATEGY_PREFER_FREE,
      allow_local: DEFAULTS.DEFAULT_PROVIDER_STRATEGY_ALLOW_LOCAL,
      max_daily_cost_usd: DEFAULTS.DEFAULT_PROVIDER_STRATEGY_MAX_DAILY_COST_USD,
      health_check_enabled: DEFAULTS.DEFAULT_PROVIDER_STRATEGY_HEALTH_CHECK_ENABLED,
      fallback_enabled: DEFAULTS.DEFAULT_PROVIDER_STRATEGY_FALLBACK_ENABLED,
      fallback_chains: {},
    },
    providers: overrides.providers || {},
    mock: overrides.mock || {
      delay_ms: DEFAULTS.MOCK_DELAY_MS,
      input_tokens: DEFAULTS.MOCK_INPUT_TOKENS,
      output_tokens: DEFAULTS.MOCK_OUTPUT_TOKENS,
    },
    ui: overrides.ui || {
      prompt_preview_length: DEFAULTS.PROMPT_PREVIEW_LENGTH,
      prompt_preview_extended: DEFAULTS.PROMPT_PREVIEW_EXTENDED,
    },
    cost_tracking: overrides.cost_tracking || {
      batch_delay_ms: DEFAULTS.DEFAULT_COST_TRACKING_BATCH_DELAY_MS,
      max_batch_size: DEFAULTS.DEFAULT_COST_TRACKING_MAX_BATCH_SIZE,
      rates: {
        openai: DEFAULTS.COST_RATE_OPENAI,
        anthropic: DEFAULTS.COST_RATE_ANTHROPIC,
        google: DEFAULTS.COST_RATE_GOOGLE,
        ollama: DEFAULTS.COST_RATE_OLLAMA,
        mock: DEFAULTS.COST_RATE_MOCK,
      },
    },
    health: overrides.health || {
      check_timeout_ms: DEFAULTS.DEFAULT_HEALTH_CHECK_TIMEOUT_MS,
      cache_ttl_ms: DEFAULTS.DEFAULT_HEALTH_CACHE_TTL_MS,
      memory_warn_percent: DEFAULTS.DEFAULT_MEMORY_WARN_PERCENT,
      memory_critical_percent: DEFAULTS.DEFAULT_MEMORY_CRITICAL_PERCENT,
    },
  };
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
memory = "Memory"
blueprints = "Blueprints"
runtime = ".exo"
portals = "Portals"
workspace = "Workspace"
active = "Active"
archive = "Archive"
plans = "Plans"
requests = "Requests"
rejected = "Rejected"
agents = "Agents"
flows = "Flows"
memoryProjects = "Projects"
memoryExecution = "Execution"
memoryIndex = "Index"
memorySkills = "Skills"
memoryPending = "Pending"
memoryTasks = "Tasks"
memoryGlobal = "Global"

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
default_model = "claude-opus-4.5"
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
