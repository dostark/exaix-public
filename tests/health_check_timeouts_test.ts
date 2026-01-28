import { assertEquals } from "https://deno.land/std@0.201.0/testing/asserts.ts";
import { HealthCheckService } from "../src/services/health_check_service.ts";
import { HealthCheckVerdict, HealthStatus } from "../src/enums.ts";

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
  const config = {
    health: {
      check_timeout_ms: 50,
      cache_ttl_ms: 10_000,
      failure_threshold: 2,
      reset_timeout_ms: 1000,
      half_open_success_threshold: 1,
    },
  } as any;

  const svc = new HealthCheckService("test", config);
  svc.registerCheck(new SlowCheck() as any);

  const report = await svc.checkHealth();

  assertEquals(report.status, HealthStatus.UNHEALTHY);
  const checkResult = report.checks["slow_check"];
  // Should be marked as FAIL due to timeout
  assertEquals(checkResult.status, HealthCheckVerdict.FAIL);
  // Allow any pending timers in the slow check to complete to avoid test leak detection
  await new Promise((resolve) => setTimeout(resolve, 220));
});
