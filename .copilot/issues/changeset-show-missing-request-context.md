---
title: "Enhance changeset commands to show request and plan context"
status: resolved
priority: medium
created: 2026-01-25
labels: [enhancement, cli, changeset, ux]
---

## Problem

The `exoctl changeset list` and `exoctl changeset show` commands provide minimal information about changesets, missing crucial context about the original request, plan, and flow step that created the changeset. Users cannot easily trace changesets back to their source or understand the full workflow context.

## Current State

**Changeset list** currently shows:

- Request ID (e.g., `request-039de14f`)
- Branch name (e.g., `feat/request-039de14f-abc123`)
- Files changed count
- Creation timestamp
- Shortened trace ID
- Agent ID (from git author)

**Changeset show** currently shows:

- Branch details
- File count and commit information
- Git diff
- Basic metadata

## Missing Information

1. **Request Context**: Request title, priority, creator, agent/flow that initiated it

1.
1.
1.

## Proposed Enhancement

### Changeset List Display

```yaml
📌 request-039de14f_plan: feat/request-039de14f-abc123
   status: pending
   request: "Implement user authentication system"
   plan: request-039de14f_plan (approved)
   agent: auth-agent
   portal: my-app-repo
   files: 5
   created: 2026-01-25 10:30:00
   trace: abc123...
```

### Changeset Show Display

```yaml
✅ changeset.show: request-039de14f_plan
   status: pending
   trace: abc123-def456-ghi789
   request: request-039de14f
   title: "Implement user authentication system"
   plan: request-039de14f_plan (approved)
   agent: auth-agent
   priority: high
   portal: my-app-repo
   created_by: user@company.com
   files_changed: 5
   commits: 3

   Commits:
   commit abc1234: "Add user model and validation"
   commit def5678: "Implement login endpoint"
   commit ghi9012: "Add password hashing"

   Diff:
   ...git diff output...
```

### Flow Step Information

For changesets created by flows, include:

```text
flow: user-onboarding-flow
flow_step: 2/5 (Database Setup)
```

## Implementation Requirements

1. **Enhanced Metadata Loading**: Similar to plan commands, load request and plan metadata from database

1.
1.
1.

## Database Schema Changes

Add to `changesets` table:

- `request_title` TEXT (derived from request metadata)
- `plan_id` TEXT (link to plan)
- `flow_id` TEXT (if created by flow)
- `flow_step` TEXT (step description)
- `portal_name` TEXT (explicit portal tracking)

## Files to Modify

- `src/cli/changeset_commands.ts` - Add metadata loading methods
- `src/cli/exoctl.ts` - Update display formatting
- `src/schemas/changeset.ts` - Add new fields
- `migrations/005_changeset_enhancement.sql` - Schema updates
- `src/services/changeset_registry.ts` - Update registration logic

## Testing

- Add regression tests for enhanced changeset display
- Test flow step tracking
- Verify portal context display
- Test status information display

## Priority

Medium - This is a significant UX improvement that would help users understand the complete request → plan → changeset workflow, but doesn't break existing functionality.

## Acceptance Criteria

- Changeset list shows request title, plan link, agent, and portal
- Changeset show displays complete context with links
- Flow-created changesets include step information
- Status information is clearly displayed
- All existing functionality preserved
- Comprehensive test coverage added

