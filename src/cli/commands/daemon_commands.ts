/**
 * @module DaemonCommands
 * @path src/cli/commands/daemon_commands.ts
 * @description Provides CLI commands for controlling the ExoFrame daemon lifecycle, including start, stop, restart, status, and log tailing.
 * @architectural-layer CLI
 * @dependencies [path, fs, base_command, cli_config, config_service, error_strategy, constants, process_utils]
 * @related-files [src/main.ts, src/cli/main.ts]
 */

import { dirname, fromFileUrl, join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import { BaseCommand, type CommandContext } from "../base.ts";
import { CLI_DEFAULTS } from "../cli.config.ts";
import { ConfigService } from "../../config/service.ts";
import { DefaultErrorStrategy } from "../errors/error_strategy.ts";
import { DAEMON_STOP_TIMEOUT_MS } from "../../config/constants.ts";
import { isProcessAlive } from "../process_utils.ts";

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  version: string;
}

/**
 * Commands for daemon control
 */
export class DaemonCommands extends BaseCommand {
  private pidFile: string;
  private configService?: ConfigService;
  private Command: typeof Deno.Command;

  constructor(context: CommandContext & { configService?: ConfigService; Command?: typeof Deno.Command }) {
    super(context);
    const workspaceRoot = this.config.system.root;
    this.pidFile = join(workspaceRoot, this.config.paths.runtime, "daemon.pid");
    this.configService = context.configService;
    this.Command = context.Command ?? Deno.Command;
  }

  /**
   * Start the ExoFrame daemon
   */
  async start(): Promise<void> {
    try {
      const workspaceRoot = this.config.system.root;
      const logFile = join(workspaceRoot, this.config.paths.runtime, "daemon.log");

      // Find daemon script relative to this command file
      const currentFile = fromFileUrl(import.meta.url);
      const mainScript = Deno.env.get("EXO_DAEMON_SCRIPT") || join(dirname(currentFile), "..", "..", "main.ts");

      const status = await this.status();
      if (status.running) {
        await this.logger.info("daemon.already_running", "daemon", { pid: status.pid ?? null });
        return;
      }

      await this.logger.info("daemon.starting", "daemon");

      // Check if main.ts exists
      if (!await exists(mainScript)) {
        throw new Error(
          `Daemon script not found: ${mainScript}\nEnsure ExoFrame is properly installed in this workspace`,
        );
      }

      // Ensure log file directory exists
      const exoDir = join(workspaceRoot, this.config.paths.runtime);
      await ensureDir(exoDir);

      // Start daemon process in background using shell for true detachment
      // This allows the CLI to exit while daemon continues running
      const env: Record<string, string> = Deno.env.toObject();

      // Explicitly pass config path if available
      if (this.configService) {
        env.EXO_CONFIG_PATH = this.configService.getConfigPath();
      }

      const exoEnvVars = Object.entries(env)
        .filter(([k]) => k.startsWith("EXO_"))
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const envPrefix = exoEnvVars ? `${exoEnvVars} ` : "";
      const cmd = new this.Command("bash", {
        args: [
          "-c",
          `${envPrefix}nohup deno run --allow-all "${mainScript}" > "${logFile}" 2>&1 & echo $!`,
        ],
        stdout: "piped",
        stderr: "piped",
        stdin: "null",
        cwd: workspaceRoot,
      });

      const output = await cmd.output();
      const pidStr = new TextDecoder().decode(output.stdout).trim();
      const pid = parseInt(pidStr, 10);

      if (isNaN(pid) || output.code !== 0) {
        const err = new TextDecoder().decode(output.stderr);
        throw new Error(`Failed to start daemon: ${err}`);
      }

      // Write PID file
      await Deno.writeTextFile(this.pidFile, pid.toString());

      // Wait for daemon to fully start (up to 3 seconds with retries)
      // CI environments may need more time for database initialization
      const started = await this.waitForProcessState(pid, true, 3000);

      if (!started) {
        await this.logDaemonActivity("daemon.start_failed", {
          error: "Daemon failed to start within timeout",
          pid: pid,
        });
        throw new Error("Daemon failed to start. Check logs for details.");
      }

      // Log successful start (writes to both console and Activity Journal)
      await this.logDaemonActivity("daemon.started", {
        pid: pid,
        log_file: logFile,
      });
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "DaemonCommands.start",
        args: {},
        error,
      });
    }
  }

  /**
   * Stop the ExoFrame daemon
   */
  async stop(): Promise<void> {
    try {
      const status = await this.status();

      if (!status.running) {
        await this.logger.info("daemon.not_running", "daemon");
        return;
      }

      await this.logger.info("daemon.stopping", "daemon", { pid: status.pid ?? null });

      try {
        // Send SIGTERM
        const killCmd = new this.Command("kill", {
          args: ["-TERM", status.pid!.toString()],
          stdout: "piped",
          stderr: "piped",
        });

        await killCmd.output();

        // Wait for process to exit (up to 5 seconds)
        const stopped = await this.waitForProcessState(status.pid!, false, DAEMON_STOP_TIMEOUT_MS);
        if (stopped) {
          await Deno.remove(this.pidFile).catch(() => {});
          await this.logDaemonActivity("daemon.stopped", {
            pid: status.pid,
            method: "graceful",
          });
          return;
        }

        // Force kill if still running
        await this.logger.warn("daemon.force_stopping", "daemon", { pid: status.pid ?? null });
        const forceKillCmd = new this.Command("kill", {
          args: ["-KILL", status.pid!.toString()],
          stdout: "piped",
          stderr: "piped",
        });

        await forceKillCmd.output();
        await Deno.remove(this.pidFile).catch(() => {});
        await this.logDaemonActivity("daemon.stopped", {
          pid: status.pid,
          method: "forced",
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to stop daemon: ${message}`);
      }
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "DaemonCommands.stop",
        args: {},
        error,
      });
    }
  }

  /**
   * Restart the ExoFrame daemon
   */
  async restart(): Promise<void> {
    try {
      await this.logger.info("daemon.restarting", "daemon");
      const beforeStatus = await this.status();
      await this.stop();
      // Brief pause to ensure port/resources are released
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
      await this.start();
      const afterStatus = await this.status();
      await this.logDaemonActivity("daemon.restarted", {
        previous_pid: beforeStatus.pid,
        new_pid: afterStatus.pid,
      });
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "DaemonCommands.restart",
        args: {},
        error,
      });
    }
  }

  /**
   * Get daemon status
   * @returns Status information
   */
  async status(): Promise<DaemonStatus> {
    const version = "1.0.0"; // TODO: Load from package.json or version file

    // Check if PID file exists
    if (!await exists(this.pidFile)) {
      return { running: false, version };
    }

    // Read PID
    const pidStr = await Deno.readTextFile(this.pidFile);
    const pid = parseInt(pidStr.trim(), 10);

    if (isNaN(pid)) {
      return { running: false, version };
    }

    // Check if process is running
    try {
      const alive = await isProcessAlive(pid);
      if (!alive) {
        // Process not running, clean up PID file
        await Deno.remove(this.pidFile).catch(() => {});
        return { running: false, version };
      }

      // Get process uptime
      const psCmd = new this.Command("ps", {
        args: ["-p", pid.toString(), "-o", "etime="],
        stdout: "piped",
        stderr: "piped",
      });

      const psResult = await psCmd.output();
      const uptime = new TextDecoder().decode(psResult.stdout).trim();

      return {
        running: true,
        pid,
        uptime,
        version,
      };
    } catch {
      return { running: false, version };
    }
  }

  /**
   * Show daemon logs
   * @param lines Number of lines to show
   * @param follow Follow log output (tail -f)
   */
  async logs(lines: number = CLI_DEFAULTS.LOG_LINES, follow: boolean = false): Promise<void> {
    try {
      const logFile = join(this.config.system.root, this.config.paths.runtime, "daemon.log");

      if (!await exists(logFile)) {
        await this.logger.info("daemon.no_logs", logFile, { hint: "Daemon may not have been started yet" });
        return;
      }

      const args = ["-n", lines.toString()];
      if (follow) {
        args.push("-f");
      }
      args.push(logFile);

      const cmd = new this.Command("tail", {
        args,
        stdout: "inherit",
        stderr: "inherit",
      });

      const process = cmd.spawn();
      await process.status;
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "DaemonCommands.logs",
        args: { lines, follow },
        error,
      });
    }
  }

  /**
   * Wait for a process to reach a desired state (running or stopped)
   * @param pid Process ID to check
   * @param shouldBeRunning Expected state (true = running, false = stopped)
   * @param timeoutMs Maximum time to wait in milliseconds
   * @returns true if desired state reached, false if timeout
   */
  private async waitForProcessState(
    pid: number,
    shouldBeRunning: boolean,
    timeoutMs: number,
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = CLI_DEFAULTS.DAEMON_CHECK_INTERVAL_MS; // Check every 50ms

    while (Date.now() - startTime < timeoutMs) {
      const isRunning = await isProcessAlive(pid);
      if (isRunning === shouldBeRunning) {
        return true;
      }
      // Use queueMicrotask for first check, then small intervals
      if (Date.now() - startTime < checkInterval) {
        await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
      } else {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }
    return false;
  }

  /**
   * Log daemon activity to the activity journal using EventLogger
   */
  protected async logDaemonActivity(actionType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const actionLogger = await this.getActionLogger();
      actionLogger.info(actionType, "daemon", {
        ...payload,
        timestamp: new Date().toISOString(),
        via: "cli",
        command: this.getCommandLineString(),
      });
    } catch (error) {
      // Log errors but don't fail the operation
      console.error("Failed to log daemon activity:", error);
    }
  }

  /**
   * Check if daemon is running
   */
  protected async isRunning(): Promise<boolean> {
    const status = await this.status();
    return status.running;
  }
}
