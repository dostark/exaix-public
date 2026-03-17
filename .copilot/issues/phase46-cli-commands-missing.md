---
title: "Phase 46 Portal Knowledge Commands Missing in CLI Wiring"
status: resolved
priority: medium
created: 2026-03-17
updated: 2026-03-17
labels: [bug, cli, phase-46, portal-knowledge]
assignee:
related_issues: []
---

## Problem

The new `analyze` and `knowledge` commands for portal management (introduced in Phase 46) are implemented in the `PortalCommands` class but are not wired to the cliffy command tree in `src/cli/exoctl.ts`. This makes them inaccessible to users via the `exoctl portal` interface.

## Reproduction Steps

```bash
# 1. Attempt to run portal analysis
exoctl portal analyze portal-exoframe

# 2. Attempt to view portal knowledge
exoctl portal knowledge portal-exoframe
```

## Observed Behavior

Both commands fail with an "Unknown command" error:

```
error: Unknown command "analyze". Did you mean command "add"?
error: Unknown command "knowledge". Did you mean command "show"?
```

Checking `src/cli/exoctl.ts` confirms that the `portal` command group only defines `add`, `list`, `show`, `remove`, `verify`, and `refresh`.

## Expected Behavior

- `exoctl portal analyze <alias>` should trigger codebase knowledge gathering.
- `exoctl portal knowledge <alias>` should display gathered knowledge.
- Both commands should be visible in `exoctl portal --help`.

## Environment

- ExoFrame Version: 1.0.0
- OS: Linux
- CLI: exoctl (cliffy)

## Root Cause Analysis

**Primary Issue:** Missing `Command` registration in the CLI entry point.

**Technical Details:**
The implementation exists in `src/cli/commands/portal_commands.ts`:
- `PortalCommands.analyze(alias, options)`
- `PortalCommands.knowledge(alias, options)`

However, `src/cli/exoctl.ts` does not include these subcommands in the `.command("portal", ...)` definition.

## Investigation Areas

### CLI Wiring
- [ ] Add `analyze <alias>` subcommand to `portal` group in `src/cli/exoctl.ts`.
- [ ] Add `knowledge <alias>` subcommand to `portal` group in `src/cli/exoctl.ts`.
- [ ] Ensure options (like `--mode`, `--force`, `--json`) are properly passed to implementation methods.

## Fix Implementation

**Changes Made:**

1. **Updated `src/cli/exoctl.ts`:**
   - Imported `PortalAnalysisMode` from `../shared/enums.ts`.
   - Added `analyze <alias>` subcommand to the `portal` command group, mapping to `portalCommands.analyze()`.
   - Added `knowledge <alias>` subcommand to the `portal` command group, mapping to `portalCommands.knowledge()`.
   - Wired options `-m/--mode`, `-f/--force` for `analyze` and `--json` for `knowledge`.

**Verification:**
- `deno task cli portal analyze --help` shows the command and its options.
- `deno task cli portal knowledge --help` shows the command and its options.
- Regression test `tests/portal_cli_wiring_regression_test.ts` passes.
- Integration test `tests/integration/18_cli_commands_integration_test.ts` passes for these commands.

## Resolution

**Status: RESOLVED** ✅

The CLI commands are now correctly wired to their implementations in the source code. Users can now trigger analysis and view gathered knowledge using the local source.
