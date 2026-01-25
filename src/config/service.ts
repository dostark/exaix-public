import { parse } from "@std/toml";
import { isAbsolute, join } from "@std/path";
import { crypto } from "@std/crypto";
import { encodeHex } from "@std/encoding/hex";
import { Config, ConfigSchema } from "./schema.ts";
import { logInfo } from "../services/structured_logger.ts";

export class ConfigService {
  private config: Config;
  private configPath: string;
  private checksum: string = "";

  constructor(configPath: string = "exo.config.toml") {
    // Use absolute path if provided, otherwise join with cwd
    this.configPath = isAbsolute(configPath) ? configPath : join(Deno.cwd(), configPath);

    // In test mode, if using default path, use temp directory to avoid polluting root
    if (this.configPath === join(Deno.cwd(), "exo.config.toml") && Deno.env.get("EXO_TEST_CLI_MODE") === "1") {
      const tempDir = Deno.makeTempDirSync({ prefix: "config-test-" });
      this.configPath = join(tempDir, "exo.config.toml");
    }

    this.config = this.load();
  }

  private load(): Config {
    try {
      const content = Deno.readTextFileSync(this.configPath);
      this.checksum = this.computeChecksum(content);

      const rawConfig = parse(content);
      const result = ConfigSchema.safeParse(rawConfig);

      if (!result.success) {
        let errorMessage = "❌ Invalid configuration in exo.config.toml:\n";
        for (const issue of result.error.issues) {
          errorMessage += `  - ${issue.path.join(".")}: ${issue.message}\n`;
        }
        throw new Error(errorMessage);
      }

      return result.data;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.warn("⚠️  Configuration file not found. Using defaults.");
        // Create default config file
        this.createDefaultConfig();
        // Reload the newly created file
        const content = Deno.readTextFileSync(this.configPath);
        this.checksum = this.computeChecksum(content);
        const rawConfig = parse(content);
        return ConfigSchema.parse(rawConfig);
      }
      throw error;
    }
  }

  private createDefaultConfig() {
    const defaultConfig = `
[system]
version = "1.0.0"
log_level = "info"

[paths]
memory = "./Memory"
blueprints = "./Blueprints"
runtime = "./.exo"
workspace = "./Workspace"
portals = "./Portals"
active = "./Workspace/Active"
archive = "./Workspace/Archive"
plans = "./Workspace/Plans"
requests = "./Workspace/Requests"
rejected = "./Workspace/Rejected"
agents = "./Blueprints/Agents"
flows = "./Blueprints/Flows"
memoryProjects = "./Memory/Projects"
memoryExecution = "./Memory/Execution"
memoryIndex = "./Memory/Index"
memorySkills = "./Memory/Skills"
memoryPending = "./Memory/Pending"
memoryTasks = "./Memory/Tasks"
memoryGlobal = "./Memory/Global"

[watcher]
debounce_ms = 200
stability_check = true
`;
    Deno.writeTextFileSync(this.configPath, defaultConfig.trim());
    logInfo("Created default configuration file", {
      audit_event: true,
      event_type: "config_created",
      config_path: this.configPath,
      service: "config-service",
    });
  }

  private computeChecksum(content: string): string {
    const data = new TextEncoder().encode(content);
    const hash = crypto.subtle.digestSync("SHA-256", data);
    return encodeHex(hash);
  }

  public get(): Config {
    return this.config;
  }

  public getChecksum(): string {
    return this.checksum;
  }

  public reload(): Config {
    this.config = this.load();
    return this.config;
  }

  public async addPortal(alias: string, targetPath: string): Promise<void> {
    const created = new Date().toISOString();

    // Read current config
    const content = await Deno.readTextFile(this.configPath);

    // Add portal entry
    const portalEntry = `\n[[portals]]\nalias = "${alias}"\ntarget_path = "${targetPath}"\ncreated = "${created}"\n`;

    // Append to config
    await Deno.writeTextFile(this.configPath, content + portalEntry);

    // Reload config
    this.config = this.load();
  }

  public async removePortal(alias: string): Promise<void> {
    // Read current config
    let content = await Deno.readTextFile(this.configPath);

    // Remove portal section using regex
    const portalRegex = new RegExp(
      `\\[\\[portals\\]\\][\\s\\S]*?alias\\s*=\\s*["']${alias}["'][\\s\\S]*?(?=\\[\\[portals\\]\\]|\\[\\w+\\]|$)`,
      "g",
    );

    content = content.replace(portalRegex, "");

    // Clean up extra blank lines
    content = content.replace(/\n{3,}/g, "\n\n");

    await Deno.writeTextFile(this.configPath, content);

    // Reload config
    this.config = this.load();
  }

  public getPortals(): Array<{ alias: string; target_path: string; created?: string }> {
    return this.config.portals || [];
  }

  public getPortal(alias: string): { alias: string; target_path: string; created?: string } | undefined {
    return this.config.portals?.find((p) => p.alias === alias);
  }

  public async updatePortalVerification(_alias: string): Promise<void> {
    // This would update last_verified timestamp if we add it to schema
    // For now, this is a placeholder for future enhancement
  }
}
