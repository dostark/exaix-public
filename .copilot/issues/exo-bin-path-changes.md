---
title: "Support for Independent Exoctl Installations via EXO_BIN_PATH"
status: resolved
priority: medium
created: 2026-03-18
updated: 2026-03-18
labels: [build, scripts, deploy, scenario-framework, environment]
---

# Support for Independent Exoctl Installations via EXO_BIN_PATH

## Description
This issue tracks code edits intended to allow multiple, independent versions of the `exoctl` binary and isolated ExoFrame configurations to coexist on a single machine. The target goal is to decouple the workspace deployment and the test suites from inherently overwriting the developer's global `exoctl` path in `~/.deno/bin/exoctl`.

## Changes Proposed

### 1. `scripts/deploy_workspace.sh`
- Checks whether `EXO_BIN_PATH` is passed via the environment when generating a deployed workspace copy.
- If present, it prevents `deno install --global -n exoctl` from polluting the user's `$PATH`.
- Instead, it generates an isolated `sh` script directly into `$EXO_BIN_PATH/exoctl`.
- The shim forces `export EXO_CONFIG_PATH` referencing the destination target config, meaning executing `exoctl` from that script naturally anchors its context into that specific sandbox workspace.

### 2. `tests/scenario_framework/runner/main.ts`
- If integration tests (`run-scenarios`) are executed within an environment carrying `EXO_BIN_PATH`, it avoids dropping to a default `shell` invocation of `"exoctl"` which might mistakenly test the user's root development toolset.
- It explicitly forces the step executor (`exoctlExecutable`) to rely on `$EXO_BIN_PATH/exoctl`, guaranteeing sandbox test hermeticity.
