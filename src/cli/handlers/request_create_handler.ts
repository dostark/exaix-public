import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";
import { BaseCommand, type CommandContext } from "../base.ts";
import { RequestPriority, RequestStatus } from "../../enums.ts";
import { ValidationChain } from "../validation/validation_chain.ts";
import { DefaultErrorStrategy } from "../errors/error_strategy.ts";
import { CommandUtils } from "../utils/command_utils.ts";
import { type RequestMetadata, type RequestOptions, type RequestSource } from "../request_commands.ts";

const VALID_PRIORITIES: RequestPriority[] = [
  RequestPriority.LOW,
  RequestPriority.NORMAL,
  RequestPriority.HIGH,
  RequestPriority.CRITICAL,
];

export class RequestCreateHandler extends BaseCommand {
  private workspaceRequestsDir: string;

  constructor(context: CommandContext) {
    super(context);
    this.workspaceRequestsDir = join(
      context.config.system.root,
      context.config.paths.workspace,
      context.config.paths.requests,
    );
  }

  async create(
    description: string,
    options: RequestOptions = {},
    source: RequestSource = "cli",
  ): Promise<RequestMetadata> {
    try {
      const trimmedDescription = description.trim();
      const priority = options.priority || RequestPriority.NORMAL;

      // Validate input
      const validation = new ValidationChain()
        .addRule("description", (val) => (!val) ? "cannot be empty" : null)
        .addRule(
          "priority",
          (val) =>
            (!VALID_PRIORITIES.includes(val as RequestPriority))
              ? `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`
              : null,
        )
        .addRule(
          "flow",
          (val) =>
            (val && options.agent)
              ? "Cannot specify both 'flow' and 'agent'. Use 'flow' for multi-agent workflows or 'agent' for single agent requests."
              : null,
        )
        .validate({ description: trimmedDescription, priority, flow: options.flow });

      if (!validation.isValid) {
        throw new Error(CommandUtils.formatValidationErrors(validation));
      }

      // Validate flow exists if specified
      if (options.flow) {
        const flowPath = join(this.config.system.root, "Blueprints", "Flows", `${options.flow}.flow.ts`);
        try {
          await Deno.stat(flowPath);
        } catch {
          throw new Error(`Flow '${options.flow}' not found. Check that the flow file exists in Blueprints/Flows/`);
        }
      }

      // Set defaults
      const agent = options.agent || "default";
      const portal = options.portal;

      // Generate unique trace_id
      const trace_id = crypto.randomUUID();
      const shortId = trace_id.slice(0, 8);
      const filename = `request-${shortId}.md`;
      const path = join(this.workspaceRequestsDir, filename);

      // Get user identity
      const created_by = await this.getUserIdentity();
      const created = new Date().toISOString();

      // Build frontmatter
      const frontmatterFields: Record<string, string> = {
        trace_id,
        created,
        status: RequestStatus.PENDING,
        priority,
        agent,
        source,
        created_by,
      };

      if (portal) {
        frontmatterFields.portal = portal;
      }

      if (options.model) {
        frontmatterFields.model = options.model;
      }

      if (options.flow) {
        frontmatterFields.flow = options.flow;
      }

      if (options.skills && options.skills.length > 0) {
        frontmatterFields.skills = JSON.stringify(options.skills);
      }

      // Build file content with YAML frontmatter
      const frontmatter = this.serializeFrontmatter(frontmatterFields);
      const content = `${frontmatter}\n\n# Request\n\n${trimmedDescription}\n`;

      // Ensure directory exists
      await ensureDir(this.workspaceRequestsDir);

      // Write file
      await Deno.writeTextFile(path, content);

      // Log activity using EventLogger
      const actionLogger = await this.getActionLogger();
      actionLogger.info("request.created", path, {
        trace_id,
        priority,
        agent,
        portal: portal || null,
        model: options.model || null,
        flow: options.flow || null,
        source,
        created_by,
        description_length: trimmedDescription.length,
        via: "cli",
        command: this.getCommandLineString(),
      }, trace_id);

      return {
        trace_id,
        filename,
        path,
        status: RequestStatus.PENDING,
        priority,
        agent,
        portal,
        model: options.model,
        flow: options.flow,
        skills: options.skills,
        created,
        created_by,
        source,
      };
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "RequestCreateHandler.create",
        args: { description, options, source },
        error,
      });
      throw error;
    }
  }

  async createFromFile(
    filePath: string,
    options: RequestOptions = {},
  ): Promise<RequestMetadata> {
    try {
      // Check file exists
      if (!await exists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read file content
      const content = await Deno.readTextFile(filePath);
      const trimmed = content.trim();

      // Validate not empty
      if (!trimmed) {
        throw new Error("File is empty");
      }

      // Create request with file source
      return this.create(trimmed, options, "file");
    } catch (error) {
      await DefaultErrorStrategy.handle({
        commandName: "RequestCreateHandler.createFromFile",
        args: { filePath, options },
        error,
      });
      throw error;
    }
  }
}
