/**
 * @module CheckCommitMsg
 * @path scripts/check_commit_msg.ts
 * @description Script to validate structured commit messages against ExoFrame guidelines.
 * @architectural-layer Scripts
 * @dependencies []
 * @related-files [tests/scripts/check_commit_msg_test.ts]
 */

/** Standard conventional commit types. */
const VALID_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
];

const REQUIRED_FIELDS = ["what", "rationale", "tests", "who", "impact"];

/** Known valid models to prevent hallucinations (can be extended). */
const VALID_MODELS = [
  "Gemini",
  "Claude",
  "GPT",
  "Antigravity",
  "Ollama",
  "Llama",
];

/**
 * Validates a commit message string.
 * @param text The full commit message.
 * @returns Object with success status and list of error messages.
 */
export function validateCommitMsg(text: string): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split("\n");

  if (lines.length === 0 || !lines[0].trim()) {
    return { success: false, errors: ["Commit message is empty."] };
  }

  const subject = lines[0].trim();

  // 1. Skip validation for auto-generated commits
  if (
    subject.startsWith("Merge branch") ||
    subject.startsWith("Merge remote-tracking branch") ||
    subject.startsWith("Revert ") ||
    subject.startsWith("fixup! ") ||
    subject.startsWith("squash! ")
  ) {
    return { success: true, errors: [] };
  }

  // 2. Validate Conventional Commit prefix
  const typeMatch = subject.match(/^(\w+)(?:\(.+\))?!?: /);
  if (!typeMatch) {
    errors.push(
      `Subject line does not follow conventional commit format: "<type>(<scope>): <summary>".`,
    );
  } else {
    const type = typeMatch[1];
    if (!VALID_TYPES.includes(type)) {
      errors.push(
        `Invalid commit type "${type}". Allowed types: ${VALID_TYPES.join(", ")}.`,
      );
    }
  }

  // 3. Extract fields and validate
  const fieldMap = new Map<string, string>();
  // Match fields like "what: content" at the start of a line
  const fieldRegex = /^(\w+):\s*(.*)/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(fieldRegex);
    if (match) {
      const field = match[1].toLowerCase();
      const content = match[2].trim();
      fieldMap.set(field, content);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fieldMap.has(field)) {
      errors.push(`Missing required field: "${field}:".`);
    } else if (!fieldMap.get(field)) {
      errors.push(`Required field "${field}:" cannot be empty.`);
    }
  }

  // 4. Specific Impact validation
  if (fieldMap.has("impact")) {
    const impact = fieldMap.get("impact")!;
    // Requirement: <component>: <details>
    // We check if it contains a colon separating component from details.
    if (!impact.includes(":")) {
      errors.push(
        `Impact field must follow the format "<component>: <details>" (e.g., "ReqProc: added validation").`,
      );
    }
  }

  // 5. Model validation (hallucination check)
  if (fieldMap.has("model")) {
    const model = fieldMap.get("model")!;
    const isKnown = VALID_MODELS.some((m) => model.toLowerCase().includes(m.toLowerCase()));
    if (!isKnown && model.trim() !== "") {
      errors.push(
        `Model "${model}" appears to be hallucinated or unknown. Use a real model name (e.g., Gemini, Claude, Antigravity).`,
      );
    }
  }

  return { success: errors.length === 0, errors };
}

/** CLI Entry point */
if (import.meta.main) {
  const commitMsgFile = Deno.args[0];
  if (!commitMsgFile) {
    console.error("Usage: deno run scripts/check_commit_msg.ts <commit-msg-file>");
    Deno.exit(1);
  }

  try {
    const text = Deno.readTextFileSync(commitMsgFile);
    const { success, errors } = validateCommitMsg(text);

    if (!success) {
      console.error("\n❌ Structured Commit Message Validation Failed:");
      errors.forEach((e) => console.error(`  - ${e}`));
      console.error("\nExpected format:");
      console.error("  feat: subject line\n");
      console.error("  what: detailed explanation");
      console.error("  rationale: why this change");
      console.error("  tests: summary status");
      console.error("  who: agent or user name");
      console.error("  impact: ArchitectureComponent: brief details");
      console.error("\nOptional: conversation_id, links, prompt, tool_audit, model\n");
      Deno.exit(1);
    }

    console.log("✅ Commit message structure valid.");
    Deno.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error reading commit message file: ${msg}`);
    Deno.exit(1);
  }
}
