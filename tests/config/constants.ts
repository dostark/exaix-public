// ============================================================================
// Testing Constants
// ============================================================================
// This module contains constants used exclusively in test files.
// For production constants, see src/config/constants.ts

// Test Prompts
export const REGRESSION_TEST_PROMPT = "Hello, reply with 'OK'";
export const TEST_LOG_PREVIEW_LENGTH = 50;

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
