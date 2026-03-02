---
title: "Event Journal Missing Token Usage Tracking in Payload"
status: resolved
priority: high
created: 2026-01-23
updated: 2026-01-23
labels: [bug, event-journal, token-usage]
---

## Problem

The event journal's activity table payloads contain provider and model information but lack tracking of token usage (input tokens, output tokens) and associated costs. This violates ExoFrame's declared functionality for cost tracking and monitoring.

## Reproduction Steps

```bash
sqlite3 .exo/journal.db "SELECT payload FROM activity WHERE payload LIKE '%google%' ORDER BY timestamp DESC;"
```

## Observed Behavior

The query returns payloads like:

```json
{"provider":"google-gemini-2.0-flash-exp","model":"gemini-2.0-flash-exp","watching_requests":"Workspace/Requests","watching_plans":"Workspace/Active","status":"active"}
{"type":"google","model":"gemini-2.0-flash-exp","source":"config","named_model":"default"}
```

No token usage counts or cost information is present in any payloads.

## Expected Behavior

Payloads should include:

- Input token count
- Output token count
- Total cost calculation based on provider pricing
- Timestamp of usage

Example expected payload:

```json
{
  "provider": "google-gemini-2.0-flash-exp",
  "model": "gemini-2.0-flash-exp",
  "input_tokens": 150,
  "output_tokens": 75,
  "cost_usd": 0.0012,
  "timestamp": "2026-01-23T10:30:00Z"
}
```

## Environment

- ExoFrame Version: Current development version
- OS: Linux
- Deno Version: As configured in deno.json
- Relevant Config: exo.config.toml (LLM provider settings)

## Investigation Needed

1. **Event Logging Code**: Check where activity events are created and logged
   - Files: `src/database/event_logger.ts`, `src/services/llm_service.ts`
   - Verify if token usage data is available at logging points

1.
   - Check if token counts are extracted from provider responses
   - Verify cost calculation logic exists

1.
   - File: `src/database/schema.ts`

## Related Files

- `src/database/event_logger.ts` - Event logging implementation
- `src/services/llm_service.ts` - LLM provider integration
- `src/config/schema.ts` - Database schema definitions
- `src/config/constants.ts` - Cost calculation constants

## Workaround

None currently known. Manual cost tracking required via external monitoring.

## Priority Justification

High priority because token usage and cost tracking is a core declared feature of ExoFrame for monitoring and billing purposes. Without this, users cannot track their AI usage costs effectively.

## Resolution

**Root Cause**: Token usage was being extracted from LLM provider responses but logged at `debug` level, which is below the default `info` logging threshold for the activity journal. Additionally, the logged token data did not include cost calculations.

**Fix**:

1. Changed token usage logging from `logger.debug()` to `logger.info()` in `handleProviderResponse()` to ensure it appears in the activity journal

1.
1.

**Commit**: Token usage with costs now logged as "llm.usage" events in the activity journal at info level.

**Verified**: Code compiles successfully and maintains backward compatibility. Regression test added in `tests/token_usage_tracking_regression_test.ts`.

