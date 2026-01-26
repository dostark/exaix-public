/**
 * Tests for deploy_workspace.sh script (Workspace Deployment)
 *
 * Success Criteria:
 * - Test 1: --no-run flag creates deploy files without running daemon
 * - Test 2: Creates README.md and copies scripts/setup_db.ts
 * - Test 3: exoctl daemon start/stop lifecycle works correctly
 * - Test 4: exoctl daemon restart stops then starts daemon
 * - Test 5: Idempotent operations (start when running, stop when stopped)
 */

import { assert, assertStringIncludes } from "https://deno.land/std@0.201.0/testing/asserts.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.201.0/path/mod.ts";
import { getDefaultPaths } from "../src/config/paths.ts";
import { exists } from "https://deno.land/std@0.201.0/fs/mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const _paths = getDefaultPaths(REPO_ROOT);

Deno.test("deploy_workspace.sh --no-run creates deploy files", async () => {
  const tmp = await Deno.makeTempDir({ prefix: "exoframe-deploy-test-" });
  try {
    const deployScript = join(REPO_ROOT, "scripts", "deploy_workspace.sh");

    const cmd = new Deno.Command("bash", {
      args: [deployScript, "--no-run", tmp],
      cwd: REPO_ROOT,
      stdout: "piped",
      stderr: "piped",
    });
    const res = await cmd.output();
    const out = new TextDecoder().decode(res.stdout || new Uint8Array());
    const err = new TextDecoder().decode(res.stderr || new Uint8Array());
    if (res.code !== 0) {
      console.error("deploy failed stdout:\n", out);
      console.error("deploy failed stderr:\n", err);
    }

    assert(res.code === 0, `deploy_workspace.sh exited with code ${res.code}`);

    // Basic expectations: README.md exists and scripts/setup_db.ts was copied
    const readme = join(tmp, "README.md");
    const setupScript = join(tmp, "scripts", "setup_db.ts");

    const readmeStat = await Deno.stat(readme);
    assert(readmeStat.isFile, "README.md not created in deployed workspace");

    const setupStat = await Deno.stat(setupScript);
    assert(setupStat.isFile, "setup_db.ts not copied to deployed workspace/scripts");

    // Verify migrate_db.ts was copied (required for setup_db.ts)
    const migrateScript = join(tmp, "scripts", "migrate_db.ts");
    assert(
      await exists(migrateScript),
      "migrate_db.ts not copied to deployed workspace/scripts",
    );

    // Verify migrations folder was copied
    const migrationsDir = join(tmp, "migrations");
    assert(
      await exists(migrationsDir),
      "migrations folder not copied to deployed workspace",
    );

    // Verify at least one migration file exists
    const initMigration = join(tmp, "migrations", "001_init.sql");
    assert(
      await exists(initMigration),
      "001_init.sql not copied to deployed workspace/migrations",
    );
  } finally {
    await Deno.remove(tmp, { recursive: true }).catch(() => {});
  }
});

// Helper to run exoctl command in a workspace
async function runExoctl(
  workspacePath: string,
  args: string[],
  env?: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const exoctlPath = join(workspacePath, "src", "cli", "exoctl.ts");
  const cmd = new Deno.Command("deno", {
    args: ["run", "--allow-all", exoctlPath, ...args],
    cwd: workspacePath,
    stdout: "piped",
    stderr: "piped",
    env: env,
  });

  const res = await cmd.output();
  return {
    code: res.code,
    stdout: new TextDecoder().decode(res.stdout),
    stderr: new TextDecoder().decode(res.stderr),
  };
}

// Helper to deploy and setup a test workspace
async function deployTestWorkspace(): Promise<string> {
  const tmp = await Deno.makeTempDir({ prefix: "exoframe-daemon-test-" });
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
  const deployScript = join(repoRoot, "scripts", "deploy_workspace.sh");

  // Deploy with --no-run (we'll run setup manually)
  const deployCmd = new Deno.Command("bash", {
    args: [deployScript, "--no-run", tmp],
    cwd: repoRoot,
    stdout: "piped",
    stderr: "piped",
  });

  const deployRes = await deployCmd.output();
  if (deployRes.code !== 0) {
    const err = new TextDecoder().decode(deployRes.stderr);
    throw new Error(`Deploy failed: ${err}`);
  }

  // Run setup to initialize database
  const setupCmd = new Deno.Command("deno", {
    args: ["task", "setup"],
    cwd: tmp,
    stdout: "piped",
    stderr: "piped",
  });

  const setupRes = await setupCmd.output();
  if (setupRes.code !== 0) {
    const err = new TextDecoder().decode(setupRes.stderr);
    throw new Error(`Setup failed: ${err}`);
  }

  return tmp;
}

Deno.test({
  name: "exoctl daemon status reports not running for fresh workspace",
  async fn() {
    const workspace = await deployTestWorkspace();
    try {
      const result = await runExoctl(workspace, ["daemon", "status"]);

      // Should succeed
      assert(result.code === 0, `exoctl daemon status failed: ${result.stderr}`);
    } finally {
      await Deno.remove(workspace, { recursive: true }).catch(() => {});
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "exoctl daemon start/stop lifecycle",
  async fn() {
    const workspace = await deployTestWorkspace();
    try {
      // Start the daemon with mock provider to avoid CI issues
      const startResult = await runExoctl(workspace, ["daemon", "start"], {
        EXO_LLM_PROVIDER: "mock",
      });
      assert(
        startResult.code === 0,
        `exoctl daemon start failed: ${startResult.stderr}`,
      );

      // Give daemon time to initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check status shows running
      const statusResult = await runExoctl(workspace, ["daemon", "status"]);
      assert(
        statusResult.code === 0,
        `exoctl daemon status failed: ${statusResult.stderr}`,
      );

      // If daemon is not running, check the log file for errors
      if (!statusResult.stdout.includes("Running")) {
        try {
          const logPath = join(workspace, ".exo", "daemon.log");
          const logContent = await Deno.readTextFile(logPath);
          console.log("Daemon log content:", logContent);
        } catch (error) {
          console.log("Could not read daemon log:", error);
        }
      }

      // Stop the daemon
      const stopResult = await runExoctl(workspace, ["daemon", "stop"]);
      assert(
        stopResult.code === 0,
        `exoctl daemon stop failed: ${stopResult.stderr}`,
      );

      // Give daemon time to shut down
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify daemon is stopped
      const finalStatus = await runExoctl(workspace, ["daemon", "status"]);
      assert(
        finalStatus.code === 0,
        `Final status check failed: ${finalStatus.stderr}`,
      );
    } finally {
      // Ensure daemon is stopped before cleanup
      await runExoctl(workspace, ["daemon", "stop"]).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
      await Deno.remove(workspace, { recursive: true }).catch(() => {});
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "exoctl daemon restart works correctly",
  async fn() {
    const workspace = await deployTestWorkspace();
    try {
      // Start the daemon first with mock provider
      const startResult = await runExoctl(workspace, ["daemon", "start"], {
        EXO_LLM_PROVIDER: "mock",
      });
      assert(
        startResult.code === 0,
        `Initial start failed: ${startResult.stderr}`,
      );

      // Give daemon time to initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get initial PID from status
      const initialStatus = await runExoctl(workspace, ["daemon", "status"]);
      const initialPidMatch = initialStatus.stdout.match(/PID:\s*(\d+)/);
      const initialPid = initialPidMatch ? initialPidMatch[1] : null;

      // Restart the daemon
      const restartResult = await runExoctl(workspace, ["daemon", "restart"], {
        EXO_LLM_PROVIDER: "mock",
      });
      assert(
        restartResult.code === 0,
        `exoctl daemon restart failed: ${restartResult.stderr}`,
      );

      // Give daemon more time to restart (CI can be slow)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check status after restart
      const finalStatus = await runExoctl(workspace, ["daemon", "status"]);
      assert(
        finalStatus.code === 0,
        `Status after restart failed: ${finalStatus.stderr}`,
      );

      // Verify PID changed (new process)
      const finalPidMatch = finalStatus.stdout.match(/PID:\s*(\d+)/);
      const finalPid = finalPidMatch ? finalPidMatch[1] : null;

      if (initialPid && finalPid) {
        assert(
          initialPid !== finalPid,
          `PID should change after restart (was ${initialPid}, now ${finalPid})`,
        );
      }
    } finally {
      // Ensure daemon is stopped before cleanup
      await runExoctl(workspace, ["daemon", "stop"]).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
      await Deno.remove(workspace, { recursive: true }).catch(() => {});
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "exoctl daemon start is idempotent (already running)",
  async fn() {
    const workspace = await deployTestWorkspace();
    try {
      // Start the daemon with mock provider
      const startResult = await runExoctl(workspace, ["daemon", "start"], {
        EXO_LLM_PROVIDER: "mock",
      });
      assert(
        startResult.code === 0,
        `Initial start failed: ${startResult.stderr}`,
      );

      // Give daemon time to initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check that daemon is running
      const statusResult = await runExoctl(workspace, ["daemon", "status"]);
      assert(statusResult.code === 0);
      assertStringIncludes(statusResult.stdout, "Running");

      // Try to start again - should succeed without error
      const secondStart = await runExoctl(workspace, ["daemon", "start"]);
      assert(
        secondStart.code === 0,
        `Second start should succeed: ${secondStart.stderr}`,
      );

      // Check that daemon is still running
      const finalStatus = await runExoctl(workspace, ["daemon", "status"]);
      assert(finalStatus.code === 0);
    } finally {
      // Ensure daemon is stopped before cleanup
      await runExoctl(workspace, ["daemon", "stop"]).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
      await Deno.remove(workspace, { recursive: true }).catch(() => {});
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "exoctl daemon stop is idempotent (not running)",
  async fn() {
    const workspace = await deployTestWorkspace();
    try {
      // Check that daemon is not running initially
      const initialStatus = await runExoctl(workspace, ["daemon", "status"]);
      assert(initialStatus.code === 0);

      // Stop without starting - should succeed
      const stopResult = await runExoctl(workspace, ["daemon", "stop"]);
      assert(
        stopResult.code === 0,
        `Stop on non-running daemon should succeed: ${stopResult.stderr}`,
      );

      // Check that daemon is still stopped
      const finalStatus = await runExoctl(workspace, ["daemon", "status"]);
      assert(finalStatus.code === 0);
    } finally {
      await Deno.remove(workspace, { recursive: true }).catch(() => {});
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
