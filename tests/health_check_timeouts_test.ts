import { assertEquals } from "@std/assert";
import { type HealthCheck, HealthCheckService } from "../src/services/health_check_service.ts";
import { HealthCheckVerdict, HealthStatus } from "../src/enums.ts";
import { createTestConfig } from "./ai/helpers/test_config.ts";

class SlowCheck {
  name = "slow_check";
  critical = true;
  async check() {
    // Delay longer than timeout
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { status: HealthCheckVerdict.PASS };
  }
}

Deno.test("[health] slow check times out and is reported as FAIL", async () => {
  const config = createTestConfig();
  config.health = {
    check_timeout_ms: 50,
    cache_ttl_ms: 10_000,
    memory_warn_percent: 80,
    memory_critical_percent: 95,
  };

  const svc = new HealthCheckService("test", config);
  svc.registerCheck(new SlowCheck() as Partial<HealthCheck> as HealthCheck);

  const report = await svc.checkHealth();

  assertEquals(report.status, HealthStatus.UNHEALTHY);
  const checkResult = report.checks["slow_check"];
  // Should be marked as FAIL due to timeout
  assertEquals(checkResult.status, HealthCheckVerdict.FAIL);
  // Allow any pending timers in the slow check to complete to avoid test leak detection
  await new Promise((resolve) => setTimeout(resolve, 220));
});
