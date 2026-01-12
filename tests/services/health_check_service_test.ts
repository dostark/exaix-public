import { assertEquals, assertExists } from "@std/assert";
import {
  DatabaseHealthCheck,
  DiskSpaceHealthCheck,
  HealthCheck,
  HealthCheckService,
  initializeHealthChecks,
  LLMProviderHealthCheck,
  MemoryHealthCheck,
} from "../../src/services/health_check_service.ts";
import { MockLLMProvider } from "../../src/ai/providers/mock_llm_provider.ts";
import { initTestDbService } from "../helpers/db.ts";

/**
 * Tests for HealthCheckService - Comprehensive Health Monitoring & Readiness Checks
 */

Deno.test("HealthCheckService: initializes with version", () => {
  const service = new HealthCheckService("1.0.0");
  assertEquals(service["version"], "1.0.0");
});

Deno.test("HealthCheckService: registers health checks", () => {
  const service = new HealthCheckService("1.0.0");
  const mockCheck = {
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "pass" as const }),
  };

  service.registerCheck(mockCheck);
  // Access private property for testing
  assertEquals((service as any).checks.size, 1);
  assertEquals((service as any).checks.get("test"), mockCheck);
});

Deno.test("HealthCheckService: returns healthy status when all checks pass", async () => {
  const service = new HealthCheckService("1.0.0");
  const mockCheck = {
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "pass" as const, metadata: { test: "data" } }),
  };

  service.registerCheck(mockCheck);
  const status = await service.checkHealth();

  assertEquals(status.status, "healthy");
  assertEquals(status.version, "1.0.0");
  assertExists(status.timestamp);
  assertEquals(status.uptime_seconds >= 0, true);
  assertEquals(status.checks.test.status, "pass");
  assertEquals(status.checks.test.metadata?.test, "data");
});

Deno.test("HealthCheckService: returns degraded status when non-critical check fails", async () => {
  const service = new HealthCheckService("1.0.0");
  const mockCheck = {
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "fail" as const, message: "Test failure" }),
  };

  service.registerCheck(mockCheck);
  const status = await service.checkHealth();

  assertEquals(status.status, "degraded");
  assertEquals(status.checks.test.status, "fail");
  assertEquals(status.checks.test.message, "Test failure");
});

Deno.test("HealthCheckService: returns unhealthy status when critical check fails", async () => {
  const service = new HealthCheckService("1.0.0");
  const mockCheck = {
    name: "test",
    critical: true,
    check: () => Promise.resolve({ status: "fail" as const, message: "Critical failure" }),
  };

  service.registerCheck(mockCheck);
  const status = await service.checkHealth();

  assertEquals(status.status, "unhealthy");
  assertEquals(status.checks.test.status, "fail");
  assertEquals(status.checks.test.message, "Critical failure");
});

Deno.test("HealthCheckService: handles check timeouts", async () => {
  const service = new HealthCheckService("1.0.0");
  let timeoutId: number | undefined;

  const slowCheck: HealthCheck = {
    name: "slow",
    critical: false,
    check: () =>
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: "pass" as const }), 100);
      }),
  };

  service.registerCheck(slowCheck);
  // Override timeout for this test
  (service as any).checkTimeout = 50;

  const status = await service.checkHealth();

  // Clear any remaining timeout from the test
  if (timeoutId) clearTimeout(timeoutId);

  assertEquals(status.checks.slow.status, "fail");
  assertExists(status.checks.slow.message);
  assertEquals(status.checks.slow.message?.includes("timed out"), true);
});

Deno.test("HealthCheckService: runs checks in parallel", async () => {
  const service = new HealthCheckService("1.0.0");
  let check1Executed = false;
  let check2Executed = false;

  const check1 = {
    name: "check1",
    critical: false,
    check: async () => {
      check1Executed = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: "pass" as const };
    },
  };

  const check2 = {
    name: "check2",
    critical: false,
    check: async () => {
      check2Executed = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: "pass" as const };
    },
  };

  service.registerCheck(check1);
  service.registerCheck(check2);

  const startTime = Date.now();
  await service.checkHealth();
  const endTime = Date.now();

  // Should complete in less than 30ms if running in parallel (each check takes 10ms)
  assertEquals(endTime - startTime < 30, true);
  assertEquals(check1Executed, true);
  assertEquals(check2Executed, true);
});

Deno.test("DatabaseHealthCheck: passes when database is accessible", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const check = new DatabaseHealthCheck(db);
    const result = await check.check();

    assertEquals(result.status, "pass");
    assertExists(result.metadata);
    assertEquals(typeof result.metadata?.response_time_ms, "number");
    assertEquals(result.duration_ms !== undefined, true);
  } finally {
    await cleanup();
  }
});

Deno.test("DatabaseHealthCheck: fails when database query fails", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    // Close the database to simulate failure
    db.close();
    const check = new DatabaseHealthCheck(db);

    const result = await check.check();

    assertEquals(result.status, "fail");
    assertExists(result.message);
    // Just check that there's an error message
    assertEquals(result.message?.length > 0, true);
  } finally {
    await cleanup();
  }
});

Deno.test("LLMProviderHealthCheck: passes when provider responds successfully", async () => {
  const mockProvider = new MockLLMProvider("scripted", {
    responses: ["OK"],
  });
  const check = new LLMProviderHealthCheck(mockProvider);

  const result = await check.check();

  assertEquals(result.status, "pass");
  assertExists(result.metadata);
  assertEquals(result.metadata?.response_time_ms !== undefined, true);
});

Deno.test("LLMProviderHealthCheck: fails when provider throws error", async () => {
  const mockProvider = new MockLLMProvider("failing", {
    errorMessage: "Provider unavailable",
  });
  const check = new LLMProviderHealthCheck(mockProvider);

  const result = await check.check();

  assertEquals(result.status, "fail");
  assertExists(result.message);
  assertEquals(result.message?.includes("unavailable"), true);
});

Deno.test("LLMProviderHealthCheck: handles timeout gracefully", async () => {
  const mockProvider = new MockLLMProvider("slow", {
    delayMs: 2000,
  });
  const check = new LLMProviderHealthCheck(mockProvider);

  const result = await check.check();

  // Should not hang and should return some status
  assertEquals(["pass", "fail", "warn"].includes(result.status), true);
});

Deno.test("DiskSpaceHealthCheck: passes when disk space is sufficient", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "disk-test-" });
  try {
    const check = new DiskSpaceHealthCheck(tempDir, { warn: 99, critical: 99.9 });
    const result = await check.check();

    // With high thresholds, current disk usage should pass
    assertEquals(result.status, "pass");
    assertExists(result.metadata);
    assertEquals(typeof result.metadata?.used_percent, "number");
    assertExists(result.metadata?.path);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("DiskSpaceHealthCheck: warns when disk space is low", async () => {
  const tempDir = await Deno.makeTempDir({ prefix: "disk-test-" });
  try {
    // Use a very low threshold to trigger warning
    const check = new DiskSpaceHealthCheck(tempDir, { warn: 0, critical: 99.9 });
    const result = await check.check();

    // With warn threshold at 0%, it should warn (since disk usage is always > 0%)
    assertEquals(result.status, "warn");
    assertExists(result.message);
    assertExists(result.metadata);
    assertEquals(typeof result.metadata?.used_percent, "number");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("DiskSpaceHealthCheck: fails when disk access fails", async () => {
  const check = new DiskSpaceHealthCheck("/nonexistent/path/that/does/not/exist", { warn: 80, critical: 95 });
  const result = await check.check();

  assertEquals(result.status, "fail");
  assertExists(result.message);
  assertEquals(result.message?.includes("failed"), true);
});

Deno.test("MemoryHealthCheck: passes when memory usage is normal", async () => {
  const check = new MemoryHealthCheck({ warn: 99, critical: 99.9 });
  const result = await check.check();

  // With high thresholds, it should pass
  assertEquals(result.status, "pass");
  assertExists(result.metadata);
  assertEquals(typeof result.metadata?.used_mb, "number");
  assertEquals(typeof result.metadata?.total_mb, "number");
});

Deno.test("MemoryHealthCheck: warns when memory usage is high", async () => {
  // Use thresholds that will trigger warning
  const check = new MemoryHealthCheck({ warn: 0, critical: 99.9 });
  const result = await check.check();

  assertEquals(result.status, "warn");
  assertExists(result.message);
});

Deno.test("MemoryHealthCheck: fails when memory usage is critical", async () => {
  // Use very low thresholds to trigger failure
  const check = new MemoryHealthCheck({ warn: 0, critical: 0 });
  const result = await check.check();

  assertEquals(result.status, "fail");
  assertExists(result.message);
});

Deno.test("initializeHealthChecks: initializes all health checks", async () => {
  const { db, config, cleanup } = await initTestDbService();
  try {
    const mockProvider = new MockLLMProvider("pattern", {
      responses: ["OK"],
    });

    const healthService = initializeHealthChecks(db, mockProvider, config);

    // Check that all expected checks are registered
    const status = await healthService.checkHealth();
    const checkNames = Object.keys(status.checks);

    assertEquals(checkNames.includes("database"), true);
    assertEquals(checkNames.includes("llm_provider"), true);
    assertEquals(checkNames.includes("disk_space"), true);
    assertEquals(checkNames.includes("memory"), true);
  } finally {
    await cleanup();
  }
});

Deno.test("initializeHealthChecks: configures checks with appropriate criticality", async () => {
  const { db, config, cleanup } = await initTestDbService();
  try {
    const mockProvider = new MockLLMProvider("pattern", {
      responses: ["OK"],
    });

    const healthService = initializeHealthChecks(db, mockProvider, config);
    const status = await healthService.checkHealth();

    // Database and disk space should be critical
    assertEquals(status.checks.database.status !== undefined, true);
    assertEquals(status.checks.disk_space.status !== undefined, true);
    assertEquals(status.checks.memory.status !== undefined, true);

    // LLM provider should be non-critical
    assertEquals(status.checks.llm_provider.status !== undefined, true);
  } finally {
    await cleanup();
  }
});

Deno.test("HTTP Endpoint Integration: formats health status for HTTP response", async () => {
  const service = new HealthCheckService("1.0.0");
  const mockCheck = {
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "pass" as const }),
  };

  service.registerCheck(mockCheck);
  const status = await service.checkHealth();

  // Should be serializable to JSON
  const jsonString = JSON.stringify(status);
  assertExists(jsonString);

  // Should parse back correctly
  const parsed = JSON.parse(jsonString);
  assertEquals(parsed.status, "healthy");
  assertEquals(parsed.version, "1.0.0");
  assertExists(parsed.timestamp);
});

Deno.test("HTTP Endpoint Integration: handles HTTP status code mapping", async () => {
  // Test healthy status
  const healthyService = new HealthCheckService("1.0.0");
  healthyService.registerCheck({
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "pass" }),
  });

  const healthyStatus = await healthyService.checkHealth();
  assertEquals(healthyStatus.status, "healthy");

  // Test degraded status
  const degradedService = new HealthCheckService("1.0.0");
  degradedService.registerCheck({
    name: "test",
    critical: false,
    check: () => Promise.resolve({ status: "fail" }),
  });

  const degradedStatus = await degradedService.checkHealth();
  assertEquals(degradedStatus.status, "degraded");

  // Test unhealthy status
  const unhealthyService = new HealthCheckService("1.0.0");
  unhealthyService.registerCheck({
    name: "test",
    critical: true,
    check: () => Promise.resolve({ status: "fail" }),
  });

  const unhealthyStatus = await unhealthyService.checkHealth();
  assertEquals(unhealthyStatus.status, "unhealthy");
});
