/**
 * Tests for Phase 28 Phase 3: Testing Environment Variable Standardization
 *
 * Success Criteria:
 * - Test 1: isTestMode() detects EXO_TEST_MODE environment variable
 * - Test 2: isCIMode() detects CI and EXO_CI_MODE environment variables
 * - Test 3: Env var schema validates EXO_TEST_* variables
 */

import { assertEquals } from "@std/assert";
import { withEnv } from "../helpers/env.ts";
import { isCIMode, isTestMode } from "../../src/config/env_schema.ts";

Deno.test("Phase 3: isTestMode() returns false when EXO_TEST_MODE not set", async () => {
  await withEnv({}, () => {
    assertEquals(isTestMode(), false);
  });
});

Deno.test("Phase 3: isTestMode() returns true when EXO_TEST_MODE=1", async () => {
  await withEnv({ EXO_TEST_MODE: "1" }, () => {
    assertEquals(isTestMode(), true);
  });
});

Deno.test("Phase 3: isTestMode() returns true when EXO_TEST_MODE=true", async () => {
  await withEnv({ EXO_TEST_MODE: "true" }, () => {
    assertEquals(isTestMode(), true);
  });
});

Deno.test("Phase 3: isTestMode() returns false when EXO_TEST_MODE=0", async () => {
  await withEnv({ EXO_TEST_MODE: "0" }, () => {
    assertEquals(isTestMode(), false);
  });
});

Deno.test("Phase 3: isTestMode() returns false when EXO_TEST_MODE=false", async () => {
  await withEnv({ EXO_TEST_MODE: "false" }, () => {
    assertEquals(isTestMode(), false);
  });
});

Deno.test("Phase 3: isCIMode() returns false when neither CI nor EXO_CI_MODE set", async () => {
  await withEnv({ CI: null, EXO_CI_MODE: null }, () => {
    assertEquals(isCIMode(), false);
  });
});

Deno.test("Phase 3: isCIMode() returns true when CI=1", async () => {
  await withEnv({ CI: "1" }, () => {
    assertEquals(isCIMode(), true);
  });
});

Deno.test("Phase 3: isCIMode() returns true when CI=true", async () => {
  await withEnv({ CI: "true" }, () => {
    assertEquals(isCIMode(), true);
  });
});

Deno.test("Phase 3: isCIMode() returns true when EXO_CI_MODE=1", async () => {
  await withEnv({ EXO_CI_MODE: "1" }, () => {
    assertEquals(isCIMode(), true);
  });
});

Deno.test("Phase 3: isCIMode() returns false when CI=0", async () => {
  await withEnv({ CI: "0" }, () => {
    assertEquals(isCIMode(), false);
  });
});

Deno.test("Phase 3: isCIMode() returns false when CI=false", async () => {
  await withEnv({ CI: "false" }, () => {
    assertEquals(isCIMode(), false);
  });
});

Deno.test("Phase 3: isCIMode() prefers EXO_CI_MODE over CI", async () => {
  // If both set, EXO_CI_MODE takes precedence
  await withEnv({ CI: "0", EXO_CI_MODE: "1" }, () => {
    assertEquals(isCIMode(), true);
  });

  await withEnv({ CI: "1", EXO_CI_MODE: "0" }, () => {
    assertEquals(isCIMode(), false);
  });
});
