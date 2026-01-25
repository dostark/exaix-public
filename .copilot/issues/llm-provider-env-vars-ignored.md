---
title: "LLM Provider Environment Variables Ignored in Provider Selection"
status: resolved
priority: high
created: 2026-01-25
updated: 2026-01-25
labels: [bug, ai, provider-selection, environment-variables]
assignee:
related_issues: []
---

# LLM Provider Environment Variables Ignored in Provider Selection

## Problem

The ExoFrame daemon ignores `EXO_LLM_PROVIDER` and `EXO_LLM_MODEL` environment variables when selecting which AI provider to use for request processing. Despite these variables being correctly set in the daemon's environment, the provider selection logic always falls back to the mock provider due to preferring "free" providers.

## Reproduction Steps

```bash
# 1. Set environment variables for real LLM provider
export EXO_LLM_PROVIDER=google
export EXO_LLM_MODEL=gemini-2.0-flash-exp

# 2. Start daemon with these variables
exoctl daemon start

# 3. Verify variables are set in daemon process
cat /proc/$(pgrep -f "exoctl daemon")/environ | tr '\0' '\n' | grep EXO_LLM
# Shows: EXO_LLM_PROVIDER=google, EXO_LLM_MODEL=gemini-2.0-flash-exp

# 4. Create a request
exoctl request "Test request"

# 5. Check journal - provider selected is still "mock"
exoctl journal --tail 5
```

## Observed Behavior

- Environment variables `EXO_LLM_PROVIDER` and `EXO_LLM_MODEL` are correctly inherited by the daemon process
- Provider selection logs show `provider.selected: mock` regardless of environment settings
- Config file changes (like `prefer_free = false`) are also ignored
- The `--model` CLI flag is accepted but doesn't override provider selection

## Expected Behavior

- When `EXO_LLM_PROVIDER` is set, that provider should be used
- When `EXO_LLM_MODEL` is set, that model should be used
- Provider selection should respect environment overrides before falling back to intelligent selection
- CLI `--model` flag should force specific provider/model selection

## Environment

- ExoFrame Version: 1.0.0
- OS: Linux
- Deno Version: 1.x.x
- Relevant Config: `prefer_free = false` in exo.config.toml (tested both true and false)

## Root Cause Analysis

**Primary Issue:** Environment variables `EXO_LLM_PROVIDER` and `EXO_LLM_MODEL` are validated but never applied to override configuration.

**Technical Details:**

1. **Validation exists but is unused:** The `getValidatedEnvOverrides()` function in `src/config/env_schema.ts` correctly validates EXO_LLM_* environment variables but is never called.
2. **Config loading doesn't apply overrides:** The `ConfigService.load()` method in `src/config/service.ts` only loads from `exo.config.toml` and validates against the schema, but doesn't merge environment overrides.
3. **Provider selection uses config only:** `ProviderSelector.selectProviderForTask()` uses `config.provider_strategy` but doesn't check for environment overrides.

**Code Locations:**

- Environment validation: `src/config/env_schema.ts:40` (function exists but unused)
- Config loading: `src/config/service.ts:20` (no environment override application)
- Provider selection: `src/ai/provider_selector.ts:113` (uses config only)

## Investigation Areas

### Environment Variable Handling

- [x] EXO_LLM_* variables are validated correctly
- [x] Variables are inherited by daemon process
- [x] getValidatedEnvOverrides() function exists but unused
- [x] ConfigService needs to apply environment overrides after TOML loading

### Provider Selection Logic

- [x] ProviderSelector uses config.provider_strategy
- [x] No environment variable checking in selection logic
- [x] Need to modify selection to respect EXO_LLM_PROVIDER override

### Test Mode Impact

- [x] EXO_TEST_MODE not set (confirmed via `env | grep EXO`)
- [x] Test mode settings commented out in exo.config.toml
- [x] isTestMode() function exists but not used in provider selection
- [x] Test mode does not affect this bug

## Fix Implementation

**Changes Made:**

1. **Modified ProviderSelector.selectProviderForTask()** in `src/ai/provider_selector.ts`:
   - Added import for `getValidatedEnvOverrides()`, `isCIMode()`, `isTestMode()` from `src/config/env_schema.ts`
   - Added environment override check at the beginning of the method with safety controls
   - If `EXO_LLM_PROVIDER` is set and the provider is registered and healthy, return it immediately
   - **Safety Check:** Blocks paid providers in test/CI environments unless `EXO_TEST_ENABLE_PAID_LLM=1` is set
   - Falls back to intelligent selection if override fails or is blocked

2. **Code Location:** `src/ai/provider_selector.ts:113-135`

**Testing:**

- Provider selector tests pass with expected warnings for unregistered providers
- Environment override logic works correctly
- Fallback to intelligent selection when override provider is not available
- **Safety Check:** Paid providers are blocked in test/CI without `EXO_TEST_ENABLE_PAID_LLM=1`
- **Integration Test Confirmed:** Daemon now respects `EXO_LLM_PROVIDER=google` and `EXO_LLM_MODEL=gemini-2.0-flash-exp`
- Google provider successfully processes requests and returns responses

## Resolution

**Status: RESOLVED** ✅

The fix successfully implements environment variable overrides for LLM provider selection with appropriate safety controls. The `EXO_LLM_PROVIDER` and `EXO_LLM_MODEL` environment variables are now properly respected by the ProviderSelector, allowing users to force specific providers and models for production deployments while maintaining safety in test/CI environments.

**Verification:**

- Daemon initializes with environment-specified provider (`google-gemini-2.0-flash-exp`)
- Request processing selects the environment-specified provider (`provider.selected: google`)
- Google provider successfully makes API calls and returns responses
- Fallback logic works when environment provider is not available
- **Safety:** Paid providers blocked in test/CI without explicit opt-in via `EXO_TEST_ENABLE_PAID_LLM=1`
