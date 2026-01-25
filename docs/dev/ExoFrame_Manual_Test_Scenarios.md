# ExoFrame Manual Test Scenarios

- **Version:** 2.0.0
- **Release Date:** 2026-01-16
- **Status:** Active
- **Reference:** [Testing Strategy](./ExoFrame_Testing_and_CI_Strategy.md) Section 2.4

---

## Table of Contents

### Installation & Setup

- [MT-01: Fresh Installation](#scenario-mt-01-fresh-installation) - Fresh system installation verification
- [MT-02: Daemon Startup](#scenario-mt-02-daemon-startup) - Daemon initialization and health checks

### Configuration & Blueprints

- [MT-03: Blueprint Management](#scenario-mt-03-blueprint-management) - Blueprint CRUD operations and validation
- [MT-16: LLM Provider Selection](#scenario-mt-16-llm-provider-selection) - Provider configuration and selection
- [MT-28: Provider Strategy and Fallback](#scenario-mt-28-provider-strategy-and-fallback) - Intelligent provider routing and failover

### Request & Plan Lifecycle

- [MT-04: Create Request](#scenario-mt-04-create-request) - Request creation via CLI
- [MT-05: Plan Generation (Mock LLM)](#scenario-mt-05-plan-generation-mock-llm) - Automated plan generation
- [MT-06: Plan Approval](#scenario-mt-06-plan-approval) - Plan approval workflow
- [MT-07: Plan Rejection](#scenario-mt-07-plan-rejection) - Plan rejection with reason tracking
- [MT-18: Multi-Agent Flow Execution](#scenario-mt-18-multi-agent-flow-execution) - Flow-based multi-agent orchestration

### Plan Execution

- [MT-08: Plan Execution & Changeset Management](#scenario-mt-08-plan-execution--changeset-management) - End-to-end execution pipeline

### Portal & Git Management

- [MT-09: Portal Management](#scenario-mt-09-portal-management) - Portal mounting and access
- [MT-29: Git Operations and Traceability](#scenario-mt-29-git-operations-and-traceability) - Git integration and trace_id tracking
- [MT-30: CLI Flow Request Support](#scenario-mt-30-cli-flow-request-support) - CLI flow request creation and execution

### Memory & Knowledge

- [MT-17: Memory Banks Integration](#scenario-mt-17-memory-banks-integration) - Memory storage, retrieval, and context cards
- [MT-26: Activity Journal Queries](#scenario-mt-26-activity-journal-queries) - Journal querying and filtering

### Skills Management

- [MT-19: Skills Management](#scenario-mt-19-skills-management) - Skills service and TUI integration

### Security & Permissions

- [MT-27: Advanced Security Testing](#scenario-mt-27-advanced-security-testing) - Comprehensive security boundary verification

### Resilience & Error Handling

- [MT-10: Daemon Crash Recovery](#scenario-mt-10-daemon-crash-recovery) - Graceful recovery from failures
- [MT-12: Invalid Request Handling](#scenario-mt-12-invalid-request-handling) - Malformed input handling
- [MT-13: Database Corruption Recovery](#scenario-mt-13-database-corruption-recovery) - Database integrity and recovery

### Performance & Concurrency

- [MT-14: Concurrent Request Processing](#scenario-mt-14-concurrent-request-processing) - Multi-request handling
- [MT-15: File Watcher Reliability](#scenario-mt-15-file-watcher-reliability) - File system event detection

### Integration Testing

- [MT-11: Real LLM Integration](#scenario-mt-11-real-llm-integration) - Live API provider integration

### TUI Dashboard

- [MT-20: TUI Dashboard Launch and Core Views Navigation](#scenario-mt-20-tui-dashboard-launch-and-core-views-navigation) - Dashboard initialization
- [MT-21: TUI Monitor View - Log Streaming and Filtering](#scenario-mt-21-tui-monitor-view---log-streaming-and-filtering) - Real-time log monitoring
- [MT-22: TUI Plan Reviewer View - Plan Management](#scenario-mt-22-tui-plan-reviewer-view---plan-management) - Interactive plan review
- [MT-23: TUI Portal Manager View - Portal Management](#scenario-mt-23-tui-portal-manager-view---portal-management) - Portal CRUD operations
- [MT-24: TUI Daemon Control View - Daemon Management](#scenario-mt-24-tui-daemon-control-view---daemon-management) - Daemon lifecycle control
- [MT-25: TUI Request Manager View - Request Management](#scenario-mt-25-tui-request-manager-view---request-management) - Request management interface

---

## Overview

This document contains detailed manual test scenarios for ExoFrame. Each scenario includes:

- **Preconditions** — Required setup before testing
- **Steps** — Exact commands to execute
- **Expected Results** — What should happen
- **Verification** — How to confirm success
- **Cleanup** — How to reset for next test

Execute these scenarios on each target platform before major releases.

### Scenario Coverage Summary

| Category                    | Scenarios | High Risk | Medium Risk | Low Risk |
| --------------------------- | --------- | --------- | ----------- | -------- |
| Installation & Setup        | 2         | 2         | 0           | 0        |
| Configuration & Blueprints  | 3         | 0         | 3           | 0        |
| Request & Plan Lifecycle    | 5         | 4         | 1           | 0        |
| Plan Execution              | 1         | 1         | 0           | 0        |
| Portal & Git Management     | 2         | 1         | 1           | 0        |
| Memory & Knowledge          | 2         | 0         | 1           | 1        |
| Skills Management           | 1         | 0         | 0           | 1        |
| Security & Permissions      | 1         | 1         | 0           | 0        |
| Resilience & Error Handling | 3         | 2         | 1           | 0        |
| Performance & Concurrency   | 2         | 0         | 2           | 0        |
| Integration Testing         | 1         | 0         | 1           | 0        |
| TUI Dashboard               | 6         | 2         | 4           | 0        |
| **Total**                   | **30**    | **13**    | **15**      | **2**    |

### Testing Recommendations

- **High Risk scenarios (13):** Must pass before release
- **Medium Risk scenarios (15):** Should pass, known issues must be documented
- **Low Risk scenarios (2):** Optional for minor releases

**Estimated Full Suite Duration:** 6-8 hours (with manual TUI interaction)

### Version History

- **v2.1.0 (2026-01-21):** Added MT-30 covering CLI Flow Request Support for Phase 30 implementation.
- **v2.0.0 (2026-01-16):** Added 13 new scenarios (MT-17 through MT-29) covering Memory Banks, Multi-Agent Flows, Skills, Security, Provider Strategy, Activity Journal, and Git operations. Added risk-based categorization and testing recommendations.
- **v1.7.0 (2025-12-02):** Previous version with 16 core scenarios and 6 TUI scenarios.

### Important Notes

**MockLLMProvider Behavior:** The default MockLLMProvider automatically initializes with default pattern fallbacks when no recordings are provided. This means scenarios using the mock provider (MT-05, MT-08) will successfully generate plans without requiring pre-recorded responses. The provider logs "falling back to pattern matching" which is expected and normal behavior.

---

## Test Environment Setup

### Prerequisites

```bash
# Verify Deno is installed (v2.x required)
deno --version

# Clone ExoFrame repository (if fresh install test)
git clone https://github.com/dostark/exoframe.git
cd exoframe

# Or use existing workspace
cd ~/ExoFrame
```

### Environment Variables

```bash
# For tests using real LLM (scenario MT-10)
export ANTHROPIC_API_KEY="your-api-key"
# OR
export OPENAI_API_KEY="your-api-key"
```

---

## Scenario MT-01: Fresh Installation

**Purpose:** Verify ExoFrame can be installed and initialized on a clean system.

### Preconditions

- Fresh system or clean user account
- Deno v2.x installed
- No existing ExoFrame installation

### Steps

```bash
# Step 1: Clone the repository
git clone https://github.com/dostark/exoframe.git
cd exoframe

# Step 2: Deploy workspace using the deploy script (recommended)
./scripts/deploy_workspace.sh ~/ExoFrame

# Step 3: Navigate to workspace and verify CLI
cd ~/ExoFrame
exoctl --help
```

### Expected Results

**Step 1:**

- Repository cloned successfully
- All files present in `exoframe/` directory

**Step 2:**

- Deploy script completes without errors
- Creates runtime folders (`System`, `Memory`, `Workspace`, `Portals`, `.exo`)
- Copies runtime artifacts to target workspace
- Runs `deno task cache` and `deno task setup` automatically
- Installs `exoctl` CLI globally to `~/.deno/bin/`

**Step 3:**

- Shows available exoctl commands
- Should include: `daemon`, `request`, `plan`, `blueprint`, `portal`, etc.

### Verification

```bash
# Check directory structure was created
ls -la ~/ExoFrame/
# Expected: Blueprints/ Workspace/ Memory/ Portals/ .exo/

# Check config file exists
cat ~/ExoFrame/exo.config.toml

# Verify exoctl is installed
exoctl --help
```

### Pass Criteria

- [ ] All directories created (Blueprints, Workspace, Memory, Portals, .exo)
- [ ] Config file exists and is valid TOML
- [ ] Database initialized (`.exo/journal.db`)
- [ ] `exoctl` CLI accessible
- [ ] No error messages during setup

---

## Scenario MT-02: Daemon Startup

**Purpose:** Verify the daemon starts correctly and creates required resources.

### Preconditions

- ExoFrame installed (MT-01 complete)
- No daemon currently running

### Steps

```bash
# Step 1: Navigate to workspace
cd ~/ExoFrame

# Step 2: Start daemon in foreground (for visibility)
exoctl daemon start

# Step 3: Wait for startup (2-3 seconds)
sleep 3

# Step 4: Check daemon status
exoctl daemon status
```

### Expected Results

**Step 2:**

- Daemon starts without errors
- Output shows: "ExoFrame daemon started"
- Shows watching directories

**Step 3:**

- No crash or error messages

**Step 4:**

- Shows daemon is running with status info
- Shows PID and uptime

### Verification

```bash
# Check process is running
pgrep -f "exoframe" || ps aux | grep exoframe

# Check database was created
ls -la ~/ExoFrame/.exo/journal.db

# Check log output
tail -20 ~/ExoFrame/.exo/daemon.log
```

### Cleanup

```bash
# Stop the daemon
exoctl daemon stop
# OR kill the process
pkill -f "exoframe"
```

### Pass Criteria

- [ ] Daemon process running
- [ ] Database file created
- [ ] `exoctl daemon status` shows "Running"
- [ ] No error messages in logs

---

## Scenario MT-03: Blueprint Management

**Purpose:** Verify blueprint creation, validation, editing, and removal work correctly.

### Preconditions

- ExoFrame workspace deployed at `~/ExoFrame`
- Database initialized
- No existing test blueprints

### Steps

````bash
# Step 1: List existing blueprints (should be empty or only defaults)
cd ~/ExoFrame
exoctl blueprint list

# Step 2: Create a blueprint from scratch
exoctl blueprint create test-agent \
  --name "Test Agent" \
  --model "ollama:codellama:13b" \
  --description "Test agent for manual scenarios"

# Step 3: Create a blueprint using template
exoctl blueprint create coder-test \
  --name "Test Coder" \
  --template coder

# Step 4: List blueprints again
exoctl blueprint list

# Step 5: Show blueprint details
exoctl blueprint show coder-test

# Step 6: Validate blueprint
exoctl blueprint validate coder-test

# Step 7: Create blueprint with custom system prompt
cat > /tmp/custom-prompt.txt << 'EOF'
# Custom Test Agent

You are a test agent.

## Output Format

\```xml
<thought>
Test reasoning
</thought>

<content>
Test content
</content>
\```
EOF

exoctl blueprint create custom-test\
--name "Custom Test"\
--model "mock:test-model"\
--system-prompt-file /tmp/custom-prompt.txt

# Step 8: Validate custom blueprint

exoctl blueprint validate custom-test

# Step 9: Create an invalid blueprint manually

cat > ~/ExoFrame/Blueprints/Agents/invalid-test.md << 'EOF'
+++
name = "Missing agent_id"
model = "ollama:llama3.2"
+++

Invalid blueprint without agent_id
EOF

# Step 10: Try to validate invalid blueprint

exoctl blueprint validate invalid-test

# Step 11: Test reserved name rejection

exoctl blueprint create system\
--name "System Agent"\
--model "ollama:llama3.2" 2>&1 || echo "Expected: Reserved name rejected"

# Step 12: Test duplicate rejection

exoctl blueprint create test-agent\
--name "Duplicate Test"\
--model "ollama:llama3.2" 2>&1 || echo "Expected: Duplicate rejected"

# Step 13: Test edit command (requires EDITOR)

export EDITOR="cat" # Use cat to just display without editing
exoctl blueprint edit test-agent

# Step 14: Use blueprint in a request

exoctl blueprint create mock-agent --name "Mock Agent" --template mock
exoctl request "Test request for manual scenario" --agent mock-agent

# Step 15: Remove blueprints

```bash
exoctl blueprint remove custom-test --force
exoctl blueprint remove coder-test --force
exoctl blueprint remove mock-agent --force
exoctl blueprint remove test-agent --force
exoctl blueprint remove invalid-test --force
```

### Expected Results

**Step 1:**

- Shows list of blueprints (may be empty)
- No errors

**Step 2:**

- Blueprint created successfully
- File created at `~/ExoFrame/Blueprints/Agents/test-agent.md`
- Success message with path shown
- Activity logged

**Step 3:**

- Blueprint created with coder template defaults
  --model "anthropic:claude-3-5-sonnet-20241022"
- Capabilities include `code_generation`

**Step 4:**

- Shows both `test-agent` and `coder-test`
- Displays model and capabilities for each

**Step 5:**

- Shows full blueprint details
- Displays: agent_id, name, model, capabilities, created, created_by, version
- Shows full system prompt content

**Step 6:**

- Validation passes
- Shows: "Blueprint 'test-agent' is valid"
- Lists validation checks passed (frontmatter, fields, tags)

**Step 7:**

- Blueprint created with custom system prompt from file
- File content matches custom-prompt.txt

**Step 8:**

- Validation passes
- Confirms `<thought>` and `<content>` tags present

**Step 9:**

- Invalid blueprint file created manually

**Step 10:**

- Validation fails
- Error mentions missing `agent_id` field
- Lists validation errors clearly

**Step 11:**

- Command fails with error
- Error message: "'system' is a reserved agent_id"
- Lists reserved names

**Step 12:**

- Command fails with error
- Error message: "Blueprint 'test-agent' already exists"
- Suggests using `exoctl blueprint edit` instead

**Step 13:**

- Opens blueprint in $EDITOR (or displays with cat)
- Shows full blueprint content

**Step 14:**

- Request created successfully
- Uses mock-agent blueprint
- Request file references mock-agent in frontmatter

**Step 15:**

- All blueprints removed successfully
- Files deleted from Blueprints/Agents/
- Activity logged for each removal

### Verification

```bash
# Check blueprint files were created
ls -la ~/ExoFrame/Blueprints/Agents/
# Expected: test-agent.md, coder-test.md, custom-test.md, mock-agent.md, invalid-test.md

# Check TOML frontmatter format
head -20 ~/ExoFrame/Blueprints/Agents/test-agent.md
# Expected: Starts with +++, has TOML fields, ends with +++

# Check system prompt from file was loaded
grep "Custom Test Agent" ~/ExoFrame/Blueprints/Agents/custom-test.md
# Expected: Custom prompt content present

# Check Activity Journal logged blueprint operations
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE 'blueprint.%' ORDER BY timestamp DESC LIMIT 10;"
exoctl journal --filter action_type=blueprint.% --tail 10
# Expected: blueprint.created, blueprint.edited, blueprint.removed entries

# Verify blueprints were removed
ls ~/ExoFrame/Blueprints/Agents/*.md 2>/dev/null | grep -E "(test-agent|coder-test|custom-test|mock-agent)" || echo "All test blueprints removed"
# Expected: No test blueprint files remain

# Check request was created with custom agent
cat ~/ExoFrame/Workspace/Requests/request-*.md | grep "mock-agent"
# Expected: Request references mock-agent
````

### Cleanup

```bash
# Remove any remaining test blueprints
rm -f ~/ExoFrame/Blueprints/Agents/test-agent.md
rm -f ~/ExoFrame/Blueprints/Agents/coder-test.md
rm -f ~/ExoFrame/Blueprints/Agents/custom-test.md
rm -f ~/ExoFrame/Blueprints/Agents/mock-agent.md
rm -f ~/ExoFrame/Blueprints/Agents/invalid-test.md

# Remove custom prompt file
rm -f /tmp/custom-prompt.txt

# Remove test request
rm -f ~/ExoFrame/Workspace/Requests/request-*.md

# Reset EDITOR
unset EDITOR
```

### Pass Criteria

- [ ] `exoctl blueprint list` shows all blueprints
- [ ] `exoctl blueprint create` generates valid TOML frontmatter
- [ ] Template system applies correct defaults (model, capabilities)
- [ ] `--system-prompt-file` loads content from file
- [ ] `exoctl blueprint show` displays full blueprint
- [ ] `exoctl blueprint validate` detects schema errors
- [ ] Validation requires `<thought>` and `<content>` tags
- [ ] Reserved names (`system`, `test`) are rejected
- [ ] Duplicate agent_id names are rejected
- [ ] `exoctl blueprint edit` opens in $EDITOR
- [ ] Blueprints can be used in `exoctl request --agent`
- [ ] `exoctl blueprint remove` deletes files
- [ ] All operations logged to Activity Journal
- [ ] Invalid frontmatter detected during validation
- [ ] Clear error messages for all failure cases

---

## Scenario MT-04: Create Request

**Purpose:** Verify request creation via CLI works correctly.

### Preconditions

- Daemon running (MT-02 complete)
- Default blueprint available (may have been removed in MT-03 cleanup)

### Steps

```bash
# Step 1: Create mock blueprint (if not exists)
exoctl blueprint create mock-agent \
  --name "Mock Agent" \
  --template mock

# Step 2: Create a simple request using mock agent
exoctl request "Add a hello world function to utils.ts" --agent mock-agent

# Step 3: List requests
exoctl request list

# Step 4: Verify request file
ls -la ~/ExoFrame/Workspace/Requests/
```

### Expected Results

**Step 1:**

- Blueprint created successfully (or already exists message)
- Mock agent available for requests

**Step 2:**

- Command completes successfully
- Shows trace ID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Shows file path created (e.g., `request-a1b2c3d4.md`)

**Step 3:**

- Lists the created request
- Shows status: `pending`
- Shows trace ID

**Step 4:**

- Request file exists with `.md` extension
- Filename format: `request-<trace-id-prefix>.md`

### Verification

```bash
# Read the request file
cat ~/ExoFrame/Workspace/Requests/request-*.md

# Expected content (YAML frontmatter):
# ---
# trace_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
# created: "2025-12-01T10:00:00.000Z"
# status: pending
# priority: normal
# agent: mock-agent
# source: cli
# created_by: "user@example.com"
# ---
#
# # Request
#
# Add a hello world function to utils.ts
```

### Cleanup

```bash
# Remove test request if not proceeding to MT-05
rm -f ~/ExoFrame/Workspace/Requests/request-*.md
```

### Pass Criteria

- [ ] Request file created in `Workspace/Requests/`
- [ ] Valid YAML frontmatter with trace_id
- [ ] Request content matches input
- [ ] `exoctl request list` shows the request

---

## Scenario MT-05: Plan Generation (Mock LLM)

**Purpose:** Verify the daemon generates a plan from a request using mock LLM.

### Preconditions

- Daemon running with mock LLM (requires `EXO_LLM_PROVIDER=mock` or config)
- Request created (MT-04 complete)

**Note:** MockLLMProvider automatically initializes with default pattern fallbacks when no recordings are provided, so it will generate valid plans without requiring pre-recorded responses.

### Steps

```bash
# Step 1: Verify daemon is running
exoctl daemon status

# Step 2: Create a mock blueprint (if not exists)
exoctl blueprint create mock-agent \
  --name "Mock Agent" \
  --template mock

# Step 3: Create request using mock agent
exoctl request "Add a hello world function to utils.ts" --agent mock-agent

# Step 4: Wait for plan generation
sleep 5
exoctl plan list

# Step 5: View the generated plan
exoctl plan show <plan-id>

# Step 6: Verify plan file
ls -la ~/ExoFrame/Workspace/Plans/
```

### Expected Results

**Step 1:**

- Daemon status shows "Running"
- If not running, start with: `EXO_LLM_PROVIDER=mock exoctl daemon start`

**Step 2:**

- Mock blueprint created successfully
- Or shows "already exists" if previously created

**Step 3:**

- Request created successfully
- Shows trace_id and file path

**Step 4:**

- Shows plan in list with `status: review`
- Plan generated using default pattern fallback

**Step 5:**

- Shows plan details including proposed steps and request ID
- Plan content includes standard sections (Overview, Steps, Expected Outcome)

**Step 6:**

- Plan file exists in `Workspace/Plans/` with format `<request-id>_plan.md`

### Verification

```bash
# Read the plan file
cat ~/ExoFrame/Workspace/Plans/*_plan.md

# Expected structure with YAML frontmatter:
# ---
# trace_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
# request_id: "request-a1b2c3d4"
# status: review
# created_at: "2025-12-01T10:01:00.000Z"
# ---
#
# # Plan: request-a1b2c3d4
#
# ## Summary
#
# Based on the request, I will implement the required functionality.
#
# ## Reasoning
#
# I need to analyze the request and create a plan for implementation.
#
# ## Proposed Plan
#
# Based on the request, I will implement the required functionality.
#
# ## Step 1: Analyze Requirements
# Review the request and identify key requirements for the implementation.
#
# ## Step 2: Design Solution
# Create a technical design for the implementation, considering architecture and patterns.
#
# ## Step 3: Implement Code
# Write the necessary code changes to implement the feature.
#
# ## Step 4: Write Tests
# Add unit tests to verify the implementation works correctly.
#
# ## Step 5: Review
# Self-review the changes for quality and ensure all requirements are met.
#
# ### Files to Modify
# - src/feature.ts (new file)
# - tests/feature_test.ts (new file)
#
# ### Expected Outcome
# The feature will be implemented and tested according to requirements.
```

### Troubleshooting

If no plans are generated after 30 seconds:

```bash
# Check daemon logs for errors
tail -50 ~/ExoFrame/.exo/daemon.log

# Look for processing errors
grep -i "request.*processing\|plan.*generated\|error" ~/ExoFrame/.exo/daemon.log | tail -10

# Check if request processor is running
grep -i "watcher\|detected" ~/ExoFrame/.exo/daemon.log | tail -20

# Verify request file is valid YAML
cat ~/ExoFrame/Workspace/Requests/request-*.md

# Check request status
cat ~/ExoFrame/Workspace/Requests/request-*.md | grep "^status:"

# Try restarting daemon
exoctl daemon stop
exoctl daemon start
sleep 5
exoctl plan list
```

**Common Issues:**

1. **Plan not generated** - Check that:
   - Daemon is running (`exoctl daemon status`)
   - Request file has valid YAML frontmatter
   - Blueprint file exists for the specified agent
   - No errors in daemon logs

2. **Request marked as failed** - Check daemon logs for:
   - Blueprint not found errors
   - LLM provider errors
   - File system permission issues

3. **MockLLMProvider logs "No exact recording found"** - This is expected and normal behavior. The provider automatically falls back to default pattern matching and generates a valid plan.

### Pass Criteria

- [ ] Plan generated within 30 seconds
- [ ] Plan linked to original request (matching trace_id)
- [ ] Plan contains steps in `## Step N: Title` format (required for execution)
- [ ] Plan includes Reasoning and Proposed Plan sections
- [ ] Plan file uses YAML frontmatter format
- [ ] MockLLMProvider logs show "falling back to pattern matching" (expected)
- [ ] Request status updated to "planned"

---

## Scenario MT-06: Plan Approval

**Purpose:** Verify plan approval workflow moves plan to active state.

### Preconditions

- Plan exists in review status (MT-05 complete)

### Steps

```bash
# Step 1: List plans in review
exoctl plan list --status review

# Step 2: Approve the plan
exoctl plan approve <plan-id>

# Step 3: Verify plan moved
exoctl plan list --status approved
ls -la ~/ExoFrame/Workspace/Active/
```

### Expected Results

**Step 1:**

- Shows plan(s) awaiting review

**Step 2:**

- Confirmation message
- Shows plan status changed to `approved`

**Step 3:**

- Plan appears in approved list
- Plan file moved to `Workspace/Active/`

### Verification

```bash
# Check plan is no longer in Workspace
ls ~/ExoFrame/Workspace/Plans/ | grep "_plan.md"  # Should be empty

# Check plan is in Active
ls ~/ExoFrame/Workspace/Active/ | grep "_plan.md"  # Should show file

# Read moved plan file
cat ~/ExoFrame/Workspace/Active/*_plan.md
# YAML frontmatter should show:
# ---
# status: approved
# ---
```

### Pass Criteria

- [ ] Plan status changed to `approved`
- [ ] Plan file moved to `Workspace/Active/`
- [ ] Original request updated

---

## Scenario MT-07: Plan Rejection

**Purpose:** Verify plan rejection workflow archives the plan.

### Preconditions

- Fresh request and plan (create new ones)
- Plan in review status

### Steps

```bash
# Step 1: Create a new request
exoctl request "Create a test feature"

# Step 2: Wait for plan generation
sleep 5
exoctl plan list --status review

# Step 3: Reject the plan with reason
exoctl plan reject <plan-id> --reason "Needs different approach"

# Step 4: Verify plan archived
exoctl plan list --status rejected
ls -la ~/ExoFrame/Workspace/Archive/
```

### Expected Results

**Step 3:**

- Confirmation message
- Shows plan status: `rejected`

**Step 4:**

- Plan appears in rejected list
- Plan file in `Workspace/Archive/`

### Verification

```bash
# Read archived plan
cat ~/ExoFrame/Workspace/Archive/*_plan.md 2>/dev/null || \
cat ~/ExoFrame/Workspace/Plans/*_rejected.md 2>/dev/null

# YAML frontmatter should contain:
# ---
# status: rejected
# rejection_reason: Needs different approach
# ---
```

### Pass Criteria

- [ ] Plan status changed to `rejected`
- [ ] Plan moved to `Workspace/Archive/`
- [ ] Rejection reason recorded

---

## Scenario MT-08: Plan Execution & Changeset Management

**Purpose:** Verify complete plan execution flow via Plan Executor service, changeset creation, and approval/rejection workflow.

**Status:** ✅ **IMPLEMENTED** - Full plan execution via PlanExecutor with ReAct-style loop, ToolRegistry security, and git management.

### Preconditions

- Daemon running (MT-02 complete)
- Agent blueprint exists (MT-03 complete - create `senior-coder` or use `mock` blueprint)
- At least one plan approved (MT-05, MT-06, MT-07 complete)

### Part A: Agent Blueprint Setup

```bash
# Step 1: Create senior-coder blueprint (if not exists)
exoctl blueprint create senior-coder \
    --name "Senior Coder" \
    --model ollama:codellama:7b-instruct \
    --template coder

# OR use mock blueprint for testing
exoctl blueprint create mock \
    --name "Mock Agent" \
    --model mock:test-model \
    --template mock

# Step 2: Verify blueprint exists
exoctl blueprint list
exoctl blueprint show senior-coder
```

### Part B: Portal Security Configuration

```bash
# Step 1: Configure portal (security is enforced by ToolRegistry path validation)
cat >> ~/ExoFrame/exo.config.toml << EOF
[[portals]]
alias = "TestApp"
target_path = "/tmp/test-portal"
# Note: Current ToolRegistry allows access to all portals if mounted
EOF

# Step 2: Create test portal directory with git repo
mkdir -p /tmp/test-portal/src
cd /tmp/test-portal
git init
echo "# Test App" > README.md
echo "export const version = '1.0';" > src/index.ts
git add .
git commit -m "Initial commit"

# Step 3: Mount portal in ExoFrame
cd ~/ExoFrame
exoctl portal add /tmp/test-portal TestApp

# Step 4: Verify portal configuration
exoctl portal list
exoctl portal show TestApp
```

### Part C: Plan Execution (Happy Path)

```bash
# Step 1: Create request targeting the portal
exoctl request "Add hello world function to src/utils.ts" \
    --agent senior-coder \
    --portal TestApp

# Step 2: Wait for plan generation (daemon processes request)
sleep 5

# Step 3: List and show generated plan
exoctl plan list
exoctl plan show <plan-id>

# Step 4: Approve the plan (triggers execution)
exoctl plan approve <plan-id>

# Step 5: Wait for execution
sleep 10

# Step 6: Verify changeset created
exoctl changeset list

# Expected output:
# ✅ changeset-uuid  TestApp  feat/hello-world-abc  pending
```

### Part D: Changeset Verification

```bash
# Step 1: View changeset details
exoctl changeset show <changeset-id>

# Expected output:
# Portal: TestApp
# Branch: feat/hello-world-<trace-id-prefix>
# Commit: a1b2c3d
# Files Changed: 1
# Status: pending
# Created By: senior-coder

# Step 2: View diff
exoctl changeset show <changeset-id> --diff

# Expected output:
# +++ src/utils.ts
# +export function helloWorld() {
# +  return "Hello, World!";
# +}

# Step 3: Verify git branch created in portal
cd /tmp/test-portal
git branch -a
# Should show: feat/hello-world-<trace-id-prefix>

# Step 4: Check Activity Journal for execution events
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '<trace-id>' ORDER BY timestamp DESC LIMIT 50;"
exoctl journal --filter trace_id=<trace-id>

# Expected events:
# plan.execution_started
# step.started
# action.executing (tool: write_file)
# action.completed
# step.completed
# plan.execution_completed
```

### Part E: Changeset Approval

```bash
# Step 1: Approve the changeset (merges to main)
exoctl changeset approve <changeset-id>

# Step 2: Verify merge completed
cd /tmp/test-portal
git log --oneline -5
# Should show merge commit

# Step 3: Verify file exists on main branch
cat /tmp/test-portal/src/utils.ts
# Should contain hello world function

# Step 4: Check changeset status updated
exoctl changeset show <changeset-id>
# Status should be: approved
# approved_by and approved_at should be set
```

### Part F: Changeset Rejection (Alternative Flow)

```bash
# Step 1: Create another request and wait for changeset
exoctl request "Add goodbye function" --agent senior-coder --portal TestApp
sleep 15

# Step 2: Reject the changeset with reason
exoctl changeset reject <changeset-id> --reason "Needs different approach"

# Step 3: Verify rejection recorded
exoctl changeset show <changeset-id>
# Status: rejected
# rejected_by and rejected_at should be set
# rejection_reason: "Needs different approach"

# Step 4: Verify branch deleted (optional based on implementation)
cd /tmp/test-portal
git branch -a
# Feature branch should be removed or marked
```

### Part G: Security Verification

```bash
# Step 1: Test Path Restriction
# ToolRegistry prevents access outside allowed roots (Workspace, Memory, Blueprints, Portals)

# Create a request that tries to read /etc/passwd
exoctl request "Read /etc/passwd" --agent senior-coder

# Wait for execution and check logs
sleep 10
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type = 'action.failed' ORDER BY timestamp DESC LIMIT 50;"
exoctl journal --filter action_type=action.failed

# Expected:
# Error: Access denied: Path /etc/passwd resolves to /etc/passwd, outside allowed roots

# Step 2: Test Command Whitelist
# ToolRegistry only allows whitelisted commands (echo, cat, ls, git, etc.)

# Create a request that tries to run 'rm -rf /' (dangerous command)
exoctl request "Run rm -rf /" --agent senior-coder

# Wait for execution and check logs
sleep 10
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type = 'action.failed' ORDER BY timestamp DESC LIMIT 50;"
exoctl journal --filter action_type=action.failed

# Expected:
# Error: Command 'rm' is not allowed.
```

### Part H: Git Commands Verification

```bash
# Step 1: Verify git commands available
exoctl git --help

# Step 2: List branches across portals
exoctl git branches

# Step 3: Check git status
exoctl git status

# Step 4: Search git log for trace_id
exoctl git log <trace-id>
# Should find commits with [ExoTrace: <trace-id>] footer
```

### Expected Results

**Part A (Blueprint Setup):**

- Agent blueprint created or verified
- Blueprint visible in `exoctl blueprint list`

**Part B (Portal Configuration):**

- Portal configured
- Git repo initialized in portal directory
- Portal mounted and visible in ExoFrame

**Part C (Execution):**

- Request created and plan generated
- Plan approval triggers PlanExecutor
- Changeset created with status=pending

**Part D (Verification):**

- Changeset details show correct portal, branch, commit
- Diff shows expected code changes
- Activity Journal logs execution steps (`step.started`, `action.executing`)

**Part E (Approval):**

- Changeset merged to main branch
- Status updated to approved with timestamps

**Part F (Rejection):**

- Changeset status updated to rejected
- Reason recorded correctly

**Part G (Security):**

- Path traversal attempts blocked and logged
- Unauthorized commands blocked and logged

**Part H (Git):**

- All git subcommands functional
- Branch and commit tracking works

### Pass Criteria

**Blueprint Setup:**

- [ ] Agent blueprint (`senior-coder` or `mock`) created or exists
- [ ] Blueprint visible in `exoctl blueprint list`

**Configuration & Setup:**

- [ ] Portal mounted and accessible via ExoFrame

**Plan Execution:**

- [ ] Approved plan triggers automatic execution
- [ ] PlanExecutor runs steps sequentially
- [ ] Agent executes via ToolRegistry tools
- [ ] Feature branch created with correct naming: `feat/<request-id>`
- [ ] Commit includes trace_id metadata

**Changeset Lifecycle:**

- [ ] Changeset registered in database with status=pending
- [ ] `exoctl changeset list` shows pending changesets
- [ ] `exoctl changeset show <id>` displays details and diff
- [ ] `exoctl changeset approve <id>` merges to main
- [ ] `exoctl changeset reject <id>` records reason and updates status

**Activity Journal:**

- [ ] `plan.execution_started` logged
- [ ] `step.started` and `step.completed` logged
- [ ] `action.executing` and `action.completed` logged for tools
- [ ] `plan.execution_completed` logged

**Security:**

- [ ] Access to files outside allowed roots blocked
- [ ] Execution of non-whitelisted commands blocked

**Git Commands:**

- [ ] `exoctl git branches` lists all portal branches
- [ ] `exoctl git status` shows repository status
- [ ] `exoctl git log <trace-id>` finds commits by trace_id

---

## Scenario MT-09: Portal Management

**Purpose:** Verify portal (external project) can be mounted and accessed.

### Preconditions

- ExoFrame running
- External project directory exists

### Steps

```bash
# Step 1: Create a test external project
mkdir -p /tmp/test-project
echo "# Test Project" > /tmp/test-project/README.md
echo "export const version = '1.0';" > /tmp/test-project/index.ts

# Step 2: Mount the portal
exoctl portal add /tmp/test-project TestProject

# Step 3: Verify portal created
exoctl portal list
ls -la ~/ExoFrame/Portals/

# Step 4: Verify symlink works
cat ~/ExoFrame/Portals/TestProject/README.md
```

### Expected Results

**Step 2:**

- Portal added successfully
- Shows portal name and path

**Step 3:**

- TestProject appears in portal list
- Symlink created in `Portals/`

**Step 4:**

- Can read files through symlink
- Content matches original

### Verification

```bash
# Check symlink
ls -la ~/ExoFrame/Portals/TestProject
# Should show: TestProject -> /tmp/test-project

# Verify context card generated
cat ~/ExoFrame/Knowledge/Portals/TestProject.md
```

### Cleanup

```bash
# Remove portal
exoctl portal remove TestProject

# Verify removal
ls ~/ExoFrame/Portals/ | grep TestProject  # Should be empty

# Clean up test project
rm -rf /tmp/test-project
```

### Pass Criteria

- [ ] Portal symlink created
- [ ] Files accessible through portal
- [ ] Context card generated
- [ ] Portal can be removed

---

## Scenario MT-10: Daemon Crash Recovery

**Purpose:** Verify daemon recovers gracefully after unexpected termination.

### Preconditions

- Daemon running with active operations
- At least one request in progress (optional)

### Steps

```bash
# Step 1: Get daemon PID
DAEMON_PID=$(pgrep -f "deno.*main.ts" | head -1)
echo "Daemon PID: $DAEMON_PID"

# Alternative: Use exoctl to get PID
# exoctl daemon status | grep "PID:"

# Step 2: Force kill the daemon (simulate crash)
kill -9 $DAEMON_PID

# Step 3: Verify daemon is dead
pgrep -f "deno.*main.ts" || echo "Daemon stopped"

# Step 4: Restart daemon
cd ~/ExoFrame
exoctl daemon start
sleep 3

# Step 5: Check status
exoctl daemon status
```

### Expected Results

**Step 2:**

- Daemon terminates immediately

**Step 4:**

- Daemon restarts successfully
- Shows recovery messages (if any)
- Resumes watching directories

**Step 5:**

- Status shows daemon healthy
- Previous state recovered

### Verification

```bash
# Check daemon is running
exoctl daemon status
# Should show: Status: Running ✓

# Check database integrity
sqlite3 ~/ExoFrame/.exo/journal.db "PRAGMA integrity_check;"
# Should show: ok

# Verify requests still tracked
exoctl request list
```

### Pass Criteria

- [ ] Daemon restarts without errors
- [ ] `exoctl daemon status` shows Running
- [ ] Database remains intact
- [ ] Previous requests still visible

---

## Scenario MT-11: Real LLM Integration

**Purpose:** Verify ExoFrame works with real LLM API providers (Anthropic, OpenAI, Google Gemini) through complete end-to-end workflows including plan generation, execution, and changeset creation.

### Preconditions

- Valid API key for chosen provider
- Daemon NOT running (will start with real LLM)
- Test portal configured

### Part A: Anthropic Claude Testing

```bash
# Step 1: Set API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Step 2: Configure ExoFrame to use Anthropic
cd ~/ExoFrame
cat >> exo.config.toml << 'EOF'

[ai]
provider = "anthropic"
model = "claude-3.5-haiku-latest"  # Or claude-3-5-sonnet-20241022
base_url = ""  # Leave empty for default

[ai.anthropic]
api_key_env = "ANTHROPIC_API_KEY"
EOF

# Step 3: Start daemon
exoctl daemon start

# Step 4: Verify provider loaded
grep -i "anthropic\|claude" .exo/daemon.log | head -5

# Step 5: Create test portal
mkdir -p /tmp/real-llm-test
cd /tmp/real-llm-test
git init
echo "# Test Project" > README.md
git add . && git commit -m "Initial commit"

# Step 6: Add portal to ExoFrame
cd ~/ExoFrame
exoctl portal add /tmp/real-llm-test RealLLMTest
exoctl daemon restart

# Step 7: Create request with real LLM
exoctl request "Add a utility function to calculate factorial in src/math.ts" \
    --agent senior-coder \
    --portal RealLLMTest

# Step 8: Wait for plan generation (real LLM takes time)
sleep 30
exoctl plan list --status review

# Step 9: View generated plan
PLAN_ID=$(exoctl plan list --status review | head -1 | awk '{print $2}')
exoctl plan show $PLAN_ID

# Step 10: Approve and execute plan
exoctl plan approve $PLAN_ID

# Step 11: Wait for execution
sleep 45
exoctl changeset list

# Step 12: Verify changeset created
CHANGESET_ID=$(exoctl changeset list | grep pending | head -1 | awk '{print $2}')
exoctl changeset show $CHANGESET_ID

# Step 13: Check token usage
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%tokens%' ORDER BY timestamp DESC LIMIT 5;"
exoctl journal --payload %tokens% --tail 5
```

### Part B: OpenAI GPT Testing

```bash
# Step 1: Set API key
export OPENAI_API_KEY="sk-proj-..."

# Step 2: Update config for OpenAI
cat > ~/ExoFrame/exo.config.toml << 'EOF'
[system]
root = "./"
log_level = "info"

[ai]
provider = "openai"
model = "gpt-5-mini"  # Or gpt-5
base_url = ""

[ai.openai]
api_key_env = "OPENAI_API_KEY"
organization_id = ""  # Optional

[[portals]]
alias = "RealLLMTest"
target_path = "/tmp/real-llm-test"
EOF

# Step 3: Restart daemon with OpenAI
exoctl daemon restart

# Step 4: Verify provider
grep -i "openai\|gpt" .exo/daemon.log | head -5

# Step 5: Create request
exoctl request "Add input validation to the factorial function" \
    --agent senior-coder \
    --portal RealLLMTest

# Step 6: Monitor plan generation
watch -n 5 'exoctl plan list'
# Wait until plan appears, then Ctrl+C

# Step 7: Review and approve
PLAN_ID=$(exoctl plan list --status review | head -1 | awk '{print $2}')
exoctl plan show $PLAN_ID
exoctl plan approve $PLAN_ID

# Step 8: Wait for execution and verify changeset
sleep 45
exoctl changeset list

# Step 9: Compare quality with Anthropic
# Check daemon log for response characteristics
tail -100 .exo/daemon.log | grep -A 5 "plan.generated"
```

### Part C: Google Gemini Testing

```bash
# Step 1: Set API key
export GOOGLE_API_KEY="AIza..."

# Step 2: Configure for Gemini
cat > ~/ExoFrame/exo.config.toml << 'EOF'
[system]
root = "./"
log_level = "info"

[ai]
provider = "google"
model = "gemini-2.0-flash-exp"  # Or gemini-2.0-pro-exp-01-28
base_url = ""

[ai.google]
api_key_env = "GOOGLE_API_KEY"

[[portals]]
alias = "RealLLMTest"
target_path = "/tmp/real-llm-test"
EOF

# Step 3: Restart with Gemini
exoctl daemon restart

# Step 4: Verify provider
grep -i "google\|gemini" .exo/daemon.log | head -5

# Step 5: Create request
exoctl request "Add error handling and tests for factorial function" \
    --agent senior-coder \
    --portal RealLLMTest

# Step 6: Full workflow
sleep 30
PLAN_ID=$(exoctl plan list --status review | head -1 |awk '{print $2}')
exoctl plan show $PLAN_ID
exoctl plan approve $PLAN_ID

sleep 45
exoctl changeset list
```

### Part D: Provider Comparison

Create comparison matrix by testing same request with each provider:

```bash
# Record metrics for each provider
# - Time to generate plan
# - Plan quality (steps, detail level)
# - Execution success rate
# - Token usage
# - Cost estimate

# Example query for token comparison
sqlite3 .exo/journal.db "
SELECT
  timestamp,
  json_extract(payload, '$.provider') as provider,
  json_extract(payload, '$.tokens.input') as input_tokens,
  json_extract(payload, '$.tokens.output') as output_tokens
FROM activity
WHERE action_type LIKE '%llm%'
ORDER BY timestamp DESC
LIMIT 20;
"
```

### Expected Results

**Part A (Anthropic Claude):**

- Daemon starts with Anthropic provider
- Claude model visible in logs
- Plan generated with detailed, nuanced steps
- Execution produces changeset with actual file modifications
- Token usage logged (typically 2000-5000 tokens per plan)
- High-quality, context-aware responses

**Part B (OpenAI GPT):**

- Daemon switches to OpenAI provider
- GPT model visible in logs
- Plan generated with structured, clear steps
- Execution successful with changeset
- Token usage logged (typically 1500-4000 tokens per plan)
- Direct, action-oriented responses

**Part C (Google Gemini):**

- Daemon switches to Gemini provider
- Gemini model visible in logs
- Plan generated (may be more concise)
- Execution successful with changeset
- Token usage logged (typically 1000-3000 tokens per plan)
- Fast response times

### Verification

```bash
# Check all plans generated
ls -la Workspace/Plans/
ls -la Workspace/Active/

# Verify changesets created
ls -la Workspace/Changesets/

# Check git branches created
cd /tmp/real-llm-test
git branch -a

# Review file changes
git diff master

# Check cost tracking (if enabled)
sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM cost_tracking ORDER BY timestamp DESC LIMIT 10;"

# Compare plan quality
for plan in Workspace/Plans/*.md; do
  echo "=== $plan ==="
  grep -A 3 "step:" "$plan" | head -20
done
```

### Cleanup

```bash
# Stop daemon
exoctl daemon stop

# Remove test portal
exoctl portal remove RealLLMTest
rm -rf /tmp/real-llm-test

# Unset API keys
unset ANTHROPIC_API_KEY
unset OPENAI_API_KEY
unset GOOGLE_API_KEY

# Restore mock configuration
cd ~/ExoFrame
cp exo.config.sample.toml exo.config.toml
```

### Pass Criteria

- [ ] **Anthropic Claude**: Provider loads, plan generated, changeset created
- [ ] **OpenAI GPT**: Provider loads, plan generated, changeset created
- [ ] **Google Gemini**: Provider loads, plan generated, changeset created
- [ ] All three providers produce coherent, actionable plans
- [ ] Execution steps generate real file changes (not just planning responses)
- [ ] Changesets contain valid git diffs
- [ ] Token usage tracked accurately for all providers
- [ ] No API errors or timeout failures
- [ ] Cost tracking logs present (if configured)

### Provider Comparison Matrix

| Aspect               | Anthropic Claude    | OpenAI GPT        | Google Gemini     |
| -------------------- | ------------------- | ----------------- | ----------------- |
| **Setup Complexity** | Simple              | Simple            | Simple            |
| **Response Quality** | Very High (nuanced) | High (structured) | Good (concise)    |
| **Response Speed**   | Fast (1-3s)         | Fast (1-3s)       | Very Fast (1-2s)  |
| **Token Usage**      | Moderate            | Moderate          | Lower (efficient) |
| **Cost (approx)**    | $$ (Output heavy)   | $                 | Free / $          |
| **Context Window**   | 200K tokens         | 128K tokens       | 1M tokens         |
| **Best For**         | Complex reasoning   | General purpose   | Fast iteration    |

### Troubleshooting

**API Key Issues:**

```bash
# Verify key is set
echo $ANTHROPIC_API_KEY | cut -c1-10  # Should show "sk-ant-..."

# Check daemon picked up key
grep "API key" .exo/daemon.log
```

**Provider Not Loading:**

```bash
# Check config syntax
deno run --allow-read scripts/validate_config.ts exo.config.toml

# Verify provider string exact match
grep "provider =" exo.config.toml
```

**No Changeset Created:**

```bash
# Check execution logs
grep "step.*" .exo/daemon.log | tail -20

# Verify actions were generated (not just planning)
grep "<actions>" .exo/daemon.log
```

---

## Scenario MT-12: Invalid Request Handling

**Purpose:** Verify system handles malformed input gracefully.

### Preconditions

- Daemon running

### Steps

```bash
# Step 1: Create request with invalid YAML
cat > ~/ExoFrame/Workspace/Requests/invalid-test.md << 'EOF'
---
id: broken
status: [invalid yaml
created: not-a-date
---

This request has broken frontmatter.
EOF

# Step 2: Wait for daemon to process
sleep 5

# Step 3: Check for error handling
exoctl request list
tail -20 ~/ExoFrame/.exo/daemon.log
```

### Expected Results

**Step 3:**

- Invalid request NOT in active list
- Error logged with clear message
- System continues operating (no crash)

### Verification

```bash
# Check error log
grep -i "validation error\|parse error\|invalid" ~/ExoFrame/.exo/daemon.log

# Verify daemon still healthy
exoctl daemon status
```

### Cleanup

```bash
# Remove invalid file
rm ~/ExoFrame/Workspace/Requests/invalid-test.md
```

### Pass Criteria

- [ ] Invalid file rejected gracefully
- [ ] Clear error message logged
- [ ] Daemon continues running
- [ ] Other requests unaffected

---

## Scenario MT-13: Database Corruption Recovery

**Purpose:** Verify system handles missing/corrupted database.

### Preconditions

- Daemon stopped
- Backup of current database (optional)

### Steps

```bash
# Step 1: Stop daemon if running
exoctl daemon stop 2>/dev/null || true

# Step 2: Backup current database
cp ~/ExoFrame/.exo/journal.db ~/ExoFrame/.exo/journal.db.backup

# Step 3: Corrupt/delete database
rm ~/ExoFrame/.exo/journal.db

# Step 4: Start daemon
cd ~/ExoFrame
exoctl daemon start
sleep 5

# Step 5: Check status
exoctl daemon status
```

### Expected Results

**Step 4:**

- Daemon starts (may show recovery messages)
- New database created
- OR shows clear error with recovery instructions

**Step 5:**

- Daemon functional or provides guidance

### Verification

```bash
# Check if database recreated
ls -la ~/ExoFrame/.exo/journal.db

# Check log for recovery messages
grep -i "database\|recovery\|init" ~/ExoFrame/.exo/daemon.log
```

### Cleanup

```bash
# Restore backup if needed
cp ~/ExoFrame/.exo/journal.db.backup ~/ExoFrame/.exo/journal.db
```

### Pass Criteria

- [ ] Clear error message if cannot recover
- [ ] Database recreated if possible
- [ ] Historical data loss noted in logs
- [ ] System operational after recovery

---

## Scenario MT-14: Concurrent Request Processing

**Purpose:** Verify system handles multiple simultaneous requests.

### Preconditions

- Daemon running

### Steps

```bash
# Step 1: Create multiple requests rapidly
for i in 1 2 3; do
  exoctl request "Test request number $i" &
done
wait

# Step 2: Wait for processing
sleep 10

# Step 3: List all requests
exoctl request list

# Step 4: Check for plans
exoctl plan list
```

### Expected Results

**Step 1:**

- All 3 requests created successfully

**Step 3:**

- All 3 requests appear in list
- Each has unique ID

**Step 4:**

- Plans generated for all requests
- No race condition errors

### Verification

```bash
# Check no duplicate IDs
exoctl request list | sort | uniq -d
# Should output nothing (no duplicates)

# Check logs for errors
grep -i "error\|conflict\|race" ~/ExoFrame/.exo/daemon.log
```

### Pass Criteria

- [ ] All requests processed
- [ ] No duplicate IDs
- [ ] No race condition errors
- [ ] Plans generated for each request

---

## Scenario MT-15: File Watcher Reliability

**Purpose:** Verify file watcher detects all changes reliably.

### Preconditions

- Daemon running

### Steps

```bash
# Step 1: Create files rapidly (proper format with frontmatter)
for i in $(seq 1 5); do
  cat > ~/ExoFrame/Workspace/Requests/rapid-$i.md << EOF
---
trace_id: "00000000-0000-0000-0000-00000000000$i"
created: "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
status: pending
priority: normal
agent: mock-agent
source: manual-test
---

# Request

Test request $i
EOF
  sleep 0.1
done

# Step 2: Modify files (update status)
for i in $(seq 1 5); do
  sed -i 's/status: pending/status: processing/' ~/ExoFrame/Workspace/Requests/rapid-$i.md
  sleep 0.1
done

# Step 3: Wait for processing
sleep 5

# Step 4: Check detection
tail -50 ~/ExoFrame/.exo/daemon.log | grep -c "file\|detected\|changed"
```

### Expected Results

**Step 4:**

- All 10 file events detected (5 creates + 5 modifies)
- No missed events

### Verification

```bash
# Check daemon logs for file detection
tail -50 ~/ExoFrame/.exo/daemon.log | grep -c "file\|detected\|changed"
# Should show entries for file changes
```

### Cleanup

```bash
# Remove test files
rm ~/ExoFrame/Workspace/Requests/rapid-*.md
```

### Pass Criteria

- [ ] All file creates detected
- [ ] All file modifications detected
- [ ] No significant delays (< 500ms)

---

## Scenario MT-16: LLM Provider Selection

**Purpose:** Verify daemon correctly selects LLM provider based on environment variables and configuration.

### Preconditions

- ExoFrame installed (MT-01 complete)
- No daemon currently running
- Ollama installed and running (see [Developer Setup - Ollama Installation](./ExoFrame_Developer_Setup.md#3-install-ollama-for-local-llm-inference) for installation instructions and model selection guide based on hardware)

### Steps

```bash
# Step 1: Test default behavior (Google provider) - Assumes GOOGLE_API_KEY set
cd ~/ExoFrame
exoctl daemon start
sleep 3

# Step 2: Check startup logs for provider
grep -i "LLM Provider" ~/ExoFrame/.exo/daemon.log

# Step 3: Stop daemon
exoctl daemon stop

# Step 4: Test Ollama provider via environment
cd ~/ExoFrame
EXO_LLM_PROVIDER=ollama exoctl daemon start
sleep 3
grep -i "LLM Provider\|provider" ~/ExoFrame/.exo/daemon.log | tail -5
exoctl daemon stop

# Step 5: Test Ollama with custom model
cd ~/ExoFrame
EXO_LLM_PROVIDER=ollama EXO_LLM_MODEL=codellama exoctl daemon start
sleep 3
grep -i "LLM Provider\|provider" ~/ExoFrame/.exo/daemon.log | tail -5
exoctl daemon stop

# Step 6: Test missing API key error (Anthropic)
cd ~/ExoFrame
unset ANTHROPIC_API_KEY
EXO_LLM_PROVIDER=anthropic exoctl daemon start 2>&1 || echo "Expected: API key error"
sleep 2
# Check if daemon failed to start (expected)
exoctl daemon status 2>&1 || echo "Daemon not running (expected)"

# Step 7: Test config file provider selection
cat >> ~/ExoFrame/exo.config.toml << 'EOF'
[ai]
provider = "ollama"
model = "llama3.2"
EOF

exoctl daemon start
sleep 3
grep -i "LLM Provider" ~/ExoFrame/.exo/daemon.log
exoctl daemon stop

# Step 8: Test environment overrides config
cd ~/ExoFrame
EXO_LLM_PROVIDER=mock exoctl daemon start
sleep 3
grep -i "LLM Provider\|provider" ~/ExoFrame/.exo/daemon.log | tail -5
exoctl daemon stop
```

### Expected Results

**Step 2:**

- Shows: `✅ LLM Provider: google-gemini-2.0-flash-exp`
- Google provider used by default

**Step 4:**

- Shows: `✅ LLM Provider: ollama-llama3.2`
- Ollama provider selected via env var

**Step 5:**

- Shows: `✅ LLM Provider: ollama-codellama`
- Custom model from EXO_LLM_MODEL

**Step 6:**

- Shows: `❌ Error: ANTHROPIC_API_KEY environment variable required for Anthropic provider`
- Daemon does NOT start

**Step 7:**

- Shows: `✅ LLM Provider: ollama-llama3.2`
- Config file settings used

**Step 8:**

- Shows: `✅ LLM Provider: mock-recorded`
- Environment variable overrides config

### Verification

```bash
# Check daemon log for provider initialization
grep -E "LLM Provider|provider.*mock|provider.*ollama" ~/ExoFrame/.exo/daemon.log

# Verify provider ID format
# Expected patterns:
#   mock-recorded
#   mock-scripted
#   ollama-<model>
#   anthropic-<model>
#   openai-<model>
```

### Cleanup

```bash
# Stop daemon
exoctl daemon stop 2>/dev/null || pkill -f "exoframe"

# Remove test config section (if added)
# Edit ~/ExoFrame/exo.config.toml and remove [ai] section

# Unset test environment variables
unset EXO_LLM_PROVIDER EXO_LLM_MODEL EXO_LLM_BASE_URL
```

### Pass Criteria

- [ ] Default provider is MockLLMProvider
- [ ] `EXO_LLM_PROVIDER=ollama` creates OllamaProvider
- [ ] `EXO_LLM_MODEL` overrides model name
- [ ] Missing API key shows clear error (does not crash)
- [ ] Config file `[ai]` section is respected
- [ ] Environment variables override config file
- [ ] Provider ID logged at startup

---

## Scenario MT-17: Memory Banks Integration

**Purpose:** Verify Memory Banks storage, retrieval, context card generation, and search functionality.

### Preconditions

- ExoFrame workspace deployed at `~/ExoFrame`
- Daemon running
- At least one portal configured
- At least one completed request/plan

### Steps

```bash
# Part A: Memory Reports Storage

# Step 1: Create a request and complete execution
exoctl request "Create a test utility function" --agent mock-agent

# Step 2: Wait for plan generation and approve
sleep 5
PLAN_ID=$(exoctl plan list --status review | head -1 | awk '{print $1}')
exoctl plan approve $PLAN_ID

# Step 3: Verify report created in Memory/Reports/
ls -la ~/ExoFrame/Memory/Reports/
cat ~/ExoFrame/Memory/Reports/*.md

# Part B: Context Storage

# Step 4: Add context document manually
cat > ~/ExoFrame/Memory/Context/test-context.md << 'EOF'
---
title: "Test Context Document"
created: "2026-01-16T12:00:00Z"
tags: [testing, manual-scenario]
---

# Test Context

This is a test context document for Memory Banks verification.

## Key Information

- Purpose: Manual testing
- Category: Documentation
EOF

# Step 5: Verify context is accessible
cat ~/ExoFrame/Memory/Context/test-context.md

# Part C: Portal Context Cards

# Step 6: Create a test portal
mkdir -p /tmp/test-memory-portal
echo "# Test Portal" > /tmp/test-memory-portal/README.md
echo "export const version = '1.0';" > /tmp/test-memory-portal/index.ts

# Step 7: Add portal to ExoFrame
exoctl portal add /tmp/test-memory-portal TestMemoryPortal

# Step 8: Verify context card generated
ls -la ~/ExoFrame/Memory/Portals/
cat ~/ExoFrame/Memory/Portals/TestMemoryPortal.md

# Part D: Memory Search and Retrieval

# Step 9: Search memory by tag
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%testing%' ORDER BY timestamp DESC LIMIT 5;"
exoctl journal --payload %testing% --tail 5

# Step 10: Query memory reports
find ~/ExoFrame/Memory/Reports/ -name "*.md" -type f

# Step 11: List all memory entries
find ~/ExoFrame/Memory/ -name "*.md" -type f | head -20
```

### Expected Results

**Part A (Memory Reports):**

- Report file created in `Memory/Reports/` with trace_id in filename
- Report contains execution summary with JSON metadata
- Report includes steps executed and outcomes

**Part B (Context Storage):**

- Context document stored successfully
- YAML frontmatter parsed correctly
- File accessible for agent context loading

**Part C (Portal Context Cards):**

- Context card generated automatically at `Memory/Portals/TestMemoryPortal.md`
- Card contains portal metadata (path, files, structure)
- Card includes automatically scanned project information

**Part D (Memory Search):**

- Search queries return relevant results
- Reports are discoverable by trace_id
- Memory structure is navigable

### Verification

```bash
# Check Memory directory structure
tree ~/ExoFrame/Memory/ -L 2

# Verify report frontmatter format
head -20 ~/ExoFrame/Memory/Reports/*.md | grep -A 10 "^---"

# Check portal context card exists
ls -la ~/ExoFrame/Memory/Portals/TestMemoryPortal.md

# Verify context is indexed
find ~/ExoFrame/Memory/ -name "*.md" | wc -l
# Should show multiple memory files

# Check Activity Journal logged memory operations
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%memory%' ORDER BY timestamp DESC LIMIT 10;"
exoctl journal --filter action_type=%memory% --tail 10
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%portal%' ORDER BY timestamp DESC LIMIT 10;"
exoctl journal --filter action_type=%portal% --tail 10
```

### Cleanup

```bash
# Remove test portal
exoctl portal remove TestMemoryPortal
rm -rf /tmp/test-memory-portal

# Remove test context
rm -f ~/ExoFrame/Memory/Context/test-context.md

# Note: Keep reports for historical record (don't clean unless testing)
```

### Pass Criteria

- [ ] Reports stored in `Memory/Reports/` with correct format
- [ ] Context documents stored in `Memory/Context/`
- [ ] Portal context cards auto-generated in `Memory/Portals/`
- [ ] Memory search returns relevant results
- [ ] All memory operations logged to Activity Journal
- [ ] YAML frontmatter parsed correctly
- [ ] Memory structure follows documented layout

---

## Scenario MT-18: Multi-Agent Flow Execution

**Purpose:** Verify flow-based request routing, CLI flow support, and multi-agent orchestration (Phase 7 + Phase 30 features).

### Preconditions

- ExoFrame workspace deployed
- Daemon running
- Multiple agent blueprints exist
- Flow definitions available in `Blueprints/Flows/`

### Steps

```bash
# Part A: Flow Definition Setup

# Step 1: Create a test flow using defineFlow() helper
cat > ~/ExoFrame/Blueprints/Flows/test-review-flow.flow.ts << 'EOF'
import { defineFlow } from "./define_flow.ts";

export default defineFlow({
  id: "test-review-flow",
  name: "Test Review Flow",
  description: "Sequential code review by multiple agents",
  version: "1.0.0",
  defaultSkills: ["code-review"],
  steps: [
    {
      id: "analyze-code",
      name: "Analyze Codebase",
      agent: "senior-coder",
      dependsOn: [],
      input: {
        source: "request",
        transform: "passthrough",
      },
      retry: {
        maxAttempts: 2,
        backoffMs: 1000,
      },
    },
    {
      id: "security-review",
      name: "Security Analysis",
      agent: "security-expert",
      dependsOn: ["analyze-code"],
      input: {
        source: "step",
        stepId: "analyze-code",
        transform: "extract-security-focus",
      },
      timeout: 30000,
      retry: {
        maxAttempts: 1,
        backoffMs: 1000,
      },
    },
    {
      id: "final-review",
      name: "Final Code Review",
      agent: "code-reviewer",
      dependsOn: ["analyze-code", "security-review"],
      input: {
        source: "step",
        stepId: "security-review",
        transform: "consolidate-reviews",
      },
      timeout: 30000,
    }
  ],
});
EOF

# Step 2: Create required agent blueprints (if not exist)
exoctl blueprint create senior-coder \
  --name "Senior Coder" \
  --template coder \
  2>/dev/null || echo "Agent already exists"

exoctl blueprint create security-expert \
  --name "Security Expert" \
  --template security \
  2>/dev/null || echo "Agent already exists"

exoctl blueprint create code-reviewer \
  --name "Code Reviewer" \
  --template reviewer \
  2>/dev/null || echo "Agent already exists"

# Part B: CLI Flow Request Creation

# Step 3: Create request using CLI --flow option
exoctl request "Review authentication module for security and code quality" --flow test-review-flow --priority high

# Step 4: Verify request was created with flow metadata
REQUEST_ID=$(exoctl request list | grep "test-review-flow" | head -1 | awk '{print $1}')
exoctl request show $REQUEST_ID

# Step 5: Check activity journal for flow routing
sleep 2
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type = 'request.created' ORDER BY timestamp DESC LIMIT 1;"
exoctl journal --filter action_type=request.created --limit 1

# Part C: Flow Execution and Monitoring

# Step 6: Wait for plan generation
sleep 5
exoctl plan list --status pending

# Step 7: Find and approve the flow plan
PLAN_ID=$(exoctl plan list --status pending | grep "test-review-flow" | head -1 | awk '{print $1}')
exoctl plan show $PLAN_ID

# Step 8: Approve and execute the flow
exoctl plan approve $PLAN_ID

# Step 9: Monitor flow execution progress
sleep 10
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$REQUEST_ID' ORDER BY timestamp DESC LIMIT 20;"
exoctl journal --filter trace_id=$REQUEST_ID --limit 20

# Step 10: Check for multi-agent execution
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT DISTINCT agent_id FROM activity WHERE trace_id = '$REQUEST_ID' AND agent_id IS NOT NULL;"
exoctl journal --filter trace_id=$REQUEST_ID --distinct agent_id

# Part D: Error Handling and Validation

# Step 11: Test invalid flow (should fail)
exoctl request "Test invalid flow" --flow nonexistent-flow 2>&1 || echo "Expected error for invalid flow"

# Step 12: Test flow + agent conflict (should fail)
exoctl request "Test conflict" --flow test-review-flow --agent senior-coder 2>&1 || echo "Expected error for flow+agent conflict"
```

### Expected Results

**Part A (Flow Setup):**

- Flow definition created using `defineFlow()` helper
- Flow validation passes (TypeScript compilation)
- Required agents exist and are accessible

**Part B (CLI Flow Support):**

- `exoctl request --flow` command succeeds
- Request created with `flow:` field in frontmatter
- Activity journal shows `request.created` with flow metadata
- Request appears in `exoctl request list` with flow indicator

**Part C (Flow Execution):**

- Request automatically routed to FlowRunner
- Plan generated with multi-step structure
- Multiple agents execute in dependency order
- Step transitions logged (step.started, step.completed)
- Final changeset includes work from all agents

**Part D (Validation):**

- Invalid flow names rejected with clear error
- Flow + agent combination properly rejected
- Error messages guide user to correct usage

### Verification

```bash
# Check flow definition exists and compiles
ls -la ~/ExoFrame/Blueprints/Flows/test-review-flow.flow.ts
deno check ~/ExoFrame/Blueprints/Flows/test-review-flow.flow.ts

# Verify CLI flow request creation
exoctl request list | grep test-review-flow

# Check request metadata includes flow
exoctl request show $REQUEST_ID | grep -A 5 -B 5 "flow:"

# Verify flow routing in activity journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$REQUEST_ID' AND action_type = 'request.created' ORDER BY timestamp DESC LIMIT 1;"
exoctl journal --filter trace_id=$REQUEST_ID --filter action_type=request.created --tail 1

# Check multi-agent execution
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$REQUEST_ID' AND action_type LIKE 'step.%' ORDER BY timestamp DESC LIMIT 50;"
exoctl journal --filter trace_id=$REQUEST_ID --filter action_type=step.%

# Verify step dependencies respected
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$REQUEST_ID' AND action_type = 'step.started' ORDER BY timestamp DESC LIMIT 50;"
exoctl journal --filter trace_id=$REQUEST_ID --filter action_type=step.started
```

### Cleanup

```bash
# Remove flow definition
rm -f ~/ExoFrame/Blueprints/Flows/test-review-flow.flow.ts

# Remove test requests (find by flow name)
for req_file in ~/ExoFrame/Workspace/Requests/*; do
  if grep -q "flow: test-review-flow" "$req_file" 2>/dev/null; then
    rm -f "$req_file"
  fi
done

# Remove generated plans and changesets
rm -f ~/ExoFrame/Workspace/Plans/*test-review-flow*.md
rm -f ~/ExoFrame/Workspace/Active/*test-review-flow*.md
rm -f ~/ExoFrame/Workspace/Changesets/*test-review-flow*.md
```

### Pass Criteria

- [ ] Flow definition created with `defineFlow()` and TypeScript validation passes
- [ ] `exoctl request --flow <id>` creates request with flow metadata
- [ ] Request routing works (FlowRunner vs AgentRunner)
- [ ] Activity journal logs flow execution events
- [ ] Multiple agents execute in correct dependency order
- [ ] Step transitions properly logged with agent assignments
- [ ] Invalid flow names rejected with helpful error messages
- [ ] Flow + agent combination properly prevented
- [ ] Final output consolidates work from all flow agents

---

## Scenario MT-19: Skills Management

**Purpose:** Verify Skills service and TUI Skills Manager functionality.

### Preconditions

- ExoFrame workspace deployed
- Daemon running
- Skills directory exists at `.agent/workflows/` or configured path

### Steps

```bash
# Part A: Skills Directory Setup

# Step 1: Create test skill
mkdir -p ~/ExoFrame/.agent/workflows
cat > ~/ExoFrame/.agent/workflows/test-skill.md << 'EOF'
---
description: Test skill for manual scenarios
---

# Test Skill

This is a test skill for verifying Skills Management functionality.

## Steps

1. Verify skill structure
2. Test skill loading
3. Validate skill metadata
EOF

# Step 2: List available skills
exoctl skills list

# Step 3: Show skill details
exoctl skills show test-skill

# Part B: TUI Skills Manager

# Step 4: Launch dashboard and navigate to Skills view
exoctl dashboard
# Navigate to Skills Manager view using Tab key
# Press Enter on a skill to view details

# Part C: Skill Validation

# Step 5: Test skill metadata parsing
cat ~/ExoFrame/.agent/workflows/test-skill.md | grep -A 5 "^---"

# Step 6: Verify skill is indexed
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%skill%' ORDER BY timestamp DESC LIMIT 5;"
exoctl journal --filter action_type=%skill% --tail 5

# Part D: Skill Dependencies (if applicable)

# Step 7: Create skill with dependencies
cat > ~/ExoFrame/.agent/workflows/complex-skill.md << 'EOF'
---
description: Complex skill with dependencies
dependencies:
  - test-skill
  - another-skill
---

# Complex Skill

This skill has dependencies on other skills.
EOF

# Step 8: Validate dependency checking
exoctl skills validate complex-skill
```

### Expected Results

**Part A (Skills Setup):**

- Skill file created successfully
- Skill appears in `exoctl skills list`
- Skill metadata parsed from YAML frontmatter

**Part B (TUI Skills Manager):**

- Skills Manager view accessible in dashboard
- Skills listed with descriptions
- Skill details view shows full content

**Part C (Validation):**

- YAML frontmatter parsed correctly
- Skills indexed and discoverable
- Skill operations logged

**Part D (Dependencies):**

- Dependency validation works
- Missing dependencies detected
- Dependency graph traversal correct

### Verification

```bash
# Check skills directory
ls -la ~/ExoFrame/.agent/workflows/

# Verify skill format
head -10 ~/ExoFrame/.agent/workflows/test-skill.md

# Check skills are indexed
find ~/ExoFrame/.agent/workflows/ -name "*.md" | wc -l

# Verify Activity Journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%skill%' ORDER BY timestamp DESC LIMIT 5;"
exoctl journal --filter action_type=%skill% --tail 5
```

### Cleanup

```bash
# Remove test skills
rm -f ~/ExoFrame/.agent/workflows/test-skill.md
rm -f ~/ExoFrame/.agent/workflows/complex-skill.md
```

### Pass Criteria

- [ ] Skills directory accessible
- [ ] Skills list command works
- [ ] Skill details display correctly
- [ ] YAML frontmatter parsed
- [ ] TUI Skills Manager accessible
- [ ] Skill validation works
- [ ] Dependency checking functional
- [ ] Skills operations logged

---

## Scenario MT-20: TUI Dashboard Launch and Core Views Navigation

**Purpose:** Verify `exoctl dashboard` launches successfully and all core views (Monitor, Plan Reviewer, Portal Manager, Daemon Control, Agent Status, Request Manager) are accessible and functional.

### Preconditions

- ExoFrame workspace deployed and initialized
- Daemon running (for full functionality)
- At least one request, plan, and portal exist in the system

### Steps

```bash
# Step 1: Launch the dashboard
exoctl dashboard

# Step 2: Verify initial view (Portal Manager) loads
# Step 3: Navigate to Monitor view (Tab key)
# Step 4: Navigate to Plan Reviewer view (Tab key)
# Step 5: Navigate to Daemon Control view (Tab key)
# Step 6: Navigate to Agent Status view (Tab key)
# Step 7: Navigate to Request Manager view (Tab key)
# Step 8: Return to Portal Manager view (Tab key)
# Step 9: Use Shift+Tab to navigate backwards through views
```

### Expected Results

- Dashboard launches without errors showing "ExoFrame TUI Dashboard"
- All 6 core views are accessible via Tab navigation
- Each view displays appropriate content and status information
- Navigation is smooth with clear visual feedback for active view
- Status bar shows "Ready" and navigation hints

### Verification

```bash
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%dashboard%' ORDER BY timestamp DESC LIMIT 5;";
# Check that all views load without errors
# Verify view titles and content are displayed correctly
# Confirm Activity Journal shows dashboard launch event
exoctl journal --filter action_type=%dashboard% --tail 5
```

### Pass Criteria

- [ ] Dashboard launches successfully
- [ ] All 6 core views are accessible via Tab navigation
- [ ] Each view displays appropriate content
- [ ] No crashes or major UI glitches during navigation
- [ ] Status bar and navigation hints are visible

## Scenario MT-21: TUI Monitor View - Log Streaming and Filtering

**Purpose:** Verify the Monitor view provides real-time log streaming, filtering capabilities, and export functionality.

### Preconditions

- ExoFrame workspace with activity history
- Daemon running to generate logs
- Multiple agents and actions in the system

### Steps

```bash
# Step 1: Launch dashboard and navigate to Monitor view
exoctl dashboard
# Press Tab until Monitor view is active

# Step 2: Observe real-time log streaming
# Wait for new log entries to appear automatically

# Step 3: Test pause/resume functionality
# Press 'p' to pause streaming
# Press 'p' again to resume

# Step 4: Test filtering by agent
# Press 'f' then 'a' to filter by agent
# Select an agent from the list

# Step 5: Test filtering by action type
# Press 'f' then 't' to filter by action type
# Select an action type (e.g., "request.created")

# Step 6: Test time window filtering
# Press 'f' then 'w' to filter by time window
# Select a time window (e.g., "Last hour")

# Step 7: Test log export
# Press 'e' to export logs to file
# Verify file is created in workspace

# Step 8: Clear all filters
# Press 'c' to clear filters
```

### Expected Results

- Logs stream in real-time when not paused
- Pause/resume works correctly
- Filters apply correctly and show only matching logs
- Export creates a file with filtered logs
- Clear filters restores full log view
- Status bar shows current filter state

### Verification

```bash
# Check exported log file exists and contains expected content
ls -la ~/ExoFrame/logs_*.txt
cat ~/ExoFrame/logs_*.txt | head -10

# Verify filter state in Activity Journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%filter%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%filter% --tail 5
```

### Pass Criteria

- [ ] Real-time log streaming works
- [ ] Pause/resume functionality works
- [ ] All filter types (agent, action, time) work correctly
- [ ] Log export creates valid file
- [ ] Filter clearing restores full view
- [ ] No performance issues with large log volumes

## Scenario MT-22: TUI Plan Reviewer View - Plan Management

**Purpose:** Verify the Plan Reviewer view allows browsing, reviewing, and approving/rejecting plans with proper keyboard navigation.

### Preconditions

- At least 2-3 pending plans exist in the system
- Plans have different statuses and content

### Steps

```bash
# Step 1: Launch dashboard and navigate to Plan Reviewer view
exoctl dashboard
# Press Tab until Plan Reviewer view is active

# Step 2: Navigate through plans
# Use Down/Up arrows to browse plans
# Use Home/End to jump to first/last plan

# Step 3: View plan details
# Press Enter on a plan to view its diff/content

# Step 4: Approve a plan
# Select a pending plan
# Press 'a' to approve
# Confirm approval in dialog

# Step 5: Reject a plan
# Select another pending plan
# Press 'r' to reject
# Enter rejection reason in dialog

# Step 6: Verify plan status changes
# Check that approved plan disappears from list
# Check that rejected plan disappears from list
```

### Expected Results

- Plans are listed with clear status indicators
- Keyboard navigation works smoothly
- Plan details/diff view shows correctly
- Approval moves plan to approved status
- Rejection moves plan to rejected status with reason
- Status messages show success/error feedback

### Verification

```bash
# Check Activity Journal for approval/rejection events
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%plan%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%plan% --tail 5

# Verify plans moved to correct directories
ls ~/ExoFrame/Workspace/Plans/  # Should not contain approved/rejected plans
ls ~/ExoFrame/Workspace/Approved/  # Should contain approved plans
ls ~/ExoFrame/Workspace/Rejected/  # Should contain rejected plans
```

### Pass Criteria

- [ ] Plans display correctly with navigation
- [ ] Plan details/diff view works
- [ ] Approval action succeeds and moves plan
- [ ] Rejection action succeeds with reason
- [ ] Status feedback is clear
- [ ] Activity Journal logs all actions

## Scenario MT-23: TUI Portal Manager View - Portal Management

**Purpose:** Verify the Portal Manager view allows managing portals (open, close, refresh, create, edit, remove, sync) with proper keyboard navigation.

### Preconditions

- At least 2-3 active portals exist in the system
- Portals have different statuses and targets

### Steps

```bash
# Step 1: Launch dashboard and navigate to Portal Manager view
exoctl dashboard
# Verify Portal Manager view is active

# Step 2: Navigate through portals
# Use Down/Up arrows to browse portals
# Use Home/End to jump to first/last portal

# Step 3: Perform portal actions
# Select a portal and press 'o' to open
# Press 'r' to refresh
# Press 'd' to delete
# Press 'e' to edit portal details
# Press 's' to sync portal

# Step 4: Create a new portal
# Press 'c' to create a new portal
# Enter portal details as prompted
```

### Expected Results

- All portal actions (open, refresh, delete, edit, sync) work correctly
- New portal creation prompts for details and adds the portal to the list
- Navigation is smooth with clear visual feedback for active portal
- Status bar shows current portal action state

### Verification

```bash
# Verify portal actions in Activity Journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%portal%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%portal% --tail 5
```

### Pass Criteria

- [ ] All portal actions work as expected
- [ ] New portal creation is successful
- [ ] No crashes or major UI glitches during portal management

---

## Scenario MT-24: TUI Daemon Control View - Daemon Management

**Purpose:** Verify the Daemon Control view allows managing the daemon (start, stop, restart) and viewing logs.

### Preconditions

- Daemon is installed and configured
- Daemon is running or stopped

### Steps

```bash
# Step 1: Launch dashboard and navigate to Daemon Control view
exoctl dashboard
# Press Tab until Daemon Control view is active

# Step 2: View daemon status
# Verify daemon status, uptime, and recent errors are displayed

# Step 3: Perform daemon actions
# Press 's' to stop the daemon
# Press 'r' to restart the daemon
# Press 'l' to view daemon logs
```

### Expected Results

- Daemon status, uptime, and errors are displayed correctly
- Stop, restart, and log viewing actions work as expected
- Status bar shows current daemon state

### Verification

```bash
# Verify daemon actions in Activity Journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%daemon%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%daemon% --tail 5
```

### Pass Criteria

- [ ] Daemon status and logs are displayed correctly
- [ ] Stop and restart actions work as expected
- [ ] No crashes or major UI glitches during daemon management

---

## Scenario MT-25: TUI Request Manager View - Request Management

**Purpose:** Verify the Request Manager view allows managing requests (create, view, cancel) with proper keyboard navigation.

### Preconditions

- At least 2-3 requests exist in the system
- Requests have different statuses and details

### Steps

```bash
# Step 1: Launch dashboard and navigate to Request Manager view
exoctl dashboard
# Press Tab until Request Manager view is active

# Step 2: Navigate through requests
# Use Down/Up arrows to browse requests
# Use Home/End to jump to first/last request

# Step 3: Perform request actions
# Select a request and press 'v' to view details
# Press 'c' to cancel the request

# Step 4: Create a new request
# Press 'n' to create a new request
# Enter request details as prompted
```

### Expected Results

- All request actions (view, cancel) work correctly
- New request creation prompts for details and adds the request to the list
- Navigation is smooth with clear visual feedback for active request
- Status bar shows current request action state

### Verification

```bash
# Verify request actions in Activity Journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%request%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%request% --tail 5
```

### Pass Criteria

- [ ] All request actions work as expected
- [ ] New request creation is successful
- [ ] No crashes or major UI glitches during request management

---

## Scenario MT-26: Activity Journal Queries

**Purpose:** Verify Activity Journal query capabilities, filtering, and export functionality.

### Preconditions

- ExoFrame workspace with activity history
- Multiple requests, plans, and actions executed
- Activity Journal database populated

### Steps

````bash
# Part A: Basic Queries

# Step 1: Query all activity
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity ORDER BY timestamp DESC LIMIT 20;";
exoctl journal --tail 20

# Step 2: Query by trace_id
TRACE_ID=$(exoctl journal --tail 1 --format json | jq -r '.[0].trace_id')
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$TRACE_ID';";
exoctl journal --filter trace_id=$TRACE_ID

# Step 3: Query by action_type
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type = 'request.created';";
exoctl journal --filter action_type=request.created

# Step 4: Query by agent_id
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE agent_id = 'mock-agent';";
exoctl journal --filter agent_id=mock-agent

# Part B: Time-Based Filtering

# Step 5: Query last activity since specific time
# (Assuming 'since' implementation allows string date)
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE timestamp >= '2024-01-01';";
exoctl journal --filter since=2024-01-01

# Part C: Formatted Output

# Step 6: JSON Output for processing
exoctl journal --tail 5 --format json | jq '.'

# Step 7: Export to file
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity;";
exoctl journal --format json > /tmp/activity_log.json

# Part D: Advanced Debugging (Backup)

# Step 8: Direct SQL access for complex analysis (Debug only)
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT COUNT(*) FROM activity;";
exoctl journal --count

# Step 9: Verify integrity
sqlite3 ~/ExoFrame/.exo/journal.db "PRAGMA integrity_check;"
```

### Expected Results

**Part A (Basic Queries):**

- `exoctl journal` returns recent activity table
- Trace ID filter isolates specific operation
- Action and Agent filters work as expected

**Part B (Time-Based):**

- `since` filter correctly limits results
- output matches expected timeframe

**Part C (Formatted Output):**

- JSON output is valid and parsable by `jq`
- Export file created successfully

**Part D (Advanced Debugging):**

- Direct SQL queries return raw data suitable for deep analysis
- Integrity check passes

### Verification

```bash
# Verify journal database structure
sqlite3 ~/ExoFrame/.exo/journal.db ".schema activity"

# Check row count
exoctl journal | wc -l

# Verify export file created
ls -lh /tmp/activity_log.json
wc -l /tmp/activity_log.json

# Check index existence for performance
sqlite3 ~/ExoFrame/.exo/journal.db ".indices activity"
```

### Cleanup

```bash
# Remove export file
rm -f /tmp/activity_log.json
```

### Pass Criteria

- [ ] All `exoctl journal` commands execute without errors
- [ ] Filtering by filters behaves as expected
- [ ] JSON output is valid
- [ ] Export file is created
- [ ] Direct SQL queries (backup) function correctly
- [ ] Database integrity check passes

---

## Scenario MT-27: Advanced Security Testing

**Purpose:** Verify comprehensive security boundaries and permission enforcement beyond basic MT-08 Part G testing.

### Preconditions

- ExoFrame workspace deployed
- Daemon running with Deno permission model
- Multiple portals configured

### Steps

```bash
# Part A: Deno Permission Model Validation

# Step 1: Verify read permission boundaries
# Attempt to read file outside workspace (should fail)
# This is tested by daemon behavior - agent cannot access /etc/passwd

# Step 2: Verify write permission boundaries
# Attempt to write file outside workspace (should fail)

# Step 3: Verify network permission boundaries
# Attempt to fetch from non-whitelisted domain (should fail)

# Part B: Portal Path Restriction

# Step 4: Create multiple isolated portals
mkdir -p /tmp/portal-a /tmp/portal-b
echo "Secret A" > /tmp/portal-a/secret.txt
echo "Secret B" > /tmp/portal-b/secret.txt

exoctl portal add /tmp/portal-a PortalA
exoctl portal add /tmp/portal-b PortalB

# Step 5: Create request targeting PortalA
exoctl request "Read secret.txt from PortalA" --agent mock-agent --portal PortalA

# Step 6: Verify agent cannot access PortalB
# (Implementation detail: ToolRegistry should restrict access)

# Part C: Command Whitelist Validation

# Step 7: Test allowed commands
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type = 'action.executing' AND payload LIKE '%command%' ORDER BY timestamp DESC LIMIT 10;";
exoctl journal --filter action_type=action.executing --payload %command% --tail 10

# Step 8: Verify dangerous commands are blocked
# Check logs for rejected commands (rm, dd, chmod, etc.)
grep -i "command.*not allowed\|blocked" ~/ExoFrame/.exo/daemon.log | tail -10

# Part D: Symlink Traversal Prevention

# Step 9: Create symlink outside workspace
ln -s /etc/passwd /tmp/malicious-link

# Step 10: Attempt to add as portal (should fail or be sanitized)
exoctl portal add /tmp/malicious-link MaliciousPortal 2>&1 || echo "Expected: symlink validation failed"

# Part E: Multi-Portal Isolation

# Step 11: Verify portal separation
ls -la ~/ExoFrame/Portals/
readlink ~/ExoFrame/Portals/PortalA
readlink ~/ExoFrame/Portals/PortalB

# Step 12: Verify no cross-portal contamination
# Each portal should only access its own files

# Part F: Activity Journal Security

# Step 13: Verify sensitive data not logged
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%password%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %password% --tail 5
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%api_key%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %api_key% --tail 5
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%secret%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %secret% --tail 5
# Should return no sensitive credentials

# Step 14: Verify actor attribution
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT DISTINCT actor FROM activity;";
exoctl journal --distinct actor
# Should show: agent names, 'system', 'human', but not 'unknown' or NULL
```

### Expected Results

**Part A (Deno Permissions):**

- Read access restricted to workspace
- Write access restricted to workspace
- Network access restricted to whitelisted domains

**Part B (Portal Restrictions):**

- Agents can only access assigned portal
- Cross-portal access blocked
- Path traversal attempts fail

**Part C (Command Whitelist):**

- Only whitelisted commands execute
- Dangerous commands logged and blocked
- Clear error messages for blocked commands

**Part D (Symlink Protection):**

- Symlink traversal prevented
- Malicious portal addition fails
- Real paths resolved and validated

**Part E (Isolation):**

- Portals isolated from each other
- No unintended file access
- Symlinks correctly configured

**Part F (Journal Security):**

- No credentials in logs
- All actions have actor attribution
- Sensitive data redacted or excluded

### Verification

```bash
# Check Deno startup permissions
ps aux | grep deno | grep ExoFrame
# Should show --allow-read, --allow-write with specific paths

# Verify portal isolation
ls -la ~/ExoFrame/Portals/

# Check for security violations in logs
grep -i "permission denied\|access denied\|blocked\|security" ~/ExoFrame/.exo/daemon.log | tail -20

# Verify no sensitive data in journal
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT COUNT(*) FROM activity WHERE payload LIKE '%api%key%';";
exoctl journal --payload %api%key% | wc -l
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT COUNT(*) FROM activity WHERE payload LIKE '%password%';";
exoctl journal --payload %password% | wc -l
# Should be 0
```

### Cleanup

```bash
# Remove test portals
exoctl portal remove PortalA
exoctl portal remove PortalB
rm -rf /tmp/portal-a /tmp/portal-b

# Remove malicious symlink
rm -f /tmp/malicious-link
```

### Pass Criteria

- [ ] Deno permissions enforced at runtime
- [ ] File access restricted to workspace
- [ ] Network access restricted to whitelist
- [ ] Portal path isolation works
- [ ] Command whitelist enforced
- [ ] Dangerous commands blocked
- [ ] Symlink traversal prevented
- [ ] Cross-portal access blocked
- [ ] No sensitive data in logs
- [ ] All actions have actor attribution
- [ ] Security violations logged clearly

---

## Scenario MT-28: Provider Strategy and Fallback

**Purpose:** Verify intelligent provider selection, fallback chains, and cost tracking.

### Preconditions

- ExoFrame installed
- Multiple LLM providers configured (or mock providers)
- Provider strategy configured in `exo.config.toml`

### Steps

```bash
# Part A: Provider Strategy Configuration

# Step 1: Configure provider strategy
cat >> ~/ExoFrame/exo.config.toml << 'EOF'

[provider_strategy]
prefer_free = true
allow_local = true
max_daily_cost_usd = 5.00
health_check_enabled = true
fallback_enabled = true

[provider_strategy.task_routing]
simple = ["ollama", "google-gemini-2.0-flash"]
complex = ["anthropic-claude-3.5-haiku", "openai-gpt-5-mini"]

[provider_strategy.fallback_chains]
default = ["ollama", "google-gemini-2.0-flash", "anthropic-claude-3.5-haiku"]
EOF

# Step 2: Verify configuration loaded
cat ~/ExoFrame/exo.config.toml | grep -A 10 "provider_strategy"

# Part B: Cost-Based Provider Selection

# Step 3: Start daemon and verify provider selection
exoctl daemon stop 2>/dev/null || true
exoctl daemon start
sleep 3

# Step 4: Check which provider was selected
grep -i "provider.*selected\|LLM Provider" ~/ExoFrame/.exo/daemon.log | tail -5

# Step 5: Create simple request (should use free/local provider)
exoctl request "Simple task: list files" --tags simple

# Step 6: Monitor provider usage
sleep 10
grep -i "provider\|model" ~/ExoFrame/.exo/daemon.log | tail -10

# Part C: Fallback Chain Testing

# Step 7: Simulate provider failure (if ollama not running)
systemctl status ollama 2>/dev/null || echo "Ollama not running - fallback expected"

# Step 8: Create request and observe fallback
exoctl request "Test fallback behavior"
sleep 10

# Step 9: Verify fallback logged
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE action_type LIKE '%fallback%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter action_type=%fallback% --tail 5
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%fallback%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %fallback% --tail 5

# Part D: Health Check Validation

# Step 10: Test provider health checks
# This may require specific implementation

# Step 11: Verify unhealthy providers skipped
grep -i "health\|skip\|unavailable" ~/ExoFrame/.exo/daemon.log | tail -10

# Part E: Cost Tracking

# Step 12: Query cost tracking (if implemented)
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%cost%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %cost% --tail 5
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%tokens%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %tokens% --tail 5

# Step 13: Verify daily cost limit enforcement
# Create multiple requests and verify limit checking
```

### Expected Results

**Part A (Configuration):**

- Provider strategy configured successfully
- Configuration parsed and validated
- Settings applied at daemon startup

**Part B (Cost-Based Selection):**

- Free providers preferred when available
- Local providers used when configured
- Provider selection logged

**Part C (Fallback):**

- Fallback chain executed when primary fails
- Each fallback attempt logged
- Final provider selection recorded

**Part D (Health Checks):**

- Provider health checked before use
- Unhealthy providers skipped
- Health status logged

**Part E (Cost Tracking):**

- Token usage tracked
- Cost calculated and logged
- Daily limits enforced

### Verification

```bash
# Check provider strategy config
grep -A 15 "provider_strategy" ~/ExoFrame/exo.config.toml

# Verify provider selection logs
grep -i "provider\|model\|fallback" ~/ExoFrame/.exo/daemon.log | tail -20

# Check cost tracking
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%tokens%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %tokens% --tail 5
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE payload LIKE '%cost%' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --payload %cost% --tail 5
```

### Cleanup

```bash
# Remove test configuration (edit exo.config.toml manually)
# Or restore backup if created

# Stop daemon
exoctl daemon stop
```

### Pass Criteria

- [ ] Provider strategy configuration loaded
- [ ] Free providers preferred when configured
- [ ] Local providers used when allowed
- [ ] Fallback chains execute on failure
- [ ] Fallback attempts logged
- [ ] Health checks performed
- [ ] Unhealthy providers skipped
- [ ] Cost tracking functional
- [ ] Daily cost limits enforced
- [ ] Provider selection decisions logged

---

## Scenario MT-29: Git Operations and Traceability

**Purpose:** Verify comprehensive git integration and trace_id tracking across commits and branches.

### Preconditions

- ExoFrame workspace deployed
- At least one portal with git repository
- Daemon running

### Steps

```bash
# Part A: Git Repository Setup

# Step 1: Create test portal with git repo
mkdir -p /tmp/git-test-portal
cd /tmp/git-test-portal
git init
git config user.email "test@exoframe.dev"
git config user.name "ExoFrame Tester"
echo "# Test Project" > README.md
git add README.md
git commit -m "Initial commit"

# Step 2: Add portal to ExoFrame
cd ~/ExoFrame
exoctl portal add /tmp/git-test-portal GitTestPortal

# Part B: Branch Creation with Trace ID

# Step 3: Create request targeting portal
exoctl request "Add utils.ts file" --agent mock-agent --portal GitTestPortal

# Step 4: Wait for plan and approve
sleep 5
PLAN_ID=$(exoctl plan list --status review | head -1 | awk '{print $1}')
TRACE_ID=$(exoctl plan show $PLAN_ID | grep trace_id | awk '{print $2}')
exoctl plan approve $PLAN_ID

# Step 5: Wait for execution and verify branch created
sleep 10
cd /tmp/git-test-portal
git branch -a

# Step 6: Verify branch naming includes trace_id prefix
git branch -a | grep -E "feat/.*$(echo $TRACE_ID | cut -d'-' -f1)"

# Part C: Commit Message Formatting

# Step 7: Check commit message format
git log --oneline -5

# Step 8: Verify trace_id in commit footer
git log -1 --format="%B"
# Should contain [ExoTrace: trace-id]

# Step 9: Search commits by trace_id
git log --all --grep="ExoTrace: $TRACE_ID"

# Part D: Multi-Portal Git Status

# Step 10: Check git status across all portals
cd ~/ExoFrame
exoctl git status

# Step 11: List branches across all portals
exoctl git branches

# Part E: Git Log Search

# Step 12: Search git logs for trace_id
exoctl git log $TRACE_ID

# Step 13: Verify trace_id linkage
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$TRACE_ID';";
exoctl journal --filter trace_id=$TRACE_ID

# Part F: Merge Operations

# Step 14: Approve changeset (merge to main)
CHANGESET_ID=$(exoctl changeset list | grep pending | head -1 | awk '{print $1}')
exoctl changeset approve $CHANGESET_ID

# Step 15: Verify merge commit
cd /tmp/git-test-portal
git log --oneline -5
git show --format="%B" HEAD

# Step 16: Verify trace_id preserved in merge commit
git log --grep="ExoTrace: $TRACE_ID" --oneline
```

### Expected Results

**Part A (Setup):**

- Git repository initialized
- Portal added to ExoFrame
- Initial commit present

**Part B (Branch Creation):**

- Feature branch created automatically
- Branch name includes trace_id prefix
- Branch format: `feat/request-id` or `feat/trace-id-prefix`

**Part C (Commit Messages):**

- Commits include descriptive message
- Trace_id in commit footer as `[ExoTrace: trace-id]`
- Commits are searchable by trace_id

**Part D (Multi-Portal):**

- Git status shows all portals
- Branches listed across portals
- Commands work with multiple repos

**Part E (Log Search):**

- Trace_id search finds commits
- Cross-portal search works
- Results link to Activity Journal

**Part F (Merge Operations):**

- Merge commit created
- Trace_id preserved in merge
- Main branch updated

### Verification

```bash
# Verify branch naming convention
cd /tmp/git-test-portal
git branch -a | grep "feat/"

# Check commit message format
git log -1 --format="%B" | grep "ExoTrace"

# Verify git commands available
exoctl git --help

# Check Activity Journal linkage
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT COUNT(*) FROM activity WHERE trace_id LIKE '%$TRACE_ID%';";
exoctl journal --filter trace_id=%$TRACE_ID% | wc -l

# Verify merge completed
git log --oneline --graph -10
```

### Cleanup

```bash
# Remove test portal
exoctl portal remove GitTestPortal
rm -rf /tmp/git-test-portal
```

### Pass Criteria

- [ ] Feature branches created automatically
- [ ] Branch naming includes trace_id
- [ ] Commit messages include trace_id footer
- [ ] Trace_id format: `[ExoTrace: uuid]`
- [ ] Git log searchable by trace_id
- [ ] Multi-portal git status works
- [ ] Multi-portal branch listing works
- [ ] Merge commits preserve trace_id
- [ ] `exoctl git` commands functional
- [ ] Activity Journal links to git commits

---

## Scenario MT-30: CLI Flow Request Support

**Purpose:** Verify that flow requests can be created via CLI and properly routed to FlowRunner with correct metadata and activity logging.

### Preconditions

- ExoFrame workspace deployed
- Daemon running
- At least one flow defined in `Blueprints/Flows/`
- Portal configured (optional for flow requests)

### Steps

```bash
# Part A: Flow Request Creation

# Step 1: List available flows
exoctl flow list

# Step 2: Create flow request via CLI
FLOW_REQUEST_ID=$(exoctl request "Process user data pipeline" --flow data-processing-flow --agent mock-agent)

# Step 3: Verify request created with flow metadata
exoctl request show $FLOW_REQUEST_ID

# Step 4: Check Activity Journal for flow request creation
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$FLOW_REQUEST_ID' ORDER BY timestamp DESC LIMIT 5;";
exoctl journal --filter trace_id=$FLOW_REQUEST_ID --tail 5

# Part B: Flow Execution and Routing

# Step 5: Wait for flow execution to start
sleep 5

# Step 6: Verify flow routed to FlowRunner (not AgentRunner)
exoctl request show $FLOW_REQUEST_ID | grep -E "(flow|FlowRunner)"

# Step 7: Check flow execution progress
exoctl flow status $FLOW_REQUEST_ID

# Step 8: Monitor Activity Journal for flow steps
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$FLOW_REQUEST_ID' AND action_type LIKE '%flow%';";
exoctl journal --filter trace_id=$FLOW_REQUEST_ID --filter action_type=%flow%

# Part C: Flow Validation and Error Handling

# Step 9: Test invalid flow name
exoctl request "Test invalid flow" --flow nonexistent-flow --agent mock-agent 2>&1 || echo "Expected error for invalid flow"

# Step 10: Test flow without required dependencies
exoctl request "Test missing deps" --flow complex-workflow --agent mock-agent 2>&1 || echo "Expected error for missing dependencies"

# Step 11: Verify error logged in Activity Journal
INVALID_REQUEST_ID=$(exoctl request list | grep "Test invalid flow" | head -1 | awk '{print $1}')
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$INVALID_REQUEST_ID' AND action_type = 'error' ORDER BY timestamp DESC LIMIT 1;";
exoctl journal --filter trace_id=$INVALID_REQUEST_ID --filter action_type=error --tail 1

# Part D: Flow with Portal Integration

# Step 12: Create flow request with portal
PORTAL_FLOW_ID=$(exoctl request "Deploy feature with flow" --flow deployment-flow --portal TestPortal --agent mock-agent)

# Step 13: Verify portal metadata included
exoctl request show $PORTAL_FLOW_ID | grep portal

# Step 14: Check git operations triggered by flow
sleep 10
exoctl git status | grep TestPortal

# Part E: Flow Completion and Results

# Step 15: Wait for flow completion
sleep 15
exoctl request show $FLOW_REQUEST_ID | grep -E "(completed|failed)"

# Step 16: Verify final activity log
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT COUNT(*) FROM activity WHERE trace_id = '$FLOW_REQUEST_ID';";
exoctl journal --filter trace_id=$FLOW_REQUEST_ID | wc -l

# Step 17: Check flow execution summary
exoctl flow summary $FLOW_REQUEST_ID
```

### Expected Results

**Part A (Creation):**

- Flow list shows available flows
- Request created successfully with flow metadata
- Activity Journal shows flow request creation event
- Request metadata includes flow name and type

**Part B (Execution):**

- Request automatically routed to FlowRunner
- Flow execution starts within expected timeframe
- Activity Journal logs flow step progression
- Flow status shows execution progress

**Part C (Validation):**

- Invalid flow names rejected with clear error
- Missing dependencies cause validation failure
- Errors properly logged in Activity Journal
- Error messages are user-friendly

**Part D (Portal Integration):**

- Portal metadata correctly associated with flow request
- Git operations triggered when portal specified
- Flow execution respects portal context

**Part E (Completion):**

- Flow completes successfully or fails gracefully
- Activity Journal contains complete execution trace
- Flow summary provides execution overview
- Results accessible via CLI commands

### Verification

```bash
# Verify flow request metadata
exoctl request show $FLOW_REQUEST_ID | jq '.metadata.flow'

# Check routing decision
# sqlite3 ~/ExoFrame/.exo/journal.db "SELECT * FROM activity WHERE trace_id = '$FLOW_REQUEST_ID' AND action_type = 'request_routed' ORDER BY timestamp DESC LIMIT 1;";
exoctl journal --filter trace_id=$FLOW_REQUEST_ID --filter action_type=request_routed --tail 1

# Validate flow execution steps
exoctl flow status $FLOW_REQUEST_ID

# Verify error handling
exoctl request list | grep -E "(failed|error)" | wc -l

# Check portal-flow integration
exoctl git log $PORTAL_FLOW_ID
```

### Cleanup

```bash
# Clean up test requests (optional)
# exoctl request delete $FLOW_REQUEST_ID
# exoctl request delete $INVALID_REQUEST_ID
# exoctl request delete $PORTAL_FLOW_ID
```

### Pass Criteria

- [ ] `exoctl request --flow` creates flow requests
- [ ] Flow requests routed to FlowRunner automatically
- [ ] Flow metadata preserved in request
- [ ] Activity Journal logs flow execution steps
- [ ] Invalid flows rejected with clear errors
- [ ] Portal integration works with flows
- [ ] Flow completion status tracked correctly
- [ ] CLI flow commands (`list`, `status`, `summary`) functional
- [ ] Error conditions handled gracefully
- [ ] Git operations triggered for portal flows

---

## QA Sign-off Template

```markdown
## Manual QA Sign-off: v[VERSION]

**Tester:** [Name]
**Date:** [Date]
**Platform:** [Ubuntu 24.04 / macOS / Windows WSL2]

### Test Results

#### Installation & Setup

| ID    | Scenario           | Risk | Pass | Fail | Skip | Notes |
| ----- | ------------------ | ---- | ---- | ---- | ---- | ----- |
| MT-01 | Fresh Installation | High |      |      |      |       |
| MT-02 | Daemon Startup     | High |      |      |      |       |

#### Configuration & Blueprints

| ID    | Scenario                       | Risk   | Pass | Fail | Skip | Notes |
| ----- | ------------------------------ | ------ | ---- | ---- | ---- | ----- |
| MT-03 | Blueprint Management           | Medium |      |      |      |       |
| MT-16 | LLM Provider Selection         | Medium |      |      |      |       |
| MT-28 | Provider Strategy and Fallback | Medium |      |      |      |       |

#### Request & Plan Lifecycle

| ID    | Scenario                   | Risk   | Pass | Fail | Skip | Notes |
| ----- | -------------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-04 | Create Request             | High   |      |      |      |       |
| MT-05 | Plan Generation (Mock LLM) | High   |      |      |      |       |
| MT-06 | Plan Approval              | High   |      |      |      |       |
| MT-07 | Plan Rejection             | Medium |      |      |      |       |
| MT-18 | Multi-Agent Flow Execution | High   |      |      |      |       |

#### Plan Execution

| ID    | Scenario                              | Risk | Pass | Fail | Skip | Notes |
| ----- | ------------------------------------- | ---- | ---- | ---- | ---- | ----- |
| MT-08 | Plan Execution & Changeset Management | High |      |      |      |       |

#### Portal & Git Management

| ID    | Scenario                        | Risk   | Pass | Fail | Skip | Notes |
| ----- | ------------------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-09 | Portal Management               | High   |      |      |      |       |
| MT-29 | Git Operations and Traceability | Medium |      |      |      |       |
| MT-30 | CLI Flow Request Support        | Medium |      |      |      |       |

#### Memory & Knowledge

| ID    | Scenario                 | Risk   | Pass | Fail | Skip | Notes |
| ----- | ------------------------ | ------ | ---- | ---- | ---- | ----- |
| MT-17 | Memory Banks Integration | Medium |      |      |      |       |
| MT-26 | Activity Journal Queries | Low    |      |      |      |       |

#### Skills Management

| ID    | Scenario          | Risk | Pass | Fail | Skip | Notes |
| ----- | ----------------- | ---- | ---- | ---- | ---- | ----- |
| MT-19 | Skills Management | Low  |      |      |      |       |

#### Security & Permissions

| ID    | Scenario                  | Risk | Pass | Fail | Skip | Notes |
| ----- | ------------------------- | ---- | ---- | ---- | ---- | ----- |
| MT-27 | Advanced Security Testing | High |      |      |      |       |

#### Resilience & Error Handling

| ID    | Scenario                     | Risk   | Pass | Fail | Skip | Notes |
| ----- | ---------------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-10 | Daemon Crash Recovery        | High   |      |      |      |       |
| MT-12 | Invalid Request Handling     | Medium |      |      |      |       |
| MT-13 | Database Corruption Recovery | High   |      |      |      |       |

#### Performance & Concurrency

| ID    | Scenario                      | Risk   | Pass | Fail | Skip | Notes |
| ----- | ----------------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-14 | Concurrent Request Processing | Medium |      |      |      |       |
| MT-15 | File Watcher Reliability      | Medium |      |      |      |       |

#### Integration Testing

| ID    | Scenario             | Risk   | Pass | Fail | Skip | Notes |
| ----- | -------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-11 | Real LLM Integration | Medium |      |      |      |       |

#### TUI Dashboard

| ID    | Scenario                                 | Risk   | Pass | Fail | Skip | Notes |
| ----- | ---------------------------------------- | ------ | ---- | ---- | ---- | ----- |
| MT-20 | TUI Dashboard Launch and Core Views      | High   |      |      |      |       |
| MT-21 | TUI Monitor View - Log Streaming         | Medium |      |      |      |       |
| MT-22 | TUI Plan Reviewer View - Plan Management | High   |      |      |      |       |
| MT-23 | TUI Portal Manager View                  | Medium |      |      |      |       |
| MT-24 | TUI Daemon Control View                  | Medium |      |      |      |       |
| MT-25 | TUI Request Manager View                 | Medium |      |      |      |       |

### Summary

- **Total Scenarios:** 30
- **High Risk:** 13
- **Medium Risk:** 15
- **Low Risk:** 2
- **Passed:**
- **Failed:**
- **Skipped:**

### Recommended Testing Order (Risk-Based)

**Priority 1 (Critical Path - High Risk):**

1. MT-01: Fresh Installation
2. MT-02: Daemon Startup
3. MT-04: Create Request
4. MT-05: Plan Generation (Mock LLM)
5. MT-06: Plan Approval
6. MT-08: Plan Execution & Changeset Management
7. MT-09: Portal Management
8. MT-10: Daemon Crash Recovery
9. MT-13: Database Corruption Recovery
10. MT-18: Multi-Agent Flow Execution
11. MT-20: TUI Dashboard Launch
12. MT-22: TUI Plan Reviewer View
13. MT-27: Advanced Security Testing

**Priority 2 (Medium Risk):**
14. MT-03: Blueprint Management
15. MT-07: Plan Rejection
16. MT-11: Real LLM Integration
17. MT-12: Invalid Request Handling
18. MT-14: Concurrent Request Processing
19. MT-15: File Watcher Reliability
20. MT-16: LLM Provider Selection
21. MT-17: Memory Banks Integration
22. MT-21: TUI Monitor View
23. MT-23: TUI Portal Manager View
24. MT-24: TUI Daemon Control View
25. MT-25: TUI Request Manager View
26. MT-28: Provider Strategy and Fallback
27. MT-29: Git Operations and Traceability
28. MT-30: CLI Flow Request Support

**Priority 3 (Low Risk):**
29. MT-19: Skills Management
30. MT-26: Activity Journal Queries

### Issues Found

1. [Issue description + steps to reproduce]
2. ...

### Verdict

- [ ] **APPROVED** for release
- [ ] **BLOCKED** - see issues above
- [ ] **APPROVED with known issues** - see notes

**Notes:**

**Signature:** _____________________
**Date:** _____________________
```

---

_End of Manual Test Scenarios_
````
