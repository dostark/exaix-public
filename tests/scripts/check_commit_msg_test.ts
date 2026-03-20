/**
 * @module CheckCommitMsgTest
 * @path tests/scripts/check_commit_msg_test.ts
 * @description Unit tests for the check_commit_msg.ts script.
 * Verifies validation logic for structured commit messages, including
 * mandatory fields, impact grounding, and provider/model validation.
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { validateCommitMsg } from "../../scripts/check_commit_msg.ts";

describe("validateCommitMsg", () => {
  it("passes a valid structured message", () => {
    const msg = `feat: add new feature

what: implemented a new feature based on requirement X
rationale: to provide users with better control over Y
tests: all 5 unit tests passed
who: Antigravity
impact: ReqProc: added validation logic
model: Gemini`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, true, result.errors?.join(", "));
  });

  it("fails if a required field is missing", () => {
    const msg = `feat: missing rationale

what: something
tests: pass
who: user
impact: ReqProc: update`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, false);
    assertEquals(result.errors.some((e: string) => e.includes("rationale")), true);
  });

  it("fails if a required field is empty", () => {
    const msg = `feat: empty who

what: something
rationale: why
tests: pass
who:
impact: ReqProc: update`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, false);
    assertEquals(result.errors.some((e: string) => e.includes("who")), true);
  });

  it("fails if impact is incorrectly formatted (missing component or colon)", () => {
    const msg = `feat: bad impact

what: something
rationale: why
tests: pass
who: user
impact: just some text without a component`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, false);
    assertEquals(result.errors.some((e: string) => e.toLowerCase().includes("impact")), true);
  });

  it("allows optional fields", () => {
    const msg = `feat: with optional fields

what: something
rationale: why
tests: pass
who: user
impact: ReqProc: update
conversation_id: 123
links: http://link
prompt: "the prompt"
tool_audit: write_to_file
model: Gemini`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, true);
  });

  it("enforces conventional commit prefix", () => {
    const msg = `no-prefix: message

what: something
rationale: why
tests: pass
who: user
impact: ReqProc: update`;
    // Assuming we want to enforce standard types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
    const result = validateCommitMsg(msg);
    assertEquals(result.success, false);
    assertEquals(result.errors.some((e: string) => e.includes("prefix") || e.includes("type")), true);
  });

  it("skips validation for merge commits", () => {
    const msg = `Merge branch 'main' into feature/x`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, true); // Should bypass
  });

  it("skips validation for revert commits", () => {
    const msg = `Revert "feat: add feature"

This reverts commit a1b2c3d4.`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, true); // Should bypass
  });

  it("skips validation for fixup! commits", () => {
    const msg = `fixup! feat: add feature`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, true); // Should bypass
  });

  it("fails if model is faked/hallucinated (optional but desired check)", () => {
    // This test might depend on how we implement "actual model" check.
    // E.g. if we have a list of known valid models.
    const msg = `feat: faked model

what: something
rationale: why
tests: pass
who: user
impact: ReqProc: update
model: SuperIntelligence-9000`;
    const result = validateCommitMsg(msg);
    assertEquals(result.success, false);
    assertEquals(result.errors.some((e: string) => e.includes("model")), true);
  });
});
