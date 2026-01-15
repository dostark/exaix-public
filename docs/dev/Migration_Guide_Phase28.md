# Phase 28: Environment Variable Migration Guide

This guide details the changes to environment variables introduced in Phase 28 of the ExoFrame configuration cleanup. These changes are designed to improve configuration validation, security, and standardization.

## 1. Summary of Changes

- **Strict Validation**: All `EXO_LLM_*` variables are now validated using Zod schemas. Invalid values will trigger warnings and be ignored.
- **Retired Variables**: Deprecated `EXO_*` variables for retries and timeouts have been removed in favor of `exo.config.toml` configuration.
- **Renamed Variables**: Testing-related environment variables have been standardized with an `EXO_TEST_*` prefix.
- **Documentation**: All supported environment variables are now documented in `exo.config.sample.toml`.

## 2. Production Environment Variables (Runtime Overrides)

The following 4 variables are the **ONLY** supported production overrides for AI provider configuration. They take precedence over `exo.config.toml` values.

| Variable             | Description                | Validation Rule                                                   | Example                                   |
| -------------------- | -------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| `EXO_LLM_PROVIDER`   | Override AI provider       | Must be one of: `mock`, `ollama`, `anthropic`, `openai`, `google` | `EXO_LLM_PROVIDER=ollama`                 |
| `EXO_LLM_MODEL`      | Override AI model name     | Non-empty string                                                  | `EXO_LLM_MODEL=llama3.2`                  |
| `EXO_LLM_BASE_URL`   | Override provider Base URL | Valid URL string                                                  | `EXO_LLM_BASE_URL=http://localhost:11434` |
| `EXO_LLM_TIMEOUT_MS` | Override request timeout   | Integer between 1000 and 300000                                   | `EXO_LLM_TIMEOUT_MS=60000`                |

### Validation Behavior

- If an invalid value is provided (e.g., `EXO_LLM_TIMEOUT_MS=abc`), the system will log a warning and ignore the override, falling back to the configuration file or defaults.
- Partial overrides are supported (e.g., you can override just the model).

## 3. Retired Environment Variables

The following environment variables have been **REMOVED**. Setting them will have **NO EFFECT**. You must migrate these settings to your `exo.config.toml` file.

| Retired Variable              | Replacement Configuration (toml)    | Default Value |
| ----------------------------- | ----------------------------------- | ------------- |
| `EXO_OLLAMA_RETRY_MAX`        | `[ai.retry.ollama] max_attempts`    | 3             |
| `EXO_OLLAMA_RETRY_BACKOFF_MS` | `[ai.retry.ollama] backoff_base_ms` | 1000          |
| `EXO_OPENAI_RETRY_MAX`        | `[ai.retry.openai] max_attempts`    | 3             |
| `EXO_OPENAI_RETRY_BACKOFF_MS` | `[ai.retry.openai] backoff_base_ms` | 1000          |
| `EXO_OPENAI_TIMEOUT_MS`       | `[ai] timeout_ms` (or `[models.*]`) | 30000         |

### Migration Example

**Before (Env Vars):**

```bash
export EXO_OLLAMA_RETRY_MAX=5
export EXO_OPENAI_TIMEOUT_MS=60000
./exoctl daemon start
```

**After (exo.config.toml):**

```toml
[ai.retry.ollama]
max_attempts = 5

[ai]
timeout_ms = 60000
```

## 4. Renamed Testing Variables

If you are a developer running tests or setting up CI pipelines, you must update your environment variables to use the new `EXO_TEST_*` prefix.

| Old Variable          | New Variable               | Purpose                                |
| --------------------- | -------------------------- | -------------------------------------- |
| `EXO_ENABLE_PAID_LLM` | `EXO_TEST_ENABLE_PAID_LLM` | Opt-in for paid LLM integration tests  |
| `EXO_OPENAI_API_KEY`  | `EXO_TEST_OPENAI_API_KEY`  | API Key for testing OpenAI integration |
| `EXO_ENABLE_OLLAMA`   | `EXO_TEST_ENABLE_OLLAMA`   | Opt-in for Ollama integration tests    |
| `EXO_RUN_LLAMA_TESTS` | `EXO_TEST_ENABLE_LLAMA`    | Opt-in for Llama provider tests        |
| `EXOCTL_TEST_MODE`    | `EXO_TEST_CLI_MODE`        | Enable CLI test stubs                  |

### CI Configuration Updates

Update your `.github/workflows/*.yml` or other CI configurations to use the new variable names.

## 5. Helper Functions (For Contributors)

New helper functions in `src/config/env_schema.ts` should be used for environment checks:

```typescript
import { isCIMode, isTestMode } from "./config/env_schema.ts";

if (isTestMode()) {
  // Logic for test execution
}

if (isCIMode()) {
  // Logic specific to CI environments
}
```

These helpers handle strict boolean parsing (detecting "0", "false", "no", "off" as false).
