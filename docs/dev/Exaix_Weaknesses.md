# ExaIx — Weaknesses Analysis & Remediation

_Grounded in ARCHITECTURE.md v2.0.0, `session_memory.ts`, `agent_executor.ts`, `memory_bank.ts`, `flow_runner.ts`, and the complete `src/services/` inventory_ [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/session_memory.ts)

---

## W1 — Semantic Search Is an Edition-Gated Gap, Not a Core Capability

## The weakness

The keyword search fallback (`memoryBank.searchMemory()`) uses frequency-based relevance scoring (counting occurrences of terms), which is crude and produces noisy results as the memory bank grows. The `calculateRelevance()` function in `memory_bank.ts` is a linear combination of title and description frequency — this degrades rapidly when memories have similar topic vocabulary.

## How to address

- Integrate a **local embedding model via Ollama** as the Solo-tier embedding backend. Ollama already ships `nomic-embed-text` and `mxbai-embed-large`; ExaIx already depends on Ollama for inference. This would make semantic search available in all editions at zero additional cost.
- Add a configuration flag `[memory.embedding] provider = "ollama"` alongside the existing `IMemoryEmbeddingService` interface — the interface is already pluggable, so this is an additive change. [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/session_memory.ts)
- Improve the keyword fallback with a simple TF-IDF scorer as an intermediate step for cases where embedding is unavailable.

---

## W2 — AgentExecutor Has a Critical Architectural Stub

## The weakness

The comment in the code reveals the gap explicitly: `// Load blueprint (TODO: use blueprint for agent spawning when implemented)`. The fallback mock result returns a hardcoded commit SHA `"abc1234567890abcdef"`. This means `AgentExecutor` as written is **not a real code execution engine** — it is a plan-interpreter that asks the LLM to describe changes rather than actually making them through tools. [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/agent_executor.ts)

The actual code execution path goes through `ExecutionLoop` → `ToolRegistry` (ReAct loop with TOML-formatted actions), not through `AgentExecutor`. The two execution paths are not clearly unified, and `AgentExecutor` appears to be a legacy or transitional component.

## How to address

- Complete the `TODO`: replace the `provider.generate()` → `parseAgentResponse()` flow with proper MCP subprocess spawning that connects a real agent (via `SafeSubprocess`) to the ExaIx MCP server.
- Unify `AgentExecutor` and `ExecutionLoop` under a single `IExecutionStrategy` interface with at least two implementations: `McpAgentStrategy` (spawns subprocess agent via MCP) and `ReActLoopStrategy` (direct TOML-action ReAct loop).
- Until the MCP path is complete, clearly document in the interface that `AgentExecutor.executeStep()` is for plan _description_ only, not actual file system execution, to prevent misuse.

---

## W3 — File-Based Communication Model Creates Onboarding and Integration Friction

## The weakness

- External programmatic callers must write a well-formatted markdown file with YAML frontmatter to the correct directory, then poll for output.
- There is no synchronous RPC path — no `POST /request` endpoint returns a result or a handle.
- The daemon detects files via `watcher.ts` (Deno file system events), which has platform-specific reliability issues (especially on network file systems, containers, and WSL).
- The clarification Q&A loop (`NEEDS_CLARIFICATION` status) requires the user to invoke `exactl request clarify --answers` and re-check status — there is no push notification or websocket connection to convey when questions are ready.

## How to address

- Add an **HTTP API layer** (even a thin one) that accepts `POST /api/v1/requests` and returns a `trace_id` immediately, then internally writes the markdown file. This is a thin adapter pattern over the existing pipeline — not a redesign.
- The MCP server (already planned for Team+) could serve this role if exposed on a local port even in Solo edition for programmatic use.
- For clarification: extend the `notification.ts` service to support a simple SSE (Server-Sent Events) stream so the CLI and future Web UI can push clarification questions to listening clients without polling.

---

## W4 — Skills Service Is Disconnected from the Execution Pipeline

## The weakness

This means accumulated procedural knowledge (how to write tests for this codebase, how to handle merge conflicts, deployment procedures) is stored but never retrieved. The `maxSkillsPerRequest: 5` and `matchThreshold: 0.3` config values suggest intent but there is no caller.

## How to address

- Wire `SkillsService.matchSkills(request)` into the `AgentRunner` pipeline after `SessionMemoryService.enhanceRequest()` and before prompt construction. Skills should inject after declarative memory context but before the user request section.
- Add a `skills_context` section to the prompt template structure in `buildPromptWithMemory()`, parallel to `memoryContext`.
- Create a `exactl skills list|show|invoke` CLI command group to make skills visible and testable by users — currently there appears to be no CLI surface for skills inspection.

---

## W5 — Memory Approval Workflow Is a Manual Bottleneck

## The weakness

- In practice, learnings accumulate in `Memory/Pending/` and never get approved because the approve step is manual and easily forgotten.
- The `ConfidenceScorer` produces a confidence level (HIGH/MEDIUM/LOW) that is already available at save time but is not used to auto-approve high-confidence learnings.
- `memory_extractor.ts` triggers after executions, but if pending approval is systematically skipped, the memory bank effectively never grows from agent activity.

## How to address

- Implement **confidence-based auto-approval**: learnings with `confidence: HIGH` and `source: AGENT` (not `source: USER`) can be auto-approved after a configurable delay (e.g., 24 hours with no manual action). Add `[memory.auto_approve] enabled = true, confidence_threshold = "high", delay_hours = 24` to `exa.config.toml`.
- Surface a daily/session digest notification via `notification.ts`: "You have N pending memory updates — review with `exactl memory pending list`". The notification system already exists but is not connected to memory pending state. [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/agent_executor.ts)
- Add a `--dry-run` flag to `exactl memory pending approve` that shows what would be added without committing, to reduce the friction of manual review.

---

## W6 — Identities/Agents Dual-Path Is a Technical Debt Risk

## The weakness

This dual-path will silently pass until someone creates a file in `agents/` expecting it to be found, only to have it shadowed by an identities/ file of the same name — or vice versa.

## How to address

- Set a **deprecation timeline**: keep the `agents/` fallback for one more minor version, log a `WARN` every time it is used ("Blueprint loaded from deprecated agents/ path; migrate to identities/"), then remove in the next major version.
- Merge `IBlueprint` and `ILoadedBlueprint` into a single `IIdentityBlueprint` type. Mark the old interfaces as `@deprecated`.
- Add `exactl blueprint migrate` command that scans `Blueprints/Agents/`, copies files to `Blueprints/Identities/`, and reports what was migrated.

---

## W7 — Context Window Management Is Implicit and Fragile

## The weakness

- `SessionMemoryService`: `maxContextLength: 4000` chars [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/session_memory.ts)
- `SkillsService`: `skillContextBudget: 2000` chars
- `portal_knowledge/` analysis results injected into context (no explicit budget)
- `ContextLoader`: 12 KB service, budget unknown without reading

There is no **global prompt budget coordinator**. Each service fills its budget independently, and the sum can silently exceed the LLM's context window. The `MAX_PROMPT_LENGTH` constant exists in `agent_executor.ts` and is used to truncate the system prompt, but user request + plan + memory context + skill context + portal knowledge is not bounded by any single controller. When total context exceeds the model's window, the LLM silently truncates from the end (which typically means losing the execution plan — the most critical part). [raw.githubusercontent](https://raw.githubusercontent.com/dostark/exaix-public/main/src/services/agent_executor.ts)

## How to address

- Introduce a `PromptBudgetAllocator` service that receives the total available context window (derived from `model` field in the blueprint), allocates budgets to each section proportionally (e.g., system prompt: 20%, portal knowledge: 15%, memory: 10%, skills: 5%, plan: 40%, request: 10%), and enforces them before prompt assembly.
- The allocation percentages should be configurable per blueprint or globally in `exa.config.toml`.
- Add a `prompt.total_tokens_used` field to the `IActivity Journal` log for every execution so users can observe context pressure over time.

---

## W8 — No Real-Time Feedback During Execution

## The weakness

For long-running executions (multi-step plans, deep analysis), this is a significant UX weakness. Users have no way to detect runaway execution, incorrect behavior, or stuck tools without waiting for completion or timeout.

## How to address

- Add **live streaming to `EventLogger`**: tool calls and LLM generation events should be emitted to a local SSE bus (even a simple in-memory pub/sub). The TUI MonitorView can subscribe to this bus for real-time updates without requiring database writes for every token.
- Implement **execution heartbeat**: `execution_loop.ts` should emit a `agent.heartbeat` event to the journal every N seconds during execution, allowing the TUI and CLI (`exactl daemon status`) to detect stalled executions.
- Add a `exactl watch <trace_id>` command that tails the Activity Journal for a specific trace in real-time, similar to `docker logs -f`.

---

## W9 — Deno Runtime Limits Ecosystem Reach

## The weakness

- The vast majority of TypeScript AI tooling (LangChain, Vercel AI SDK, llamaindex.ts) is Node.js-first and requires polyfills or is simply incompatible with Deno.
- `npm:` import compatibility in Deno is improving but not complete for packages with native bindings or Node.js `__dirname`/`require()` patterns.
- CI/CD ecosystems default to Node.js; most developers don't have Deno installed. This raises the contribution and onboarding barrier.
- Docker base images for Deno are larger and less battle-tested than Node alpine images.

## How to address

- This is a foundational tradeoff, not a simple fix. The recommended path is to **maintain Deno but provide a Node.js compatibility shim layer** for the most critical external integrations:
  - For LLM providers: ExaIx already has its own `ProviderFactory` abstraction — keep extending it rather than delegating to LangChain.
  - For embedding: Use Ollama's REST API directly (already done for inference) rather than importing a Node.js SDK.
  - Add a `Dockerfile` and `compose.yml` to the repo for zero-install onboarding.
- Document the Deno requirement prominently and add a `scripts/check_runtime.ts` that verifies the Deno version constraint at startup.

---

## W10 — Plan Approval Gate Has No Time-Based Expiry or Escalation

## The weakness

- No expiry: a plan generated 3 months ago can still be approved
- No escalation: no notification reminder that plans are waiting
- No stale-context detection: the codebase may have changed significantly since the plan was generated, making the plan's assumptions invalid

## How to address

- Add `plan_ttl_hours` to `exa.config.toml` (default: 72h). Plans older than TTL should transition to `expired` status and require regeneration before execution.
- `notification.ts` should emit daily reminders for pending plans older than 24h.
- Add a `stale_context_check` to `PlanExecutor`: before executing an approved plan, check whether the portal's git HEAD has advanced since the plan was generated. If yes, emit a `plan.context_possibly_stale` warning to the journal and surface it to the user before proceeding.

---

Continuing directly after **W10**:

---

## W11 — PortalKnowledgeService Invalidation Is Time-Based, Not Change-Based

## The weakness

**Fix:** Replace time-staleness with **git-hash invalidation**. Store the portal's `HEAD` commit SHA alongside `gatheredAt` in `knowledge.json`. At request time, run a single `git rev-parse HEAD` (negligible cost) and re-analyze only when SHA has changed. Add a `max_files_delta` threshold: if fewer than N files changed since last analysis, run only strategies 1–3 (directory census, key files, config parsing) incrementally rather than a full pipeline. Log `portal.knowledge.skipped` to the journal when analysis is skipped due to unchanged HEAD.

---

## W12 — ReflexiveAgent Iteration Budget Has No Adaptive Control or Convergence Detection

## The weakness

- Early convergence (output quality stopped improving — continued iterations waste budget)
- Oscillation (output quality alternates between two states — infinite refinement will not converge)
- Complexity-proportional budgeting (a one-line fix and a full authentication system refactor get the same iteration count)

**Fix:** Connect `ConfidenceScorer` inline within `ReflexiveAgent`: after each iteration, score the current output; if `score >= agents.confidence_threshold` (already a config key) exit early. Add a **convergence detector**: if `|score_n - score_(n-1)| < min_improvement_delta` (configurable, default: 2 points) for two consecutive iterations, treat as converged. Let `IRequestAnalysis.complexity` (Phase 45 output) feed into `effectiveMaxIterations = baseMax + floor(complexity * scaleFactor)` so complex requests get proportionally more refinement budget.

---

## W13 — No Structured Error Recovery at the Flow Level

## The weakness

- **Fallback steps**: if step A fails, execute step B instead
- **Partial completion checkpointing**: resume from the last successful step rather than restarting the whole flow
- **Compensating transactions**: if step 3 fails after step 2 modified files, undo step 2's Git changes

For long flows (analyze → implement → test → review), a step 3 failure leaves step 2's changes in the worktree in an inconsistent state. Worktree isolation contains the blast radius but doesn't recover progress.

**Fix:** Add `onError` to flow step YAML definitions, parallel to the existing gate `onFail`:

```yaml
step:
  id: implement
  onError:
    action: fallback | retry | abort | compensate
    fallbackStep: implement-simplified
    maxRetries: 2
```

Implement **flow checkpointing**: serialize the completed step results (`IFlowContext`) to `Memory/Execution/{trace_id}/checkpoint.json` after each successful step. If a flow restarts, load the checkpoint and skip already-completed steps. For compensating transactions, add a `compensate` action array whose items are tool calls executed in reverse order when downstream steps fail.

---

## W14 — Multi-Portal Flows Are Not Supported

## The weakness

**Fix:** Add an optional `portal` field to individual flow step definitions:

```yaml
steps:
  - id: analyze-frontend
    type: agent
    portal: frontend # step-level portal override
    agent: analyst
  - id: implement-backend
    type: agent
    portal: backend
    agent: senior-coder
```

`FlowRunner` resolves each step's portal using `PortalPermissionsService`, requiring a new `cross_portal` permission type. `IFlowResult` aggregates per-portal `IChangesetResult` entries. Memory context would need to be portal-scoped per step rather than globally resolved once at flow start.

---

## W15 — Token and Cost Consumption Is Not Persisted per Request

## The weakness

**Fix:** Extend `IModelProvider.generate()` to return `{ text, usage: { promptTokens, completionTokens, costUsdEstimate } }` — most provider APIs already include usage in their response objects. Log these fields in every `agent.*` journal event payload. Add a `exactl log cost [--trace <id>] [--portal <name>] [--since <date>]` CLI command that aggregates token/cost from the journal. In Solo edition add a configurable `[budget] max_tokens_per_request` guard in `AgentRunner` that refuses to start if the estimated prompt exceeds budget.

---

## W16 — `.copilot/` Knowledge Base Is a Committed Build Artifact

## The weakness

**Fix:** Move `.copilot/` entirely to `.gitignore`. Generate it as a CI artifact cached by content hash of source files. Add a pre-commit hook (`scripts/setup_hooks.sh`) that runs `verify_manifest_fresh.ts` and blocks commits when the manifest is stale. For embedding storage, replace flat files with a SQLite database using `sqlite-vss` extension — enabling incremental updates (only re-embed changed chunks) rather than full regeneration on every change.

---

## Summary Priority Matrix

| #       | Weakness                                                                  | Severity | Effort    | Priority |
| ------- | ------------------------------------------------------------------------- | -------- | --------- | -------- |
| **W2**  | `AgentExecutor` stub — LLM describes changes, doesn't execute them        | Critical | High      | **P0**   |
| **W7**  | No global prompt budget coordinator — silent context window overflow      | High     | Medium    | **P1**   |
| **W1**  | Semantic search gated to Team+; Solo has crude keyword fallback           | High     | Medium    | **P1**   |
| **W8**  | No real-time execution feedback — no streaming, no heartbeat              | High     | Medium    | **P1**   |
| **W13** | No flow-level error recovery, fallback steps, or checkpointing            | High     | Medium    | **P1**   |
| **W4**  | `SkillsService` never invoked — procedural memory disconnected            | Medium   | Low       | **P2**   |
| **W5**  | Memory approval bottleneck — PENDING learnings never get promoted         | Medium   | Low       | **P2**   |
| **W10** | Plan approval has no TTL, stale-context detection, or reminders           | Medium   | Low       | **P2**   |
| **W11** | Portal knowledge invalidation is time-based, not change-based             | Medium   | Low       | **P2**   |
| **W12** | ReflexiveAgent: no convergence detection, no adaptive iteration budget    | Medium   | Low       | **P2**   |
| **W15** | Token/cost not persisted per request; optimization impossible             | Medium   | Medium    | **P2**   |
| **W3**  | File-based API — no synchronous RPC, no push notification                 | Medium   | Medium    | **P2**   |
| **W14** | Single-portal-per-flow constraint blocks multi-service workflows          | Medium   | High      | **P2**   |
| **W6**  | `identities/`+`agents/` dual-path technical debt, dual `IBlueprint` types | Low      | Low       | **P3**   |
| **W16** | `.copilot/` knowledge base committed to git — stale artifact risk         | Low      | Low       | **P3**   |
| **W9**  | Deno runtime limits npm ecosystem reach and contribution barrier          | Low      | Very High | **P3**   |

---

### Consolidated Remediation Roadmap

## Sprint 1 — Correctness blockers

- W2: Complete MCP subprocess spawning in `AgentExecutor` (the critical P0 TODO)
- W7: Implement `PromptBudgetAllocator` to prevent silent context overflow
- W13: Flow-level checkpointing + `onError` step handling

## Sprint 2 — High-value UX and reliability

- W1: Ollama-backed local embedding for Solo edition
- W8: SSE event bus for live execution streaming + `exactl watch <trace_id>` command
- W15: Token/cost fields in Activity Journal + `exactl log cost` CLI command

## Sprint 3 — Coherence and completeness

- W4: Wire `SkillsService.matchSkills()` into `AgentRunner` prompt construction
- W5: Confidence-based auto-approval for high-confidence agent learnings
- W11: Git-hash invalidation for portal knowledge
- W12: Inline `ConfidenceScorer` feedback inside `ReflexiveAgent` loop + convergence detection

## Sprint 4 — Architecture evolution

- W6: Deprecate `agents/` fallback path, merge `IBlueprint` types, add `exactl blueprint migrate`
- W10: Plan TTL + stale-context check before execution + pending-plan reminders
- W14: Per-step portal declarations in flow YAML + cross-portal permission type
- W3: HTTP API adapter layer over the file-based pipeline
- W16: Move `.copilot/` out of git, pre-commit hook for manifest staleness
- W9: Dockerfile + Docker Compose for zero-install Deno onboarding

## Weakness-to-Edition Mapping Matrix

Each weakness and its remediation is mapped across the three ExaIx editions (Solo 🟢 / Team 🔵 / Enterprise 🟣) using the following legend for the fix delivery column:

| Symbol         | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| ✅ Fix applies | Remediation resolves the weakness in this edition                 |
| ⚠️ Partial     | Weakness is partially mitigated; full fix requires higher edition |
| ❌ Affected    | Weakness present and unmitigated in this edition                  |
| 🔵 Upgrade     | Full fix only feasible at Team+ tier                              |
| 🟣 Upgrade     | Full fix only feasible at Enterprise tier                         |
| —              | Not applicable (feature not present in this edition)              |

---

### Matrix

| #       | Weakness                                                        | Priority | Solo 🟢 | Team 🔵    | Enterprise 🟣 | Fix Delivery Tier                                                                        | Notes                                                                                                                                                                           |
| ------- | --------------------------------------------------------------- | -------- | ------- | ---------- | ------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W2**  | `AgentExecutor` stub — LLM describes changes, not executes      | P0       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | Core execution correctness; affects all editions equally. No edition is exempt. Fix must ship to all.                                                                           |
| **W7**  | No global prompt budget coordinator                             | P1       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | Context window overflow is model-agnostic. All editions use LLMs and all are affected. `PromptBudgetAllocator` is a core service.                                               |
| **W1**  | Semantic search gated; Solo falls back to keyword scoring       | P1       | ❌      | ✅         | ✅            | 🟢 Solo fix                                                                              | Team+/Enterprise already have vector search. Fix is specifically for Solo: add Ollama-backed `nomic-embed-text` embedding provider.                                             |
| **W8**  | No real-time execution feedback                                 | P1       | ❌      | ⚠️ Partial | ✅            | 🟢 All (SSE bus) / 🔵 Web UI stream                                                      | Solo/Team get SSE event bus + `exactl watch`; Enterprise additionally benefits from Web UI streaming. Base fix ships to all.                                                    |
| **W13** | No flow-level error recovery or checkpointing                   | P1       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | Multi-step flows exist in all editions. Checkpointing and `onError` step handling is a core flow engine concern.                                                                |
| **W15** | Token/cost not persisted per request                            | P2       | ❌      | ⚠️ Partial | ✅            | 🟢 All (journal fields) / 🔵 per-user budgets / 🟣 forecasting                           | Activity Journal token fields ship to all editions. Budget enforcement and forecasting follow the existing edition-tiered cost model.                                           |
| **W4**  | `SkillsService` disconnected from execution pipeline            | P2       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | `SkillsService` is a Solo-available service. Wiring it into `AgentRunner` is a core pipeline fix for all editions.                                                              |
| **W5**  | Memory approval bottleneck — learnings accumulate as PENDING    | P2       | ❌      | ⚠️ Partial | ✅            | 🟢 All (confidence auto-approve) / 🔵 Team review workflow / 🟣 governance-gated approve | Solo gets confidence-based auto-approval. Team gets multi-user review queue. Enterprise adds governance-gated mandatory review.                                                 |
| **W10** | Plan approval has no TTL or stale-context detection             | P2       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | Plan lifecycle applies identically across all editions. TTL + stale-context check is a `PlanExecutor` concern, edition-independent.                                             |
| **W11** | Portal knowledge invalidated by time, not by git change         | P2       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | All editions mount portals and run knowledge analysis. Git-hash invalidation is a universal improvement.                                                                        |
| **W12** | ReflexiveAgent — no convergence detection or adaptive iteration | P2       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | `ReflexiveAgent` is available in all editions. Inline `ConfidenceScorer` feedback and convergence detection is core service logic.                                              |
| **W3**  | File-based API — no synchronous RPC path                        | P2       | ❌      | ⚠️ Partial | ✅            | 🟢 All (HTTP adapter) / 🔵 Web UI + MCP server / 🟣 Enterprise API gateway               | Solo gets a thin local HTTP adapter. Team adds MCP server mode and Web UI. Enterprise adds API gateway and auth.                                                                |
| **W14** | Single-portal-per-flow constraint                               | P2       | —       | ❌         | ❌            | 🔵 Team+                                                                                 | Multi-portal collaboration is inherently a Team+ concern. Solo is single-user and multi-portal flows require RBAC for cross-portal permission grants, which is a Team+ feature. |
| **W6**  | `identities/`+`agents/` dual-path; dual `IBlueprint` types      | P3       | ❌      | ❌         | ❌            | 🟢 All                                                                                   | Blueprint loading is shared infrastructure. Migration tooling (`exactl blueprint migrate`) ships to all. Deprecation warnings affect all.                                       |
| **W16** | `.copilot/` knowledge base committed to git                     | P3       | ❌      | ❌         | ❌            | 🟢 All (dev tooling)                                                                     | This is a developer/contributor concern, not a runtime concern. Pre-commit hooks and `.gitignore` change affects the repository regardless of edition.                          |
| **W9**  | Deno runtime limits ecosystem reach                             | P3       | ❌      | ⚠️ Partial | ⚠️ Partial    | 🟢 All (Docker) / 🔵 Team CI templates                                                   | Dockerfile + Compose ships to all editions. Team edition adds CI/CD pipeline templates for common platforms. Enterprise adds pre-validated container images.                    |

---

### Edition Impact Summary

| Edition           | Weaknesses Fully Affecting                                            | Weaknesses Partially Affecting | Weaknesses Not Applicable |
| ----------------- | --------------------------------------------------------------------- | ------------------------------ | ------------------------- |
| **Solo 🟢**       | W1, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12, W13, W15, W16 (15) | —                              | W14 (multi-portal)        |
| **Team 🔵**       | W2, W4, W6, W7, W9, W10, W11, W12, W13, W14 (10)                      | W3, W5, W8, W15, W16 (5)       | —                         |
| **Enterprise 🟣** | W2, W4, W6, W7, W10, W11, W12, W13, W14 (9)                           | W3, W5, W8, W9, W15, W16 (6)   | —                         |

**Key observation:** W2 (the `AgentExecutor` stub) and W7 (no prompt budget coordinator) are the only P0/P1 weaknesses that affect **all three editions equally and fully** — they are core architectural gaps with no edition-tier mitigation path. They must be treated as global blockers regardless of commercial positioning. All other weaknesses either have partial edition-tiered mitigations already in place or are addressable incrementally within existing edition boundaries.
