import { assertEquals, assertStringIncludes } from "@std/assert";
import { JournalFormatter } from "../../src/cli/formatters/journal_formatter.ts";
import type { ActivityRecord, JournalFilterOptions } from "../../src/services/db.ts";
import { captureConsoleOutput } from "./helpers/test_utils.ts";
import {
  JOURNAL_ACTIVITY_COUNT,
  JOURNAL_ACTOR_USER,
  JOURNAL_AGENT_ID,
  JOURNAL_COUNT_VALUE,
  JOURNAL_DISTINCT_FIELD_ACTION,
  JOURNAL_ELLIPSIS,
  JOURNAL_ID_ONE,
  JOURNAL_ID_THREE,
  JOURNAL_ID_TWO,
  JOURNAL_PAYLOAD,
  JOURNAL_TARGET_LONG,
  JOURNAL_TARGET_SHORT,
  JOURNAL_TIMESTAMP_ONE,
  JOURNAL_TIMESTAMP_THREE,
  JOURNAL_TIMESTAMP_TWO,
  JOURNAL_TRACE_ID_ONE,
  JOURNAL_TRACE_ID_THREE,
  JOURNAL_TRACE_ID_TWO,
  JOURNAL_TRUNCATE_MAX,
  JournalAction,
  JournalFormat,
} from "../config/constants.ts";

const baseActivities: ActivityRecord[] = [
  {
    id: JOURNAL_ID_ONE,
    trace_id: JOURNAL_TRACE_ID_ONE,
    actor: JOURNAL_ACTOR_USER,
    agent_id: JOURNAL_AGENT_ID,
    action_type: JournalAction.Error,
    target: JOURNAL_TARGET_LONG,
    payload: JOURNAL_PAYLOAD,
    timestamp: JOURNAL_TIMESTAMP_ONE,
  },
  {
    id: JOURNAL_ID_TWO,
    trace_id: JOURNAL_TRACE_ID_TWO,
    actor: JOURNAL_ACTOR_USER,
    agent_id: JOURNAL_AGENT_ID,
    action_type: JournalAction.Approve,
    target: JOURNAL_TARGET_SHORT,
    payload: JOURNAL_PAYLOAD,
    timestamp: JOURNAL_TIMESTAMP_TWO,
  },
  {
    id: JOURNAL_ID_THREE,
    trace_id: JOURNAL_TRACE_ID_THREE,
    actor: JOURNAL_ACTOR_USER,
    agent_id: JOURNAL_AGENT_ID,
    action_type: JournalAction.Create,
    target: JOURNAL_TARGET_SHORT,
    payload: JOURNAL_PAYLOAD,
    timestamp: JOURNAL_TIMESTAMP_THREE,
  },
];

Deno.test("JournalFormatter: renders JSON output", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = {};
    JournalFormatter.render(baseActivities, filter, JournalFormat.Json);
  });

  const parsed = JSON.parse(output) as ActivityRecord[];
  assertEquals(parsed.length, JOURNAL_ACTIVITY_COUNT);
  assertEquals(parsed[0].action_type, JournalAction.Error);
});

Deno.test("JournalFormatter: renders table output and truncates long targets", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = {};
    JournalFormatter.render(baseActivities, filter, JournalFormat.Table);
  });

  const expectedTruncated = JOURNAL_TARGET_LONG.slice(
    0,
    JOURNAL_TRUNCATE_MAX - JOURNAL_ELLIPSIS.length,
  ) + JOURNAL_ELLIPSIS;
  assertStringIncludes(output, JournalAction.Error);
  assertStringIncludes(output, JournalAction.Approve);
  assertStringIncludes(output, JournalAction.Create);
  assertStringIncludes(output, expectedTruncated);
});

Deno.test("JournalFormatter: renders text output", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = {};
    JournalFormatter.render(baseActivities, filter, JournalFormat.Text);
  });

  assertStringIncludes(output, JournalAction.Error);
  assertStringIncludes(output, JOURNAL_TARGET_SHORT);
});

Deno.test("JournalFormatter: renders distinct values in table format", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = { distinct: JOURNAL_DISTINCT_FIELD_ACTION };
    JournalFormatter.render(baseActivities, filter, JournalFormat.Table);
  });

  assertStringIncludes(output, JournalAction.Error);
});

Deno.test("JournalFormatter: renders counts in table format", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = { count: true };
    const countActivities: ActivityRecord[] = baseActivities.map((activity) => ({
      ...activity,
      count: JOURNAL_COUNT_VALUE,
    }));
    JournalFormatter.render(countActivities, filter, JournalFormat.Table);
  });

  assertStringIncludes(output, JournalAction.Error);
  assertStringIncludes(output, String(JOURNAL_COUNT_VALUE));
});

Deno.test("JournalFormatter: renders counts in text format", async () => {
  const output = await captureConsoleOutput(() => {
    const filter: JournalFilterOptions = { count: true };
    const countActivities: ActivityRecord[] = baseActivities.map((activity) => ({
      ...activity,
      count: JOURNAL_COUNT_VALUE,
    }));
    JournalFormatter.render(countActivities, filter, JournalFormat.Text);
  });
  assertStringIncludes(output, JournalAction.Error);
  assertStringIncludes(output, String(JOURNAL_COUNT_VALUE));
});
