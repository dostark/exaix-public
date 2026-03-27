# Exaix Glossary

Single source of truth for **kernel** and other critical names used in Exaix.
This file defines how terms are used across CLI, blueprints, flows, journal,
MCP and internal services.

---

## Core Execution Concepts

### Identity

Configured LLM persona/blueprint that Exaix can run to perform work on behalf of
a user, service, or flow step. Lives as a markdown file under
`Blueprints/Identities/` and is referenced from requests, flows and tools by its
`identity_id`.

### Identity Blueprint

The markdown file that defines an identity: metadata, instructions, capabilities
and constraints. Located in `Blueprints/Identities/` and loaded by the
identity loader at runtime.

### Actor

Any entity that can initiate, receive, or process a request or event in Exaix:
end‑user, developer, identity instance, Exaix internal service, or external MCP
client. Actors appear in journal records (for example `actor`, `actor_type`)
and represent the **"who"** behind each action.

### Agent (Runtime Agent)

Code‑level execution unit that orchestrates one or more identities to complete a
task. An agent owns the control flow (calling identities, tools, services),
while identities provide the concrete LLM behavior. Examples: `AgentRunner`,
`FlowRunner`, `RequestRouter`.

---

## Clarifying Diagram: Actor vs Agent vs Identity

```text
+---------------------+         +-----------------+         +-------------------+
|       ACTOR         |  uses   |      AGENT      |  runs   |     IDENTITY      |
|---------------------| ------> | (runtime logic) | ----->  | (LLM persona)     |
| - user              |         | - orchestrator  |         | - instructions    |
| - service           |         | - flow engine   |         | - behavior config |
| - mcp client        |         | - router        |         | - tools access    |
+---------------------+         +-----------------+         +-------------------+

Actors are "who", agents are "how", identities are "what and with which voice".
```

---

## End‑to‑End Request Flow Diagram

```text
[ External Trigger ]
        |
        v
+---------------------+
|       ACTOR         |
| - user via CLI      |
| - mcp client        |
| - service           |
+---------------------+
        |
        | creates request (frontmatter + body)
        v
+---------------------+    resolve identity    +-----------------------+
|      REQUEST        | --------------------> |   IDENTITY REGISTRY   |
| - frontmatter       |                        | Blueprints/Identities/|
|   - identity        |                        +-----------------------+
+---------------------+                                  |
        |                                                 v
        | dispatch                              +-------------------+
        v                                       |     IDENTITY      |
+---------------------+  orchestrate using      | (LLM persona)     |
|       AGENT         | ----------------------> +-------------------+
| - type (flow, tool) |
| - execution logic   |  logs progress and results
+---------------------+ --------+
        |                       v
        | execute steps  +---------------------+
        v                |       JOURNAL       |
+---------------------+  | - actor             |
|  TOOLS / SERVICES   |  | - actor_type        |
| (memory, tools, ..) |  | - agent_id          |
+---------------------+  | - agent_kind        |
                         | - identity_id        |
                         | - request/flow ids   |
                         +---------------------+
```

---

## Requests and Frontmatter

### Request

Top‑level unit of work submitted to Exaix via CLI, MCP or other integrations.
A request has frontmatter (YAML), optional body content and is processed into
one or more agent executions that run identities.

### Request Frontmatter

YAML metadata block at the top of a request file that configures how Exaix
should process the request. Includes keys such as `identity`, `flow_id`, and
execution options, validated by Zod schemas.

### `identity` (request frontmatter)

Name or ID of the identity to use when handling the request. Exaix resolves
this to an identity blueprint and passes it to the appropriate agent for
execution.

---

## Blueprints and Flows

### Blueprint

Configuration file that defines behavior for Exaix: identities, flows, tools
and other structured behaviors. Identity blueprints live under
`Blueprints/Identities/`, flow blueprints under `Blueprints/Flows/`.

### Identity Directory (`Blueprints/Identities/`)

Canonical directory where identity blueprints are stored and resolved.
All identities used by flows, requests and tools must live here.

### Flow

Declarative description of a multi‑step process that Exaix executes, typically
using one or more agents that in turn run identities and tools. Flows are
defined as YAML in `Blueprints/Flows/*.yaml` and validated by shared flow
schemas.

### Flow Step

Single unit of work within a flow, mapped to a specific identity. Each step
has an `id`, `name`, `identity`, dependencies and step‑specific configuration.

### `identity` (flow step)

Required field on a flow step indicating which identity blueprint to use for
that step. The flow engine selects an appropriate agent to run the given
identity.

### Gate Evaluate

Flow block that performs a quality or acceptance check using a judge identity
and a list of criteria. Uses an `identity` field to reference the judging
identity.

---

## CLI Layer

### `exactl`

Primary CLI entrypoint for Exaix operations: creating and sending requests,
managing blueprints and flows, running validations and CI checks.

### `--identity` (CLI flag)

CLI option used to select the identity blueprint for a given request. The CLI
resolves the identity and delegates execution to the correct agent.

### `exactl blueprint identity *`

CLI subcommands for managing identity blueprints (list, create, validate, show,
delete). These commands operate only on `Blueprints/Identities/`.

---

## MCP and Integrations

### MCP Server

Exaix Model Context Protocol server that exposes tools and operations to MCP
clients. It advertises a versioned schema and surfaces tools such as
`exaix*create*request`.

### `exaix*create*request` (MCP tool)

MCP tool used by clients to create and submit Exaix requests programmatically.
Its input parameter for selecting an identity is named `identity` and maps
directly to an `identity_id`.

---

## Journal and Persistence

### Journal

Append‑only record of Exaix activity, including requests, flow steps, agent
executions and internal events. Used for debugging, auditing and regression
testing.

### Journal Actor Fields (`actor`, `actor_type`)

Fields in journal entries describing **who** performed the action.

| Field        | Type   | Meaning                                                                                                               |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `actor`      | string | Free-form identity of who acted. Format: `"user:<email>"`, `"service:<name>"`, `"mcp-client:<id>"`, `"identity:<id>"` |
| `actor_type` | string | Enumerated category of the actor: `"user"`, `"service"`, `"mcp-client"`, `"identity"`                                 |

`actor_type = "identity"` means an identity instance acted autonomously with
no human in the loop (e.g. a chained or scheduled identity call).

### Journal Agent Fields (`agent*id`, `agent*kind`)

Fields in journal entries describing **how** the work was done — which runtime
execution unit handled it.

| Field        | Type   | Meaning                                                                                              |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------- |
| `agent_id`   | string | Identifier of the runtime agent instance, e.g. `"agent-runner"`, `"flow-runner"`, `"request-router"` |
| `agent_kind` | string | Category of runtime agent: `"agent-runner"`, `"flow-agent"`, `"tool-agent"`, `"request-router"`      |

These fields are **always** about the runtime Agent, never about an identity
blueprint.

### Journal Identity Field (`identity_id`)

Field in journal entries describing **what** LLM persona was used.

| Field         | Type   | Meaning                                                                                                                                           |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity_id` | string | Canonical ID of the identity blueprint that was loaded and run for this LLM call. Matches the slug of the `.md` file in `Blueprints/Identities/`. |

---

## Code Identifiers

This section defines the exact camelCase / snake_case names used in TypeScript
interfaces, database columns and journal payloads for each core concept.

### `identity` vs `identity_id`

| Name          | Where used                                                   | Meaning                                                                                         |
| ------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `identity`    | Request frontmatter, flow YAML step, CLI flag `--identity`   | The name or slug the user/config provides to select an identity blueprint (e.g. `senior-coder`) |
| `identity_id` | TypeScript interface field, database column, journal payload | The resolved canonical identifier stored in a record after the blueprint has been looked up     |

`identity` is the **input**. `identity_id` is what the system **stores**.
They are often the same string value but play different roles.

### Actor code identifiers

| Code name    | Layer                                        | Meaning                                                                        |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `actor`      | TypeScript field, journal payload, DB column | Free-form string identifying who performed the action                          |
| `actor_type` | TypeScript field, journal payload, DB column | Enumerated category: `"user"` \| `"service"` \| `"mcp-client"` \| `"identity"` |

### Agent code identifiers

| Code name    | Layer                                        | Meaning                                                                                                       |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `agent_id`   | TypeScript field, journal payload, DB column | Identifier of the runtime agent instance that handled execution. Never holds an identity blueprint reference. |
| `agent_kind` | TypeScript field, journal payload, DB column | Category of runtime agent: `"agent-runner"` \| `"flow-agent"` \| `"tool-agent"` \| `"request-router"`         |

### Identity code identifiers

| Code name     | Layer                                        | Meaning                                                     |
| ------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `identity_id` | TypeScript field, journal payload, DB column | Canonical ID of the identity blueprint used for an LLM call |

### Complete journal record field map

Every `activity` table row and every `ILogEvent` / `IActivity` object carries
fields from all three concepts:

```text
actor        — who initiated            (Actor concept)
actor_type   — category of who          (Actor concept)
agent_id     — which runtime agent      (Agent concept)
agent_kind   — category of agent        (Agent concept)
identity_id  — which LLM blueprint      (Identity concept)
```

Not every event has all five fields populated. A CLI command with no LLM call
will have `actor` and `agent*id` but an empty `identity*id`.

### `AgentHealth` and `AgentStatus`

These describe the **runtime state** of a running Agent instance, not a static
blueprint. They are correctly named with the `Agent` prefix.

- `AgentHealth` — whether the agent process/connection is currently healthy
- `AgentStatus` — lifecycle state of a running agent (`active`, `inactive`, `error`)

These names are **not changed**.

---

## Directories and Constants

### `Blueprints/Identities/`

Directory containing all identity blueprints known to Exaix. Treated as the
single source of truth for identities.

### `Blueprints/Flows/`

Directory containing flow blueprints. Each flow step references identities by
`identity` name or `identity_id`.
