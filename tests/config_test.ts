/**
 * Tests for Configuration System (Step 2.1: The Configuration Service)
 *
 * Success Criteria:
 * - Test 1: ConfigSchema accepts valid minimal configuration
 * - Test 2: ConfigSchema rejects invalid values (log_level, paths, etc.)
 * - Test 3: ConfigSchema provides sensible defaults for optional fields
 * - Test 4: ConfigService loads and validates exo.config.toml
 * - Test 5: ConfigService throws clear error for missing config file
 * - Test 6: ConfigService resolves relative paths correctly
 * - Test 7: ConfigService validates provider configuration
 */

import { assertEquals, assertExists, assertStringIncludes, assertThrows } from "@std/assert";
import { ProviderCostTier } from "../src/enums.ts";

import { ConfigService } from "../src/config/service.ts";
import { ConfigSchema } from "../src/config/schema.ts";
import { join } from "@std/path";
import { initializeGlobalLogger, resetGlobalLogger } from "../src/services/structured_logger.ts";

Deno.test("ConfigSchema accepts valid minimal config", () => {
  const validConfig = {
    system: {
      version: "1.0.0",
      log_level: "info",
    },
    paths: {
      memory: "./Memory",
      blueprints: "./Blueprints",
      system: "./System",
    },
  };

  const result = ConfigSchema.safeParse(validConfig);
  assertEquals(result.success, true);
});

Deno.test("ConfigSchema rejects invalid log_level", () => {
  const invalidConfig = {
    system: {
      log_level: "invalid",
    },
    paths: {
      memory: "./Memory",
    },
  };

  const result = ConfigSchema.safeParse(invalidConfig);
  assertEquals(result.success, false);
});

Deno.test("ConfigSchema applies defaults for missing agents section", () => {
  const configWithoutAgents = {
    system: {
      version: "1.0.0",
      log_level: "info",
    },
    paths: {
      memory: "./Memory",
      blueprints: "./Blueprints",
      system: "./System",
    },
  };

  const result = ConfigSchema.parse(configWithoutAgents);
  assertEquals(result.agents.default_model, "default");
  assertEquals(result.agents.timeout_sec, 60);
});

Deno.test("ConfigSchema applies defaults for missing watcher section", () => {
  const configWithoutWatcher = {
    system: {
      version: "1.0.0",
      log_level: "info",
    },
    paths: {
      memory: "./Memory",
      blueprints: "./Blueprints",
      system: "./System",
    },
  };

  const result = ConfigSchema.parse(configWithoutWatcher);
  assertEquals(result.watcher.debounce_ms, 200);
  assertEquals(result.watcher.stability_check, true);
});

Deno.test("ConfigService computes checksum", () => {
  initializeGlobalLogger({
    minLevel: "info",
    outputs: [],
    enablePerformanceTracking: false,
    serviceName: "test",
    version: "1.0.0",
  });

  try {
    // Clean up before test to ensure consistent state
    try {
      Deno.removeSync("exo.config.toml");
    } catch {
      // Ignore if doesn't exist
    }

    const service = new ConfigService("exo.config.toml");
    const checksum = service.getChecksum();

    assertExists(checksum);
    assertEquals(checksum.length, 64); // SHA-256 produces 64 hex chars
  } finally {
    // Clean up after test
    try {
      Deno.removeSync("exo.config.toml");
    } catch {
      // Ignore
    }
    resetGlobalLogger();
  }
});

Deno.test("ConfigService loads config successfully", () => {
  initializeGlobalLogger({
    minLevel: "info",
    outputs: [],
    enablePerformanceTracking: false,
    serviceName: "test",
    version: "1.0.0",
  });

  try {
    // Clean up before test
    try {
      Deno.removeSync("exo.config.toml");
    } catch {
      // Ignore
    }

    const service = new ConfigService("exo.config.toml");
    const config = service.get();

    assertExists(config.system);
    assertExists(config.paths);
    assertEquals(config.system.log_level, "info");
  } finally {
    // Clean up after test
    try {
      Deno.removeSync("exo.config.toml");
    } catch {
      // Ignore
    }
    resetGlobalLogger();
  }
});

// ============================================================================
// ConfigService Error Handling Tests
// ============================================================================

Deno.test("ConfigService handles missing config file", async (t) => {
  // Initialize global logger for tests
  initializeGlobalLogger({
    minLevel: "info",
    outputs: [],
    enablePerformanceTracking: false,
    serviceName: "test",
    version: "1.0.0",
  });

  await t.step("should create default config when file not found", () => {
    const tempPath = join(Deno.cwd(), "test-missing-config.toml");

    // Clean up if exists
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore if doesn't exist
    }

    // ConfigService should create default config
    const service = new ConfigService("test-missing-config.toml");
    const config = service.get();

    // Verify config has defaults (from the created default file)
    assertEquals(config.system.log_level, "info");
    assertEquals(config.paths.memory, "./Memory"); // From file
    assertEquals(config.paths.blueprints, "./Blueprints"); // From file

    // Verify file was created
    const fileExists = (() => {
      try {
        Deno.statSync(tempPath);
        return true;
      } catch {
        return false;
      }
    })();
    assertEquals(fileExists, true);

    // Clean up
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  await t.step("should compute checksum for created default config", () => {
    const tempPath = join(Deno.cwd(), "test-checksum-config.toml");

    // Clean up if exists
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore
    }

    const service = new ConfigService("test-checksum-config.toml");
    const checksum = service.getChecksum();

    // Checksum should be computed for the created file
    assertEquals(typeof checksum, "string");
    assertEquals(checksum.length > 0, true);

    // Clean up
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore
    }
  });

  // Reset global logger after test
  resetGlobalLogger();
});

Deno.test("ConfigService handles invalid TOML syntax", () => {
  const tempPath = join(Deno.cwd(), "test-invalid-toml.toml");

  // Create file with invalid TOML
  Deno.writeTextFileSync(tempPath, "[system\nthis is not valid TOML");

  try {
    assertThrows(
      () => {
        new ConfigService("test-invalid-toml.toml");
      },
      Error,
    );
  } finally {
    // Clean up
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore
    }
  }
});

Deno.test("ConfigService handles validation errors", async (t) => {
  await t.step("should exit on missing required fields", () => {
    const tempPath = join(Deno.cwd(), "test-missing-fields.toml");

    // Create config missing required system.version
    Deno.writeTextFileSync(
      tempPath,
      `
[system]
log_level = "info"
    `.trim(),
    );

    try {
      assertThrows(
        () => {
          new ConfigService("test-missing-fields.toml");
        },
        Error,
        "Invalid configuration",
      );
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should exit on invalid field types", () => {
    const tempPath = join(Deno.cwd(), "test-invalid-types.toml");

    // Create config with invalid log_level
    Deno.writeTextFileSync(
      tempPath,
      `
[system]
version = "1.0.0"
log_level = "invalid_level"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"
    `.trim(),
    );

    try {
      assertThrows(
        () => {
          new ConfigService("test-invalid-types.toml");
        },
        Error,
        "Invalid configuration",
      );
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should exit on invalid timeout value", () => {
    const tempPath = join(Deno.cwd(), "test-invalid-timeout.toml");

    Deno.writeTextFileSync(
      tempPath,
      `
[system]
log_level = "info"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"

[agents]
timeout_sec = -5
    `.trim(),
    );

    try {
      assertThrows(
        () => {
          new ConfigService("test-invalid-timeout.toml");
        },
        Error,
        "Invalid configuration",
      );
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });
});

Deno.test("ConfigService handles edge cases", async (t) => {
  await t.step("should handle empty config file", () => {
    const tempPath = join(Deno.cwd(), "test-empty-config.toml");

    // Empty TOML file will throw a parse error
    Deno.writeTextFileSync(tempPath, "");

    try {
      // Empty file causes TOML parse error, not validation error
      assertThrows(
        () => {
          new ConfigService("test-empty-config.toml");
        },
        Error,
        "Parse error",
      );
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should handle config with comments", () => {
    const tempPath = join(Deno.cwd(), "test-comments-config.toml");

    Deno.writeTextFileSync(
      tempPath,
      `
# This is a comment
[system]
version = "1.0.0"
log_level = "info"  # inline comment

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"
    `.trim(),
    );

    try {
      const service = new ConfigService("test-comments-config.toml");
      const config = service.get();

      assertEquals(config.system.version, "1.0.0");
      assertEquals(config.system.log_level, "info");
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should handle config with extra unknown fields", () => {
    const tempPath = join(Deno.cwd(), "test-extra-fields.toml");

    Deno.writeTextFileSync(
      tempPath,
      `
[system]
version = "1.0.0"
log_level = "info"
unknown_field = "should be ignored"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"

[unknown_section]
foo = "bar"
    `.trim(),
    );

    try {
      const service = new ConfigService("test-extra-fields.toml");
      const config = service.get();

      // Should load successfully, extra fields ignored
      assertEquals(config.system.version, "1.0.0");
      assertEquals(config.system.log_level, "info");
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should handle config with unicode in paths", () => {
    const tempPath = join(Deno.cwd(), "test-unicode-config.toml");

    Deno.writeTextFileSync(
      tempPath,
      `
[system]
version = "1.0.0"
log_level = "info"

[paths]
memory = "./记忆"
blueprints = "./蓝图"
runtime = "./系統"
    `.trim(),
    );

    try {
      const service = new ConfigService("test-unicode-config.toml");
      const config = service.get();

      assertEquals(config.paths.memory, "./记忆");
      assertEquals(config.paths.blueprints, "./蓝图");
      assertEquals(config.paths.runtime, "./系統");
    } finally {
      try {
        Deno.removeSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should compute consistent checksums", () => {
    const content = `[system]
log_level = "info"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"`;

    const tempPath1 = join(Deno.cwd(), "test-checksum-1.toml");
    const tempPath2 = join(Deno.cwd(), "test-checksum-2.toml");

    try {
      Deno.writeTextFileSync(tempPath1, content);
      Deno.writeTextFileSync(tempPath2, content);

      const service1 = new ConfigService("test-checksum-1.toml");
      const service2 = new ConfigService("test-checksum-2.toml");

      // Same content should produce same checksum
      assertEquals(service1.getChecksum(), service2.getChecksum());
      assertEquals(service1.getChecksum().length, 64); // SHA-256 hex
    } finally {
      try {
        Deno.removeSync(tempPath1);
        Deno.removeSync(tempPath2);
      } catch {
        // Ignore
      }
    }
  });

  await t.step("should compute different checksums for different content", () => {
    const tempPath1 = join(Deno.cwd(), "test-checksum-diff-1.toml");
    const tempPath2 = join(Deno.cwd(), "test-checksum-diff-2.toml");

    try {
      Deno.writeTextFileSync(
        tempPath1,
        `[system]
log_level = "info"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"`,
      );

      Deno.writeTextFileSync(
        tempPath2,
        `[system]
log_level = "debug"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"`,
      );

      const service1 = new ConfigService("test-checksum-diff-1.toml");
      const service2 = new ConfigService("test-checksum-diff-2.toml");

      // Different content should produce different checksums
      assertEquals(
        service1.getChecksum() !== service2.getChecksum(),
        true,
      );
    } finally {
      try {
        Deno.removeSync(tempPath1);
        Deno.removeSync(tempPath2);
      } catch {
        // Ignore
      }
    }
  });
});

// ============================================================================
// Security Tests - Use `deno test --filter "[security]"` to run only these
// ============================================================================

Deno.test("[security] Env Variable Access: EXO_ prefixed vars are accessible", () => {
  // This test verifies the security model where only EXO_* env vars should be accessible
  // In production, the daemon runs with --allow-env=EXO_,HOME,USER

  // Set a test EXO_ variable
  const testValue = "test-value-" + Date.now();
  Deno.env.set("EXO_TEST_VAR", testValue);

  try {
    // EXO_ prefixed vars should be accessible
    const value = Deno.env.get("EXO_TEST_VAR");
    assertEquals(value, testValue, "EXO_ prefixed vars should be accessible");
  } finally {
    Deno.env.delete("EXO_TEST_VAR");
  }
});

Deno.test("[security] Env Variable Access: HOME and USER are accessible for identity", () => {
  // These are explicitly allowed for user identity detection
  // The start:fg task allows: --allow-env=EXO_,HOME,USER

  const home = Deno.env.get("HOME");
  const user = Deno.env.get("USER");

  // At least one should be available on most systems
  assertEquals(
    home !== undefined || user !== undefined,
    true,
    "HOME or USER should be accessible for identity detection",
  );
});

Deno.test("[security] Env Variable Security: Verify sensitive env vars are not in config", () => {
  // This test ensures the config system doesn't accidentally expose sensitive vars
  // Config should never read API_KEY, AWS_SECRET_ACCESS_KEY, etc.

  const sensitiveVars = [
    "API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ACCESS_KEY_ID",
    "DATABASE_PASSWORD",
    "DB_PASSWORD",
    "SECRET_KEY",
    "PRIVATE_KEY",
    "GITHUB_TOKEN",
    "NPM_TOKEN",
  ];

  // Set dummy sensitive vars for testing
  for (const varName of sensitiveVars) {
    Deno.env.set(varName, "SENSITIVE_VALUE_" + varName);
  }

  try {
    // Create a config and verify it doesn't contain sensitive values
    const tempPath = join(Deno.cwd(), "test-security-config.toml");
    Deno.writeTextFileSync(
      tempPath,
      `[system]
log_level = "info"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./Runtime"`,
    );

    try {
      const service = new ConfigService("test-security-config.toml");
      const config = service.get();
      const configStr = JSON.stringify(config);

      // Verify none of the sensitive values appear in config
      for (const varName of sensitiveVars) {
        assertEquals(
          configStr.includes("SENSITIVE_VALUE_" + varName),
          false,
          `Config should not contain value of ${varName}`,
        );
      }
    } finally {
      Deno.removeSync(tempPath);
    }
  } finally {
    // Clean up sensitive vars
    for (const varName of sensitiveVars) {
      Deno.env.delete(varName);
    }
  }
});

Deno.test("[security] Env Variable Security: Config doesn't expand env vars in paths", () => {
  // Ensure path configuration doesn't expand environment variables
  // which could lead to path injection attacks

  Deno.env.set("MALICIOUS_PATH", "/etc/passwd");

  const tempPath = join(Deno.cwd(), "test-path-injection.toml");
  try {
    // Create config with env var reference in path
    Deno.writeTextFileSync(
      tempPath,
      `[system]
log_level = "info"

[paths]
memory = "$MALICIOUS_PATH"
blueprints = "./Blueprints"
runtime = "./Runtime"`,
    );

    const service = new ConfigService("test-path-injection.toml");
    const config = service.get();

    // Path should be literal "$MALICIOUS_PATH", not expanded to /etc/passwd
    assertEquals(
      config.paths.memory.includes("/etc/passwd"),
      false,
      "Env vars in paths should not be expanded",
    );
    assertEquals(
      config.paths.memory.includes("$MALICIOUS_PATH") ||
        config.paths.memory.includes("MALICIOUS_PATH"),
      true,
      "Path should contain literal string, not expanded value",
    );
  } finally {
    Deno.env.delete("MALICIOUS_PATH");
    try {
      Deno.removeSync(tempPath);
    } catch {
      // Ignore
    }
  }
});

// Provider Strategy Configuration Tests (Improvement 5: Enhanced Configuration Schema)

Deno.test("ConfigSchema accepts provider_strategy section", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    provider_strategy: {
      prefer_free: true,
      allow_local: true,
      max_daily_cost_usd: 5.00,
      health_check_enabled: true,
      fallback_enabled: true,
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_strategy?.prefer_free, true);
    assertEquals(result.data.provider_strategy?.allow_local, true);
    assertEquals(result.data.provider_strategy?.max_daily_cost_usd, 5.00);
    assertEquals(result.data.provider_strategy?.health_check_enabled, true);
    assertEquals(result.data.provider_strategy?.fallback_enabled, true);
  }
});

Deno.test("ConfigSchema accepts provider_strategy.fallback_chains", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    provider_strategy: {
      fallback_chains: {
        free: ["google", "ollama", "mock"],
        paid: ["anthropic", "openai"],
        local: ["ollama"],
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_strategy?.fallback_chains?.free, ["google", "ollama", "mock"]);
    assertEquals(result.data.provider_strategy?.fallback_chains?.paid, ["anthropic", "openai"]);
    assertEquals(result.data.provider_strategy?.fallback_chains?.local, ["ollama"]);
  }
});

Deno.test("ConfigSchema accepts provider_strategy.budgets", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    provider_strategy: {
      budgets: {
        anthropic_daily_usd: 3.00,
        openai_daily_usd: 2.00,
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_strategy?.budgets?.anthropic_daily_usd, 3.00);
    assertEquals(result.data.provider_strategy?.budgets?.openai_daily_usd, 2.00);
  }
});

Deno.test("ConfigSchema accepts provider_strategy.task_routing", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    provider_strategy: {
      task_routing: {
        simple: ["ollama", "google"],
        medium: ["google", "anthropic"],
        complex: ["anthropic", "openai"],
        code_generation: ["anthropic", "openai"],
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.provider_strategy?.task_routing?.simple, ["ollama", "google"]);
    assertEquals(result.data.provider_strategy?.task_routing?.medium, ["google", "anthropic"]);
    assertEquals(result.data.provider_strategy?.task_routing?.complex, ["anthropic", "openai"]);
    assertEquals(result.data.provider_strategy?.task_routing?.code_generation, ["anthropic", "openai"]);
  }
});

Deno.test("ConfigSchema accepts providers.* overrides", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    providers: {
      google: {
        cost_tier: ProviderCostTier.FREEMIUM,
        free_quota_requests_per_day: 1500,
        timeout_ms: 30000,
      },
      ollama: {
        cost_tier: ProviderCostTier.FREE,
        base_url: "http://localhost:11434",
        timeout_ms: 60000,
      },
      anthropic: {
        cost_tier: ProviderCostTier.PAID,
        timeout_ms: 30000,
        rate_limit_rpm: 50,
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.providers?.google?.cost_tier, ProviderCostTier.FREEMIUM);
    assertEquals(result.data.providers?.google?.free_quota_requests_per_day, 1500);
    assertEquals(result.data.providers?.ollama?.cost_tier, ProviderCostTier.FREE);
    assertEquals(result.data.providers?.ollama?.base_url, "http://localhost:11434");
    assertEquals(result.data.providers?.anthropic?.cost_tier, ProviderCostTier.PAID);
    assertEquals(result.data.providers?.anthropic?.rate_limit_rpm, 50);
  }
});

Deno.test("ConfigSchema provides defaults for provider_strategy", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    // Check that defaults are applied
    assertEquals(result.data.provider_strategy?.prefer_free, true);
    assertEquals(result.data.provider_strategy?.allow_local, true);
    assertEquals(result.data.provider_strategy?.max_daily_cost_usd, 5.00);
    assertEquals(result.data.provider_strategy?.health_check_enabled, true);
    assertEquals(result.data.provider_strategy?.fallback_enabled, true);
  }
});

Deno.test("ConfigSchema rejects unknown provider names in fallback_chains", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    provider_strategy: {
      fallback_chains: {
        free: ["invalid_provider", "google"],
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, false);
});

Deno.test("ConfigSchema rejects invalid cost_tier values", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    providers: {
      google: {
        cost_tier: "invalid_tier",
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, false);
});

Deno.test("ConfigSchema accepts valid cost_tier values", () => {
  const config = {
    system: { version: "1.0.0" },
    paths: {
      workspace: "Workspace",
      runtime: ".exo",
      memory: "Memory",
      portals: "Portals",
      blueprints: "Blueprints",
    },
    providers: {
      google: {
        cost_tier: ProviderCostTier.FREE,
      },
      anthropic: {
        cost_tier: ProviderCostTier.PAID,
      },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.providers?.google?.cost_tier, ProviderCostTier.FREE);
    assertEquals(result.data.providers?.anthropic?.cost_tier, ProviderCostTier.PAID);
  }
});

Deno.test("ConfigSchema validation: rejects invalid default_model", () => {
  // Config with default_model pointing to nothing
  const config = {
    system: { version: "1.0.0", log_level: "info" },
    paths: { memory: "M", blueprints: "B", runtime: "R" },
    agents: { default_model: "non_existent_model" },
    models: {
      my_model: { provider: "mock", model: "m" },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, false);
  if (!result.success) {
    // Zod error path
    const error = result.error.errors.find((e) => e.path.includes("default_model"));
    assertExists(error);
    assertStringIncludes(error.message, "not found");
  }
});

Deno.test("ConfigSchema validation: rejects invalid fallback_chain target (with message check)", () => {
  const config = {
    system: { version: "1.0.0", log_level: "info" },
    paths: { memory: "M", blueprints: "B", runtime: "R" },
    provider_strategy: {
      fallback_chains: {
        broken_chain: ["missing_target"],
      },
    },
    models: {
      my_model: { provider: "mock", model: "m" },
    },
  };

  const result = ConfigSchema.safeParse(config);
  assertEquals(result.success, false);
  if (!result.success) {
    const error = result.error.errors.find((e) => e.path.includes("fallback_chains"));
    assertExists(error);
    assertStringIncludes(error.message, "unknown target");
  }
});
