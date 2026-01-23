---
title: "changeset show --diff option not implemented"
status: resolved
priority: medium
created: 2026-01-23
labels: [bug, cli, changeset, ux]
---

# Issue: `--diff` option is not implemented for `exoctl changeset show`

## Problem
The CLI command `exoctl changeset show <id> --diff` (and variants like `-d`) is not recognized. The help output does not list `--diff` as a valid option, and passing it results in an error:

```
error: Unknown option "--diff". Did you mean option "--help"?
```

## Reproduction Steps
1. Run `exoctl changeset list` to get a changeset ID or branch.
2. Run `exoctl changeset show <id> --diff` or `exoctl changeset show <branch> --diff`.
3. Observe the error: `Unknown option "--diff"`.

## Expected Behavior
- `--diff` (and `-d`) should be a valid option for `exoctl changeset show`.
- When provided, the command should print only the unified diff for the changeset, not the full details.
- The help output should document the `--diff` option.

## Observed Behavior
- The CLI rejects `--diff` and `-d` as unknown options.
- The only way to see the diff is to run `exoctl changeset show <id>` and manually extract the diff from the output.

## Impact
- Users cannot easily view just the diff for a changeset from the CLI.
- This is inconsistent with typical CLI UX and the help description.

## Resolution
✅ **FIXED**: Added `--diff`/`-d` option to `exoctl changeset show` command.

**Changes Made:**
- Modified `src/cli/exoctl.ts` to add the `--diff` option to the changeset show command
- When `--diff` is provided, outputs only the unified diff (raw git diff format)
- When `--diff` is not provided, shows the full changeset details as before
- Both `--diff` and `-d` (short form) are supported
- Help text now documents the new option

**Testing:**
- ✅ `--diff` option recognized in help output
- ✅ `--diff` outputs only the diff content
- ✅ `-d` (short form) works identically
- ✅ Default behavior (no --diff) unchanged
- ✅ Error handling preserved

---
