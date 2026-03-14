/**
 * @module RequestClarifyTest
 * @path tests/cli/commands/request_clarify_test.ts
 * @description Tests for the `exoctl request clarify` CLI command (Step 13 of Phase 47).
 * Covers displaying pending questions, submitting answers, forcing proceed, and cancelling.
 * @related-files [src/cli/commands/request_commands.ts, src/cli/handlers/request_clarify_handler.ts]
 */

import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { RequestCommands } from "../../../src/cli/commands/request_commands.ts";
import {
  ClarificationQuestionCategory,
  ClarificationSessionStatus,
  type IClarificationSession,
} from "../../../src/shared/schemas/clarification_session.ts";
import { ClarifyResultStatus } from "../../../src/shared/enums.ts";
import { RequestStatus } from "../../../src/shared/status/request_status.ts";
import { saveClarification } from "../../../src/services/quality_gate/clarification_persistence.ts";
import { createCliTestContext } from "../helpers/test_setup.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<IClarificationSession> = {}): IClarificationSession {
  return {
    requestId: "req-clarify-001",
    originalBody: "fix it",
    rounds: [
      {
        round: 1,
        questions: [
          {
            id: "r1q1",
            question: "What component needs fixing?",
            rationale: "To narrow the scope",
            category: ClarificationQuestionCategory.CONTEXT,
            required: true,
          },
          {
            id: "r1q2",
            question: "What is the expected behavior?",
            rationale: "To define acceptance criteria",
            category: ClarificationQuestionCategory.ACCEPTANCE,
            required: false,
          },
        ],
        askedAt: new Date().toISOString(),
      },
    ],
    status: ClarificationSessionStatus.ACTIVE,
    qualityHistory: [{ round: 0, score: 30, level: "poor" }],
    ...overrides,
  };
}

function makeRequestFile(requestsDir: string, requestId: string): string {
  const filePath = join(requestsDir, `${requestId}.md`);
  Deno.writeTextFileSync(
    filePath,
    [
      "---",
      `trace_id: "trace-${requestId}"`,
      `created: "${new Date().toISOString()}"`,
      `status: "${RequestStatus.REFINING}"`,
      `priority: "normal"`,
      `agent: "test-agent"`,
      `source: cli`,
      `created_by: "test-user"`,
      "---",
      "fix it",
    ].join("\n"),
  );
  return filePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("[request clarify] displays pending questions", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-001";
    const filePath = makeRequestFile(requestsDir, requestId);
    const session = makeSession();
    await saveClarification(filePath, session);

    const commands = new RequestCommands(context);
    const result = await commands.clarify(requestId);

    assertEquals(result.status, ClarifyResultStatus.QUESTIONS);
    assertExists(result.questions);
    assertEquals(result.questions!.length, 2);
    assertEquals(result.questions![0].id, "r1q1");
  } finally {
    await cleanup();
  }
});

Deno.test("[request clarify] answer flag submits specific answers", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-002";
    const filePath = makeRequestFile(requestsDir, requestId);
    const session = makeSession({ requestId });
    await saveClarification(filePath, session);

    const commands = new RequestCommands(context);

    // Stub engine that returns a session with a second round
    const nextSession: IClarificationSession = {
      ...session,
      rounds: [
        ...session.rounds,
        {
          round: 2,
          questions: [{
            id: "r2q1",
            question: "Follow-up?",
            rationale: "More context needed",
            category: ClarificationQuestionCategory.CONTEXT,
            required: false,
          }],
          askedAt: new Date().toISOString(),
        },
      ],
      qualityHistory: [...session.qualityHistory, { round: 1, score: 55, level: "acceptable" }],
    };
    const stubEngine = {
      processAnswers: (_sess: IClarificationSession, _ans: Record<string, string>) => Promise.resolve(nextSession),
      isComplete: (sess: IClarificationSession) => sess.status === ClarificationSessionStatus.AGENT_SATISFIED,
      cancel: (sess: IClarificationSession) => ({
        ...sess,
        status: ClarificationSessionStatus.USER_CANCELLED,
      }),
    };

    const result = await commands.clarify(requestId, {
      answers: { r1q1: "The auth module", r1q2: "Should not throw" },
      engine: stubEngine,
    });

    assertEquals(result.status, ClarifyResultStatus.QUESTIONS);
    assertExists(result.questions);
    assertEquals(result.round, 2);
  } finally {
    await cleanup();
  }
});

Deno.test("[request clarify] proceed finalizes session", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-003";
    const filePath = makeRequestFile(requestsDir, requestId);
    const session = makeSession({ requestId });
    await saveClarification(filePath, session);

    const commands = new RequestCommands(context);
    const result = await commands.clarify(requestId, { proceed: true });

    assertEquals(result.status, ClarifyResultStatus.COMPLETE);

    // Request file status should now be PENDING
    const content = await Deno.readTextFile(filePath);
    assertEquals(content.includes(RequestStatus.PENDING), true);
  } finally {
    await cleanup();
  }
});

Deno.test("[request clarify] cancel reverts session", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-004";
    const filePath = makeRequestFile(requestsDir, requestId);
    const session = makeSession({ requestId });
    await saveClarification(filePath, session);

    const commands = new RequestCommands(context);
    const result = await commands.clarify(requestId, { cancel: true });

    assertEquals(result.status, ClarifyResultStatus.CANCELLED);

    // Request file status should now be PENDING (re-queued)
    const content = await Deno.readTextFile(filePath);
    assertEquals(content.includes(RequestStatus.PENDING), true);
  } finally {
    await cleanup();
  }
});

Deno.test("[request clarify] shows quality score progression", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-005";
    const filePath = makeRequestFile(requestsDir, requestId);
    const session = makeSession({
      requestId,
      qualityHistory: [
        { round: 0, score: 30, level: "poor" },
        { round: 1, score: 55, level: "acceptable" },
      ],
    });
    await saveClarification(filePath, session);

    const commands = new RequestCommands(context);
    const result = await commands.clarify(requestId);

    // score should reflect the latest entry in qualityHistory
    assertEquals(result.score, 55);
  } finally {
    await cleanup();
  }
});

Deno.test("[request clarify] no session returns no_session status", async () => {
  const { tempDir, config, context, cleanup } = await createCliTestContext();
  try {
    const requestsDir = join(tempDir, config.paths.workspace, config.paths.requests);
    await Deno.mkdir(requestsDir, { recursive: true });

    const requestId = "req-clarify-no-session";
    makeRequestFile(requestsDir, requestId);

    const commands = new RequestCommands(context);
    const result = await commands.clarify(requestId);

    assertEquals(result.status, ClarifyResultStatus.NO_SESSION);
  } finally {
    await cleanup();
  }
});
