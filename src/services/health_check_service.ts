/**
 * Health Check Service - Comprehensive Health Monitoring & Readiness Checks
 *
 * Provides health check endpoints for orchestrators (Kubernetes, Docker, etc.) to determine
 * service readiness and liveness. Implements standard health check patterns with support
 * for critical and non-critical checks.
 */

import type { DatabaseService } from "./db.ts";
import type { IModelProvider } from "../ai/providers.ts";
import type { Config } from "../config/schema.ts";

/**
 * Interface for individual health check implementations
 */
export interface HealthCheck {
  /** Unique name for this health check */
  name: string;
  /** Whether failure of this check should mark the overall service as unhealthy */
  critical: boolean;
  /** Perform the health check */
  check(): Promise<HealthCheckResult>;
}

/**
 * Result of a health check operation
 */
export interface HealthCheckResult {
  /** Status of the check: pass, warn, or fail */
  status: "pass" | "warn" | "fail";
  /** Optional human-readable message */
  message?: string;
  /** Optional metadata about the check (response times, metrics, etc.) */
  metadata?: Record<string, unknown>;
  /** Duration of the check in milliseconds */
  duration_ms?: number;
}

/**
 * Overall health status of the service
 */
export interface HealthStatus {
  /** Overall status: healthy, degraded, or unhealthy */
  status: "healthy" | "degraded" | "unhealthy";
  /** ISO timestamp when the check was performed */
  timestamp: string;
  /** Service version */
  version: string;
  /** Uptime in seconds since service start */
  uptime_seconds: number;
  /** Results of individual health checks */
  checks: Record<string, HealthCheckResult>;
}

/**
 * Main health check service that orchestrates all health checks
 */
export class HealthCheckService {
  private checks = new Map<string, HealthCheck>();
  private startTime = Date.now();
  private checkTimeout = 30000; // 30 seconds default timeout

  constructor(private version: string) {}

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  /**
   * Perform all registered health checks and return overall status
   */
  async checkHealth(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};
    let hasFailure = false;
    let hasWarning = false;

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        const start = performance.now();

        try {
          // Add timeout to each check using AbortSignal.timeout
          const timeoutSignal = AbortSignal.timeout(this.checkTimeout);
          const result = await Promise.race([
            check.check(),
            new Promise<never>((_, reject) => {
              timeoutSignal.addEventListener("abort", () => {
                reject(new Error(`Health check '${name}' timed out after ${this.checkTimeout}ms`));
              });
            }),
          ]);

          const duration = performance.now() - start;
          results[name] = {
            ...result,
            duration_ms: Math.round(duration),
          };

          if (result.status === "fail") {
            if (check.critical) {
              hasFailure = true;
            } else {
              hasWarning = true;
            }
          } else if (result.status === "warn") {
            hasWarning = true;
          }
        } catch (error) {
          const duration = performance.now() - start;
          results[name] = {
            status: "fail",
            message: error instanceof Error ? error.message : String(error),
            duration_ms: Math.round(duration),
          };

          if (check.critical) {
            hasFailure = true;
          } else {
            hasWarning = true;
          }
        }
      },
    );

    await Promise.allSettled(checkPromises);

    return {
      status: hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy",
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      checks: results,
    };
  }

  /**
   * Check the health of a specific provider by name.
   * @param providerName The name of the provider to check
   * @returns True if the provider is healthy, false otherwise
   */
  async checkProvider(providerName: string): Promise<boolean> {
    const check = this.checks.get(providerName);
    if (!check) {
      return false; // Provider not registered for health checks
    }

    try {
      const result = await check.check();
      return result.status === "pass";
    } catch {
      return false;
    }
  }
}

/**
 * Database connectivity health check
 */
export class DatabaseHealthCheck implements HealthCheck {
  name = "database";
  critical = true;

  constructor(private db: DatabaseService) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Simple query to verify connectivity
      const result = this.db.instance.prepare("SELECT 1 as health_check").get() as { health_check: number };

      const duration = performance.now() - start;

      if (result.health_check === 1) {
        return await Promise.resolve({
          status: "pass",
          metadata: {
            response_time_ms: Math.round(duration),
          },
          duration_ms: Math.round(duration),
        });
      } else {
        return await Promise.resolve({
          status: "fail",
          message: "Database returned unexpected result",
          duration_ms: Math.round(duration),
        });
      }
    } catch (error) {
      const duration = performance.now() - start;
      return await Promise.resolve({
        status: "fail",
        message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      });
    }
  }
}

/**
 * LLM provider availability health check
 */
export class LLMProviderHealthCheck implements HealthCheck {
  name = "llm_provider";
  critical = false; // Can operate without LLM (mock mode)

  constructor(private provider: IModelProvider) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Test with minimal prompt
      await this.provider.generate("health check", {
        max_tokens: 10,
      });

      const duration = performance.now() - start;

      return {
        status: "pass",
        metadata: {
          response_time_ms: Math.round(duration),
        },
        duration_ms: Math.round(duration),
      };
    } catch (error) {
      const duration = performance.now() - start;
      return {
        status: "fail",
        message: `LLM provider health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      };
    }
  }
}

/**
 * Disk space availability health check
 */
export class DiskSpaceHealthCheck implements HealthCheck {
  name = "disk_space";
  critical = true;

  constructor(
    private path: string,
    private thresholds: { warn: number; critical: number },
  ) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      // Use df command to get disk usage information
      const command = new Deno.Command("df", {
        args: ["-BG", this.path],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();

      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`df command failed: ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);
      const lines = output.trim().split("\n");

      if (lines.length < 2) {
        throw new Error("Unexpected df output format");
      }

      // Parse the second line (skip header)
      const fields = lines[1].trim().split(/\s+/);
      if (fields.length < 5) {
        throw new Error("Unexpected df output format");
      }

      // df -BG shows sizes in 1G blocks, use percentage column
      const usePercent = parseInt(fields[4].replace("%", ""));

      const duration = performance.now() - start;

      if (usePercent >= this.thresholds.critical) {
        return {
          status: "fail",
          message: `Disk space critically low: ${usePercent}% used`,
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      } else if (usePercent >= this.thresholds.warn) {
        return {
          status: "warn",
          message: `Disk space low: ${usePercent}% used`,
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      } else {
        return {
          status: "pass",
          metadata: {
            path: this.path,
            used_percent: usePercent,
            warn_threshold: this.thresholds.warn,
            critical_threshold: this.thresholds.critical,
          },
          duration_ms: Math.round(duration),
        };
      }
    } catch (error) {
      const duration = performance.now() - start;
      return {
        status: "fail",
        message: `Disk space check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      };
    }
  }
}

/**
 * Memory usage health check
 */
export class MemoryHealthCheck implements HealthCheck {
  name = "memory";
  critical = true;

  constructor(private thresholds: { warn: number; critical: number }) {}

  async check(): Promise<HealthCheckResult> {
    const start = performance.now();

    try {
      const usage = Deno.memoryUsage();
      const usedBytes = usage.heapUsed;
      const totalBytes = usage.heapTotal;

      const usedMB = usedBytes / 1024 / 1024;
      const totalMB = totalBytes / 1024 / 1024;
      const usedPercent = (usedBytes / totalBytes) * 100;

      const duration = performance.now() - start;

      if (usedPercent >= this.thresholds.critical) {
        return Promise.resolve({
          status: "fail",
          message: `Memory usage critically high: ${usedPercent.toFixed(1)}% used`,
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      } else if (usedPercent >= this.thresholds.warn) {
        return Promise.resolve({
          status: "warn",
          message: `Memory usage high: ${usedPercent.toFixed(1)}% used`,
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      } else {
        return await Promise.resolve({
          status: "pass",
          metadata: {
            used_mb: Math.round(usedMB),
            total_mb: Math.round(totalMB),
            used_percent: Math.round(usedPercent * 10) / 10,
          },
          duration_ms: Math.round(duration),
        });
      }
    } catch (error) {
      const duration = performance.now() - start;
      return await Promise.resolve({
        status: "fail",
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Math.round(duration),
      });
    }
  }
}

/**
 * Initialize health checks for the service
 */
export function initializeHealthChecks(
  db: DatabaseService,
  provider: IModelProvider,
  config: Config,
): HealthCheckService {
  const health = new HealthCheckService("1.0.0");

  health.registerCheck(new DatabaseHealthCheck(db));
  health.registerCheck(new LLMProviderHealthCheck(provider));
  health.registerCheck(
    new DiskSpaceHealthCheck(config.system.root, {
      warn: 80,
      critical: 95,
    }),
  );
  health.registerCheck(
    new MemoryHealthCheck({
      warn: 80,
      critical: 95,
    }),
  );

  return health;
}

/**
 * HTTP endpoint handler for health checks
 */
export async function handleHealthCheck(
  _req: Request,
  health: HealthCheckService,
): Promise<Response> {
  try {
    const status = await health.checkHealth();

    // Return appropriate HTTP status code based on health status
    let httpStatus = 200;
    if (status.status === "unhealthy") {
      httpStatus = 503; // Service Unavailable
    } else if (status.status === "degraded") {
      httpStatus = 200; // Still OK but with warnings
    }

    return new Response(JSON.stringify(status, null, 2), {
      status: httpStatus,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    // If health check itself fails, return service unavailable
    const errorResponse = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptime_seconds: 0,
      checks: {},
      error: error instanceof Error ? error.message : String(error),
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  }
}
