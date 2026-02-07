// ============================================================================
// Testing Constants
// ============================================================================
// This module contains constants used exclusively in test files.
// For production constants, see src/config/constants.ts

// Test Prompts
export const REGRESSION_TEST_PROMPT = "Hello, reply with 'OK'";
export const TEST_LOG_PREVIEW_LENGTH = 50;

// Test Timeouts (in milliseconds)
export const REGRESSION_TEST_TIMEOUT_MS = 30000;

// ============================================================================
// Provider / Transport Test Constants
// ============================================================================

// Use minimal retry/backoff in unit tests to avoid slowing the suite.
export const TEST_RETRY_MAX_ATTEMPTS_SINGLE = 1;
export const TEST_RETRY_BACKOFF_BASE_MS_ZERO = 0;
export const TEST_PROVIDER_TIMEOUT_MS_SHORT = 50;

// MCP CLI / Server tests
export const TEST_MCP_PORT = 34567;
export const TEST_MCP_DEFAULT_PORT = 3000;

// LlamaProvider offline tests
export const TEST_OLLAMA_ENDPOINT = "http://ollama.test/api/generate";
export const TEST_LLAMAPROVIDER_MODEL_LLAMA = "llama3.2:1b";
export const TEST_LLAMAPROVIDER_MODEL_CODELLAMA = "codellama:7b-instruct";
export const TEST_LLAMAPROVIDER_PROMPT = "Hello";
export const TEST_LLAMAPROVIDER_JSON_BODY = '{"ok":true}';

// Environment Keys
export const ENV_GOOGLE_API_KEY = "GOOGLE_API_KEY";
export const ENV_OPENAI_API_KEY = "OPENAI_API_KEY";
export const ENV_ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";

// Log and Error Prefixes/Messages
export const LOG_PREFIX_GOOGLE_RESPONSE = "Google Response:";
export const LOG_PREFIX_GOOGLE_ERROR = "Google Provider Error:";
export const LOG_PREFIX_OPENAI_RESPONSE = "OpenAI Response:";
export const LOG_PREFIX_OPENAI_ERROR = "OpenAI Provider Error:";
export const LOG_PREFIX_ANTHROPIC_RESPONSE = "Anthropic Response:";
export const LOG_PREFIX_ANTHROPIC_ERROR = "Anthropic Provider Error (CAUGHT):";
export const LOG_MSG_ENDPOINT_REACHED = "✅ Endpoint reached (Access/Quota/Auth error confirmed)";
export const LOG_MSG_ENDPOINT_REACHED_ANHROPIC = "✅ Endpoint reached (Error caught but confirms connectivity)";
export const ERROR_MSG_HTTP_404 = "404";
export const ERROR_MSG_NOT_FOUND = "not_found";
export const LOG_MSG_NOT_FOUND_DETECTED = "❌ 404/Not Found Error Detected!";

// ============================================================================
// Schema Describer Test Constants
// ============================================================================

export enum SchemaDescriberKey {
  Name = "name",
  Age = "age",
  Tags = "tags",
  Status = "status",
}

export enum SchemaDescriberEnumValue {
  Active = "active",
  Inactive = "inactive",
}

export enum SchemaDescriberType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Unknown = "unknown",
}

export enum SchemaDescriberToken {
  ArrayPrefix = "Array<",
  ArraySuffix = ">",
  EnumPrefix = "enum(",
  EnumSuffix = ")",
  EnumSeparator = " | ",
  OptionalPrefix = "optional(",
  OptionalSuffix = ")",
  Quote = '"',
  FieldSeparator = ": ",
}

// ============================================================================
// Journal Formatter / Commands Test Constants
// ============================================================================

export enum JournalFormat {
  Json = "json",
  Table = "table",
  Text = "text",
}

export const JOURNAL_FORMAT_JSON = JournalFormat.Json;
export const JOURNAL_FORMAT_TABLE = JournalFormat.Table;
export const JOURNAL_FORMAT_TEXT = JournalFormat.Text;

export enum JournalAction {
  Error = "test.error",
  Approve = "test.approve",
  Create = "test.create",
  Generic = "test.action",
}

export const JOURNAL_ACTION_ERROR = JournalAction.Error;
export const JOURNAL_ACTION_APPROVE = JournalAction.Approve;
export const JOURNAL_ACTION_CREATE = JournalAction.Create;
export const JOURNAL_ACTION_GENERIC = JournalAction.Generic;

export const JOURNAL_ID_ONE = "activity-1";
export const JOURNAL_ID_TWO = "activity-2";
export const JOURNAL_ID_THREE = "activity-3";

export const JOURNAL_TRACE_ID_ONE = "trace-1";
export const JOURNAL_TRACE_ID_TWO = "trace-2";
export const JOURNAL_TRACE_ID_THREE = "trace-3";

export const JOURNAL_ACTOR_USER = "user";
export const JOURNAL_AGENT_ID = "agent-1";

export const JOURNAL_TARGET_SHORT = "target-short";
export const JOURNAL_TARGET_LONG = "target-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export const JOURNAL_PAYLOAD = "{}";

export const JOURNAL_TIMESTAMP_ONE = "2026-01-01T00:00:00.000Z";
export const JOURNAL_TIMESTAMP_TWO = "2026-01-01T00:00:01.000Z";
export const JOURNAL_TIMESTAMP_THREE = "2026-01-01T00:00:02.000Z";

export const JOURNAL_TRUNCATE_MAX = 30;
export const JOURNAL_ELLIPSIS = "...";

export const JOURNAL_ACTIVITY_COUNT = 3;
export const JOURNAL_COUNT_VALUE = 2;

export const JOURNAL_DISTINCT_FIELD_ACTION = "action_type";
export const JOURNAL_TAIL_LIMIT = 5;
export const JOURNAL_CAPTURE_COUNT_ONE = 1;

export const JOURNAL_FILTER_TRACE = `trace_id=${JOURNAL_TRACE_ID_ONE}`;
export const JOURNAL_FILTER_ACTION = `action_type=${JournalAction.Generic}`;
export const JOURNAL_FILTER_AGENT = `agent_id=${JOURNAL_AGENT_ID}`;
export const JOURNAL_SINCE_VALUE = "2026-01-01T00:00:00.000Z";
export const JOURNAL_FILTER_SINCE = `since=${JOURNAL_SINCE_VALUE}`;
export const JOURNAL_FILTER_UNKNOWN = "unknown=foo";
export const JOURNAL_FILTER_INVALID = "invalidfilter";

export const JOURNAL_INVALID_FILTER_PREFIX = "Invalid filter format:";
export const JOURNAL_UNKNOWN_FILTER_PREFIX = "Unknown filter key:";

// ============================================================================
// Token Usage Regression Test Constants
// ============================================================================

// Test token counts for regression testing
export const TEST_PROMPT_TOKENS_GOOGLE = 10;
export const TEST_COMPLETION_TOKENS_GOOGLE = 5;
export const TEST_TOTAL_TOKENS_GOOGLE = 15;

export const TEST_PROMPT_TOKENS_OPENAI = 20;
export const TEST_COMPLETION_TOKENS_OPENAI = 10;
export const TEST_TOTAL_TOKENS_OPENAI = 30;

export const TEST_PROMPT_TOKENS_ANTHROPIC = 25;
export const TEST_COMPLETION_TOKENS_ANTHROPIC = 15;
export const TEST_TOTAL_TOKENS_ANTHROPIC = 40;

// Test model names for regression testing
export const TEST_MODEL_GOOGLE = "gemini-pro";
export const TEST_MODEL_OPENAI = "gpt-4";
export const TEST_MODEL_ANTHROPIC = "claude-3";

// Test provider IDs for regression testing
export const TEST_PROVIDER_ID_GOOGLE = "google-gemini-pro";
export const TEST_PROVIDER_ID_OPENAI = "openai-gpt-4";
export const TEST_PROVIDER_ID_ANTHROPIC = "anthropic-claude-3";

// Test provider IDs for error cases
export const TEST_PROVIDER_ID_GOOGLE_ERROR = "google-test";
export const TEST_PROVIDER_ID_OPENAI_ERROR = "openai-test";
export const TEST_PROVIDER_ID_ANTHROPIC_ERROR = "anthropic-test";

// ============================================================================
// Token Metrics Integration Test Constants
// ============================================================================

// Environment variable names
export const ENV_TEST_ENABLE_PAID_LLM = "EXO_TEST_ENABLE_PAID_LLM";
export const ENV_TEST_ENABLE_PAID_LLM_VALUE = "1";

// Test prompts for token metrics validation
export const TOKEN_METRICS_TEST_PROMPT = "Say OK";

// Model names for integration testing
export const TOKEN_METRICS_MODEL_GOOGLE = "gemini-2.5-flash";
export const TOKEN_METRICS_MODEL_OPENAI = "gpt-4o-mini";
export const TOKEN_METRICS_MODEL_ANTHROPIC = "claude-3-5-haiku-20241022";

// Wait times for async operations (milliseconds)
export const TOKEN_METRICS_ASYNC_WAIT_MS = 1000;

// Database query limits
export const TOKEN_METRICS_DB_QUERY_LIMIT = 10;

// Action type for token usage events
export const ACTION_TYPE_LLM_USAGE = "llm.usage";

// Skip messages for common API errors
export const SKIP_MSG_OPT_IN_REQUIRED =
  "EXO_TEST_ENABLE_PAID_LLM is not set to '1' (opt-in required to avoid API costs)";
export const SKIP_MSG_GOOGLE_API_KEY_MISSING = "GOOGLE_API_KEY not set";
export const SKIP_MSG_OPENAI_API_KEY_MISSING = "OPENAI_API_KEY not set";
export const SKIP_MSG_ANTHROPIC_API_KEY_MISSING = "ANTHROPIC_API_KEY not set";
export const SKIP_MSG_GOOGLE_INVALID_KEY = "Invalid API key (401)";
export const SKIP_MSG_GOOGLE_RATE_LIMIT = "Rate limit exceeded (429)";
export const SKIP_MSG_GOOGLE_MODEL_NOT_FOUND = "Model not found (404)";
export const SKIP_MSG_GOOGLE_QUOTA = "Insufficient quota (403)";
export const SKIP_MSG_OPENAI_INVALID_KEY = "Invalid API key (401)";
export const SKIP_MSG_OPENAI_RATE_LIMIT = "Rate limit exceeded (429)";
export const SKIP_MSG_OPENAI_MODEL_NOT_FOUND = "Model not found (404)";
export const SKIP_MSG_OPENAI_QUOTA = "Insufficient quota";
export const SKIP_MSG_ANTHROPIC_INVALID_KEY = "Invalid API key (401)";
export const SKIP_MSG_ANTHROPIC_RATE_LIMIT = "Rate limit exceeded (429)";
export const SKIP_MSG_ANTHROPIC_MODEL_NOT_FOUND = "Model not found (404)";
export const SKIP_MSG_ANTHROPIC_CREDITS = "Insufficient credits (400)";
export const SKIP_MSG_ANTHROPIC_QUOTA = "Insufficient quota (403)";

// Error message patterns for detection
export const ERROR_PATTERN_401 = "401";
export const ERROR_PATTERN_UNAUTHORIZED = "unauthorized";
export const ERROR_PATTERN_429 = "429";
export const ERROR_PATTERN_RATE_LIMIT = "rate limit";
export const ERROR_PATTERN_404 = "404";
export const ERROR_PATTERN_NOT_FOUND = "not found";
export const ERROR_PATTERN_400 = "400";
export const ERROR_PATTERN_CREDIT = "credit";
export const ERROR_PATTERN_BALANCE = "balance";
export const ERROR_PATTERN_403 = "403";
export const ERROR_PATTERN_QUOTA = "quota";

// Assertion messages
export const ASSERT_MSG_LLM_USAGE_EVENTS_GOOGLE = "Expected at least one llm.usage event for Google";
export const ASSERT_MSG_LLM_USAGE_EVENTS_OPENAI = "Expected at least one llm.usage event for OpenAI";
export const ASSERT_MSG_LLM_USAGE_EVENTS_ANTHROPIC = "Expected at least one llm.usage event for Anthropic";
export const ASSERT_MSG_PROMPT_TOKENS_EXISTS = "prompt_tokens should exist";
export const ASSERT_MSG_COMPLETION_TOKENS_EXISTS = "completion_tokens should exist";
export const ASSERT_MSG_TOTAL_TOKENS_EXISTS = "total_tokens should exist";
export const ASSERT_MSG_COST_USD_EXISTS = "cost_usd should exist";
export const ASSERT_MSG_MODEL_EXISTS = "model should exist";
export const ASSERT_MSG_PROMPT_TOKENS_GT_ZERO = "prompt_tokens should be > 0";
export const ASSERT_MSG_COMPLETION_TOKENS_GT_ZERO = "completion_tokens should be > 0";
export const ASSERT_MSG_TOTAL_TOKENS_GT_ZERO = "total_tokens should be > 0";
export const ASSERT_MSG_COST_USD_GT_ZERO = "cost_usd should be > 0";
export const ASSERT_MSG_RESPONSE_EXISTS = "Provider should return a response";
export const ASSERT_MSG_RESPONSE_NOT_EMPTY = "Response should not be empty";
