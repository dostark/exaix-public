# Issue: Security Expert Agent Fails to Create Changeset Content

## Problem Description

The `security-expert` agent fails to create a changeset with actual content (code changes or requested documents) after plan approval. This occurs even when the plan explicitly outlines remediation steps or document creation.

## Context

The user suspects this behavior is linked to the initial request instruction "Do not make any changes in the OpenStock code". However, the expectation is that:

1. If the request asks for a "readable audit document" (without modifying _code_), the document should still be created.

In this specific reported instance, the user requested an audit document, but the resulting changeset only contained a `test-execution.txt` placeholder file.

## Reproduction Steps

1. Start the daemon: `exactl daemon start`

   ```bash
   exactl request --agent security-expert --portal <portal> "Perform a security audit... Do not make any changes... Your goal is to create only readable audit document..."
   ```

1.
1.

## Observed Behavior

The changeset is created but contains only a placeholder file (e.g., `test-execution.txt`). The requested audit document is missing.

## Expected Behavior

The agent should generate the requested artifacts (e.g., the audit report) and include them in the changeset.

## Possible Causes

- The `security-expert` agent's system prompt or execution logic might heavily prioritize the "no changes" instruction, treating file creation (even for the audit doc) as a "change" to be avoided.

## Investigation Results

**Status**: Verified / Root Cause Identified

The issue is caused by the interaction between the Planner's interpretation of "no changes" and the `ExecutionLoop`'s fallback behavior.

1. **Planner Behavior**: The Planner respects the "Do not make any changes" instruction literally. Instead of creating a `write_file` step to save the audit report, it generates the report content solely within the Plan's metadata (Markdown structure). As a result, the generated plan has **0 execution steps**.

   ```typescript
   // src/services/execution_loop.ts
   if (actions.length === 0) {
     // ...
     // For testing or empty plans, create a dummy file to ensure we have changes
     const testFile = join(executionRoot, "test-execution.txt");
     await Deno.writeTextFile(testFile, ...);
   }
   ```

1.

## Recommendation

This is indeed a bug in the agent's behavior. The `security-expert` agent (and the generic Planner) should be instructed that "creating a requested documentation or report file" is a valid action even when "no code changes" are requested.

### Proposed Fix

Update the Planner System Prompt to explicitly allow/encourage `write_file` operations for non-code artifacts (reports, documentation, audits) even when code modifications are restricted.
