import { LogLevel, MCPTransport, MockStrategy, ProviderCostTier, ProviderType } from "../enums.ts";

// ============================================================================
// Path Configuration Defaults
// ============================================================================
export const DEFAULT_WORKSPACE_PATH = "Workspace";
export const DEFAULT_RUNTIME_PATH = ".exo";
export const DEFAULT_MEMORY_PATH = "Memory";
export const DEFAULT_PORTALS_PATH = "Portals";
export const DEFAULT_BLUEPRINTS_PATH = "Blueprints";
export const DEFAULT_ACTIVE_PATH = "Active";
export const DEFAULT_ARCHIVE_PATH = "Archive";
export const DEFAULT_PLANS_PATH = "Plans";
export const DEFAULT_REQUESTS_PATH = "Requests";
export const DEFAULT_REJECTED_PATH = "Rejected";

// Subfolder Defaults (relative to their parent domain)
export const DEFAULT_AGENTS_PATH = "Agents";
export const DEFAULT_FLOWS_PATH = "Flows";
export const DEFAULT_PROJECTS_MEMORY_PATH = "Projects";
export const DEFAULT_EXECUTION_MEMORY_PATH = "Execution";
export const DEFAULT_INDEX_MEMORY_PATH = "Index";
export const DEFAULT_SKILLS_MEMORY_PATH = "Skills";
export const DEFAULT_PENDING_MEMORY_PATH = "Pending";
export const DEFAULT_TASKS_MEMORY_PATH = "Tasks";
export const DEFAULT_GLOBAL_MEMORY_PATH = "Global";

export const ExoPathDefaults = {
  workspace: DEFAULT_WORKSPACE_PATH,
  runtime: DEFAULT_RUNTIME_PATH,
  memory: DEFAULT_MEMORY_PATH,
  portals: DEFAULT_PORTALS_PATH,
  blueprints: DEFAULT_BLUEPRINTS_PATH,
  flows: `${DEFAULT_BLUEPRINTS_PATH}/${DEFAULT_FLOWS_PATH}`,
  requests: DEFAULT_REQUESTS_PATH,
  plans: DEFAULT_PLANS_PATH,
  active: DEFAULT_ACTIVE_PATH,
  archive: DEFAULT_ARCHIVE_PATH,
  rejected: DEFAULT_REJECTED_PATH,
  agents: DEFAULT_AGENTS_PATH,
  memoryProjects: `${DEFAULT_MEMORY_PATH}/${DEFAULT_PROJECTS_MEMORY_PATH}`,
  memoryExecution: `${DEFAULT_MEMORY_PATH}/${DEFAULT_EXECUTION_MEMORY_PATH}`,
  memoryIndex: `${DEFAULT_MEMORY_PATH}/${DEFAULT_INDEX_MEMORY_PATH}`,
  memorySkills: `${DEFAULT_MEMORY_PATH}/${DEFAULT_SKILLS_MEMORY_PATH}`,
  memoryPending: `${DEFAULT_MEMORY_PATH}/${DEFAULT_PENDING_MEMORY_PATH}`,
  memoryTasks: `${DEFAULT_MEMORY_PATH}/${DEFAULT_TASKS_MEMORY_PATH}`,
  memoryGlobal: `${DEFAULT_MEMORY_PATH}/${DEFAULT_GLOBAL_MEMORY_PATH}`,
};

// ============================================================================
// Database Validation Limits
// ============================================================================
export const DATABASE_BATCH_FLUSH_MS_MIN = 10;
export const DATABASE_BATCH_FLUSH_MS_MAX = 10000;
export const DATABASE_BATCH_MAX_SIZE_MIN = 1;
export const DATABASE_BATCH_MAX_SIZE_MAX = 1000;
export const DATABASE_BUSY_TIMEOUT_MS_MIN = 0;
export const DATABASE_BUSY_TIMEOUT_MS_MAX = 30000;

// Database defaults
export const DEFAULT_DATABASE_BATCH_FLUSH_MS = 1000;
export const DEFAULT_DATABASE_BATCH_MAX_SIZE = 100;
export const DEFAULT_DATABASE_JOURNAL_MODE = "WAL";
export const DEFAULT_DATABASE_FOREIGN_KEYS = true;
export const DEFAULT_DATABASE_BUSY_TIMEOUT_MS = 5000;

// ============================================================================
// File Watcher Validation Limits
// ============================================================================
export const WATCHER_DEBOUNCE_MS_MIN = 50;
export const WATCHER_DEBOUNCE_MS_MAX = 5000;

// Watcher defaults
export const DEFAULT_WATCHER_DEBOUNCE_MS = 200;
export const DEFAULT_WATCHER_STABILITY_CHECK = true;
export const DEFAULT_WATCHER_STABILITY_BACKOFF_MS = [50, 100, 200, 500, 1000];
export const DEFAULT_WATCHER_STABILITY_MAX_ATTEMPTS = 5;
export const DEFAULT_WATCHER_STABILITY_MIN_FILE_SIZE = 1;

// ============================================================================
// Agent Validation Limits
// ============================================================================
export const AGENT_TIMEOUT_SEC_MIN = 1;
export const AGENT_TIMEOUT_SEC_MAX = 300;
export const AGENT_MAX_ITERATIONS_MIN = 1;
export const AGENT_MAX_ITERATIONS_MAX = 100;

// Agent defaults
export const DEFAULT_AGENT_MODEL = "default";
export const DEFAULT_AGENT_TIMEOUT_SEC = 60;
export const DEFAULT_AGENT_MAX_ITERATIONS = 10;

// ============================================================================
// AI/LLM Provider Defaults
// ============================================================================
export const DEFAULT_AI_TIMEOUT_MS = 30000;
export const DEFAULT_AI_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_AI_RETRY_BACKOFF_BASE_MS = 1000;
export const DEFAULT_AI_RETRY_TIMEOUT_PER_REQUEST_MS = 30000;

// AI configuration schema defaults
export const DEFAULT_AI_MODEL = "gemini-2.5-flash";
export const DEFAULT_AI_TEMPERATURE_MIN = 0;
export const DEFAULT_AI_TEMPERATURE_MAX = 2;

// ============================================================================
// AI Validation Limits
// ============================================================================
export const AI_TEMPERATURE_MIN = 0;
export const AI_TEMPERATURE_MAX = 2;
export const AI_RETRY_MAX_ATTEMPTS_MIN = 1;
export const AI_RETRY_MAX_ATTEMPTS_MAX = 10;
export const AI_RETRY_BACKOFF_BASE_MS_MIN = 100;
export const AI_RETRY_BACKOFF_BASE_MS_MAX = 10000;
export const AI_RETRY_TIMEOUT_PER_REQUEST_MS_MIN = 1000;
export const AI_RETRY_TIMEOUT_PER_REQUEST_MS_MAX = 300000;
export const AI_TIMEOUT_MS_MIN = 1000;
export const AI_TIMEOUT_MS_MAX = 300000;

// Model-specific timeout defaults
export const DEFAULT_MODEL_TIMEOUT_MS = 30000;
export const DEFAULT_FAST_MODEL_TIMEOUT_MS = 15000;
export const DEFAULT_LOCAL_MODEL_TIMEOUT_MS = 60000;

// Provider-specific retry defaults
export const DEFAULT_OLLAMA_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_OLLAMA_RETRY_BACKOFF_MS = 1000;
export const DEFAULT_ANTHROPIC_RETRY_MAX_ATTEMPTS = 5;
export const DEFAULT_ANTHROPIC_RETRY_BACKOFF_MS = 2000;
export const DEFAULT_OPENAI_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_OPENAI_RETRY_BACKOFF_MS = 1000;
export const DEFAULT_GOOGLE_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_GOOGLE_RETRY_BACKOFF_MS = 1000;

// Provider-specific timeout defaults
export const DEFAULT_OPENAI_TIMEOUT_MS = 30000;
export const DEFAULT_ANTHROPIC_TIMEOUT_MS = 60000;
export const DEFAULT_GOOGLE_TIMEOUT_MS = 30000;
export const DEFAULT_OLLAMA_TIMEOUT_MS = 120000;

// Provider-specific base URLs and models
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.2";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
// Options: gpt-5-mini (default), gpt-5, gpt-5-pro, gpt-5.2, o4-mini, gpt-5-codex
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
// Options: gemini-2.0-flash-exp (default), gemini-2.5-flash, gemini-2.0-flash-lite, gemini-3-pro-latest, gemini-2.5-pro
export const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash";

// ============================================================================
// Mock Provider Validation Limits
// ============================================================================
export const MOCK_DELAY_MS_MIN = 0;
export const MOCK_DELAY_MS_MAX = 5000;
export const MOCK_INPUT_TOKENS_MIN = 1;
export const MOCK_INPUT_TOKENS_MAX = 10000;
export const MOCK_OUTPUT_TOKENS_MIN = 1;
export const MOCK_OUTPUT_TOKENS_MAX = 10000;

// Mock provider defaults
export const MOCK_DELAY_MS = 100;
export const MOCK_INPUT_TOKENS = 100;
export const MOCK_OUTPUT_TOKENS = 200;

// Default mock model name
export const DEFAULT_MOCK_MODEL = "mock-model";

// Additional model names for schema defaults
export const DEFAULT_FAST_MODEL_NAME = "gemini-2.5-flash"; // Was mock-fast, now using recommended fast model name as default
export const DEFAULT_LOCAL_MODEL_NAME = "llama3.2";

// Provider names for schema defaults
export const PROVIDER_MOCK = ProviderType.MOCK;
export const PROVIDER_OLLAMA = ProviderType.OLLAMA;
export const PROVIDER_OPENAI = ProviderType.OPENAI;
export const PROVIDER_ANTHROPIC = ProviderType.ANTHROPIC;
export const PROVIDER_GOOGLE = ProviderType.GOOGLE;

// Provider metadata constants
export const PROVIDER_MOCK_DESCRIPTION = "Mock provider for testing and development";
export const PROVIDER_OLLAMA_DESCRIPTION = "Local Ollama instance for running open-source models";
export const PROVIDER_ANTHROPIC_DESCRIPTION = "Anthropic's Claude models for high-quality AI responses";
export const PROVIDER_OPENAI_DESCRIPTION = "OpenAI's GPT models for versatile AI tasks";
export const PROVIDER_GOOGLE_DESCRIPTION = "Google's Gemini models for multimodal AI";

export const PROVIDER_CAPABILITIES_CHAT = "chat";
export const PROVIDER_CAPABILITIES_STREAMING = "streaming";
export const PROVIDER_CAPABILITIES_VISION = "vision";
export const PROVIDER_CAPABILITIES_TOOLS = "tools";

export const PROVIDER_MOCK_CAPABILITIES = ["chat", "streaming"];
export const PROVIDER_OLLAMA_CAPABILITIES = ["chat", "streaming"];
export const PROVIDER_ANTHROPIC_CAPABILITIES = ["chat", "streaming", "vision"];
export const PROVIDER_OPENAI_CAPABILITIES = ["chat", "streaming", "vision", "tools"];
export const PROVIDER_GOOGLE_CAPABILITIES = ["chat", "streaming", "vision"];

export const PROVIDER_COST_TIER_FREE = ProviderCostTier.FREE;
export const PROVIDER_COST_TIER_PAID = ProviderCostTier.PAID;
export const PROVIDER_COST_TIER_FREEMIUM = ProviderCostTier.FREEMIUM;

export const PROVIDER_MOCK_STRENGTHS = ["testing", "development"];
export const PROVIDER_OLLAMA_STRENGTHS = ["simple", "local", "privacy"];
export const PROVIDER_ANTHROPIC_STRENGTHS = ["complex", "reasoning", "analysis"];
export const PROVIDER_OPENAI_STRENGTHS = ["general", "creative", "complex"];
export const PROVIDER_GOOGLE_STRENGTHS = ["simple", "multimodal", "fast"];

// Health check constants
export const PROVIDER_HEALTH_CHECK_TEST_PROMPT = "Hello";
export const PROVIDER_HEALTH_CHECK_MAX_TOKENS = 1;
export const PROVIDER_HEALTH_CHECK_TEMPERATURE = 0;
export const PROVIDER_HEALTH_CHECK_TIMEOUT_MS = 5000;

// Provider ID generation constants
export const PROVIDER_ID_MOCK_PREFIX = "mock-";
export const PROVIDER_ID_MOCK_DEFAULT_STRATEGY = "recorded";

// Model routing patterns
export const MODEL_ROUTING_LLAMA_PATTERN = /^(codellama:|llama[0-9.]*:)/;

// Default mock strategy
export const DEFAULT_MOCK_STRATEGY = MockStrategy.RECORDED;

// ============================================================================
// UI/Preview Validation Limits
// ============================================================================
export const PROMPT_PREVIEW_LENGTH_MIN = 10;
export const PROMPT_PREVIEW_LENGTH_MAX = 500;
export const PROMPT_PREVIEW_EXTENDED_MIN = 50;
export const PROMPT_PREVIEW_EXTENDED_MAX = 1000;

// UI defaults
export const PROMPT_PREVIEW_LENGTH = 100;
export const PROMPT_PREVIEW_EXTENDED = 500;
export const DEFAULT_ANTHROPIC_API_VERSION = "2023-06-01";
// Options: claude-haiku-4-5-20251001 (default), claude-sonnet-4-5-20250929, claude-opus-4-5-20251101
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_ANTHROPIC_MAX_TOKENS = 4096;

// ============================================================================
// MCP Defaults
// ============================================================================
export const DEFAULT_MCP_ENABLED = true;
export const DEFAULT_MCP_TRANSPORT = MCPTransport.STDIO;
export const DEFAULT_MCP_SERVER_NAME = "exoframe";
export const DEFAULT_MCP_VERSION = "1.0.0";
export const DEFAULT_MCP_AGENT_ID = "system";

// ============================================================================
// Git Operations Validation Limits
// ============================================================================
export const GIT_TIMEOUT_MS_MIN = 1000;
export const GIT_TIMEOUT_MS_MAX = 60000;
export const GIT_MAX_RETRIES_MIN = 1;
export const GIT_MAX_RETRIES_MAX = 10;
export const GIT_RETRY_BACKOFF_BASE_MS_MIN = 100;
export const GIT_RETRY_BACKOFF_BASE_MS_MAX = 10000;
export const GIT_BRANCH_NAME_COLLISION_MAX_RETRIES_MIN = 1;
export const GIT_BRANCH_NAME_COLLISION_MAX_RETRIES_MAX = 10;
export const GIT_TRACE_ID_SHORT_LENGTH_MIN = 4;
export const GIT_TRACE_ID_SHORT_LENGTH_MAX = 16;
export const GIT_BRANCH_SUFFIX_LENGTH_MIN = 4;
export const GIT_BRANCH_SUFFIX_LENGTH_MAX = 16;

// Git defaults
export const DEFAULT_GIT_BRANCH_PREFIX_PATTERN = "^(feature|bugfix|hotfix|chore)/";
export const DEFAULT_GIT_ALLOWED_PREFIXES = ["feature/", "bugfix/", "hotfix/", "chore/"];
export const DEFAULT_GIT_STATUS_TIMEOUT_MS = 10000;
export const DEFAULT_GIT_LS_FILES_TIMEOUT_MS = 15000;
export const DEFAULT_GIT_CHECKOUT_TIMEOUT_MS = 30000;
export const DEFAULT_GIT_CLEAN_TIMEOUT_MS = 20000;
export const DEFAULT_GIT_LOG_TIMEOUT_MS = 20000;
export const DEFAULT_GIT_DIFF_TIMEOUT_MS = 30000;
export const DEFAULT_GIT_COMMAND_TIMEOUT_MS = 60000;
export const DEFAULT_GIT_MAX_RETRIES = 3;
export const DEFAULT_GIT_RETRY_BACKOFF_BASE_MS = 1000;
export const DEFAULT_GIT_BRANCH_NAME_COLLISION_MAX_RETRIES = 5;
export const DEFAULT_GIT_TRACE_ID_SHORT_LENGTH = 8;
export const DEFAULT_GIT_BRANCH_SUFFIX_LENGTH = 8;
export const DEFAULT_GIT_REVERT_CONCURRENCY_LIMIT = 1;
export const DEFAULT_GIT_EXIT_CODE_FATAL = 128;

// ============================================================================
// Rate Limiting Validation Limits
// ============================================================================
export const RATE_LIMIT_MAX_CALLS_PER_MINUTE_MIN = 1;
export const RATE_LIMIT_MAX_CALLS_PER_MINUTE_MAX = 1000;
export const RATE_LIMIT_MAX_TOKENS_PER_HOUR_MIN = 1000;
export const RATE_LIMIT_MAX_TOKENS_PER_HOUR_MAX = 1000000;
export const RATE_LIMIT_MAX_COST_PER_DAY_MIN = 0.01;
export const RATE_LIMIT_MAX_COST_PER_DAY_MAX = 1000;
export const RATE_LIMIT_COST_PER_1K_TOKENS_MIN = 0.001;
export const RATE_LIMIT_COST_PER_1K_TOKENS_MAX = 1;

// Rate limiting defaults
export const DEFAULT_RATE_LIMIT_ENABLED = true;
export const DEFAULT_RATE_LIMIT_MAX_CALLS_PER_MINUTE = 60;
export const DEFAULT_RATE_LIMIT_MAX_TOKENS_PER_HOUR = 100000;
export const DEFAULT_RATE_LIMIT_MAX_COST_PER_DAY = 10.0;
export const DEFAULT_RATE_LIMIT_COST_PER_1K_TOKENS = 0.002;

// Rate limiting time windows (in milliseconds)
export const RATE_LIMIT_WINDOW_MINUTE_MS = 60_000; // 1 minute
export const RATE_LIMIT_WINDOW_HOUR_MS = 3_600_000; // 1 hour
export const RATE_LIMIT_WINDOW_DAY_MS = 86_400_000; // 1 day

// Token estimation constants
export const TOKEN_ESTIMATION_CHARS_PER_TOKEN = 4;
export const TOKEN_ESTIMATION_MAX_TOKENS = 2000;

// ============================================================================
// Cost Tracking Validation Limits
// ============================================================================
export const COST_TRACKING_BATCH_DELAY_MS_MIN = 100;
export const COST_TRACKING_BATCH_DELAY_MS_MAX = 60000;
export const COST_TRACKING_MAX_BATCH_SIZE_MIN = 1;
export const COST_TRACKING_MAX_BATCH_SIZE_MAX = 1000;
export const COST_TRACKING_RATES_MIN = 0;
export const COST_TRACKING_RATES_MAX = 1;

// Cost tracking defaults
export const DEFAULT_COST_TRACKING_BATCH_DELAY_MS = 5000;
export const DEFAULT_COST_TRACKING_MAX_BATCH_SIZE = 50;
// Rates per 1K tokens. Based on 2025-2026 output pricing:
// OpenAI gpt-5-mini: $2.00/1M output → $0.002/1K
export const COST_RATE_OPENAI = 0.002;
// Anthropic claude-haiku-4-5: $5.00/1M output → $0.005/1K
export const COST_RATE_ANTHROPIC = 0.005;
// Google gemini-2.5-flash (Vertex AI): $2.50/1M output → $0.0025/1K
export const COST_RATE_GOOGLE = 0.0025;
export const COST_RATE_OLLAMA = 0.0;
export const COST_RATE_MOCK = 0.0;
export const TOKENS_PER_COST_UNIT = 1000;

// ============================================================================
// Health Check Validation Limits
// ============================================================================
export const HEALTH_CHECK_TIMEOUT_MS_MIN = 1000;
export const HEALTH_CHECK_TIMEOUT_MS_MAX = 300000;
export const HEALTH_CACHE_TTL_MS_MIN = 1000;
export const HEALTH_CACHE_TTL_MS_MAX = 3600000;
export const HEALTH_MEMORY_WARN_PERCENT_MIN = 1;
export const HEALTH_MEMORY_WARN_PERCENT_MAX = 99;
export const HEALTH_MEMORY_CRITICAL_PERCENT_MIN = 1;
export const HEALTH_MEMORY_CRITICAL_PERCENT_MAX = 99;

// Health check defaults
export const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 30000;
export const DEFAULT_HEALTH_CACHE_TTL_MS = 300000;
export const DEFAULT_MEMORY_WARN_PERCENT = 80;
export const DEFAULT_MEMORY_CRITICAL_PERCENT = 95;

// ============================================================================
// Provider Strategy Validation Limits
// ============================================================================
export const PROVIDER_STRATEGY_MAX_DAILY_COST_USD_MIN = 0;
export const PROVIDER_STRATEGY_MAX_DAILY_COST_USD_MAX = 1000;
export const PROVIDER_STRATEGY_BUDGETS_MIN = 0;

// Provider strategy defaults
export const DEFAULT_PROVIDER_STRATEGY_PREFER_FREE = true;
export const DEFAULT_PROVIDER_STRATEGY_ALLOW_LOCAL = true;
export const DEFAULT_PROVIDER_STRATEGY_MAX_DAILY_COST_USD = 5.0;
export const DEFAULT_PROVIDER_STRATEGY_HEALTH_CHECK_ENABLED = true;
export const DEFAULT_PROVIDER_STRATEGY_FALLBACK_ENABLED = true;
export const DEFAULT_PROVIDER_STRATEGY_FALLBACK_CHAINS = {
  "balanced": ["openai", "anthropic", "google"],
  "fast": ["google", "openai"],
  "local_first": ["ollama", "openai"],
};

// ============================================================================
// Provider Validation Limits
// ============================================================================
export const PROVIDER_FREE_QUOTA_REQUESTS_PER_DAY_MIN = 0;
export const PROVIDER_TIMEOUT_MS_MIN = 1000;
export const PROVIDER_TIMEOUT_MS_MAX = 300000;
export const PROVIDER_RATE_LIMIT_RPM_MIN = 1;
export const PROVIDER_RATE_LIMIT_RPM_MAX = 1000;

// ============================================================================
// API Endpoint Defaults
// ============================================================================
export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
export const DEFAULT_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_GOOGLE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_SUBPROCESS_TIMEOUT_MS = 30000;

// ============================================================================
// Keyboard Key Constants
// ============================================================================
export const KEY_ESCAPE = "escape";
export const KEY_ENTER = "enter";
export const KEY_BACKSPACE = "backspace";
export const KEY_UP = "up";
export const KEY_DOWN = "down";
export const KEY_DELETE = "delete";
export const KEY_LEFT = "left";
export const KEY_RIGHT = "right";
export const KEY_HOME = "home";
export const KEY_END = "end";
export const KEY_QUESTION = "?";
export const KEY_SLASH = "/";
export const KEY_SPACE = "space";
export const KEY_F1 = "f1";
export const KEY_0 = "0";
export const KEY_1 = "1";
export const KEY_2 = "2";
export const KEY_3 = "3";
export const KEY_4 = "4";
export const KEY_5 = "5";
export const KEY_6 = "6";
export const KEY_7 = "7";
export const KEY_8 = "8";
export const KEY_9 = "9";
export const KEY_B = "b";
export const KEY_F = "f";
export const KEY_G = "g";
export const KEY_P = "p";
export const KEY_Q = "q";
export const KEY_E = "e";
export const KEY_J = "j";
export const KEY_N = "n";
export const KEY_S = "s";
export const KEY_A = "a";
export const KEY_R = "r";
export const KEY_K = "k";
export const KEY_L = "l";
export const KEY_T = "t";
export const KEY_C = "c";
export const KEY_D = "d";
export const KEY_H = "h";
export const KEY_M = "m";
export const KEY_V = "v";
export const KEY_Y = "y";
export const KEY_Z = "z";
export const KEY_CAPITAL_P = "P";
export const KEY_CAPITAL_R = "R";
export const KEY_CAPITAL_T = "T";
export const KEY_CAPITAL_A = "A";
export const KEY_CAPITAL_E = "E";
export const KEY_TAB = "tab";
export const KEY_SHIFT_TAB = "Shift+Tab";
export const KEY_1_TO_7 = "1-7";
export const KEY_CTRL_LEFT = "Ctrl+Left";
export const KEY_CTRL_RIGHT = "Ctrl+Right";
export const KEY_CTRL_UP = "Ctrl+Up";
export const KEY_CTRL_DOWN = "Ctrl+Down";
export const KEY_ESC_Q = "Esc/q";
export const KEY_CAPITAL_C = "C";

// ============================================================================
// Agent Status Constants
// ============================================================================

// ============================================================================
// General Status Constants
// ============================================================================

// ============================================================================
// Memory Scope Constants
// ============================================================================
export const MEMORY_SCOPE_GLOBAL = "global";
export const MEMORY_SCOPE_PROJECTS = "projects";
export const MEMORY_SCOPE_EXECUTIONS = "executions";
export const MEMORY_SCOPE_PENDING = "pending";
export const MEMORY_SCOPE_SEARCH = "search";

export type MemoryTuiScope =
  | typeof MEMORY_SCOPE_GLOBAL
  | typeof MEMORY_SCOPE_PROJECTS
  | typeof MEMORY_SCOPE_EXECUTIONS
  | typeof MEMORY_SCOPE_PENDING
  | typeof MEMORY_SCOPE_SEARCH;

// ============================================================================
// Logging Defaults
// ============================================================================
export const DEFAULT_LOG_LEVEL = LogLevel.INFO;
export const DEFAULT_LOG_MAX_SIZE_MB = 10;
export const DEFAULT_LOG_MAX_FILES = 5;
export const LOG_FILE_PREFIX = "structured-log";
export const LOG_FILE_EXTENSION = ".jsonl";

// ============================================================================
// CLI Display and Validation Constants
// ============================================================================
export const CLI_SEPARATOR_LENGTH = 50;
export const CLI_SEPARATOR_MEDIUM = 60;
export const CLI_SEPARATOR_LONG = 70;
export const CLI_SEPARATOR_WIDE = 80;
export const CLI_SEPARATOR_SHORT = 30;
export const CLI_SEPARATOR_NARROW = 40;
export const CLI_PREVIEW_LENGTH_SHORT = 50;
export const CLI_PREVIEW_LENGTH_LONG = 500;
export const PORTAL_ALIAS_MAX_LENGTH = 50;

export const CLI_LAYOUT_SKILL_ID_WIDTH = 20;
export const CLI_LAYOUT_SKILL_NAME_WIDTH = 23;
export const CLI_LAYOUT_SKILL_SOURCE_WIDTH = 8;
export const CLI_LAYOUT_SKILL_VERSION_WIDTH = 7;
export const CLI_LAYOUT_SKILL_STATUS_WIDTH = 10;
export const CLI_LAYOUT_BOX_WIDTH_WIDE = 57;
export const CLI_LAYOUT_BOX_WIDTH_STANDARD = 47;
export const CLI_LAYOUT_BOX_LABEL_WIDTH = 55;
export const CLI_LAYOUT_BOX_INDENT_WIDTH = 43;
export const CLI_LAYOUT_PADDING_STANDARD = 20;

export const CLI_TRUNCATE_TITLE_SHORT = 28;
export const CLI_TRUNCATE_TITLE_MEDIUM = 35;
export const CLI_TRUNCATE_ID_SHORT = 8;
export const CLI_TRUNCATE_ID_LONG = 36;

export const LOG_RENDERER_MAX_MESSAGE_LENGTH = 100;
export const LOG_RENDERER_TRACE_ID_LENGTH = 8;
export const LOG_RENDERER_SEPARATOR_LENGTH = 50;

export const TIME_MS_PER_SECOND = 1000;
export const TIME_MS_PER_MINUTE = 60_000;
export const TIME_MS_PER_HOUR = 3_600_000;
// ============================================================================
// Retry and Error Constants
// ============================================================================

/** Error types that should trigger a retry */
export const RETRYABLE_ERROR_TYPES = [
  "RateLimitError",
  "TimeoutError",
  "NetworkError",
  "ServiceUnavailable",
  "InternalServerError",
  "ConnectionError",
  "ECONNRESET",
  "ETIMEDOUT",
];

/** Message substrings that indicate a retryable condition */
export const RETRYABLE_MESSAGE_PATTERNS = [
  "rate limit",
  "timeout",
  "network",
  "unavailable",
  "internal server",
  "connection",
  "econnreset",
  "etimedout",
  "socket hang up",
];

/** HTTP status codes that are considered retryable */
export const RETRYABLE_HTTP_STATUS_CODES = [
  "429", // Too Many Requests
  "500", // Internal Server Error
  "502", // Bad Gateway
  "503", // Service Unavailable
  "504", // Gateway Timeout
];

// ============================================================================
// General System Limits and Thresholds
// ============================================================================

/** Maximum length for names (portals, agents, etc.) */
export const MAX_NAME_LENGTH = 50;

/** Maximum length for unique identifiers */
export const MAX_ID_LENGTH = 50;

/** Default limit for database and service queries */
export const DEFAULT_QUERY_LIMIT = 50;

/** Minimum length threshold for meaningful content (summary, prompt, etc.) */
export const MIN_CONTENT_THRESHOLD = 50;

/** Default refresh interval for TUI views */
export const DEFAULT_REFRESH_INTERVAL_MS = 5000;

/** Timeout for acquiring file locks */
export const LOCK_ACQUIRE_TIMEOUT_MS = 5000;

/** Timeout for stopping the daemon */
export const DAEMON_STOP_TIMEOUT_MS = 5000;

/** Max delay for database retries */
export const DB_MAX_RETRY_DELAY_MS = 5000;

/** Maximum length for blueprint names */
export const BLUEPRINT_NAME_MAX_LENGTH = 100;

/** Maximum length for user requests */
export const USER_REQUEST_MAX_LENGTH = 10000;

/** Maximum length for plan content */
export const PLAN_CONTENT_MAX_LENGTH = 50000;

/** Maximum length for model names */
export const MODEL_NAME_MAX_LENGTH = 100;

/** Maximum length for filenames */
export const FILENAME_MAX_LENGTH = 255;

/** Maximum length for file paths */
export const PATH_MAX_LENGTH = 4096;

/** Default timeout for agent execution in milliseconds */
export const DEFAULT_AGENT_TIMEOUT_MS = 300000;

/** Maximum length for system prompts */
export const MAX_PROMPT_LENGTH = 50000;

/** Confidence Score Thresholds */
export const CONFIDENCE_THRESHOLD_VERY_LOW = 30;
export const CONFIDENCE_THRESHOLD_LOW = 50;
export const CONFIDENCE_THRESHOLD_MEDIUM = 70;
export const CONFIDENCE_THRESHOLD_HIGH = 90;

/** Default Confidence Thresholds */
export const CONFIDENCE_DEFAULT_LOW_THRESHOLD = 50;
export const CONFIDENCE_DEFAULT_VERY_LOW_THRESHOLD = 30;
export const CONFIDENCE_DEFAULT_HIGH_THRESHOLD = 80;

/** Confidence Scoring Base Values */
export const CONFIDENCE_SCORE_BASE = 70;

/** Confidence Adjustments */
export const CONFIDENCE_ADJUSTMENT_CERTAIN = 3;
export const CONFIDENCE_ADJUSTMENT_UNCERTAIN = -8;
export const CONFIDENCE_ADJUSTMENT_HEDGING = -5;
export const CONFIDENCE_ADJUSTMENT_QUALIFIER = -2;
export const CONFIDENCE_ADJUSTMENT_QUESTION = -10;
export const CONFIDENCE_ADJUSTMENT_SHORT = -15;
export const CONFIDENCE_ADJUSTMENT_VERY_SHORT = -20;

/** Confidence Length Thresholds */
export const CONFIDENCE_LENGTH_THRESHOLD_SHORT = 50;
export const CONFIDENCE_LENGTH_THRESHOLD_VERY_SHORT = 20;

// ============================================================================
// Agent Status Constants
// ============================================================================
export const AGENT_STATUS_ACTIVE = "active";
export const AGENT_STATUS_INACTIVE = "inactive";
export const AGENT_STATUS_ERROR = "error";
export const AGENT_STATUS_ORDER = [AGENT_STATUS_ACTIVE, AGENT_STATUS_INACTIVE, AGENT_STATUS_ERROR];
