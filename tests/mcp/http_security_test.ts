/**
 * Tests for MCP Server HTTP transport with security headers
 */

import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert";
import { MCPServer } from "../../src/mcp/server.ts";
import { ConfigService } from "../../src/config/service.ts";
import { DatabaseService } from "../../src/services/db.ts";

Deno.test("MCPServer: includes comprehensive security headers", () => {
  // Create a mock server instance to test security headers
  const configService = new ConfigService();
  const config = configService.get();
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio", // Start with stdio, we'll add HTTP later
  });

  // Test that security headers method exists and returns proper headers
  const headers = (server as any).getSecurityHeaders();

  // Content Security Policy
  assertStringIncludes(headers["Content-Security-Policy"], "default-src 'none'");
  assertStringIncludes(headers["Content-Security-Policy"], "frame-ancestors 'none'");

  // Anti-clickjacking
  assertEquals(headers["X-Frame-Options"], "DENY");

  // Anti-MIME sniffing
  assertEquals(headers["X-Content-Type-Options"], "nosniff");

  // XSS protection
  assertEquals(headers["X-XSS-Protection"], "1; mode=block");

  // HTTPS enforcement
  assertStringIncludes(headers["Strict-Transport-Security"], "max-age=");

  // Referrer policy
  assertEquals(headers["Referrer-Policy"], "strict-origin-when-cross-origin");

  // Permissions policy
  assertStringIncludes(headers["Permissions-Policy"], "geolocation=()");
});

Deno.test("MCPServer: applies security headers to HTTP responses", () => {
  const configService = new ConfigService();
  const config = configService.get();
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio",
  });

  // Mock a Response object
  const mockResponse = new Response("test content", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  // Test that addSecurityHeaders method exists and enhances responses
  const enhancedResponse = (server as any).addSecurityHeaders(mockResponse);

  // Verify all security headers are present
  assert(enhancedResponse.headers.get("Content-Security-Policy") !== null);
  assert(enhancedResponse.headers.get("X-Frame-Options") !== null);
  assert(enhancedResponse.headers.get("Strict-Transport-Security") !== null);

  // Verify original content is preserved
  assertEquals(enhancedResponse.status, 200);
  // Note: Can't easily test body content in this mock setup
});

Deno.test("MCPServer: CSP prevents inline script execution", () => {
  const configService = new ConfigService();
  const config = configService.get();
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio",
  });

  const csp = (server as any).getSecurityHeaders()["Content-Security-Policy"];

  // Verify CSP syntax is valid and secure
  assertStringIncludes(csp, "default-src 'none'");
  assertStringIncludes(csp, "script-src 'self'");
  // Should not allow unsafe-inline for scripts
  assert(!csp.includes("script-src 'unsafe-inline'"));
  assert(!csp.includes("script-src *"));
});

Deno.test("MCPServer: HSTS enforces HTTPS", () => {
  const configService = new ConfigService();
  const config = configService.get();
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio",
  });

  const headers = (server as any).getSecurityHeaders();
  const hsts = headers["Strict-Transport-Security"];

  assertStringIncludes(hsts, "max-age=");
  assertStringIncludes(hsts, "includeSubDomains");

  // Parse max-age to ensure it's reasonable (at least 1 year)
  const maxAgeMatch = hsts.match(/max-age=(\d+)/);
  assert(maxAgeMatch !== null);
  const maxAge = parseInt(maxAgeMatch[1]);
  assert(maxAge >= 31536000); // 1 year in seconds
});

Deno.test("MCPServer: headers prevent common attacks", () => {
  const configService = new ConfigService();
  const config = configService.get();
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio",
  });

  const headers = (server as any).getSecurityHeaders();

  // Should prevent iframe embedding (clickjacking)
  assertEquals(headers["X-Frame-Options"], "DENY");

  // Should prevent MIME type confusion
  assertEquals(headers["X-Content-Type-Options"], "nosniff");

  // Should enable XSS filtering
  assertStringIncludes(headers["X-XSS-Protection"], "mode=block");

  // Should restrict referrer information
  assertEquals(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
});

Deno.test("MCPServer: supports SSE transport configuration", () => {
  const configService = new ConfigService();
  const config = configService.get();
  // Modify config to use SSE transport
  config.mcp.transport = "sse";

  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "sse",
  });

  // Verify server is configured for SSE
  assertEquals((server as any).transport, "sse");
});

Deno.test("MCPServer: handles HTTP POST requests", async () => {
  const configService = new ConfigService();
  const config = configService.get();
  config.mcp.transport = "sse";

  // Use a mock database service to avoid timer leaks
  const mockDb = {
    logActivity: () => {},
  } as any;

  const server = new MCPServer({
    config,
    db: mockDb,
    transport: "sse"
  });

  // Create a mock initialize request
  const initRequest = new Request("http://localhost:3000", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    })
  });

  const response = await (server as any).handleHTTPRequest(initRequest);

  // Verify response has security headers
  assert(response.headers.get("Content-Security-Policy") !== null);
  assert(response.headers.get("X-Frame-Options") !== null);
  assert(response.headers.get("Strict-Transport-Security") !== null);

  // Verify it's a JSON response
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(response.status, 200);
});

Deno.test("MCPServer: rejects non-POST HTTP requests", async () => {
  const configService = new ConfigService();
  const config = configService.get();
  config.mcp.transport = "sse";

  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "sse"
  });

  // Create a GET request
  const getRequest = new Request("http://localhost:3000", {
    method: "GET"
  });

  const response = await (server as any).handleHTTPRequest(getRequest);

  // Should return 405 Method Not Allowed with security headers
  assertEquals(response.status, 405);
  assert(response.headers.get("Content-Security-Policy") !== null);
});

Deno.test("MCPServer: handles malformed JSON in HTTP requests", async () => {
  const configService = new ConfigService();
  const config = configService.get();
  config.mcp.transport = "sse";

  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "sse"
  });

  // Create a request with invalid JSON
  const badRequest = new Request("http://localhost:3000", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid json"
  });

  const response = await (server as any).handleHTTPRequest(badRequest);

  // Should return 400 Bad Request with security headers
  assertEquals(response.status, 400);
  assert(response.headers.get("Content-Security-Policy") !== null);

  const responseBody = await response.json();
  assertEquals(responseBody.error.code, -32700);
  assertStringIncludes(responseBody.error.message, "Parse error");
});

Deno.test("MCPServer: HTTP server only starts with SSE transport", async () => {
  const configService = new ConfigService();
  const config = configService.get();
  // Keep default stdio transport
  const dbService = new DatabaseService(config);

  const server = new MCPServer({
    config,
    db: dbService,
    transport: "stdio"
  });

  // Should reject HTTP server start with stdio transport
  await assertRejects(
    () => (server as any).startHTTPServer(3000),
    Error,
    "HTTP server only available for SSE transport"
  );
});
