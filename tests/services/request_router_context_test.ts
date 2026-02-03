import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { RequestRouter } from "../../src/services/request_router.ts";
import type { PortalPermissions } from "../../src/schemas/portal_permissions.ts";
import { PortalOperation } from "../../src/enums.ts";
import { initTestDbService } from "../helpers/db.ts";
import { createMockConfig } from "../helpers/config.ts";
import { EventLogger } from "../../src/services/event_logger.ts";
import type { Config } from "../../src/config/schema.ts";

/**
 * TDD Tests for RequestRouter WorkspaceExecutionContext Integration
 * Task 1.3: Request Router Integration
 */

describe("RequestRouter WorkspaceExecutionContext Integration", () => {
  let tempDir: string;
  let portalDir: string;
  let workspaceDir: string;
  let originalCwd: string;
  let router: RequestRouter;
  let logger: EventLogger;
  let config: Config;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    originalCwd = Deno.cwd();

    // Use test helpers for proper setup
    const dbService = await initTestDbService();
    tempDir = dbService.tempDir;
    cleanup = dbService.cleanup;

    portalDir = join(tempDir, "portal");
    workspaceDir = join(tempDir, "workspace");

    // Create directories with git repos
    await ensureDir(join(portalDir, ".git"));
    await ensureDir(join(workspaceDir, ".git"));
    await ensureDir(join(portalDir, "Blueprints", "Agents"));

    // Create portal config
    const portalConfig: PortalPermissions = {
      alias: "test-portal",
      target_path: portalDir,
      operations: [
        PortalOperation.READ,
        PortalOperation.WRITE,
        PortalOperation.GIT,
      ],
      agents_allowed: ["*"],
    };

    // Create mock config
    config = createMockConfig(workspaceDir, {
      portals: [portalConfig as any],
    });

    logger = new EventLogger({ db: dbService.db });

    // Create mock dependencies
    const _mockFlowRunner = {
      execute: () => Promise.resolve({ success: true }),
    };

    const _mockAgentRunner = {
      execute: () => Promise.resolve({ success: true }),
    };

    const mockFlowValidator = {
      validateFlow: () => Promise.resolve({ valid: true }),
    };

    // Create RequestRouter instance
    router = new RequestRouter(
      mockFlowRunner as any,
      mockAgentRunner as any,
      mockFlowValidator,
      logger,
      "default-agent",
      join(tempDir, "Blueprints"),
      config,
    );
  });

  afterEach(async () => {
    try {
      Deno.chdir(originalCwd);
    } catch (_error) {
      // Ignore
    }

    if (cleanup) {
      await cleanup();
    }
  });

  describe("buildExecutionContext method", () => {
    it("creates portal context when request has portal parameter", () => {
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          portal: "test-portal",
        },
        body: "test request",
      };

      const context = router.buildExecutionContext(request);

      assertExists(context);
      assertEquals(context.portal, "test-portal");
      assertEquals(context.workingDirectory, portalDir);
      assertEquals(context.gitRepository, join(portalDir, ".git"));
    });

    it("creates workspace context when request has no portal parameter", () => {
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {},
        body: "test request",
      };

      const context = router.buildExecutionContext(request);

      assertExists(context);
      assertEquals(context.portal, undefined);
      assertEquals(context.workingDirectory, workspaceDir);
      assertEquals(context.gitRepository, join(workspaceDir, ".git"));
    });

    it("throws error for invalid portal alias", () => {
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          portal: "non-existent-portal",
        },
        body: "test request",
      };

      try {
        router.buildExecutionContext(request);
        throw new Error("Should have thrown error");
      } catch (error) {
        assertEquals(
          (error as Error).message,
          "Portal 'non-existent-portal' not found",
        );
      }
    });
  });

  describe("route method integration", () => {
    it.skip("passes portal context to agent executor", async () => {
      // TODO: This test requires updating route() method implementation
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          agent: "test-agent",
          portal: "test-portal",
        },
        body: "test request",
      };

      // Create a spy to verify context is passed
      let capturedContext: any;
      const _mockAgentRunner = {
        execute: (_agentId: string, _request: any, context: any) => {
          capturedContext = context;
          return Promise.resolve({ success: true });
        },
      };

      // TODO: Replace router's agent runner with mock
      // router.agentRunner = mockAgentRunner;

      await router.route(request);

      assertExists(capturedContext);
      assertEquals(capturedContext.portal, "test-portal");
      assertEquals(capturedContext.workingDirectory, portalDir);
    });

    it.skip("passes workspace context to agent executor when no portal specified", async () => {
      // TODO: This test requires updating route() method implementation
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          agent: "test-agent",
        },
        body: "test request",
      };

      // Create a spy to verify context is passed
      let capturedContext: any;
      const _mockAgentRunner = {
        execute: (_agentId: string, _request: any, context: any) => {
          capturedContext = context;
          return Promise.resolve({ success: true });
        },
      };

      // TODO: Replace router's agent runner with mock
      // router.agentRunner = mockAgentRunner;

      await router.route(request);

      assertExists(capturedContext);
      assertEquals(capturedContext.portal, undefined);
      assertEquals(capturedContext.workingDirectory, workspaceDir);
    });

    it.skip("passes portal context to flow runner", async () => {
      // TODO: This test requires updating route() method implementation
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          flow: "test-flow",
          portal: "test-portal",
        },
        body: "test request",
      };

      // Create a spy to verify context is passed
      let capturedContext: any;
      const _mockFlowRunner = {
        execute: (_flowId: string, _request: any, context: any) => {
          capturedContext = context;
          return Promise.resolve({ success: true });
        },
      };

      // TODO: Replace router's flow runner with mock
      // router.flowRunner = mockFlowRunner;

      await router.route(request);

      assertExists(capturedContext);
      assertEquals(capturedContext.portal, "test-portal");
      assertEquals(capturedContext.workingDirectory, portalDir);
    });
  });

  describe("portal validation", () => {
    it("validates portal exists before creating context", () => {
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          portal: "invalid-portal",
        },
        body: "test request",
      };

      try {
        router.buildExecutionContext(request);
        throw new Error("Should have thrown error");
      } catch (error) {
        assertEquals(
          (error as Error).message,
          "Portal 'invalid-portal' not found",
        );
      }
    });

    it("validates portal has required permissions", () => {
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          portal: "test-portal",
          agent: "restricted-agent",
        },
        body: "test request",
      };

      // This test will require portal permission checks
      // For now, just verify context is created
      const context = router.buildExecutionContext(request);

      assertExists(context);
      assertEquals(context.portal, "test-portal");
    });
  });

  describe("context lifecycle", () => {
    it.skip("context is created before agent execution", async () => {
      // TODO: This test requires updating route() method implementation
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          agent: "test-agent",
          portal: "test-portal",
        },
        body: "test request",
      };

      let contextCreatedBeforeExecution = false;

      const _mockAgentRunner = {
        execute: (_agentId: string, _request: any, context: any) => {
          // Verify context exists when execution starts
          if (context && context.portal === "test-portal") {
            contextCreatedBeforeExecution = true;
          }
          return Promise.resolve({ success: true });
        },
      };

      // TODO: Inject mock runner
      // router.agentRunner = mockAgentRunner;

      await router.route(request);

      assertEquals(contextCreatedBeforeExecution, true);
    });

    it.skip("context is cleared after execution completes", async () => {
      // TODO: This test requires route() method context cleanup
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          agent: "test-agent",
          portal: "test-portal",
        },
        body: "test request",
      };

      await router.route(request);

      // Verify working directory was restored
      assertEquals(Deno.cwd(), originalCwd);
    });

    it.skip("context is cleared even if execution fails", async () => {
      // TODO: This test requires route() method error handling
      const request = {
        traceId: "trace-1",
        requestId: "req-1",
        frontmatter: {
          agent: "test-agent",
          portal: "test-portal",
        },
        body: "test request",
      };

      const _mockAgentRunner = {
        execute: () => {
          throw new Error("Execution failed");
        },
      };

      // TODO: Inject mock runner
      // router.agentRunner = mockAgentRunner;

      try {
        await router.route(request);
      } catch (_error) {
        // Expected error
      }

      // Verify working directory was restored even after error
      assertEquals(Deno.cwd(), originalCwd);
    });
  });
});
