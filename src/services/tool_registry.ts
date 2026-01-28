/**
 * Tool Registry - Step 4.1 of Implementation Plan
 * Maps LLM function calls to safe Deno operations with security validation
 */
import { ConfigSchema } from "../config/schema.ts";
import { join, resolve } from "@std/path";
import { expandGlob } from "@std/fs";
import type { Config } from "../config/schema.ts";
import type { DatabaseService } from "./db.ts";
import { PathResolver } from "./path_resolver.ts";
import { ActivityActor, LogLevel } from "../enums.ts";
import { MiddlewarePipeline } from "./middleware/pipeline.ts";
import { ServiceContext } from "./common/types.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * JSON Schema for a tool parameter
 */
export interface ToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

/**
 * JSON Schema for tool parameters
 */
export interface ToolSchema {
  type: "object";
  properties: Record<string, ToolParameterSchema>;
  required?: string[];
}

/**
 * Tool definition with JSON schema for LLM function calling
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolSchema;
}

/**
 * Result of tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Configuration for ToolRegistry
 */
export interface ToolRegistryConfig {
  config: Config;
  db?: DatabaseService;
  traceId?: string;
  agentId?: string;
  baseDir?: string;
}

/**
 * Context for tool execution middleware
 */
interface ToolContext extends ServiceContext {
  toolName: string;
  params: Record<string, any>;
  result?: ToolResult;
  toolRegistry: ToolRegistry;
}

// ============================================================================
// Command Whitelist
// ============================================================================

// Combined whitelist for backward compatibility
const ALLOWED_COMMANDS = new Set([
  // Safe commands
  "echo",
  "printf",
  "pwd",
  "whoami",
  "id",
  "date",
  "uptime",
  "which",
  "type",
  "command",
  "hash",
  "alias",
  // Validated commands
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "stat",
  "basename",
  "dirname",
  "grep",
  "cut",
  "tr",
  "sort",
  "uniq",
  "rev",
  "fold",
  "fmt",
  "git",
  "npm",
  "node",
  "deno",
]);

// ============================================================================
// Argument Validation Functions
// ============================================================================

/**
 * Validate command arguments for security and safety
 */
function validateCommandArguments(command: string, args: string[]): { valid: boolean; reason?: string } {
  // Reject dangerous argument patterns
  const dangerousPatterns = [
    /[\$`]/, // Shell metacharacters
    /\|/, // Pipes
    /;/, // Command separators
    /&&/, // Logical AND
    /\|\|/, // Logical OR
    />/, // Output redirection
    /<</, // Input redirection
    /2>/, // Error redirection
  ];

  for (const arg of args) {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(arg)) {
        return {
          valid: false,
          reason: `Argument contains dangerous pattern: ${pattern.source}`,
        };
      }
    }
  }

  // Command-specific validations
  switch (command) {
    case "git":
      return validateGitArguments(args);
    case "npm":
    case "node":
    case "deno":
      return validateRuntimeArguments(command, args);
    case "ls":
      return validateLsArguments(args);
    case "grep":
      return validateGrepArguments(args);
    default:
      // For safe commands, basic validation is sufficient
      return { valid: true };
  }
}

/**
 * Validate git command arguments
 */
function validateGitArguments(args: string[]): { valid: boolean; reason?: string } {
  const dangerousGitOptions = [
    "--exec-path",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--config",
    "--config-env",
    "--exec",
    "--html-path",
  ];

  for (const arg of args) {
    if (dangerousGitOptions.some((option) => arg.startsWith(option))) {
      return {
        valid: false,
        reason: `Dangerous git option not allowed: ${arg}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate runtime command arguments (npm, node, deno)
 */
function validateRuntimeArguments(runtime: string, args: string[]): { valid: boolean; reason?: string } {
  // Only allow specific safe subcommands
  const safeSubcommands = ["--version", "--help", "version", "info"];

  if (args.length === 0) return { valid: true }; // Allow bare command

  const firstArg = args[0];
  if (!safeSubcommands.includes(firstArg)) {
    return {
      valid: false,
      reason: `${runtime} subcommand not allowed: ${firstArg}`,
    };
  }

  return { valid: true };
}

/**
 * Validate ls command arguments
 */
function validateLsArguments(args: string[]): { valid: boolean; reason?: string } {
  // Allow safe ls options only
  const allowedLsOptions = ["-l", "-a", "-h", "-1", "--color=never"];

  for (const arg of args) {
    if (arg.startsWith("-") && !allowedLsOptions.includes(arg)) {
      return {
        valid: false,
        reason: `Unsafe ls option not allowed: ${arg}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate grep command arguments
 */
function validateGrepArguments(args: string[]): { valid: boolean; reason?: string } {
  // Allow safe grep options only
  const allowedGrepOptions = ["-i", "-v", "-n", "-c", "-l", "-r", "-E", "-F"];

  for (const arg of args) {
    if (arg.startsWith("-") && !allowedGrepOptions.some((opt) => arg.startsWith(opt))) {
      return {
        valid: false,
        reason: `Unsafe grep option not allowed: ${arg}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// ToolRegistry Implementation
// ============================================================================

export class ToolRegistry {
  private config: Config;
  private db?: DatabaseService;
  private traceId?: string;
  private agentId?: string;
  private pathResolver: PathResolver;
  private tools: Map<string, Tool>;
  private baseDir: string;
  private pipeline: MiddlewarePipeline<ToolContext>;

  constructor(options?: ToolRegistryConfig) {
    // Use ConfigSchema to parse and apply all defaults automatically
    this.config = options?.config || ConfigSchema.parse({
      system: { root: Deno.cwd(), log_level: LogLevel.INFO },
      paths: {}, // Will use schema defaults
      database: {}, // Will use schema defaults
      watcher: {}, // Will use schema defaults
      agents: {}, // Will use schema defaults including max_iterations
      models: {}, // Will use schema defaults
      portals: [],
      mcp: {}, // Will use schema defaults
    });
    this.db = options?.db;
    this.traceId = options?.traceId ?? "tool-registry";
    this.agentId = options?.agentId ?? "system";
    // Default baseDir to system root if not provided. Resolve it to ensure absolute path.
    this.baseDir = options?.baseDir ? resolve(options.baseDir) : resolve(this.config.system.root);

    this.pathResolver = new PathResolver(this.config);
    this.tools = new Map();
    this.pipeline = new MiddlewarePipeline<ToolContext>();

    this.registerCoreTools();
    this.setupMiddleware();
  }

  private setupMiddleware() {
    // Validation Middleware
    this.pipeline.use(async (ctx, next) => {
      if (!this.tools.has(ctx.toolName)) {
        ctx.result = {
          success: false,
          error: `Tool '${ctx.toolName}' not found`,
        };
        return; // Stop pipeline
      }
      await next();
    });

    // Logging Middleware
    this.pipeline.use(async (ctx, next) => {
      const startTime = Date.now();
      try {
        await next();
        this.logActivity(`tool.${ctx.toolName}`, {
          success: ctx.result?.success ?? false,
          duration_ms: Date.now() - startTime,
          params: ctx.params,
          error: ctx.result?.error,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logActivity(`tool.${ctx.toolName}`, {
          success: false,
          duration_ms: Date.now() - startTime,
          params: ctx.params,
          error: errorMsg,
        });
        throw error;
      }
    });

    // Error Handling Middleware
    this.pipeline.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        ctx.result = this.formatError(error);
      }
    });
  }

  /**
   * Register all core tools
   */
  private registerCoreTools() {
    this.tools.set("read_file", {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read",
          },
        },
        required: ["path"],
      },
    });

    this.tools.set("write_file", {
      name: "write_file",
      description: "Write or overwrite a file with content",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    });

    this.tools.set("list_directory", {
      name: "list_directory",
      description: "List files and directories in a path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the directory to list",
          },
        },
        required: ["path"],
      },
    });

    this.tools.set("search_files", {
      name: "search_files",
      description: "Search for files matching a glob pattern",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern to match (e.g., '*.ts', '**/*.md')",
          },
          path: {
            type: "string",
            description: "Directory to search in",
          },
        },
        required: ["pattern", "path"],
      },
    });

    this.tools.set("create_directory", {
      name: "create_directory",
      description: "Create a directory (recursively)",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the directory to create",
          },
        },
        required: ["path"],
      },
    });

    this.tools.set("run_command", {
      name: "run_command",
      description: "Execute a whitelisted shell command",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Command to execute (must be whitelisted)",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Command arguments",
          },
        },
        required: ["command"],
      },
    });
  }

  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, params: Record<string, any>): Promise<ToolResult> {
    const context: ToolContext = {
      toolName,
      params,
      toolRegistry: this,
      traceId: this.traceId,
      agentId: this.agentId,
    };

    await this.pipeline.execute(context, async () => {
      // Core Execution Logic
      switch (toolName) {
        case "read_file":
          context.result = await this.readFile(params.path);
          break;
        case "write_file":
          context.result = await this.writeFile(params.path, params.content);
          break;
        case "list_directory":
          context.result = await this.listDirectory(params.path);
          break;
        case "search_files":
          context.result = await this.searchFiles(params.pattern, params.path);
          break;
        case "run_command":
          context.result = await this.runCommand(params.command, params.args || []);
          break;
        case "create_directory":
          context.result = await this.createDirectory(params.path);
          break;
        default:
          context.result = {
            success: false,
            error: `Tool '${toolName}' not implemented`,
          };
      }
    });

    return context.result!;
  }

  /**
   * Read file tool implementation
   */
  private async readFile(path: string): Promise<ToolResult> {
    try {
      const resolvedPath = await this.resolvePath(path);
      const content = await Deno.readTextFile(resolvedPath);
      return this.formatSuccess({ content });
    } catch (error) {
      return this.formatError(error, `File: ${path}`);
    }
  }

  /**
   * Write file tool implementation
   */
  private async writeFile(path: string, content: string): Promise<ToolResult> {
    try {
      const resolvedPath = await this.resolvePath(path);

      // Ensure parent directory exists
      const parentDir = join(resolvedPath, "..");
      await Deno.mkdir(parentDir, { recursive: true });

      await Deno.writeTextFile(resolvedPath, content);
      return this.formatSuccess({ path: resolvedPath });
    } catch (error) {
      return this.formatError(error);
    }
  }

  /**
   * List directory tool implementation
   */
  private async listDirectory(path: string): Promise<ToolResult> {
    try {
      const resolvedPath = await this.resolvePath(path);
      const entries: Array<{ name: string; isDirectory: boolean }> = [];

      for await (const entry of Deno.readDir(resolvedPath)) {
        entries.push({
          name: entry.name,
          isDirectory: entry.isDirectory,
        });
      }

      return this.formatSuccess({ entries });
    } catch (error) {
      return this.formatError(error, `Directory: ${path}`);
    }
  }

  /**
   * Search files tool implementation
   */
  private async searchFiles(pattern: string, searchPath: string): Promise<ToolResult> {
    try {
      const resolvedPath = await this.resolvePath(searchPath);
      const files: string[] = [];

      // Construct glob pattern
      const globPattern = join(resolvedPath, pattern);

      for await (const entry of expandGlob(globPattern)) {
        if (entry.isFile) {
          files.push(entry.path);
        }
      }

      return this.formatSuccess({ files });
    } catch (error) {
      return this.formatError(error);
    }
  }

  /**
   * Resolve and validate a path
   * - If path starts with @, use PathResolver (for alias resolution)
   * - Otherwise, validate it's within allowed roots
   */
  private async resolvePath(path: string): Promise<string> {
    const { PathSecurity, PathTraversalError, PathAccessError } = await import("../utils/path_security.ts");

    // Use PathResolver for alias paths
    if (path.startsWith("@")) {
      return await this.pathResolver.resolve(path);
    }

    // Define allowed roots - RESOLVE TO ABSOLUTE PATHS
    // We must resolve config.system.root to absolute first if receiving relative paths
    // But typically config.system.root should be correct.
    // The issue is mixing relative config paths with absolute Portal paths.
    // We normalize all to absolute here.
    const systemRootAbsolute = await Deno.realPath(this.config.system.root).catch(() =>
      resolve(this.config.system.root)
    );

    const allowedRoots = [
      join(systemRootAbsolute, this.config.paths.workspace),
      join(systemRootAbsolute, this.config.paths.memory),
      join(systemRootAbsolute, this.config.paths.blueprints),
      systemRootAbsolute,
      ...this.config.portals.map((p) => p.target_path),
    ];

    try {
      // Securely resolve path within allowed roots
      // Pass this.baseDir as the rootDir for resolution of relative paths
      const resolvedPath = await PathSecurity.resolveWithinRoots(
        path,
        allowedRoots,
        this.baseDir,
      );

      return resolvedPath;
    } catch (error) {
      if (error instanceof PathTraversalError) {
        // Log security event
        this.db?.logActivity(
          ActivityActor.SYSTEM,
          "security.path_traversal_attempted",
          path,
          {
            attempted_path: path,
            error: error.message,
            trace_id: this.traceId,
            agent_id: this.agentId,
          },
          this.traceId,
          this.agentId,
        );

        throw new Error(`Access denied: Path traversal detected`);
      }

      if (error instanceof PathAccessError) {
        // Log access violation
        this.db?.logActivity(
          ActivityActor.SYSTEM,
          "security.path_access_denied",
          path,
          {
            attempted_path: path,
            resolved_path: error.message.includes("->") ? error.message.split("->")[1]?.trim() : undefined,
            error: error.message,
            trace_id: this.traceId,
            agent_id: this.agentId,
          },
          this.traceId,
          this.agentId,
        );

        const allowedRootsList = allowedRoots.join(", ");
        throw new Error(`Access denied: Path outside allowed directories. Allowed roots: ${allowedRootsList}`);
      }

      // Log generic path resolution errors
      this.db?.logActivity(
        ActivityActor.SYSTEM,
        "path.resolution_error",
        path,
        {
          input_path: path,
          error: error instanceof Error ? error.message : String(error),
          trace_id: this.traceId,
          agent_id: this.agentId,
        },
        this.traceId,
        this.agentId,
      );

      throw error;
    }
  }

  /**
   * Run command tool implementation
   */
  public async runCommand(command: string, args: string[]): Promise<ToolResult> {
    try {
      // Check if command is whitelisted
      if (!ALLOWED_COMMANDS.has(command)) {
        return {
          success: false,
          error: `Command '${command}' is not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(", ")}`,
        };
      }

      // Validate command arguments for security
      const validation = validateCommandArguments(command, args);
      if (!validation.valid) {
        return {
          success: false,
          error: `Command arguments not allowed: ${validation.reason}`,
        };
      }

      const cmd = new Deno.Command(command, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await cmd.output();

      const output = new TextDecoder().decode(stdout);
      const errorOutput = new TextDecoder().decode(stderr);

      if (code !== 0) {
        return {
          success: false,
          error: `Command failed with exit code ${code}: ${errorOutput}`,
        };
      }

      return {
        success: true,
        data: {
          output,
          exitCode: code,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Log activity to database
   */
  private logActivity(actionType: string, payload: Record<string, any>) {
    if (!this.db) return;

    try {
      this.db.logActivity(
        ActivityActor.AGENT,
        actionType,
        payload.params?.path || payload.params?.command || null,
        payload,
        this.traceId,
        this.agentId,
      );
    } catch (error) {
      console.error("Failed to log tool activity:", error);
    }
  }

  /**
   * Format tool result for success
   * @private
   */
  private formatSuccess(data: any): ToolResult {
    return {
      success: true,
      data,
    };
  }

  /**
   * Format tool result for error
   * @private
   */
  private formatError(error: unknown, context?: string): ToolResult {
    // Handle path security errors
    if (error instanceof Error && error.message.includes("outside allowed roots")) {
      return {
        success: false,
        error: `Access denied: ${error.message}`,
      };
    }

    // Handle not found errors
    if (error instanceof Deno.errors.NotFound) {
      const message = context ? `${context} not found` : "Not found";
      return {
        success: false,
        error: message,
      };
    }

    // Generic error handling
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * Create directory tool implementation
   */
  private async createDirectory(path: string): Promise<ToolResult> {
    try {
      const resolvedPath = await this.resolvePath(path);
      await Deno.mkdir(resolvedPath, { recursive: true });
      return this.formatSuccess({ path: resolvedPath });
    } catch (error) {
      return this.formatError(error, `Directory: ${path}`);
    }
  }
}
