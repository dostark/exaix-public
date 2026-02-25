/**
 * @module TestModeEnvVarsTest
 * @path tests/config/phase3_testing_env_vars_test.ts
 * @description Verifies the logic for 'test mode' detection, ensuring that
 * 'EXO_TEST_MODE' is correctly parsed across varied boolean string representations.
 */

import { assertEquals } from "@std/assert";
import { withEnv } from "../helpers/env.ts";
import { isCIMode, isTestMode } from "../../src/config/env_schema.ts";

Deno.test({
  name: "Phase 3: isTestMode() returns false when EXO_TEST_MODE not set",
  fn() {
    withEnv({ EXO_TEST_MODE: null, EXO_TEST_CLI_MODE: null }, () => {
      assertEquals(isTestMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isTestMode() returns true when EXO_TEST_MODE=1",
  fn() {
    withEnv({ EXO_TEST_MODE: "1" }, () => {
      assertEquals(isTestMode(), true);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isTestMode() returns true when EXO_TEST_MODE=true",
  fn() {
    withEnv({ EXO_TEST_MODE: "true" }, () => {
      assertEquals(isTestMode(), true);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isTestMode() returns false when EXO_TEST_MODE=0",
  fn() {
    withEnv({ EXO_TEST_MODE: "0", EXO_TEST_CLI_MODE: null }, () => {
      assertEquals(isTestMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isTestMode() returns false when EXO_TEST_MODE=false",
  fn() {
    withEnv({ EXO_TEST_MODE: "false", EXO_TEST_CLI_MODE: null }, () => {
      assertEquals(isTestMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns false when neither CI nor EXO_CI_MODE set",
  fn() {
    withEnv({ CI: null, EXO_CI_MODE: null }, () => {
      assertEquals(isCIMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns true when CI=1",
  fn() {
    withEnv({ CI: "1" }, () => {
      assertEquals(isCIMode(), true);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns true when CI=true",
  fn() {
    withEnv({ CI: "true" }, () => {
      assertEquals(isCIMode(), true);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns true when EXO_CI_MODE=1",
  fn() {
    withEnv({ EXO_CI_MODE: "1" }, () => {
      assertEquals(isCIMode(), true);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns false when CI=0",
  fn() {
    withEnv({ CI: "0" }, () => {
      assertEquals(isCIMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() returns false when CI=false",
  fn() {
    withEnv({ CI: "false" }, () => {
      assertEquals(isCIMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Phase 3: isCIMode() prefers EXO_CI_MODE over CI",
  fn() {
    // If both set, EXO_CI_MODE takes precedence
    withEnv({ CI: "0", EXO_CI_MODE: "1" }, () => {
      assertEquals(isCIMode(), true);
    });

    withEnv({ CI: "1", EXO_CI_MODE: "0" }, () => {
      assertEquals(isCIMode(), false);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
