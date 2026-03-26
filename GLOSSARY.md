# Exaix Glossary

Single source of truth for **kernel** and other critical names used in Exaix.
This file defines how terms are used across CLI, blueprints, flows, journal,
MCP and internal services.

---

## Core Execution Concepts

### Identity

Configured LLM persona/blueprint that Exaix can run to perform work on behalf of
a user, service, or flow step.[page:2] Lives as a markdown file under
`Blueprints/Identities/` and is referenced from requests, flows and tools by its
`identity_id`.[page:2]

### Identity Blueprint

The markdown file that defines an identity: metadata, instructions, capabilities
and constraints.[page:2] Located in `Blueprints/Identities/` and loaded by the
identity loader at runtime.[page:2]

### Identity ID (`identity_id`)

Stable identifier of an identity blueprint, used in flows, frontmatter, MCP and
runtime.[page:2] It uniquely selects which identity should be used for a given
execution.[page:2]

### Actor

Any entity that can initiate, receive, or process a request or event in Exaix:
end‑user, developer, identity instance, Exaix internal service, or external MCP
client.[page:2] Actors appear in journal records (for example `actor_id`,
`actor_type`) and represent the “who” behind each action.[page:2]

### Agent (Runtime Agent)

Code‑level execution unit that orchestrates one or more identities to complete a
task.[page:2] An agent owns the control flow (calling identities, tools,
services), while identities provide the concrete LLM behavior.[page:2]

---

## Clarifying Diagram: Actor vs Agent vs Identity

Conceptual relationship between actor, agent and identity:

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

High‑level end‑to‑end path from external trigger to journal records:

```text
[ External Trigger ]
    |        ^
    |        |
    v        |
+---------------------+
|       ACTOR         |
|---------------------|
| - user via CLI      |
| - mcp client        |
| - service           |
+---------------------+
    |
    | creates request (frontmatter + body)
    v
+---------------------+      resolve identity      +-----------------------+
|      REQUEST        | -------------------------> |   IDENTITY REGISTRY   |
|---------------------|                            |  (Blueprints/Ident.)  |
| - id, workspace     |                            | - identity_id -> file |
| - frontmatter       |                            +-----------------------+
|   - identity        |                                      |
+---------------------+                                      v
    |                                               +-------------------+
    | dispatch                                      |     IDENTITY      |
    v                                               | (LLM persona)     |
+---------------------+    orchestrate using        +-------------------+
|       AGENT         | -----------------------------^
|---------------------|
| - type (flow, tool) | logs progress and results
| - execution logic   |-----------------------------+
+---------------------+                             |
    |                                              v
    | execute steps                        +---------------------+
    v                                      |       JOURNAL       |
+---------------------+                    |---------------------|
|  TOOLS / SERVICES   |                    | - actor_id/type     |
| (memory, tools, ..) |                    | - agent_id/kind     |
+---------------------+                    | - identity_id       |
                                           | - request/flow ids  |
                                           +---------------------+
```

---

## Requests and Frontmatter

### Request

Top‑level unit of work submitted to Exaix via CLI, MCP or other integrations.[page:2]
A request has frontmatter (YAML), optional body content and is processed into
one or more agent executions that run identities.[page:2]

### Request Frontmatter

YAML metadata block at the top of a request file that configures how Exaix
should process the request.[page:2] Includes keys such as `identity`,
`flow_id`, and execution options, validated by Zod schemas.[page:2]

### `identity` (request frontmatter)

Name or ID of the identity to use when handling the request.[page:2] Exaix
resolves this to an identity blueprint and passes it to the appropriate agent
for execution.[page:2]

---

## Blueprints and Flows

### Blueprint

Configuration file that defines behavior for Exaix: identities, flows, tools
and other structured behaviors.[page:2] Identity blueprints live under
`Blueprints/Identities/`, flow blueprints under `Blueprints/Flows/`.[page:2]

### Identity Directory (`Blueprints/Identities/`)

Canonical directory where identity blueprints are stored and resolved.[page:2]
All identities used by flows, requests and tools must live here.[page:2]

### Flow

Declarative description of a multi‑step process that Exaix executes, typically
using one or more agents that in turn run identities and tools.[page:2] Flows
are defined as YAML in `Blueprints/Flows/*.yaml` and validated by shared flow
schemas.[page:2]

### Flow Step

Single unit of work within a flow, usually mapped to a specific identity (and
implicitly to an agent implementation).[page:2] Each step has an `id`, `name`,
`identity`, dependencies and step‑specific configuration.[page:2]

### `identity` (flow step)

Required field on a flow step indicating which identity blueprint to use for
that step.[page:2] The flow engine selects an appropriate agent to run the
given identity.[page:2]

### Gate Evaluate

Flow block that performs a quality or acceptance check using a judge identity
and a list of criteria.[page:2] Uses an `identity` field to reference the
judging identity.[page:2]

---

## CLI Layer

### `exactl`

Primary CLI entrypoint for Exaix operations: creating and sending requests,
managing blueprints and flows, running validations and CI checks.[page:2]

### `--identity` (CLI flag)

CLI option used to select the identity blueprint for a given request.[page:2]
The CLI resolves the identity and delegates execution to the correct agent.[page:2]

### `exactl blueprint identity *`

CLI subcommands for managing identity blueprints (list, create, validate, show,
delete).[page:2] These commands operate only on `Blueprints/Identities/`.[page:2]

---

## MCP and Integrations

### MCP Server

Exaix Model Context Protocol server that exposes tools and operations to MCP
clients.[page:2] It advertises a versioned schema and surfaces tools such as
`exaix_create_request`.[page:2]

### `exaix_create_request` (MCP tool)

MCP tool used by clients to create and submit Exaix requests programmatically.[page:2]
Its input parameter for selecting an identity is named `identity` and maps
directly to an `identity_id`.[page:2]

---

## Journal and Persistence

### Journal

Append‑only record of Exaix activity, including requests, flow steps, agent
executions and internal events.[page:2] Used for debugging, auditing and
regression testing.[page:2]

### Journal Actor Fields (`actor_id`, `actor_type`)

Standard fields in journal entries describing who performed the action (user,
identity instance, service, MCP client, etc.).[page:2] These fields always
refer to the Actor concept.[page:2]

### Journal Agent Fields (`agent_id`, `agent_kind`)

Optional fields describing which agent implementation handled the action (for
example `flow-agent`, `tool-agent`, `request-router`).[page:2] These fields
refer to the runtime Agent concept, not to identities.[page:2]

### Journal Identity Fields (`identity_id`)

Fields describing which identity was used for a given LLM call or step.[page:2]
They always reference an identity blueprint.[page:2]

---

## Directories and Constants

### `Blueprints/Identities/`

Directory containing all identity blueprints known to Exaix.[page:2] Treated as
the single source of truth for identities.[page:2]

### `Blueprints/Flows/`

Directory containing flow blueprints.[page:2] Each flow step references
identities by `identity` name or `identity_id`.[page:2]
