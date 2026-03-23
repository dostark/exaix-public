---
title: "Support for Independent Exactl Installations via EXA_BIN_PATH"
status: resolved
priority: medium
created: 2026-03-18
updated: 2026-03-18
labels: [build, scripts, deploy, scenario-framework, environment]
---

# Support for Independent Exactl Installations via EXA_BIN_PATH

## Description
This issue tracks code edits intended to allow multiple, independent versions of the `exactl` binary and isolated Exaix configurations to coexist on a single machine. The target goal is to decouple the workspace deployment and the test suites from inherently overwriting the developer's global `exactl` path in `~/.deno/bin/exactl`.

## Changes Proposed

### 1. `scripts/deploy_workspace.sh`
- Checks whether `EXA_BIN_PATH` is passed via the environment when generating a deployed workspace copy.
- If present, it prevents `deno install --global -n exactl` from polluting the user's `$PATH`.
- Instead, it generates an isolated `sh` script directly into `$EXA_BIN_PATH/exactl`.
- The shim forces `export EXA_CONFIG_PATH` referencing the destination target config, meaning executing `exactl` from that script naturally anchors its context into that specific sandbox workspace.

### 2. `tests/scenario_framework/runner/main.ts`
- If integration tests (`run-scenarios`) are executed within an environment carrying `EXA_BIN_PATH`, it avoids dropping to a default `shell` invocation of `"exactl"` which might mistakenly test the user's root development toolset.
- It explicitly forces the step executor (`exactlExecutable`) to rely on `$EXA_BIN_PATH/exactl`, guaranteeing sandbox test hermeticity.
