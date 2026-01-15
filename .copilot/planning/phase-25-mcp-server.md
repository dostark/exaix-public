# Phase 25: MCP Server Completion

**Goal:** Implement high-level ExoFrame domain tools (Create Request, List Plans, Approve, Query Journal) for the MCP server.

## Overview

We have implemented the MCP Foundation (Server, Transport) and FileSystem/Git tools (Phase 13/Foundation). This phase focuses on exposing the core ExoFrame logic to AI agents.

### Step 25.1: Domain Tools Implementation

**Goal:** Allow agents to perform ExoFrame actions.

**New Tools:**
1.  `exoframe_create_request`: Create a new request file.
2.  `exoframe_list_plans`: List pending plans.
3.  `exoframe_approve_plan`: Approve a plan by ID.
4.  `exoframe_query_journal`: Query the Activity Journal.

**Implementation Plan:**
- [x] Create `src/mcp/domain_tools.ts`
- [x] Implement `ToolHandler` for each domain tool.
- [x] Register tools in `src/mcp/server.ts`.

### Step 25.2: Configuration & Security

**Goal:** Ensure generic configuration and permission handling.

**Updates:**
- [x] Use `exo.config.toml` for enabling/disabling tools (refer to [src/config/schema.ts](file:///home/dkasymov/git/ExoFrame/src/config/schema.ts)).
- [x] Enforce `agent_id` tracking for all tool calls.

### Step 25.3: Verification

**Tests:**
- [x] Unit tests for domain tools (mocking `RequestCommands` and `PlanCommands`).
- [x] Integration tests via `exoctl mcp start`.

**Documentation:**
- [x] Provide `claude_desktop_config.json` example (moved to `templates/mcp/`).
- [x] Provide `cline_settings.json` example (moved to `templates/mcp/`).

### Exit Criteria

- [x] All high-level tools implemented and registered.
- [x] Users can drive ExoFrame via Claude Desktop / Cline.
- [x] Activity Journal logs all high-level actions.

---

## Original Phase 13 Plan (Reference)

**Duration:** 1-2 weeks\
**Prerequisites:** Phases 1–12 (All core features complete, Obsidian retired)\
**Goal:** Add Model Context Protocol (MCP) server interface for programmatic ExoFrame interaction

### Step 13.1: MCP Server Foundation ✅ COMPLETED

**Implementation:**

```typescript
// src/mcp/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// ... (Implementation details omitted for brevity, see src/mcp/server.ts)
```

**Success Criteria:**

1. [x] MCP server starts via `exoctl mcp start`
2. [x] Server exposes standard MCP capabilities
3. [x] Stdio transport for local connections
4. [x] Server metadata includes name and version
5. [x] Graceful shutdown on SIGTERM

### Step 13.2: Tool Implementations

**Success Criteria:**

1. [x] `exoframe_create_request` creates request files
2. [x] `exoframe_list_plans` returns pending plans
3. [x] `exoframe_approve_plan` approves plans
4. [x] `exoframe_query_journal` queries Activity Journal
5. [x] All operations logged to Activity Journal
6. [x] Error responses follow MCP error schema

### Step 13.3: Client Integration Examples

**Success Criteria:**

1. [x] Documentation for Claude Desktop setup (see `templates/mcp/claude_desktop_config.json`)
2. [x] Documentation for Cline/IDE integration (see `templates/mcp/cline_settings.json`)
3. [x] Example prompts for using MCP tools
4. [x] Troubleshooting guide for MCP connections

### Step 13.4: Testing & Documentation

**Test Coverage:**

```typescript
// tests/mcp/server_test.ts
// ... (See tests/mcp/domain_tools_test.ts for actual implementation)
```

**Success Criteria:**

1. [x] Unit tests for all MCP tools
2. [x] Integration test with MCP client
3. [x] Documentation in User Guide
4. [x] Architecture diagram updated
5. [x] Example repository with MCP configurations

### Phase 13 Benefits

**For Users:**

- Automate ExoFrame workflows from AI assistants
- Integrate with existing IDE agents
- Programmatic access without learning CLI

**For Developers:**

- Standard MCP protocol (no custom API)
- Local-first (no cloud dependencies)
- Full audit trail in Activity Journal
- Complements file-based architecture

### Phase 13 Exit Criteria

- [x] MCP server implemented with stdio transport
- [x] All core tools implemented (create, list, approve, query)
- [x] Activity Journal logging for all MCP operations
- [x] Integration tests with MCP client
- [x] Documentation for Claude Desktop setup
- [x] Documentation for IDE integration
- [x] Example configurations repository
- [x] User Guide updated with MCP section
