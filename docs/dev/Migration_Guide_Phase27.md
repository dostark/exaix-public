# Migration Guide: Phase 27 - Magic Number Externalization

## Overview

Phase 27 focused on identifying and externalizing widespread "magic numbers" and "magic strings" into centralized configuration files and constants. This improves maintainability, configurability, and type safety across the codebase.

## Key Changes

### 1. Configuration Externalization

- **New Configuration File:** `exo.config.toml` (sample provided in `exo.config.sample.toml`) now controls system, provider, logging, and performance settings.
- **Config Schema:** Updated `src/config/schema.ts` to validate all new configuration options using Zod.
- **Defaults:** `src/config/constants.ts` defines all default values, serving as the single source of truth.

### 2. Enum Standardization

String literals used for status, priorities, types, and other categorical data have been replaced with TypeScript Enums.

- **Status Enums:** `RequestStatus`, `PlanStatus`, `ExecutionStatus`, `MemoryStatus`, `SkillStatus` in `src/enums.ts`.
- **Other Enums:** `RequestPriority`, `MemoryType`, `HealthCheckVerdict`, `LogLevel`.
- **Zod Schemas:** Zod schemas now use `z.nativeEnum()` for strict validation.

### 3. Constants Refactoring

- **CLI Constants:** `src/cli/cli.config.ts` contains tunable constants for CLI commands (limits, padding, formatting).
- **TUI Constants:** `src/tui/tui.config.ts` contains TUI-specific constants (icons, colors, refresh rates).
- **Internal Constants:** `src/constants.ts` (proxied in `src/config/constants.ts`) holds system-wide internal defaults.

### 4. Codebase Refactoring

Services and components have been refactored to consume these values from configuration or constants instead of hardcoded literals.

## Migration Steps for Developers

If you have local branches or forks, you may need to update your code:

1. **Run `deno task check`:** Verify that you don't have type errors related to string literals.
2. **Update Enums:** Replace string literals (e.g., `"pending"`) with Enum members (e.g., `RequestStatus.PENDING`).
3. **Update Config:** If you have a local `exo.config.toml`, compare it with `exo.config.sample.toml` and add any missing sections (especially `[provider_strategy]`, `[system]`, `[cli]`).
4. **Use Constants:** Import constants from `src/config/constants.ts`, `src/cli/cli.config.ts`, or `src/tui/tui.config.ts` instead of hardcoding values.

## Example Changes

**Before:**

```typescript
const timeout = 30000;
if (status === "pending") { ... }
```

**After:**

```typescript
import { DEFAULT_TIMEOUT_MS } from "../config/constants.ts";
import { RequestStatus } from "../enums.ts";

const timeout = config.system.timeout || DEFAULT_TIMEOUT_MS;
if (status === RequestStatus.PENDING) { ... }
```

## Configuration Reference

Refer to `exo.config.sample.toml` for a complete list of available configuration options and their defaults.
