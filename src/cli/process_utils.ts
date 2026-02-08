/**
 * Small CLI process helpers.
 *
 * Kept in a standalone module so production code and tests can share behavior
 * without duplicating shell command boilerplate.
 */

/**
 * Check whether a PID appears alive by using `kill -0`.
 *
 * NOTE: This is POSIX-specific; ExoFrame's CLI currently assumes a Unix-like environment.
 */
export async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    const cmd = new Deno.Command("kill", {
      args: ["-0", pid.toString()],
      stdout: "piped",
      stderr: "piped",
    });
    const result = await cmd.output();
    return result.success;
  } catch {
    return false;
  }
}
