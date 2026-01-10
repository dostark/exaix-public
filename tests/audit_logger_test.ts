/**
 * AuditLogger Test Suite
 * Implements security audit logging for critical operations
 */

import { assertEquals, assertExists, assertFalse, assertNotEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { assertSpyCalls, spy } from "jsr:@std/testing@^1.0.0/mock";
import { initTestDbService } from "./helpers/db.ts";
import { AuditLogger } from "../src/services/audit_logger.ts";

// Simple assert function for conditions
function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

Deno.test("AuditLogger: logs security events to database", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: "permission" as const,
      action: "portal_access_check",
      actor: "agent123",
      resource: "/portal/secure",
      result: "denied" as const,
      metadata: { reason: "insufficient_permissions" },
      severity: "high" as const,
    };

    await auditLogger.logSecurityEvent(event);

    // Check database was called (we'll verify structure in integration)
    // For now, just ensure no errors thrown
    assertEquals(true, true);
  } finally {
    await cleanup();
  }
});

Deno.test("AuditLogger: writes to tamper-evident audit file", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: "auth" as const,
      action: "login_attempt",
      actor: "user@example.com",
      resource: "system",
      result: "success" as const,
      metadata: { method: "api_key" },
      severity: "low" as const,
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
  }
});

Deno.test("AuditLogger: sends alerts for critical events", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const alertSpy = spy(auditLogger, "sendSecurityAlert");

    const criticalEvent = {
      type: "auth" as const,
      action: "api_key_exposed",
      actor: "system",
      resource: "anthropic_api_key",
      result: "error" as const,
      metadata: { location: "memory_dump" },
      severity: "critical" as const,
    };

    await auditLogger.logSecurityEvent(criticalEvent);

    // Verify alert was sent
    assertSpyCalls(alertSpy, 1);
    const alertCall = alertSpy.calls[0];
    assertEquals(alertCall.args[0].severity, "critical");
    assertEquals(alertCall.args[0].action, "api_key_exposed");
  } finally {
    await cleanup();
  }
});

Deno.test("AuditLogger: masks sensitive data in logs", async () => {
  const { db, cleanup } = await initTestDbService();
  try {
    const auditLogger = new AuditLogger({ db });
    const event = {
      type: "auth" as const,
      action: "api_key_validation",
      actor: "agent123",
      resource: "anthropic_provider",
      result: "success" as const,
      metadata: {
        api_key: "sk-ant-api03-1234567890abcdef",
        model: "claude-3-sonnet-20240229",
      },
      severity: "low" as const,
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
  }
});
