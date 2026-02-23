/**
 * Tests for Environment Variable Validation Schema (Phase 28, Phase 1)
 *
 * Success Criteria:
 * - Test 1: getValidatedEnvOverrides() returns empty object when no env vars set
 * - Test 2: Valid EXO_LLM_PROVIDER is accepted and validated
 * - Test 3: Invalid EXO_LLM_PROVIDER is rejected
 * - Test 4: EXO_LLM_MODEL validates non-empty strings
 * - Test 5: EXO_LLM_BASE_URL validates URLs
 * - Test 6: EXO_LLM_TIMEOUT_MS validates numeric range (1000-300000)
 * - Test 7: Multiple valid env vars work together
 * - Test 8: Warnings logged for invalid values
 */

import { assertEquals, assertExists } from "@std/assert";
import { withEnv } from "../helpers/env.ts";
import { getValidatedEnvOverrides } from "../../src/config/env_schema.ts";

Deno.test("EnvLLMOverride: returns empty object when no env vars set", async () => {
  await withEnv({}, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides, {});
  });
});

Deno.test("EnvLLMOverride: validates EXO_LLM_PROVIDER with valid provider", async () => {
  await withEnv({ EXO_LLM_PROVIDER: "ollama" }, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides.EXO_LLM_PROVIDER, "ollama");
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_PROVIDER with invalid provider", async () => {
  await withEnv({ EXO_LLM_PROVIDER: "invalid-provider-xyz" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Invalid provider should be rejected (undefined)
    assertEquals(overrides.EXO_LLM_PROVIDER, undefined);
  });
});

Deno.test("EnvLLMOverride: validates EXO_LLM_MODEL with non-empty string", async () => {
  await withEnv({ EXO_LLM_MODEL: "llama3.2" }, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides.EXO_LLM_MODEL, "llama3.2");
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_MODEL with empty string", async () => {
  await withEnv({ EXO_LLM_MODEL: "" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Empty model should be rejected
    assertEquals(overrides.EXO_LLM_MODEL, undefined);
  });
});

Deno.test("EnvLLMOverride: validates EXO_LLM_BASE_URL with valid URL", async () => {
  await withEnv({ EXO_LLM_BASE_URL: "http://localhost:11434" }, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides.EXO_LLM_BASE_URL, "http://localhost:11434");
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_BASE_URL with invalid URL", async () => {
  await withEnv({ EXO_LLM_BASE_URL: "not-a-url" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Invalid URL should be rejected
    assertEquals(overrides.EXO_LLM_BASE_URL, undefined);
  });
});

Deno.test("EnvLLMOverride: validates EXO_LLM_TIMEOUT_MS with valid number string", async () => {
  await withEnv({ EXO_LLM_TIMEOUT_MS: "60000" }, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, 60000);
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_TIMEOUT_MS below minimum (1000ms)", async () => {
  await withEnv({ EXO_LLM_TIMEOUT_MS: "999" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Below minimum should be rejected
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, undefined);
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_TIMEOUT_MS above maximum (300000ms)", async () => {
  await withEnv({ EXO_LLM_TIMEOUT_MS: "300001" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Above maximum should be rejected
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, undefined);
  });
});

Deno.test("EnvLLMOverride: rejects EXO_LLM_TIMEOUT_MS with non-numeric string", async () => {
  await withEnv({ EXO_LLM_TIMEOUT_MS: "not-a-number" }, () => {
    const overrides = getValidatedEnvOverrides();
    // Non-numeric should be rejected
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, undefined);
  });
});

Deno.test("EnvLLMOverride: handles multiple valid env vars together", async () => {
  await withEnv({
    EXO_LLM_PROVIDER: "anthropic",
    EXO_LLM_MODEL: "claude-opus-4-6",
    EXO_LLM_BASE_URL: "https://api.anthropic.com/v1/messages",
    EXO_LLM_TIMEOUT_MS: "60000",
  }, () => {
    const overrides = getValidatedEnvOverrides();
    assertEquals(overrides.EXO_LLM_PROVIDER, "anthropic");
    assertEquals(overrides.EXO_LLM_MODEL, "claude-opus-4-6");
    assertEquals(overrides.EXO_LLM_BASE_URL, "https://api.anthropic.com/v1/messages");
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, 60000);
  });
});

Deno.test("EnvLLMOverride: filters out invalid vars but keeps valid ones", async () => {
  await withEnv({
    EXO_LLM_PROVIDER: "ollama", // valid
    EXO_LLM_MODEL: "", // invalid (empty)
    EXO_LLM_TIMEOUT_MS: "999", //invalid (below min)
  }, () => {
    const overrides = getValidatedEnvOverrides();
    // Only valid provider should be present
    assertEquals(overrides.EXO_LLM_PROVIDER, "ollama");
    assertEquals(overrides.EXO_LLM_MODEL, undefined);
    assertEquals(overrides.EXO_LLM_TIMEOUT_MS, undefined);
  });
});

Deno.test("EnvLLMOverride: warns on validation failure", async () => {
  // Capture console.warn output
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: string[]) => warnings.push(args.join(" "));

  try {
    await withEnv({ EXO_LLM_TIMEOUT_MS: "invalid" }, () => {
      getValidatedEnvOverrides();
    });

    // Should have logged a warning about timeout
    assertExists(warnings.find((w) => w.includes("Invalid EXO_LLM_TIMEOUT_MS")));
  } finally {
    console.warn = originalWarn;
  }
});
