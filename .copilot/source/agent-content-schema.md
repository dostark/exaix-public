---
agent: general
scope: dev
title: "Agent Content Schema Reference"
short_summary: "Standardized JSON schema for agent <content> responses with Zod validation requirements."
version: "1.0"
topics: ["agents", "schema", "json", "validation", "blueprints"]
---

This document defines the standardized JSON schema that all agent blueprints must use in their `<content>` sections. This schema is validated using Zod and ensures consistent, machine-readable output across all agents.

## Overview

All agents must respond with two XML-like tags:

1. `<thought>` - Agent's internal analysis and reasoning (see [agent-thought-standardization.md](agent-thought-standardization.md) for standardized structure)
2. `<content>` - Valid JSON object matching the PlanSchema (see below)

## Required JSON Schema

The `<content>` section must contain **valid JSON** that conforms to this exact structure:

```json
{
  "title": "Plan title (1-300 characters)",
  "description": "Detailed description of what this plan accomplishes",
  "steps": [
    {
      "step": 1,
      "title": "Step title (1-200 characters)",
      "description": "What this step does",
      "actions": [
        {
          "tool": "read_file",
          "params": {
            "path": "path/to/file.ts"
          },
          "description": "Optional description of this specific action"
        }
      ],
      "tools": ["read_file", "write_file", "run_command"],
      "successCriteria": ["Success criterion 1", "Success criterion 2"],
      "dependencies": [2, 3],
      "rollback": "How to undo this step if needed"
    }
  ],
  "estimatedDuration": "Estimated time (e.g., '2-3 hours', '1 day')",
  "risks": ["Risk 1", "Risk 2", "Risk 3"]
}
```

## Field Requirements

### Required Fields

**title** (string, 1-300 chars)

- Plan summary/goal
- Should be concise but descriptive
- Example: "Implement User Authentication System"

**description** (string, min 1 char)

- What the plan accomplishes
- Should provide context and scope
- Example: "Add JWT-based authentication with login, registration, and session management"

**steps** (array, 1-50 steps)

- Ordered list of execution steps
- Each step must have sequential step numbers (1, 2, 3...)

### Step Fields

**step** (integer, positive)

- Step number (must be sequential: 1, 2, 3...)
- Used for ordering and dependency references

**title** (string, 1-200 chars)

- Step name/summary
- Should be actionable
- Example: "Create User Schema", "Implement Password Hashing"

**description** (string, min 1 char)

- What this step does
- Should be detailed enough for implementation
- Example: "Create database migration for users table with email, password_hash, and timestamps"

### Optional Fields

**actions** (array of action objects)

- **MANDATORY for daemon execution**
- Defines specific tool invocations
- Each action specifies tool, parameters, and optional description

**tools** (array of strings)

- High-level list of tools needed for this step
- Valid values: `"read_file"`, `"write_file"`, `"run_command"`, `"list_directory"`, `"search_files"`, `"create_directory"`

**successCriteria** (array of strings)

- How to verify step completion
- Should be measurable/verifiable
- Example: `["Migration file created with proper indexes", "Schema includes unique constraint on email"]`

**dependencies** (array of integers)

- Step numbers that must complete first
- Enables parallel execution where possible
- Example: `[1, 2]` means steps 1 and 2 must complete before this step

**rollback** (string)

- How to undo this step if needed
- Should be specific and actionable
- Example: "Drop users table and remove migration file"

### Plan-Level Optional Fields

**estimatedDuration** (string)

- Time estimate for plan completion
- Should be realistic and include units
- Example: `"2-3 hours"`, `"1-2 days"`, `"1 week"`

**risks** (array of strings)

- Potential issues or concerns
- Should include mitigation strategies where possible
- Example: `["Database migration conflicts", "Third-party API rate limits"]`

## Action Schema

Actions define specific tool invocations within a step:

```json
{
  "tool": "read_file",
  "params": {
    "path": "src/user.ts",
    "startLine": 1,
    "endLine": 50
  },
  "description": "Read the user model to understand current structure"
}
```

### Supported Tools

- **read_file**: `{"path": "string", "startLine?": "number", "endLine?": "number"}`
- **write_file**: `{"path": "string", "content": "string", "encoding?": "string"}`
- **run_command**: `{"command": "string", "args?": "string[]", "cwd?": "string"}`
- **list_directory**: `{"path": "string"}`
- **search_files**: `{"query": "string", "includePattern?": "string"}`
- **create_directory**: `{"path": "string", "recursive?": "boolean"}`

## Response Format Template

Use this template in all agent blueprints:

```xml
<thought>
[Your analysis and reasoning here]
</thought>

<content>
{
  "title": "Brief plan title",
  "description": "What this plan accomplishes",
  "steps": [
    {
      "step": 1,
      "title": "First step title",
      "description": "What this step does",
      "actions": [
        {
          "tool": "read_file",
          "params": { "path": "file.ts" },
          "description": "Why this action is needed"
        }
      ],
      "successCriteria": ["How to verify success"],
      "dependencies": [],
      "rollback": "How to undo if needed"
    }
  ],
  "estimatedDuration": "Time estimate",
  "risks": ["Potential issues"]
}
</content>
```

## Zod Validation

All JSON responses are validated against `PlanSchema` from `src/schemas/plan_schema.ts`:

```typescript
import { PlanSchema } from "../schemas/plan_schema.ts";

// Validation
const result = PlanSchema.parse(jsonContent);
```

## Examples

### Simple Plan (Minimal Fields)

```json
{
  "title": "Add Error Logging",
  "description": "Implement basic error logging functionality",
  "steps": [
    {
      "step": 1,
      "title": "Create Logger Module",
      "description": "Create a new logger.ts file with error logging functions"
    }
  ]
}
```

### Complex Plan (All Fields)

```json
{
  "title": "Implement Real-Time Notification System",
  "description": "Add WebSocket-based real-time notifications with persistent storage, UI components, and comprehensive error handling",
  "steps": [
    {
      "step": 1,
      "title": "Database Schema Migration",
      "description": "Create notifications table with user_id, type, message, read status, and timestamps. Add indexes for efficient querying.",
      "tools": ["write_file"],
      "actions": [
        {
          "tool": "write_file",
          "params": {
            "path": "migrations/001_notifications.sql",
            "content": "CREATE TABLE notifications (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID NOT NULL,\n  type TEXT NOT NULL,\n  message TEXT NOT NULL,\n  is_read BOOLEAN DEFAULT false,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\nCREATE INDEX idx_notifications_user_id ON notifications(user_id);"
          }
        }
      ],
      "successCriteria": [
        "Migration file created with proper indexes",
        "Supports notification types: info, warning, error, success",
        "Includes created_at and read_at timestamps"
      ],
      "dependencies": [],
      "rollback": "DROP TABLE notifications; DELETE migration file"
    },
    {
      "step": 2,
      "title": "WebSocket Server Implementation",
      "description": "Implement WebSocket server with authentication, connection management, and message broadcasting",
      "tools": ["write_file", "run_command"],
      "successCriteria": [
        "WebSocket server accepts authenticated connections",
        "Messages are broadcast to relevant users",
        "Connection cleanup on disconnect"
      ],
      "dependencies": [1],
      "rollback": "Remove WebSocket server files and dependencies"
    }
  ],
  "estimatedDuration": "3-4 days",
  "risks": [
    "WebSocket connection scaling issues",
    "Database performance with high notification volume",
    "Browser compatibility with older WebSocket implementations"
  ]
}
```

## Migration Notes

When migrating from markdown to JSON format:

1. **Preserve `<thought>` section** - Keep agent reasoning unchanged
2. **Convert markdown structure** - Transform sections into JSON fields
3. **Map content appropriately** - Use `title`, `description`, and `steps` to represent the same information
4. **Add actions for automation** - Include specific tool invocations where possible
5. **Validate thoroughly** - Ensure JSON passes Zod validation

## Reference

- **Schema Implementation**: `src/schemas/plan_schema.ts`
- **Zod Validation**: `PlanSchema.parse(jsonContent)`
- **Tool Definitions**: `src/enums.ts` (McpToolName)
- **Migration Guide**: `.copilot/planning/phase-31-agent-blueprint-json-migration.md`
