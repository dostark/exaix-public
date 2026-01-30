/**
 * Enums for ExoFrame constants and types.
 * These replace magic words and provide type safety.
 */

/**
 * Types of AI providers supported by the system.
 * Each provider represents a different AI service or model backend.
 */
export enum ProviderType {
  /** Local Ollama instance for running open-source models */
  OLLAMA = "ollama",
  /** Anthropic's Claude models */
  ANTHROPIC = "anthropic",
  /** OpenAI's GPT models */
  OPENAI = "openai",
  /** Google's Gemini models */
  GOOGLE = "google",
  /** Mock provider for testing and development */
  MOCK = "mock",
}

/**
 * Mock strategy types for the mock provider.
 * Defines different behaviors for mock responses during testing.
 */
export enum MockStrategy {
  /** Use recorded responses from previous interactions */
  RECORDED = "recorded",
  /** Use scripted responses defined in configuration */
  SCRIPTED = "scripted",
  /** Generate responses based on pattern matching */
  PATTERN = "pattern",
  /** Always return failures for testing error handling */
  FAILING = "failing",
  /** Introduce delays to simulate slow responses */
  SLOW = "slow",
}

/**
 * Status for the ExoFrame daemon.
 */
export enum DaemonStatus {
  RUNNING = "running",
  STOPPED = "stopped",
  ERROR = "error",
  UNKNOWN = "unknown",
}

/**
 * Complexity levels for tasks and operations.
 * Used to determine processing requirements and resource allocation.
 */
export enum TaskComplexity {
  /** Basic operations requiring minimal processing */
  SIMPLE = "simple",
  /** Standard operations with moderate complexity */
  MEDIUM = "medium",
  /** Complex operations requiring significant processing */
  COMPLEX = "complex",
}

/**
 * Pricing tiers for AI services and operations.
 * Determines cost categorization and billing levels.
 */
export enum PricingTier {
  /** Local execution with no external costs */
  LOCAL = "local",
  /** Free tier services */
  FREE = "free",
  /** Low-cost commercial services */
  LOW = "low",
  /** Medium-cost commercial services */
  MEDIUM = "medium",
  /** High-cost premium services */
  HIGH = "high",
}

/**
 * Severity levels for security events and alerts.
 * Used to prioritize security responses and logging.
 */
export enum SecuritySeverity {
  /** Minor security events requiring basic logging */
  LOW = "low",
  /** Moderate security concerns requiring attention */
  MEDIUM = "medium",
  /** Serious security incidents requiring immediate action */
  HIGH = "high",
  /** Critical security breaches requiring urgent response */
  CRITICAL = "critical",
}

/**
 * Types of security events that can occur in the system.
 * Categorizes different kinds of security-related activities.
 */
export enum SecurityEventType {
  /** Authentication-related events (login, logout, token validation) */
  AUTH = "auth",
  /** Permission and access control events */
  PERMISSION = "permission",
  /** File system access and modification events */
  FILE_ACCESS = "file_access",
  /** API call and external service interaction events */
  API_CALL = "api_call",
  /** Configuration and settings change events */
  CONFIG_CHANGE = "config_change",
}

/**
 * Results of security events and operations.
 * Indicates the outcome of security-related actions.
 */
export enum SecurityEventResult {
  /** Operation completed successfully */
  SUCCESS = "success",
  /** Operation was denied or blocked */
  DENIED = "denied",
  /** Operation failed due to an error */
  ERROR = "error",
}

/**
 * Operations that can be performed on a portal.
 */
export enum PortalOperation {
  READ = "read",
  WRITE = "write",
  GIT = "git",
}

/**
 * Cost tier classification for providers.
 */
export enum ProviderCostTier {
  FREE = "free",
  FREEMIUM = "freemium",
  PAID = "paid",
  LOCAL = "local",
}

/**
 * Fine-grained permission actions.
 */
export enum PermissionAction {
  READ = "read",
  WRITE = "write",
  EXECUTE = "execute",
  DELETE = "delete",
}

/**
 * Security modes for execution.
 */
export enum SecurityMode {
  /** Fully isolated execution */
  SANDBOXED = "sandboxed",
  /** Shared access to selected resources */
  HYBRID = "hybrid",
}

/**
 * General status codes for entities in the system.
 * This is the single source of truth for all status values.
 */
export enum GeneralStatus {
  // Basic states
  ACTIVE = "active",
  INACTIVE = "inactive",
  BROKEN = "broken",
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  DRAFT = "draft",
  DEPRECATED = "deprecated",

  // Execution states
  RUNNING = "running",

  // Plan states
  REVIEW = "review",
  APPROVED = "approved",
  REJECTED = "rejected",
  NEEDS_REVISION = "needs_revision",

  // Agent/System states
  ERROR = "error",

  // Request states
  IN_PROGRESS = "in_progress",
  PLANNED = "planned",
}

/**
 * Status codes specific to agents.
 */
export enum AgentStatus {
  ACTIVE = GeneralStatus.ACTIVE,
  INACTIVE = GeneralStatus.INACTIVE,
  ERROR = GeneralStatus.ERROR,
}

/**
 * Health status codes for agents.
 */
export enum AgentHealth {
  HEALTHY = "healthy",
  WARNING = "warning",
  CRITICAL = "critical",
}

/**
 * Status states for task and execution lifecycle.
 * Tracks the progress and completion state of operations.
 */
export enum ExecutionStatus {
  PENDING = GeneralStatus.PENDING,
  ACTIVE = GeneralStatus.ACTIVE,
  RUNNING = GeneralStatus.RUNNING,
  COMPLETED = GeneralStatus.COMPLETED,
  FAILED = GeneralStatus.FAILED,
}

/**
 * Priority values for requests and tasks.
 */
export enum RequestPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Status for user requests.
 */
export enum RequestStatus {
  PENDING = GeneralStatus.PENDING,
  PLANNED = GeneralStatus.PLANNED,
  IN_PROGRESS = GeneralStatus.IN_PROGRESS,
  COMPLETED = GeneralStatus.COMPLETED,
  FAILED = GeneralStatus.FAILED,
  CANCELLED = GeneralStatus.CANCELLED,
}

/**
 * Status for execution plans.
 */
export enum PlanStatus {
  REVIEW = GeneralStatus.REVIEW,
  APPROVED = GeneralStatus.APPROVED,
  ACTIVE = GeneralStatus.ACTIVE,
  COMPLETED = GeneralStatus.COMPLETED,
  FAILED = GeneralStatus.FAILED,
  ERROR = GeneralStatus.ERROR,
  REJECTED = GeneralStatus.REJECTED,
  NEEDS_REVISION = GeneralStatus.NEEDS_REVISION,
  PENDING = GeneralStatus.PENDING,
}

/**
 * Status for changesets.
 */
export enum ChangesetStatus {
  /** Created by agent, awaiting review */
  PENDING = "pending",
  /** Approved and merged */
  APPROVED = "approved",
  /** Rejected */
  REJECTED = "rejected",
}

/**
 * Status for memory bank entries (learnings, proposals).
 */
export enum MemoryStatus {
  /** Entry is waiting for review */
  PENDING = "pending",
  /** Entry has been approved */
  APPROVED = "approved",
  /** Entry has been rejected */
  REJECTED = "rejected",
  /** Entry has been archived/deprecated */
  ARCHIVED = "archived",
}

/**
 * Status for skill lifecycle.
 */
export enum SkillStatus {
  DRAFT = GeneralStatus.DRAFT,
  ACTIVE = GeneralStatus.ACTIVE,
  DEPRECATED = GeneralStatus.DEPRECATED,
}

/**
 * Status for portal lifecycle.
 */
export enum PortalStatus {
  ACTIVE = GeneralStatus.ACTIVE,
  BROKEN = GeneralStatus.BROKEN,
}

/**
 * Status for dialog lifecycle.
 */
export enum DialogStatus {
  ACTIVE = GeneralStatus.ACTIVE,
  CONFIRMED = GeneralStatus.CONFIRMED,
  CANCELLED = GeneralStatus.CANCELLED,
}

/**
 * Confidence levels for AI-generated content and decisions.
 * Represents the system's certainty in its outputs.
 */
export enum ConfidenceLevel {
  /** Low confidence in the result */
  LOW = "low",
  /** Moderate confidence in the result */
  MEDIUM = "medium",
  /** High confidence in the result */
  HIGH = "high",
}

/**
 * Granular confidence assessment levels for detailed evaluation.
 * Provides more precise confidence measurements.
 */
export enum ConfidenceAssessmentLevel {
  /** Very low confidence, result is highly uncertain */
  VERY_LOW = "very_low",
  /** Low confidence, result needs verification */
  LOW = "low",
  /** Moderate confidence, result is reasonably reliable */
  MEDIUM = "medium",
  /** High confidence, result is trustworthy */
  HIGH = "high",
  /** Very high confidence, result is highly reliable */
  VERY_HIGH = "very_high",
}

/**
 * Priority levels for task scheduling and execution.
 * Lower numeric values indicate higher priority.
 */
export enum PriorityLevel {
  /** Highest priority for local operations */
  LOCAL = 0,
  /** Low priority tasks */
  LOW = 2,
  /** Medium priority tasks */
  MEDIUM = 3,
  /** High priority tasks */
  HIGH = 4,
  /** Default priority for unspecified tasks */
  DEFAULT = 999,
}

/**
 * Types of findings in code analysis and review results.
 * Categorizes different kinds of issues or observations found during analysis.
 */
export enum AnalysisFindingType {
  /** A problem that needs to be fixed */
  ISSUE = "issue",
  /** A recommendation for improvement */
  SUGGESTION = "suggestion",
  /** An informational note or observation */
  NOTE = "note",
  /** A warning about potential issues */
  WARNING = "warning",
  /** A critical error that must be addressed */
  ERROR = "error",
}

/**
 * Severity levels for analysis findings.
 * Indicates the importance and urgency of addressing each finding.
 */
export enum AnalysisFindingSeverity {
  /** Minor issues that can be addressed later */
  LOW = "low",
  /** Moderate issues that should be considered */
  MEDIUM = "medium",
  /** Important issues that need attention */
  HIGH = "high",
  /** Critical issues that require immediate action */
  CRITICAL = "critical",
}

/**
 * SQLite journal modes for database configuration.
 * Defines how SQLite handles the rollback journal file.
 */
export enum SqliteJournalMode {
  /** Delete the journal file after each transaction */
  DELETE = "DELETE",
  /** Truncate the journal file to zero length after each transaction */
  TRUNCATE = "TRUNCATE",
  /** Persist the journal file after each transaction */
  PERSIST = "PERSIST",
  /** Store the journal in memory */
  MEMORY = "MEMORY",
  /** Use Write-Ahead Logging for better concurrency */
  WAL = "WAL",
  /** Disable the rollback journal entirely */
  OFF = "OFF",
}

/**
 * Log levels for system logging configuration.
 * Defines the verbosity levels for logging output.
 */
export enum LogLevel {
  /** Detailed diagnostic information for debugging */
  DEBUG = "debug",
  /** General information about system operation */
  INFO = "info",
  /** Warning messages about potential issues */
  WARN = "warn",
  /** Error messages about failures */
  ERROR = "error",
}

/**
 * Agent execution error types.
 */
export enum AgentExecutionErrorType {
  TIMEOUT = "timeout",
  BLUEPRINT_NOT_FOUND = "blueprint_not_found",
  PORTAL_NOT_FOUND = "portal_not_found",
  PERMISSION_DENIED = "permission_denied",
  MCP_CONNECTION_FAILED = "mcp_connection_failed",
  TOOL_ERROR = "tool_error",
  GIT_ERROR = "git_error",
  SECURITY_VIOLATION = "security_violation",
  AGENT_ERROR = "agent_error",
}

/**
 * Types of steps in a flow.
 */
export enum FlowStepType {
  AGENT = "agent",
  GATE = "gate",
  BRANCH = "branch",
  CONSENSUS = "consensus",
}

/**
 * Actions taken when a flow gate evaluation fails.
 */
export enum FlowGateOnFail {
  RETRY = "retry",
  HALT = "halt",
  CONTINUE_WITH_WARNING = "continue-with-warning",
}

/**
 * Methods used to reach consensus in a flow.
 */
export enum FlowConsensusMethod {
  MAJORITY = "majority",
  WEIGHTED = "weighted",
  UNANIMOUS = "unanimous",
  JUDGE = "judge",
}

/**
 * Sources for flow step input data.
 */
export enum FlowInputSource {
  REQUEST = "request",
  STEP = "step",
  AGGREGATE = "aggregate",
  FEEDBACK = "feedback",
}

/**
 * Formats for flow output.
 */
export enum FlowOutputFormat {
  MARKDOWN = "markdown",
  JSON = "json",
  CONCAT = "concat",
}

/**
 * Transport protocols for MCP communication.
 */
export enum MCPTransport {
  STDIO = "stdio",
  SSE = "sse",
}

/**
 * Standard MCP tool names used in the system.
 */
export enum McpToolName {
  READ_FILE = "read_file",
  WRITE_FILE = "write_file",
  RUN_COMMAND = "run_command",
  LIST_DIRECTORY = "list_directory",
  SEARCH_FILES = "search_files",
  CREATE_DIRECTORY = "create_directory",
}

/**
 * Sources for system configuration.
 */
export enum ConfigSource {
  ENV = "env",
  CONFIG = "config",
  DEFAULT = "default",
}

/**
 * Types of references in memory banks.
 */
export enum MemoryReferenceType {
  FILE = "file",
  API = "api",
  DOC = "doc",
  URL = "url",
  EXECUTION = "execution",
}

/**
 * Sources for memory bank entries.
 */
export enum MemorySource {
  EXECUTION = "execution",
  USER = "user",
  AGENT = "agent",
  LEARNED = "learned",
  CORE = "core",
  PROJECT = "project",
}

/**
 * Applicability scopes for memory and configuration.
 */
export enum MemoryScope {
  GLOBAL = "global",
  PROJECT = "project",
}

/**
 * Categories for learned insights and patterns.
 */
export enum LearningCategory {
  PATTERN = "pattern",
  ANTI_PATTERN = "anti-pattern",
  DECISION = "decision",
  INSIGHT = "insight",
  TROUBLESHOOTING = "troubleshooting",
}

/**
 * Operations that can be performed on memory bank entries.
 */
export enum MemoryOperation {
  ADD = "add",
  UPDATE = "update",
  PROMOTE = "promote",
  DEMOTE = "demote",
  ARCHIVE = "archive",
  DELETE = "delete",
}

/**
 * Sources for review and approval actions.
 */
export enum ReviewSource {
  USER = "user",
  AUTO = "auto",
}

/**
 * Quality levels for reflexive critique.
 */
export enum CritiqueQuality {
  EXCELLENT = "excellent",
  GOOD = "good",
  ACCEPTABLE = "acceptable",
  NEEDS_IMPROVEMENT = "needs_improvement",
  POOR = "poor",
}

/**
 * Types of issues identified in critique.
 */
export enum CritiqueIssueType {
  ACCURACY = "accuracy",
  COMPLETENESS = "completeness",
  CLARITY = "clarity",
  RELEVANCE = "relevance",
  FORMAT = "format",
  LOGIC = "logic",
  OTHER = "other",
}

/**
 * Severity levels for critique issues.
 */
export enum CritiqueSeverity {
  CRITICAL = "critical",
  MAJOR = "major",
  MINOR = "minor",
  SUGGESTION = "suggestion",
}

/**
 * Verdicts for evaluation results.
 */
export enum EvaluationVerdict {
  PASS = "pass",
  FAIL = "fail",
  NEEDS_IMPROVEMENT = "needs_improvement",
}

/**
 * Impact of a factor on confidence.
 */
export enum FactorImpact {
  POSITIVE = "positive",
  NEGATIVE = "negative",
  NEUTRAL = "neutral",
}

/**
 * Category for evaluation criteria.
 */
export enum EvaluationCategory {
  QUALITY = "quality",
  CORRECTNESS = "correctness",
  COMPLETENESS = "completeness",
  SECURITY = "security",
  STYLE = "style",
  PERFORMANCE = "performance",
}

/**
 * Types of issues identified in tool reflection.
 */
export enum ToolReflectionIssueType {
  ERROR = "error",
  INCOMPLETE = "incomplete",
  UNEXPECTED = "unexpected",
  TIMEOUT = "timeout",
  PERMISSION = "permission",
  FORMAT = "format",
  OTHER = "other",
}

/**
 * Severity levels for tool reflection issues.
 */
export enum ToolReflectionSeverity {
  CRITICAL = "critical",
  MAJOR = "major",
  MINOR = "minor",
}

/**
 * Status of an archived plan.
 */
export enum ArchiveStatus {
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Type of a session memory item.
 */
export enum SessionMemoryItemType {
  LEARNING = "learning",
  PATTERN = "pattern",
  DECISION = "decision",
  EXECUTION = "execution",
  INSIGHT = "insight",
}

/**
 * Types of search results and entries in memory banks.
 */
export enum MemoryType {
  PROJECT = "project",
  EXECUTION = "execution",
  PATTERN = "pattern",
  DECISION = "decision",
  LEARNING = "learning",
}

/**
 * Types of activity in the system for summaries and journaling.
 */
export enum ActivityType {
  EXECUTION = "execution",
  TASK = "task",
  DECISION = "decision",
}

/**
 * Valid actors for activity logging.
 */
export enum ActivityActor {
  HUMAN = "human",
  AGENT = "agent",
  SYSTEM = "system",
}

/**
 * Overall health status of the service or a component.
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

/**
 * Result status of an individual health check.
 */
export enum HealthCheckVerdict {
  PASS = "pass",
  WARN = "warn",
  FAIL = "fail",
}

/**
 * Types of nodes in the TUI tree view.
 */
export enum TuiNodeType {
  ROOT = "root",
  SCOPE = "scope",
  PROJECT = "project",
  EXECUTION = "execution",
  LEARNING = "learning",
  PATTERN = "pattern",
  DECISION = "decision",
  AGENT = "agent",
  STATUS_GROUP = "status-group",
  MODEL_GROUP = "model-group",
  GROUP = "group",
}

/**
 * Grouping modes for TUI views.
 */
export enum TuiGroupBy {
  NONE = "none",
  STATUS = "status",
  MODEL = "model",
}

/**
 * Capabilities supported by AI providers.
 */
export enum ProviderCapability {
  CHAT = "chat",
  STREAMING = "streaming",
  VISION = "vision",
  TOOLS = "tools",
}

/**
 * Icons used in the TUI.
 */
export enum TuiIcon {
  AGENT = "🤖",
  LEARNING = "🎯",
  BRAIN = "🧠",
  SUCCESS = "✅",
  WARNING = "⚠️",
  CRITICAL = "❌",
  INFO = "ℹ️",
  BULLET = "•",
  PORTAL_ACTIVE = "🟢",
  PORTAL_BROKEN = "🔴",
  PORTAL_INACTIVE = "⚪",
  FOLDER = "📂",
}

/**
 * Types of dialogs used in the Request Manager View.
 */
export enum RequestDialogType {
  SEARCH = "search",
  FILTER_STATUS = "filter-status",
  FILTER_AGENT = "filter-agent",
  CREATE = "create",
  PRIORITY = "priority",
}

/**
 * Actions for daemon control key bindings.
 */
export enum DaemonKeyAction {
  START = "start",
  STOP = "stop",
  RESTART = "restart",
  VIEW_LOGS = "view-logs",
  VIEW_CONFIG = "view-config",
  REFRESH = "refresh",
  AUTO_REFRESH = "auto-refresh",
  HELP = "help",
  QUIT = "quit",
  CANCEL = "cancel",
}

// /**
//  * Categories for key bindings.
//  */
// export enum KeyBindingCategory {
//   ACTIONS = "Actions",
//   VIEW = "View",
//   HELP = "Help",
// }
