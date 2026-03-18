/**
 * @module ScenarioFrameworkVersionTest
 * @path tests/scenario_framework/tests/unit/version_test.ts
 * @description Tests for the centralized schema version constants and
 * validation utilities to ensure version strings are properly enforced.
 * @architectural-layer Test
 * @related-files [tests/scenario_framework/schema/version.ts, tests/scenario_framework/schema/scenario_schema.ts]
 */

import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  compareVersions,
  isCompatibleVersion,
  isValidVersion,
  SCHEMA_VERSION,
  VERSION_PATTERN,
} from "../../schema/version.ts";

Deno.test("[ScenarioFrameworkVersion] SCHEMA_VERSION is a valid semver string", () => {
  assert(VERSION_PATTERN.test(SCHEMA_VERSION));
  assertEquals(SCHEMA_VERSION, "1.0.0");
});

Deno.test("[ScenarioFrameworkVersion] isValidVersion accepts valid semver strings", () => {
  assert(isValidVersion("0.0.0"));
  assert(isValidVersion("1.0.0"));
  assert(isValidVersion("2.1.0"));
  assert(isValidVersion("10.20.30"));
});

Deno.test("[ScenarioFrameworkVersion] isValidVersion rejects invalid version strings", () => {
  assertFalse(isValidVersion(""));
  assertFalse(isValidVersion("1.0"));
  assertFalse(isValidVersion("1"));
  assertFalse(isValidVersion("1.0.0.0"));
  assertFalse(isValidVersion("v1.0.0"));
  assertFalse(isValidVersion("1.0.0-beta"));
  assertFalse(isValidVersion("abc.def.ghi"));
});

Deno.test("[ScenarioFrameworkVersion] compareVersions returns correct ordering", () => {
  assertEquals(compareVersions("1.0.0", "1.0.0"), 0);
  assertEquals(compareVersions("1.0.0", "0.9.9"), 1);
  assertEquals(compareVersions("0.9.9", "1.0.0"), -1);
  assertEquals(compareVersions("1.1.0", "1.0.0"), 1);
  assertEquals(compareVersions("1.0.1", "1.0.0"), 1);
  assertEquals(compareVersions("2.0.0", "1.9.9"), 1);
  assertEquals(compareVersions("1.9.9", "2.0.0"), -1);
});

Deno.test("[ScenarioFrameworkVersion] isCompatibleVersion accepts same major version", () => {
  assert(isCompatibleVersion("1.0.0"));
  assert(isCompatibleVersion("1.1.0"));
  assert(isCompatibleVersion("1.0.5"));
  assert(isCompatibleVersion("1.99.99"));
});

Deno.test("[ScenarioFrameworkVersion] isCompatibleVersion rejects different major versions", () => {
  assertFalse(isCompatibleVersion("2.0.0"));
  assertFalse(isCompatibleVersion("3.1.0"));
  assertFalse(isCompatibleVersion("0.0.0"));
});

Deno.test("[ScenarioFrameworkVersion] isCompatibleVersion rejects invalid version strings", () => {
  assertFalse(isCompatibleVersion(""));
  assertFalse(isCompatibleVersion("invalid"));
  assertFalse(isCompatibleVersion("1.0"));
  assertFalse(isCompatibleVersion("v1.0.0"));
});

Deno.test("[ScenarioFrameworkVersion] VERSION_PATTERN matches expected format", () => {
  assert(VERSION_PATTERN.test("0.0.0"));
  assert(VERSION_PATTERN.test("1.0.0"));
  assert(VERSION_PATTERN.test("999.999.999"));
});

Deno.test("[ScenarioFrameworkVersion] VERSION_PATTERN rejects malformed versions", () => {
  assertFalse(VERSION_PATTERN.test(""));
  assertFalse(VERSION_PATTERN.test("1.0"));
  assertFalse(VERSION_PATTERN.test("1"));
  assertFalse(VERSION_PATTERN.test("1.0.0.0"));
  assertFalse(VERSION_PATTERN.test("v1.0.0"));
  assertFalse(VERSION_PATTERN.test("1.0.0-beta"));
});
