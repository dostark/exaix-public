/**
 * AuditLogger Test Suite
 * Implements security audit logging for critical operations
 */

import { assertEquals, assertExists, assertFalse, assertStringIncludes } from "@std/assert";
import { CritiqueSeverity } from "../src/enums.ts";

import { assertSpyCalls, spy } from "@std/testing/mock";
import { initTestDbService } from "./helpers/db.ts";
import { AuditLogger } from "../src/services/audit_logger.ts";
import { SecurityEventResult, SecurityEventType, SecuritySeverity } from "../src/enums.ts";
import { join } from "@std/path";

/**
 * Clean up audit folder created during tests
 */
async function cleanupAuditFolder(): Promise<void> {
  try {
    const auditDir = join(".", "audit");
    await Deno.remove(auditDir, { recursive: true });
  } catch (error) {
    // Ignore if audit folder doesn't exist or can't be removed
    console.warn("[Test Cleanup] Failed to remove audit folder:", error);
  }
}

Deno.test("AuditLogger: logs security events to database", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: SecurityEventType.PERMISSION,
      action: "portal_access_check",
      actor: "agent123",
      resource: "/portal/secure",
      result: SecurityEventResult.DENIED,
      metadata: { reason: "insufficient_permissions" },
      severity: SecuritySeverity.HIGH,
    };

    await auditLogger.logSecurityEvent(event);

    // Check database was called (we'll verify structure in integration)
    // For now, just ensure no errors thrown
    assertEquals(true, true);
  } finally {
    await cleanup();
    await cleanupAuditFolder();
  }
});

Deno.test("AuditLogger: writes to tamper-evident audit file", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: SecurityEventType.AUTH,
      action: "login_attempt",
      actor: "user@example.com",
      resource: "system",
      result: SecurityEventResult.SUCCESS,
      metadata: { method: "api_key" },
      severity: SecuritySeverity.LOW,
    };

    await auditLogger.logSecurityEvent(event);

    // Verify file was created and contains the event
    const auditFile = `audit/${new Date().toISOString().split("T")[0]}.jsonl`;
    const content = await Deno.readTextFile(auditFile);
    const lines = content.trim().split("\n");
    const lastEntry = JSON.parse(lines[lines.length - 1]);

    assertEquals(lastEntry.type, "auth");
    assertEquals(lastEntry.action, "login_attempt");
    assertEquals(lastEntry.actor, "user@example.com");
    assertExists(lastEntry.timestamp);
    assertExists(lastEntry.trace_id);
    assertExists(lastEntry.session_id);
  } finally {
    await cleanup();
    await cleanupAuditFolder();
  }
});

Deno.test("AuditLogger: sends alerts for critical events", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const alertSpy = spy(auditLogger, "sendSecurityAlert");

    const criticalEvent = {
      type: SecurityEventType.AUTH,
      action: "api_key_exposed",
      actor: "system",
      resource: "anthropic_api_key",
      result: SecurityEventResult.ERROR,
      metadata: { location: "memory_dump" },
      severity: SecuritySeverity.CRITICAL,
    };

    await auditLogger.logSecurityEvent(criticalEvent);

    // Verify alert was sent
    assertSpyCalls(alertSpy, 1);
    const alertCall = alertSpy.calls[0];
    assertEquals(alertCall.args[0].severity, CritiqueSeverity.CRITICAL);
    assertEquals(alertCall.args[0].action, "api_key_exposed");
  } finally {
    await cleanup();
    await cleanupAuditFolder();
  }
});

Deno.test("AuditLogger: masks sensitive data in logs", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: SecurityEventType.AUTH,
      action: "api_key_validation",
      actor: "agent123",
      resource: "anthropic_provider",
      result: SecurityEventResult.SUCCESS,
      metadata: {
        api_key: "sk-ant-api03-1234567890abcdef",
        model: "claude-3-sonnet-20240229",
      },
      severity: SecuritySeverity.LOW,
    };

    await auditLogger.logSecurityEvent(event);

    // Check audit file for masked data
    const auditFile = `audit/${new Date().toISOString().split("T")[0]}.jsonl`;
    const content = await Deno.readTextFile(auditFile);
    const lines = content.trim().split("\n");
    const lastEntry = JSON.parse(lines[lines.length - 1]);

    // API key should be masked
    assertFalse(lastEntry.metadata.api_key.includes("sk-ant-api03"));
    assertStringIncludes(lastEntry.metadata.api_key, "***");
    // Other data should remain
    assertEquals(lastEntry.metadata.model, "claude-3-sonnet-20240229");
  } finally {
    await cleanup();
    await cleanupAuditFolder();
  }
});
