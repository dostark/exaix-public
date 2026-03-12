# ExoFrame User Guide

- **Version:** 0.1.0
- **Date:** 2026-01-25

## 1. Introduction

This guide explains how to deploy and use an ExoFrame workspace. Unlike the development repository (where the code
lives), a **User Workspace** is where your actual agents, knowledge, and portals reside.

### 1.1 When to Use ExoFrame

ExoFrame is **not** a replacement for IDE-integrated AI assistants (Copilot, Cursor, Windsurf). Those tools excel at real-time, interactive coding help.

**Use ExoFrame when you need:**

| Scenario                          | Why ExoFrame                                          |
| --------------------------------- | ----------------------------------------------------- |
| **Overnight batch processing**    | Drop request, go to lunch, come back to results       |
| **Audit/compliance requirements** | Full trace_id linking: request → plan → code → commit |
| **Multi-project refactoring**     | Portals give agents context across multiple codebases |
| **Air-gapped environments**       | 100% local with Ollama (no cloud required)            |
| **Team accountability**           | Know who approved what change and why                 |

**Use IDE agents when you need:**

| Scenario                    | Why IDE Agent            |
| --------------------------- | ------------------------ |
| Quick code fix while coding | Faster, more interactive |
| Real-time pair programming  | Conversational interface |
| Exploring unfamiliar code   | Inline explanations      |

### 1.2 Key Concepts

- **Request:** What you want the agent to do (markdown file or CLI command).
- **Request Analysis:** A pre-processing step that extracts structured goals, requirements, and constraints from your request. This helps ensure the agent's plan is grounded in your actual intent.
- **Actionability Score:** A 0–100 score indicating if your request is ready for execution. A low score (typically <60) means the request is underspecified or ambiguous.
- **Complexity:** The system classifies a request as `Simple`, `Medium`, `Complex`, or `Epic` to select the most cost-effective and powerful engine for the task.
- **Plan:** Agent's proposal for how to accomplish the request.
- **Approval:** Human review gate before agent executes.
- **Trace ID:** UUID linking everything together for audit.

### 1.2.1 How to Improve Your Actionability Score

The **Actionability Score** is a measure of how "grounded" and "specified" your request is. A higher score leads to more accurate plans and fewer agent errors.

#### Strategies for High-Score Requests

1. **Define Explicit Goals:** Instead of "Fix the bug," use "Fix the null pointer exception in `handler.ts` when the user ID is missing."
2. **Reference Specific Files:** Use absolute paths or workspace-relative paths (e.g., `src/services/db.ts`). This allows the analyzer to verify the context exists.
3. **Provide Acceptance Criteria:** Use phrases like "The task is complete when..." or "Must pass all unit tests in `tests/`."
4. **Specify Constraints:** Mention any library versions, style guides, or performance requirements (e.g., "Must use Deno.test and maintain < 100ms latency").
5. **Use Markdown Requests:** For complex tasks, create a `.md` file in `Workspace/Active/` with headers for "Goal," "Context," and "Constraints" instead of a one-line CLI string.

#### Resolving Ambiguity

If `exoctl request show` reports an actionability score below 60, look for the **Ambiguities** section in the output. To resolve them:

- **Clarify the Scope:** If the agent is unsure which files to edit, provide the list.
- **Provide Samples:** If the task involves a new format, include a snippet of the desired output.
- **Run `exoctl request analyze`:** Use this command to re-run the analysis after you've updated the request description to see if the score improves.

### 1.3 Quick Request Examples

Submit requests via the CLI to get started quickly:

```bash
# 1. Simple task
exoctl request "Refactor src/utils.ts to use async/await"

# 2. High priority task with specific agent
exoctl request "Audit security in src/api/" --agent security-auditor --priority high

# 3. Task targeting a specific portal
exoctl request "Update README in the MyProject portal" --portal MyProject

# 4. Use a specific model configuration
exoctl request "Generate unit tests for src/math.ts" --model fast

# 5. Analyze a request without executing it
exoctl request analyze "Implement a new authentication flow" --mode hybrid
```

## 2. Installation & Deployment

### 2.1 Standard Deployment

From the repository root run the included script to create a user workspace (default: `~/ExoFrame`):

```bash
# From repo root
./scripts/deploy_workspace.sh /path/to/target-workspace

# Example (create a workspace in your home dir)
./scripts/deploy_workspace.sh ~/ExoFrame
```

**What the deploy script does:**

- Creates the standard runtime folders (`System`, `Memory`, `Workspace`, `Portals`).
- Copies runtime artifacts (`deno.json`, `import_map.json`, `scripts/`, `migrations/`, `src/`) into the target workspace.
- Runs `deno task cache` and `deno task setup` to initialize the database.
- Installs `exoctl` CLI globally to `~/.deno/bin/`.

### 2.2 Post-Deployment Setup

After deployment, ensure `~/.deno/bin` is in your PATH (one-time setup):

```bash
# Add to your shell profile
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Then optionally customize your configuration:

````bash
cd /path/to/target-workspace

# Review and customize config (optional)
cp exo.config.sample.toml exo.config.toml
nano exo.config.toml

# Start the daemon
deno task start
# or: exoctl daemon start

```bash
deno task start
````

### 2.3 Ollama Setup (Local LLM)

For fully local, air-gapped operation without cloud API dependencies, install Ollama:

```bash
# Install Ollama (Linux/macOS/WSL)
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version

# Start the Ollama service
ollama serve &
```

#### Choosing the Right Model

Select a model based on your hardware capabilities:

| Hardware Profile                       | Recommended Model       | Install Command                     | Performance               |
| -------------------------------------- | ----------------------- | ----------------------------------- | ------------------------- |
| **Minimal** (8GB RAM, CPU)             | `llama3.2:1b`           | `ollama pull llama3.2:1b`           | ⚡ Fast, basic reasoning  |
| **Standard** (16GB RAM, CPU)           | `llama3.2:3b`           | `ollama pull llama3.2:3b`           | ⚖️ Balanced speed/quality |
| **Developer** (16GB RAM, GPU)          | `codellama:7b-instruct` | `ollama pull codellama:7b-instruct` | 💻 Optimized for code     |
| **Power User** (32GB+ RAM, GPU 8GB+)   | `codellama:13b`         | `ollama pull codellama:13b`         | 🚀 Best code quality      |
| **Workstation** (64GB+ RAM, GPU 16GB+) | `codellama:34b`         | `ollama pull codellama:34b`         | 🏆 Premium quality        |

**Quick Start:**

```bash
# Pull the default model (recommended for most users)
ollama pull llama3.2

# For code-focused work, add codellama
ollama pull codellama:7b-instruct

# Test the model
ollama run llama3.2 "Explain what ExoFrame does in one sentence."
```

**Configure ExoFrame to use Ollama:**

```bash
# Option 1: Environment variable (temporary)
EXO_LLM_PROVIDER=ollama EXO_LLM_MODEL=llama3.2 exoctl daemon start

# Option 2: Config file (permanent)
# Add to [models.local] or set as default
cat >> ~/ExoFrame/exo.config.toml << 'EOF'
[agents]
default_model = "local"

[models.local]
provider = "ollama"
model = "llama3.2"
EOF
```

**Troubleshooting:**

| Issue                  | Solution                                   |
| ---------------------- | ------------------------------------------ |
| "connection refused"   | Run `ollama serve` to start the service    |
| Slow inference         | Use smaller model or enable GPU support    |
| Out of memory          | Switch to smaller model (3b or 1b variant) |
| GPU not detected (WSL) | Install NVIDIA drivers on Windows host     |

### 2.4 Cloud LLM Setup (Anthropic, OpenAI, Google)

ExoFrame supports premium cloud models for higher reasoning capabilities. These require API keys and an internet connection.

#### 2.4.1 API Key Configuration

Set your API keys as environment variables in your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
# Anthropic (Claude)
export ANTHROPIC_API_KEY="your-key-here"

# OpenAI (GPT)
export OPENAI_API_KEY="your-key-here"

# Google (Gemini)
export GOOGLE_API_KEY="your-key-here"
```

#### 2.4.2 Model Configuration

Configure your preferred models in `exo.config.toml`. You can define multiple named models and switch between them.

```toml
[agents]
default_model = "default"

[models.default]
provider = "anthropic"
model = "claude-opus-4.5"

[models.fast]
provider = "openai"
model = "gpt-5.2-pro-mini"

[models.local]
provider = "ollama"
model = "llama3.2"
```

#### 2.4.3 Provider Comparison

| Provider      | Best For                         | Recommended Model | Cost |
| ------------- | -------------------------------- | ----------------- | ---- |
| **Anthropic** | Complex reasoning, large context | `claude-opus-4.5` | $$$  |
| **OpenAI**    | General purpose, speed           | `gpt-5.2-pro`     | $$   |
| **Google**    | Long context, multimodal         | `gemini-3-pro`    | $$   |
| **Ollama**    | Privacy, zero cost, offline      | `llama3.2`        | Free |

### 2.4 Advanced Deployment Options

```bash
# fast deploy (runs deno tasks automatically)
./scripts/deploy_workspace.sh /home/alice/ExoFrame

# deploy but skip automatic execution of deno tasks (safer in constrained envs)
./scripts/deploy_workspace.sh --no-run /home/alice/ExoFrame

# alternative: only scaffold the target layout and copy templates
./scripts/scaffold.sh /home/alice/ExoFrame

# once scaffolded, initialize runtime manually
cd /home/alice/ExoFrame
deno task cache
deno task setup
deno task start
```

## 3. Workspace Overview

### 3.1 Directory Structure

- **Workspace/**: Drop requests here.
- **Memory/**: Memory Banks for execution history and project knowledge.
- **.exo/**: Database and logs (do not touch manually).
- **Portals/**: Symlinks to your projects.

### 3.2 Memory Banks

Memory Banks provide structured storage for ExoFrame's execution history, project context, and cross-project learnings. This system offers CLI-based access to your workspace's knowledge with automatic learning extraction.

#### Directory Structure

```text
Memory/
├── Global/             # Cross-project learnings
│   ├── learnings.json  # Global insights and patterns
│   └── learnings.md    # Human-readable learnings
├── Pending/            # Memory updates awaiting approval
│   └── {proposal-id}.json
├── Execution/          # Execution history (agent runs)
│   ├── {trace-id}/
│   │   ├── summary.md
│   │   ├── context.json
│   │   └── changes.diff
├── Projects/           # Project-specific knowledge
│   ├── {portal-name}/
│   │   ├── overview.md
│   │   ├── patterns.md
│   │   ├── decisions.md
│   │   └── references.md
└── Index/              # Search indices
    ├── tags.json
    └── embeddings/     # Semantic search vectors
```

#### CLI Access

Use the `exoctl memory` commands to interact with Memory Banks:

```bash
# List all global learnings
exoctl memory list

# List project memory banks
exoctl memory project list

# Show project details
exoctl memory project show MyProject

# Search across all memory (keyword)
exoctl memory search "database migration"

# Search by tags
exoctl memory search --tags "error-handling,async"

# List execution history
exoctl memory execution list --limit 10

# View pending memory updates
exoctl memory pending list

# Approve a pending update
exoctl memory pending approve <proposal-id>

# Reject with reason
exoctl memory pending reject <proposal-id> --reason "Duplicate"

# Rebuild search indices
exoctl memory rebuild-index
```

#### Features

- **Automatic Learning Extraction**: Insights are extracted from agent executions
- **Pending Workflow**: Review and approve/reject proposed learnings
- **Global + Project Scope**: Learnings can be global or project-specific
- **Tag-Based Search**: Filter by tags for precise results
- **Keyword Search**: Full-text search with frequency ranking
- **Embedding Search**: Semantic similarity search (deterministic mock vectors)
- **Structured Data**: JSON metadata alongside human-readable markdown
- **CLI Integration**: Direct access without external dependencies

#### Pending Workflow

When an agent execution completes, ExoFrame automatically extracts learnings:

1. **Extract**: Insights from `lessons_learned` and execution patterns

1.
1.

This ensures quality control over what enters the knowledge base.

## 4. CLI Reference

### 4.1 Installation

The ExoFrame CLI (`exoctl`) provides a comprehensive interface for managing plans, reviews, git operations, the daemon, and portals.

**Automatic Installation (recommended):**

The deploy script automatically installs `exoctl` globally. You just need to ensure `~/.deno/bin` is in your PATH:

```bash
# Add to your ~/.bashrc or ~/.zshrc (one-time setup)
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
exoctl --help
```

**Manual Installation:**

If you need to reinstall or the automatic installation failed:

```bash
# From your ExoFrame workspace
cd ~/ExoFrame

# Install globally with config (required for import map resolution)
deno install --global --allow-all --config deno.json -n exoctl src/cli/exoctl.ts

# For Deno 1.x (older versions)
# deno install --allow-all --config deno.json -n exoctl src/cli/exoctl.ts
```

**Alternative: Use via task runner (no global install):**

```bash
cd ~/ExoFrame
deno task cli <command>

# Examples:
deno task cli daemon status
deno task cli plan list
```

**Verify CLI is working:**

```bash
# Check exoctl is accessible
exoctl --help

# Check daemon status
exoctl daemon status
```

### 4.1a Working with the TUI Dashboard

ExoFrame provides a powerful Terminal User Interface (TUI) dashboard for real-time monitoring, plan review, portal management, and daemon control—all from your terminal. The TUI dashboard is the recommended cockpit for day-to-day operations.

#### Launching the Dashboard

To start the dashboard, run:

```bash
exoctl dashboard
```

You can also specify a workspace:

```bash
exoctl dashboard --workspace /path/to/ExoFrame
```

For help and available options:

```bash
exoctl dashboard --help
```

#### Dashboard Views

The dashboard includes 7 integrated views, each accessible via the view picker (`p`) or `Tab` navigation:

| Icon | View                | Description                              |
| ---- | ------------------- | ---------------------------------------- |
| 🌀   | **Portal Manager**  | Manage project portals and aliases       |
| 📋   | **Plan Reviewer**   | Review and approve agent-generated plans |
| 📊   | **Monitor**         | Real-time activity log streaming         |
| ⚙️   | **Daemon Control**  | Start, stop, and manage the daemon       |
| 🤖   | **Agent Status**    | Monitor agent health and activity        |
| 📥   | **Request Manager** | Track and manage requests                |
| 💾   | **Memory View**     | Browse and manage Memory Banks           |

#### Key Features

- **Multi-Pane Split View:** Run multiple views side-by-side
- **Real-time Log Streaming:** Filter and search Activity Journal logs
- **Plan Approval Workflow:** Review diffs and approve/reject plans
- **Portal Management:** Add, remove, refresh, and configure portals
- **Daemon Control:** Full lifecycle management from the TUI
- **Notification System:** Alerts for important events
- **Layout Persistence:** Save and restore your preferred layouts
- **Keyboard-First Navigation:** Vim-style keys supported
- **Accessibility:** High contrast mode and screen reader support

#### Global Navigation

| Key                 | Action                     |
| ------------------- | -------------------------- |
| `Tab` / `Shift+Tab` | Switch between panes/views |
| `1`-`7`             | Jump directly to pane      |
| `?` / `F1`          | Show help overlay          |
| `p`                 | Open view picker           |
| `n`                 | Toggle notification panel  |
| `R`                 | Refresh current view       |
| `q` / `Esc`         | Quit dashboard             |

#### Split View (Multi-Pane Mode)

The dashboard supports multiple panes for side-by-side view comparison:

| Key | Action                               |
| --- | ------------------------------------ |
| `v` | Split pane vertically (left/right)   |
| `h` | Split pane horizontally (top/bottom) |
| `c` | Close current pane                   |
| `z` | Maximize/restore pane (zoom)         |
| `s` | Save current layout                  |
| `r` | Restore saved layout                 |
| `d` | Reset to default layout              |

**Layout Persistence:** Press `s` to save your layout, `r` to restore it later. Layouts are saved to `~/.exoframe/tui_layout.json`.

#### Using the Dashboard

- **Navigation:** Use `Tab` or arrow keys to switch between panes. Use `↑↓` or `jk` within lists.
- **Split View:** Press `v` for vertical split or `h` for horizontal. Each pane can display a different view.
- **Plan Approval:** In the Plan Reviewer, press `a` to approve or `r` to reject. Use `Enter` to view details.
- **Log Monitoring:** The Monitor streams logs in real time. Press `Space` to pause, `f` to filter.
- **Portal Management:** Add (`a`), delete (`d`), or refresh (`r`) portals from the Portal Manager.
- **Daemon Control:** Press `s` to start, `k` to stop, `r` to restart the daemon.

#### Example Workflow

```bash
# 1. Launch the dashboard
exoctl dashboard

# 2. Split the view to see Plans and Monitor side-by-side
#    Press 'v' to split, then 'p' to pick a view

# 3. Navigate to Plan Reviewer (Tab or number key)
# 4. Review and approve a plan (Enter to view, 'a' to approve)
# 5. Watch execution logs in Monitor pane
# 6. Check agent status in Agent Status view
# 7. Save your layout for next time (press 's')
```

#### Accessibility Features

ExoFrame TUI includes accessibility support:

- **High Contrast Mode:** Enhanced colors for visibility. Set `tui.high_contrast = true` in config.
- **Screen Reader Support:** Status announcements. Set `tui.screen_reader = true`.
- **Keyboard-Only:** All features accessible without mouse.

#### Troubleshooting

- **Dashboard fails to launch:** Ensure your terminal supports ANSI escape codes and raw mode.
- **Keys not responding:** Check that your terminal is in focus and not in paste mode.
- **Layout not saving:** Verify write permissions to `~/.exoframe/` directory.
- **Colors look wrong:** Try toggling high contrast mode or check `$TERM` environment variable.

For complete keyboard shortcuts, see [TUI Keyboard Reference](./TUI_Keyboard_Reference.md).

For technical details, see the [Implementation Plan](./ExoFrame_Implementation_Plan.md#step-95-tui-cockpit-implementation-plan).

### 4.2 Command Groups

#### **Dashboard Command** - Terminal UI Cockpit

**Split View (Multi-Pane) Mode:**

- Press `s` or use the on-screen menu to split the dashboard into two or more panes.
- Each pane can show a different view (e.g., Monitor + Plans, Plans + Portals).
- Resize panes with `Ctrl+Arrow` keys. Switch focus with `Tab`.
- Preset layouts (vertical/horizontal) available in the settings panel (`?`).
- Example: Review a plan in one pane while watching logs in another.

The `exoctl dashboard` command launches the interactive Terminal User Interface (TUI) cockpit for ExoFrame. This dashboard provides real-time monitoring, plan review, portal management, and daemon control—all from your terminal.

```bash
# Launch the TUI dashboard
exoctl dashboard

# Optional: run in a specific workspace
exoctl dashboard --workspace /path/to/ExoFrame

# See help and options
exoctl dashboard --help
```

**Features:**

- Real-time log streaming and filtering
- Review and approve/reject plans with diff view
- Manage portals (add, remove, refresh, view status)
- Control daemon (start, stop, restart, view status)
- View agent health and activity
- Keyboard navigation, theming, and notifications

**Example workflow:**

```bash
# 1. Launch the dashboard
$ exoctl dashboard

# 2. Navigate between Monitor, Plans, Portals, Daemon, and Agents views
#    (use Tab/Arrow keys, see on-screen help)

# 3. Approve a plan from the Plan Reviewer view
# 4. Watch logs in real time in the Monitor view
# 5. Add or refresh a portal in the Portal Manager
# 6. Start/stop the daemon from the Daemon Control view
```

**Troubleshooting:**

- If the dashboard fails to launch, ensure your terminal supports ANSI escape codes and your workspace is initialized.
- For accessibility or theming issues, see the dashboard settings panel (press `?` in the TUI).

See the [Implementation Plan](./ExoFrame_Implementation_Plan.md#step-95-tui-cockpit-implementation-plan) for technical details and roadmap.

ExoFrame CLI is organized into ten main command groups:

#### **Request Commands** - Primary Interface for Creating Requests

> **⚠️ RECOMMENDED:** Use `exoctl request` to create requests. Do NOT manually create files in `/Workspace/Requests/` — this is error-prone and bypasses validation.

The `exoctl request` command is the **primary interface** for submitting work to ExoFrame agents:

```bash
# Basic usage - just describe what you want
exoctl request "Implement user authentication for the API"

# With options
exoctl request "Add rate limiting" --agent senior_coder --priority high
exoctl request "Fix security bug" --priority critical --portal MyProject
exoctl request "Patch release branch" --portal MyProject --target-branch release_1.2
exoctl request "Build a web app" --flow web-development

# From file (for complex/long requests)
exoctl request --file ~/requirements.md
exoctl request -f ./feature-spec.md --agent architect

# List pending requests
exoctl request list
exoctl request list --status pending

# Show request details
exoctl request show <trace-id>
exoctl request show a1b2c3d4

# Dry run (see what would be created)
exoctl request "Test" --dry-run

# JSON output (for scripting)
exoctl request "Test" --json

# Inject skills to override agent limitations
exoctl request "Audit and write report" --agent security-expert --skills documentation-driven

# Trigger immediate intent analysis
exoctl request "Implement a new authentication flow" --analyze --engine llm
exoctl request "Update documentation" --analyze --engine heuristic

# Analyze an existing request
exoctl request analyze a1b2c3d4
exoctl request analyze "Existing Request Subject" --engine llm
```

**Options:**

| Option            | Short | Description                                                                      |
| ----------------- | ----- | -------------------------------------------------------------------------------- |
| `--agent`         | `-a`  | Target agent blueprint (default: `default`, mutually exclusive with --flow)      |
| `--flow`          |       | Target multi-agent flow (mutually exclusive with --agent)                        |
| `--priority`      | `-p`  | Priority: `low`, `normal`, `high`, `critical`                                    |
| `--portal`        |       | Portal alias for project context                                                 |
| `--target-branch` |       | Target/base branch when working inside a portal (stored as `target_branch`)      |
| `--skills`        |       | Comma-separated list of skills to inject (e.g., `documentation-driven,file-ops`) |
| `--file`          | `-f`  | Read description from file                                                       |
| `--interactive`   | `-i`  | Interactive mode with prompts                                                    |
| `--dry-run`       |       | Preview without creating                                                         |
| `--json`          |       | Machine-readable output                                                          |
| `--analyze`       |       | Trigger immediate intent analysis (Phase 45)                                     |
| `--engine`        | `-e`  | Analysis engine: `heuristic` (default), `llm`                                    |

**Example workflow:**

```bash
# 1. Create a request with one command
$ exoctl request "Add input validation to all API endpoints"
✓ Request created: request-a1b2c3d4.md
  Trace ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Priority: normal
  Agent: default
  Path: /home/user/ExoFrame/Workspace/Requests/request-a1b2c3d4.md
  Next: Daemon will process this automatically

# 2. Check if plan was generated
$ exoctl plan list
📋 Plans (1):

🔍 add-validation-a1b2c3d4
   Status: review
   Trace: a1b2c3d4...

# 3. List your requests
$ exoctl request list
📥 Requests (1):

🟢 a1b2c3d4
   Status: pending
   Agent: default
   Created: user@example.com @ 2025-11-27T10:30:00.000Z
```

**Why CLI instead of manual files?**

| Aspect         | Manual File Creation     | `exoctl request`           |
| -------------- | ------------------------ | -------------------------- |
| Frontmatter    | Must write TOML manually | Auto-generated             |
| Trace ID       | Must generate UUID       | Auto-generated             |
| Validation     | None until daemon reads  | Immediate                  |
| Audit trail    | Not logged               | Logged to Activity Journal |
| Error handling | Silent failures          | Clear error messages       |
| Speed          | ~30 seconds              | ~2 seconds                 |

#### **Plan Commands** - Review AI-generated plans

Review and approve plans before agents execute them:

> **⚠️ IMPLEMENTATION STATUS:** Plan approval moves plans to `Workspace/Active/` where they are detected and parsed (Steps 5.12.1-5.12.2 ✅). Automatic agent-driven execution (Steps 5.12.3-5.12.6) is in development. In the agent-driven model, LLM agents will have direct portal access through scoped tools (read_file, write_file, git_create_branch, git_commit) and will create reviews themselves. See [ExoFrame Architecture](./ExoFrame_Architecture.md#plan-execution-flow-step-512) for details.

```bash
# List all plans awaiting review
exoctl plan list
exoctl plan list --status review          # Filter by status

# Show plan details
exoctl plan show <plan-id>

# Approve a plan (moves to Workspace/Active for detection and parsing)
exoctl plan approve <plan-id>

# Approve with skills injection for execution
exoctl plan approve <plan-id> --skills file-ops,testing-best-practices

# Reject a plan with reason
exoctl plan reject <plan-id> --reason "Approach too risky"

# Request revisions with comments
exoctl plan revise <plan-id> \
  --comment "Add error handling" \
  --comment "Include unit tests"
```

**Example workflow:**

```bash
# 1. Check what's pending
$ exoctl plan list
📋 Plans (2):

🔍 implement-auth
   Status: review
   Trace: 550e8400...

⚠️ refactor-db
   Status: needs_revision
   Trace: 7a3c9b12...

# 2. Review a plan
$ exoctl plan show implement-auth

# 3. Approve or request changes
$ exoctl plan approve implement-auth
✓ Plan 'implement-auth' approved
  Moved to: Workspace/Active/implement-auth.md
  Status: Plan detected and parsed (agent-driven execution in development)

  Note: Currently, approved plans are detected and validated. Future: agents
  will have portal access to create reviews directly. Agent-driven execution
  (Step 5.12.3-5.12.6) is in development.
```

#### **Review Commands** - Review agent-generated outputs

After agents execute plans and create git branches or artifacts, review their outputs:

```bash
# List all pending reviews (agent-created branches and artifacts)
exoctl review list
exoctl review list --status pending

# Show review details with diff (for code) or content (for artifacts)
exoctl review show <request-id>
exoctl review show feat/implement-auth-550e8400

# Approve review (merges branch to main or marks artifact approved)
exoctl review approve <request-id>

# Reject review (deletes branch or marks artifact rejected)
exoctl review reject <request-id> --reason "Failed code review"
```

**Cleanup behavior (code reviews):**

- **Reject:** Deletes the feature branch (best-effort cleanup if the branch is checked out in a worktree).
- **Approve:** Merges into the review’s recorded base branch (often `main`).
  - If the review was executed in an **isolated worktree**, ExoFrame also removes the worktree checkout and its pointer at `Memory/Execution/{trace-id}/worktree`, and then deletes the feature branch.
  - If the review was executed on a normal branch checkout, ExoFrame merges but does not automatically delete the feature branch.
- **Merge conflict on approve (worktree reviews):** ExoFrame attempts `git merge --abort` and removes the worktree checkout + pointer to avoid leaving orphaned worktrees. The feature branch is kept so a human can resolve and re-merge.

**Example workflow:**

```bash
# 1. See what code changes are ready
$ exoctl review list
📋 Reviews (1):

📌 implement-auth (feat/implement-auth-550e8400)
   Files: 12
   Created: 2025-11-25 14:30:22
   Trace: 550e8400...

# 2. Review the changes
$ exoctl review show implement-auth
📋 Review: implement-auth

Branch: feat/implement-auth-550e8400
Files changed: 12
Commits: 3

Commits:
  a3f21b89 - Add JWT authentication
  c4d8e123 - Add login endpoint
  f9a23c45 - Add auth middleware

Diff:
[full diff output...]

# 3. Approve or reject
$ exoctl review approve implement-auth
✓ Review approved
  Branch: feat/implement-auth-550e8400
  Merged to main: 3b5f7a21
  Files changed: 12
```

#### **Git Commands** - Repository operations with trace_id

Query git history and track changes by trace_id:

```bash
# List all branches with trace metadata
exoctl git branches
exoctl git branches --pattern "feat/*"     # Filter pattern

# Show repository status
exoctl git status

# Search commits by trace_id
exoctl git log --trace <trace-id>
```

**Example workflow:**

```bash
# Find all branches created by agents
$ exoctl git branches --pattern "feat/*"
🌳 Branches (3):

  feat/implement-auth-550e8400
   Last commit: a3f21b89 (11/25/2025)
   Trace: 550e8400...

  feat/add-tests-7a3c9b12
   Last commit: b2c31a45 (11/24/2025)
   Trace: 7a3c9b12...

# Check workspace status
$ exoctl git status
📊 Repository Status

Branch: main

Modified (2):
  M src/auth/handler.ts
  M src/shared/schemas/config.ts

# Find all commits for a specific request
$ exoctl git log --trace 550e8400-e29b-41d4-a716-446655440000
📜 Commits for trace 550e8400...

a3f21b89 - Add JWT authentication
  Author: exoframe-agent
  Date: 11/25/2025, 2:30:45 PM
```

#### **Portal Commands** - Manage external project access

Portals are symlinked directories that give agents controlled access to external projects:

```bash
# Add a new portal
exoctl portal add <target-path> <alias> [--default-branch <branch>] [--execution-strategy <branch|worktree>]
exoctl portal add ~/Dev/MyWebsite MyWebsite
exoctl portal add ~/Dev/MyWebsite MyWebsite --default-branch main --execution-strategy worktree

# List all configured portals
exoctl portal list

# Portal listing output:
# 🔗 Configured Portals (2):
#
# MyWebsite
#   Status: Active ✓
#   Target: /home/user/Dev/MyWebsite
#   Symlink: ~/ExoFrame/Portals/MyWebsite
#   Context: ~/ExoFrame/Memory/Projects/MyWebsite.md
#
# MyAPI
#   Status: Broken ⚠
#   Target: /home/user/Dev/MyAPI (not found)
#   Symlink: ~/ExoFrame/Portals/MyAPI

# Show detailed information about a portal
exoctl portal show <alias>
exoctl portal show MyWebsite

# Remove a portal (deletes symlink, archives context card)
exoctl portal remove <alias>
exoctl portal remove MyWebsite
exoctl portal remove MyWebsite --keep-card  # Keep context card

# Verify portal integrity
exoctl portal verify                        # Check all portals
exoctl portal verify MyWebsite              # Check specific portal

# Refresh context card (re-scan project)
exoctl portal refresh <alias>
exoctl portal refresh MyWebsite
```

**Portal base branch and execution strategy:**

- `exoctl request --portal <alias> --target-branch <branch>` stores `target_branch` in request/plan frontmatter and uses it as the review's merge target (`base_branch`) for portal code reviews.
- If `target_branch` is not provided, ExoFrame falls back to the portal's configured `default_branch` (if set), and otherwise auto-detects the repository's default branch.
- `--execution-strategy` controls how ExoFrame runs write-capable portal work:
  - `branch` (default): create a feature branch in the portal repo checkout.
  - `worktree`: create an isolated git worktree per execution (good for parallel requests) and record `worktree_path` on the review.

For worktree executions, ExoFrame also writes a discoverability pointer at `Memory/Execution/{trace-id}/worktree` (symlink when possible; `PATH.txt` fallback).

**Worktree maintenance:**

- `exoctl git worktrees list [--portal <alias>] [--repo <path>]` shows all Git worktrees for a repository (useful to locate the active execution worktree).
- `exoctl git worktrees prune [--portal <alias>] [--repo <path>]` prunes stale worktree metadata (useful after manual deletion or crashes).

**What happens when adding a portal:**

1. Creates symlink: `~/ExoFrame/Portals/<alias>` → `<target-path>`

1.
1.
1.
1.

**Portal verification checks:**

- Symlink exists and is valid
- Target directory exists and is readable
- Target path matches config
- Deno has necessary permissions
- Context card exists

**Safety features:**

- Portal removal moves context cards to `_archived/` instead of deleting
- Broken portals are detected and flagged (target moved/deleted)
- OS-specific handling:
  - **Windows:** Creates junction points if symlinks unavailable
  - **macOS:** Prompts for Full Disk Access on first portal
  - **Linux:** Checks inotify limits for filesystem watching

**Example workflows:**

```bash
# 1. Add a new portal
$ exoctl portal add ~/Dev/MyWebsite MyWebsite
✓ Validated target: /home/user/Dev/MyWebsite
✓ Created symlink: ~/ExoFrame/Portals/MyWebsite
✓ Generated context card: ~/ExoFrame/Memory/Portals/MyWebsite.md
✓ Updated configuration: exo.config.toml
✓ Validated permissions
✓ Logged to Activity Journal
⚠️  Daemon restart required: exoctl daemon restart

# 2. List all portals and check status
$ exoctl portal list
🔗 Configured Portals (3):

MyWebsite
  Status: Active ✓
  Target: /home/user/Dev/MyWebsite
  Symlink: ~/ExoFrame/Portals/MyWebsite
  Context: ~/ExoFrameMemory/Portals/MyWebsite.md

MyAPI
  Status: Active ✓
  Target: /home/user/Dev/MyAPI
  Symlink: ~/ExoFrame/Portals/MyAPI
  Context: ~/ExoFrameMemory/Portals/MyAPI.md

OldProject
  Status: Broken ⚠
  Target: /home/user/Dev/OldProject (not found)
  Symlink: ~/ExoFrame/Portals/OldProject

# 3. View detailed portal information
$ exoctl portal show MyWebsite
📁 Portal: MyWebsite

Target Path:    /home/user/Dev/MyWebsite
Symlink:        ~/ExoFrame/Portals/MyWebsite
Status:         Active ✓
Context Card:   ~/ExoFrameMemory/Portals/MyWebsite.md
Permissions:    Read/Write ✓
Created:        2025-11-26 10:30:15
Last Verified:  2025-11-26 14:22:33

# 4. Verify portal integrity
$ exoctl portal verify
🔍 Verifying Portals...

MyWebsite: OK ✓
  ✓ Target accessible
  ✓ Symlink valid
  ✓ Permissions correct
  ✓ Context card exists

MyAPI: OK ✓
  ✓ Target accessible
  ✓ Symlink valid
  ✓ Permissions correct
  ✓ Context card exists

OldProject: FAILED ✗
  ✗ Target not found: /home/user/Dev/OldProject
  ✓ Symlink exists
  ✓ Context card exists
  ⚠️  Portal is broken - target directory missing

Summary: 1 broken, 2 healthy

# 5. Refresh context card after project changes
$ exoctl portal refresh MyWebsite
🔄 Refreshing context card for 'MyWebsite'...
✓ Scanned target directory
✓ Detected changes: 3 new files
✓ Updated context card
✓ Preserved user notes
✓ Logged to Activity Journal

# 6. Remove a portal safely
$ exoctl portal remove OldProject
⚠️  Remove portal 'OldProject'?
This will:
  - Delete symlink: ~/ExoFrame/Portals/OldProject
  - Archive context card: ~/ExoFrameMemory/Portals/_archived/OldProject_20251126.md
  - Update configuration
Continue? (y/N): y

✓ Removed symlink
✓ Archived context card
✓ Updated configuration
✓ Logged to Activity Journal
⚠️  Daemon restart recommended: exoctl daemon restart
```

#### **Blueprint Commands** - Manage agent definitions

Blueprints define agent personas, capabilities, and system prompts. They are **required** for request processing - missing blueprints cause requests to fail.

```bash
# Create a new agent blueprint
exoctl blueprint create <agent-id> --name "Agent Name" --model <provider:model>
exoctl blueprint create senior-coder --name "Senior Coder" --model anthropic:claude-sonnet

# Create with full options
exoctl blueprint create security-auditor \
  --name "Security Auditor" \
  --model openai:gpt-4o-mini \
  --description "Specialized agent for security analysis" \
  --capabilities code_review,vulnerability_scanning \
  --system-prompt-file ~/prompts/security.txt

# Create from template (faster setup)
exoctl blueprint create my-coder --name "My Coder" --template coder
exoctl blueprint create my-reviewer --name "My Reviewer" --template reviewer
exoctl blueprint create test-agent --name "Test Agent" --template mock

# List all available blueprints
exoctl blueprint list

# Show blueprint details
exoctl blueprint show <agent-id>
exoctl blueprint show senior-coder

# Validate blueprint format
exoctl blueprint validate <agent-id>
exoctl blueprint validate senior-coder

# Edit blueprint in $EDITOR
exoctl blueprint edit <agent-id>

# Remove a blueprint
exoctl blueprint remove <agent-id>
exoctl blueprint remove security-auditor --force # Skip confirmation
```

#### **Flow Commands** - Manage multi-agent workflows

Flows allow you to coordinate multiple agents to perform complex tasks.

```bash
# List all available flows
exoctl flow list
exoctl flow list --json

# Show flow details and dependency graph
exoctl flow show <flow-id>
exoctl flow show research-pipeline

# Validate a flow definition
exoctl flow validate <flow-id>
exoctl flow validate research-pipeline
```

##### Flow Step Types

Flows support various step types for different orchestration patterns:

| Step Type  | Purpose               | Key Features                    |
| ---------- | --------------------- | ------------------------------- |
| `agent`    | Execute an agent      | Agent invocation with context   |
| `gate`     | Quality checkpoint    | Pass/fail criteria, retry logic |
| `branch`   | Conditional branching | Expression-based path selection |
| `parallel` | Concurrent execution  | Multiple steps in parallel      |
| `loop`     | Iterative processing  | Repeat until condition met      |

##### Condition Expressions

Flow conditions use a safe expression syntax:

```yaml
# Simple comparisons
condition: "status == 'success'"
condition: "confidence >= 80"

# Logical operators
condition: "status == 'success' && score >= 70"
condition: "isComplete || hasTimeout"

# Step result access
condition: "steps.validation.passed == true"
condition: "steps.analysis.score >= threshold"
```

##### Quality Gates

Gates enforce quality standards before proceeding:

```yaml
step:
  type: gate
  name: code_review_gate
  condition: "score >= 80"
  criteria:
    - CODE_CORRECTNESS
    - HAS_TESTS
  onPass: continue
  onFail:
    action: feedback
    maxRetries: 3
```

**Built-in Evaluation Criteria:**

| Criteria           | Description                           |
| ------------------ | ------------------------------------- |
| `CODE_CORRECTNESS` | Validates syntax and semantics        |
| `HAS_TESTS`        | Ensures test coverage exists          |
| `FOLLOWS_SPEC`     | Matches specification requirements    |
| `IS_SECURE`        | Checks security best practices        |
| `PERFORMANCE_OK`   | Validates performance characteristics |

##### Feedback Loops

Feedback loops enable iterative refinement:

```yaml
step:
  type: loop
  name: refinement_loop
  maxIterations: 5
  exitCondition: "quality >= 90"
  onMaxIterations: proceed_with_best
  steps:
    - type: agent
      agent: reviewer
    - type: gate
      condition: "review.passed"
```

**Available Templates:**

| Template     | Model                   | Best For                          |
| ------------ | ----------------------- | --------------------------------- |
| `default`    | ollama:codellama:13b    | General-purpose tasks             |
| `coder`      | anthropic:claude-sonnet | Software development              |
| `reviewer`   | openai:gpt-4o-mini      | Code review and quality           |
| `architect`  | anthropic:claude-opus   | System design and architecture    |
| `researcher` | openai:gpt-5            | Research and analysis             |
| `gemini`     | google:gemini-3-flash   | Multimodal AI with fast responses |
| `mock`       | mock:test-model         | Testing and CI/CD                 |

**Blueprint File Structure:**

```markdown
+++
agent_id = "senior-coder"
name = "Senior Coder"
model = "anthropic:claude-3-sonnet"
capabilities = ["code_generation", "debugging"]
created = "2025-12-02T10:00:00Z"
created_by = "user@example.com"
version = "1.0.0"
+++

# Senior Coder Agent

System prompt with <thought> and <content> tags...
```

**Example workflow:**

```bash
# 1. Create a custom agent
$ exoctl blueprint create my-agent \
  --name "My Custom Agent" \
  --model anthropic:claude-sonnet
✓ Blueprint created: Blueprints/Agents/my-agent.md

# 2. List all agents
$ exoctl blueprint list
senior-coder (anthropic:claude-3-sonnet)
security-auditor (openai:gpt-4o-mini)
my-agent (anthropic:claude-sonnet)

# 3. Use in requests
$ exoctl request "Review code" --agent security-auditor
```

**Common errors and solutions:**

```bash
# Error: Target path does not exist
$ exoctl portal add /nonexistent/path BadPortal
✗ Error: Target path does not exist: /nonexistent/path
✗ Portal creation failed - no changes made

Solution: Verify the path exists and is accessible

# Error: Alias already exists
$ exoctl portal add ~/Dev/Another MyWebsite
✗ Error: Portal 'MyWebsite' already exists

Solution: Use a different alias or remove the existing portal first

# Error: Invalid alias characters
$ exoctl portal add ~/Dev/Project "My Project!"
✗ Error: Alias contains invalid characters. Use alphanumeric, dash, underscore only.

Solution: Use only letters, numbers, dashes, and underscores

# Error: Permission denied (macOS)
$ exoctl portal add ~/Desktop/MyApp MyApp
✗ Error: Permission denied - Full Disk Access required

Solution: System Settings → Privacy & Security → Full Disk Access → Enable for Terminal

# Warning: inotify limit (Linux)
⚠️  Warning: File watch limit may be insufficient for large portals
Current limit: 8192 watches

Solution: Increase limit with: echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

**Alias validation rules:**

- Must contain only alphanumeric characters, dashes, and underscores
- Cannot start with a number
- Cannot be empty
- Cannot use reserved names: `System`, `Workspace`, `Memory`, `Blueprints`, `Active`, `Archive`
- Maximum length: 50 characters

#### **Daemon Commands** - Control the ExoFrame daemon

Manage the background daemon process:

```bash
# Start the daemon (runs in background, returns to prompt)
exoctl daemon start

# Alternative: start via deno task (also backgrounds)
deno task start:bg

# For development: run in foreground (blocks terminal, shows live output)
deno task start

# Stop the daemon gracefully
exoctl daemon stop

# Restart the daemon
exoctl daemon restart

# Check daemon status
exoctl daemon status

# View daemon logs
exoctl daemon logs
exoctl daemon logs --lines 100           # Show last 100 lines
exoctl daemon logs --follow              # Stream logs (like tail -f)
```

#### **Skill Commands** - Manage Procedural Skills

Skills are reusable procedural knowledge that agents can learn and apply. They represent patterns, techniques, and best practices that improve agent performance over time.

```bash
# List all available skills
exoctl skill list

# Show details of a specific skill
exoctl skill show <skill-id>

# Match skills for a given request
exoctl skill match "Implement user authentication"

# Derive a new skill from recent learnings
exoctl skill derive --name "API Security Patterns"

# Create a new skill manually
exoctl skill create <name> --description "Skill description"
```

**Skill Types:**

- **Procedural Skills:** Step-by-step processes (e.g., "Code Review Process")
- **Pattern Skills:** Reusable patterns (e.g., "Error Handling Patterns")
- **Domain Skills:** Specialized knowledge (e.g., "React Best Practices")
- **Tool Skills:** How to use specific tools effectively

**Example workflow:**

```bash
# Find relevant skills for a task
$ exoctl skill match "Build a REST API"
🔍 Matching skills for: "Build a REST API"

API Design Patterns (95% match)
  Description: Best practices for REST API design
  Usage: 23 times, Success: 21/23

Authentication Implementation (87% match)
  Description: Secure authentication patterns
  Usage: 15 times, Success: 14/15

# Use a skill in a request
$ exoctl request "Build a REST API for user management" --skill api-design-patterns
```

#### **MCP Commands** - Model Context Protocol Server

The Model Context Protocol (MCP) allows external AI clients to interact with your ExoFrame workspace using standardized tools.

```bash
# Start the MCP server
exoctl mcp start

# Start with debug logging
exoctl mcp start --log-level debug

# Check MCP server status
exoctl mcp status
```

**Available MCP Tools:**

- `exoframe_create_request`: Create new requests in your workspace
- `exoframe_list_plans`: View pending plans for approval
- `exoframe_approve_plan`: Approve plans for execution
- `exoframe_query_journal`: Search the Activity Journal
- File system tools: `read_file`, `write_file`, `list_dir`, etc. (scoped to workspace)

**Client Integration:**

**Claude Desktop:**

```json
{
  "mcpServers": {
    "exoframe": {
      "command": "exoctl",
      "args": ["mcp", "start"],
      "env": {
        "EXOFRAME_ROOT": "/path/to/your/workspace"
      }
    }
  }
}
```

**Example workflow:**

```bash
# Start MCP server
$ exoctl mcp start
🚀 MCP Server started on stdio
  Tools: exoframe_create_request, exoframe_list_plans, exoframe_approve_plan, exoframe_query_journal
  File system access: scoped to workspace

# External client can now use ExoFrame tools
# Client: "Create a request to refactor the authentication module"
# ExoFrame: ✓ Request created: request-abc123.md
```

#### **Memory Banks CLI** - Access Execution History and Project Knowledge

ExoFrame provides comprehensive CLI commands to access your workspace's memory banks.

**Memory Commands:**

```bash
# List all projects
exoctl memory projects

# Get project details
exoctl memory project MyProject

# List execution history
exoctl memory execution

# Get specific execution details
exoctl memory execution trace-abc123

# Search across all memory banks
exoctl memory search "database migration"

# Search within specific project
exoctl memory search --project MyProject "API changes"
```

**Features:**

- **Execution History:** Every agent run automatically stored with full context
- **Project Knowledge:** Persistent context for ongoing projects
- **Full-text Search:** Find patterns across all memory banks
- **Structured Data:** JSON metadata alongside human-readable summaries
- **No Dependencies:** Direct CLI access without external tools

---

**Example workflow:**

```bash
# Check if daemon is running
$ exoctl daemon status
🔧 Daemon Status

Version: 1.0.0
Status: Running ✓
PID: 12345
Uptime: 2:15:30

# View recent logs
$ exoctl daemon logs --lines 20

# Follow logs in real-time
$ exoctl daemon logs --follow
[2025-11-25 14:30:15] INFO: Daemon started
[2025-11-25 14:30:16] INFO: Watching /Workspace/Requests
[2025-11-25 14:32:45] INFO: New request detected: implement-auth
...
```

### 4.3 Quick Reference

**Most Common Operations:**

```bash
# Create requests quickly (instead of manual file creation)
exoctl request "Add user authentication"    # Quick request
exoctl request "Fix bug" --priority high    # With priority
exoctl request -i                           # Interactive mode

# Human review workflow
exoctl plan list                           # See pending plans
exoctl plan show <id>                      # Review plan details
exoctl plan approve <id>                   # Approve for execution
exoctl plan reject <id> --reason "..."     # Reject with feedback

# Code review workflow
exoctl review list                      # See agent-created branches
exoctl review show <id>                 # Review code changes
exoctl review approve <id>              # Merge to main
exoctl review reject <id> --reason "..."# Delete branch

# Portal management
exoctl portal add ~/Dev/MyProject MyProject  # Mount external project
exoctl portal list                           # Show all portals
exoctl portal show MyProject                 # Portal details
exoctl portal remove MyProject               # Unmount portal
exoctl portal verify                         # Check portal integrity
exoctl portal refresh MyProject              # Update context card

# Daemon management
exoctl daemon start                        # Start background process
exoctl daemon stop                         # Stop gracefully
exoctl daemon status                       # Check health
exoctl daemon logs --follow                # Watch logs

# Git operations
exoctl git branches                        # List all branches
exoctl git status                          # Working tree status
exoctl git log --trace <id>                # Find commits by trace

# Memory and skills
exoctl memory search "authentication"      # Search execution history
exoctl skill match "API design"            # Find relevant skills
exoctl skill list                          # List all skills

# MCP server
exoctl mcp start                          # Start MCP server for external clients
exoctl mcp status                          # Check MCP server status

# Activity Journal
exoctl journal --tail 20                  # View recent activity
exoctl journal --filter action_type=error # Find errors
exoctl journal --count                    # Count activities by type
```

### 4.4 Activity Logging

All human actions via CLI are automatically logged to the Activity Journal:

- Plan approvals/rejections → `plan.approved`, `plan.rejected`
- Review approvals/rejections → `review.approved`, `review.rejected`
- All actions tagged with `actor='human'`, `via='cli'`
- User identity captured from git config or OS username

Query activity history:

```bash
# View recent activity history
exoctl journal --tail 10

# Filter by trace ID to see complete request lifecycle
TRACE_ID=$(exoctl journal --tail 1 --format json | jq -r '.[0].trace_id')
exoctl journal --filter trace_id=$TRACE_ID

# Audit all errors across the system
exoctl journal --filter action_type=error
```

### 4.5 Output Formatting

All CLI commands output human-readable text by default. JSON output is supported for scripting:

```bash
# Human-readable (default)
exoctl plan list

# Machine-readable JSON output
exoctl plan list --format json
```

### 4.6 File Format Reference

ExoFrame uses **YAML frontmatter** for all markdown files (requests, plans, reports). This format provides structured metadata for processing and search.

#### YAML Frontmatter Format

Request, plan, and report files use `---` delimiters with YAML syntax:

```markdown
---
trace_id: "550e8400-e29b-41d4-a716-446655440000"
created: 2025-11-28T10:30:00.000Z
status: pending
priority: normal
agent: default
source: cli
created_by: user@example.com
tags: [feature, api]
---

# Request

Implement user authentication for the API...
```

#### Why YAML Frontmatter?

| Benefit                 | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| **Memory Banks search** | Structured metadata enables powerful search and filtering |
| **CLI commands work**   | CLI can filter/sort by status, priority, agent            |
| **Standard format**     | Most markdown tools expect YAML (`---` delimiters)        |
| **Auto-generated**      | `exoctl request` creates proper frontmatter automatically |

#### Frontmatter Fields Reference

**Request Files** (`Workspace/Requests/request-*.md`):

| Field        | Type     | Required | Example                                  |
| ------------ | -------- | -------- | ---------------------------------------- |
| `trace_id`   | string   | ✓        | `"550e8400-e29b-41d4-a716-446655440000"` |
| `created`    | datetime | ✓        | `2025-11-28T10:30:00.000Z`               |
| `status`     | string   | ✓        | `pending`, `processing`, `completed`     |
| `priority`   | string   | ✓        | `low`, `normal`, `high`, `critical`      |
| `agent`      | string   | ✓        | `default`, `senior_coder`, `architect`   |
| `source`     | string   | ✓        | `cli`, `file`, `interactive`             |
| `created_by` | string   | ✓        | `user@example.com`                       |
| `portal`     | string   |          | `MyProject` (optional project context)   |
| `tags`       | array    |          | `[feature, api]` (optional tags)         |

**Plan Files** (`Workspace/Plans/*.md`):

| Field        | Type     | Required | Example                                  |
| ------------ | -------- | -------- | ---------------------------------------- |
| `trace_id`   | string   | ✓        | `"550e8400-e29b-41d4-a716-446655440000"` |
| `request_id` | string   | ✓        | `"implement-auth"`                       |
| `status`     | string   | ✓        | `review`, `approved`, `rejected`         |
| `created_at` | datetime | ✓        | `2025-11-28T10:35:00.000Z`               |
| `agent_id`   | string   | ✓        | `senior_coder`                           |

**Report Files** (`Memory/Reports/*.md`):

| Field          | Type     | Required | Example                                  |
| -------------- | -------- | -------- | ---------------------------------------- |
| `trace_id`     | string   | ✓        | `"550e8400-e29b-41d4-a716-446655440000"` |
| `request_id`   | string   | ✓        | `"implement-auth"`                       |
| `status`       | string   | ✓        | `completed`, `failed`                    |
| `completed_at` | datetime | ✓        | `2025-11-28T11:00:00.000Z`               |
| `agent_id`     | string   | ✓        | `senior_coder`                           |
| `branch`       | string   |          | `feat/implement-auth-550e8400`           |

#### YAML Syntax Quick Reference

```yaml
# Strings (quotes optional for simple values)
status: pending
agent: default

# Strings with special characters (quotes required)
trace_id: "550e8400-e29b-41d4-a716-446655440000"
created_by: "user@example.com"

# Dates (ISO 8601 format)
created: 2025-11-28T10:30:00.000Z

# Arrays (inline format)
tags: [feature, api, urgent]

# Booleans
approved: true
```

> **💡 TIP:** Use `exoctl request` to create requests with proper frontmatter automatically. Manual file creation is error-prone.

### 4.7 Bootstrap (Reference Implementation)

```bash
# 1. Clone or deploy workspace
./scripts/deploy_workspace.sh ~/ExoFrame

# 2. Navigate to workspace
cd ~/ExoFrame

# 3. Cache dependencies
deno task cache

# 4. Initialize database and system
deno task setup

# 5. Start daemon
exoctl daemon start
# or: deno task start

# 6. Verify daemon is running
exoctl daemon status
```

**Complete workflow example:**

```bash
# 1. Create a request (quick method - recommended)
exoctl request "Implement user authentication for the API"
# Output: ✓ Request created: request-a1b2c3d4.md

# Alternative: Manual file creation (if you need custom frontmatter)
# echo "Implement user authentication" > ~/ExoFrame/Workspace/Requests/auth.md

# 2. Agent will generate a plan automatically
# Wait a moment... (daemon watches Workspace/Requests)

# 3. Review the plan
exoctl plan list
exoctl plan show implement-auth

# 4. Approve the plan
exoctl plan approve implement-auth

# 5. Review changes created by agents
exoctl review list
exoctl review show implement-auth

# 6. Approve the review to merge
exoctl review approve implement-auth

# Current Status:
# ✅ Request creation automated
# ✅ Plan generation automated
# ✅ Plan approval workflow complete
# ✅ Plan detection and parsing implemented
# ✅ Review creation and approval available
# 🚧 Full agent-driven execution in development

# All completed steps logged to Activity Journal with trace_id
```

## 5. Operational Procedures

### 5.1 Backup

**Before Backup:**

```bash
# Stop daemon to ensure database consistency
deno task stop
```

**Backup Command:**

```bash
# Backup ExoFrame directory
tar -czf exoframe-backup-$(date +%Y%m%d).tar.gz \
  --exclude='*.log' \
  --exclude='deno-dir' \
  ~/ExoFrame

# Verify backup
tar -tzf exoframe-backup-*.tar.gz | head
```

**What to backup separately:**

- Portals are symlinks, not actual code
- Actual project code lives in `~/Dev/*` (backup separately)
- OS keyring secrets (handled by OS backup tools)

### 5.2 Restore

```bash
# Extract backup
tar -xzf exoframe-backup-20251120.tar.gz -C ~/

# Verify portal symlinks still work
cd ~/ExoFrame/Portals
ls -la

# Recreate broken symlinks if projects moved
deno task mount ~/Dev/MyProject MyProject

# Restart daemon
deno task start
```

### 5.3 Upgrade ExoFrame

```bash
# 1. Stop daemon
deno task stop

# 2. Backup current version (see 12.1)
tar -czf exoframe-pre-upgrade.tar.gz ~/ExoFrame

# 3. Pull latest code
cd ~/ExoFrame
git pull origin main

# 4. Check for breaking changes
cat CHANGELOG.md

# 5. Run migrations if needed
deno task migrate

# 6. Clear Deno cache (forces re-compilation)
deno cache --reload src/main.ts

# 7. Restart daemon
deno task start

# 8. Verify
deno task status
```

### 5.4 Troubleshooting

**Agent Stuck / Unresponsive:**

```bash
# Check daemon status
exoctl daemon status

# View recent daemon logs
exoctl daemon logs --lines 50

# Check active git branches
exoctl git branches --pattern "feat/*"

# View agent activity
exoctl review list

# Restart daemon if needed
exoctl daemon restart
```

**Plan Not Processing:**

```bash
# List pending plans
exoctl plan list

# Check if plan is approved
exoctl plan show <id>

# Approve if status is 'review'
exoctl plan approve <id>

# Check daemon logs for errors
exoctl daemon logs --follow
```

**Code Changes Not Visible:**

```bash
# List all reviews
exoctl review list

# Show specific review details
exoctl review show <id>

# Check git status
exoctl git status

# View branches
exoctl git branches
```

**Database Corruption:**

```bash
# Stop daemon first
exoctl daemon stop

# Check integrity
sqlite3 ~/ExoFrame/.exo/journal.db "PRAGMA integrity_check;"

# If corrupted, restore from backup
cp ~/backups/journal.db ~/ExoFrame/.exo/journal.db

# If no backup, rebuild empty database
rm ~/ExoFrame/.exo/journal.db
deno task setup --db-only

# Restart daemon
exoctl daemon start
```

**Permission Errors:**

```bash
# Check current Deno permissions
cat deno.json

# View daemon status for errors
exoctl daemon status
exoctl daemon logs

# Verify workspace paths are accessible
ls -la ~/ExoFrame/Workspace
ls -la ~/ExoFrame/.exo

# Restart with correct permissions
exoctl daemon restart
```

### 5.5 Uninstall

```bash
# 1. Stop daemon
exoctl daemon stop

# 2. Remove ExoFrame directory
rm -rf ~/ExoFrame

# 3. Remove CLI tool from PATH (if installed globally)
rm ~/.deno/bin/exoctl

# 4. Portals are just symlinks - actual projects untouched
# Nothing to clean unless you want to remove project directories
```

### 5.6 Health Check

```bash
# Check daemon status
exoctl daemon status

# Output:
# 🔧 Daemon Status
# Version: 1.0.0
# Status: Running ✓
# PID: 12345
# Uptime: 2:15:30

# View recent activity
exoctl daemon logs --lines 20

# Check git repository status
exoctl git status

# List pending work
exoctl plan list
exoctl review list

# View all branches
exoctl git branches
```

### 5.7 Common Workflows

**Daily Operations:**

```bash
# Morning: Check what's pending
exoctl plan list
exoctl review list

# Review and approve plans
exoctl plan show <id>
exoctl plan approve <id>

# Review and merge code
exoctl review show <id>
exoctl review approve <id>

# End of day: Check daemon health
exoctl daemon status
```

**Weekly Maintenance:**

```bash
# Stop daemon for backup
exoctl daemon stop

# Backup workspace (see section 5.1)
tar -czf exoframe-backup-$(date +%Y%m%d).tar.gz ~/ExoFrame

# Clean up old branches
exoctl git branches | grep -v main | xargs git branch -d

# Restart daemon
exoctl daemon start
```

### 5.8 Portal Workflows

Portals enable agents to work directly in external project repositories (e.g., `~/git/MyProject`) instead of the deployed workspace. This ensures git operations, feature branches, and reviews track actual source code changes in the correct repositories.

#### How Portal Execution Works

When you submit a request targeting a portal:

1. **Execution Environment**: Agent runs in portal workspace (e.g., `~/git/MyProject`)

1.
1.

#### Cleanup & lifecycle notes

- **Portals:** A portal is a stable symlink entry under `Portals/`. It is not auto-removed; use `exoctl portal remove <alias>` when you no longer want it mounted.
- **Reviews:** Review records remain for audit/history, but their _working artifacts_ (branches/worktrees) may be cleaned up as part of approve/reject.
- **Worktree execution:** Some portal runs use an isolated Git worktree checkout. A pointer is recorded at `Memory/Execution/{trace-id}/worktree` pointing to the worktree directory.
  - **Approve/Reject:** Worktree checkout + pointer are removed to avoid stale worktrees.
  - **Approve:** The feature branch is deleted after cleanup.
  - **Merge conflict:** ExoFrame aborts the merge (best effort) and removes the worktree checkout + pointer, but keeps the feature branch for manual conflict resolution.

#### Code Analysis with Portal

Read-only agents (like `code-analyst`) execute in portal workspace but don't create git branches. Instead, they produce analysis artifacts stored in `Memory/Execution/`:

```bash
# Add portal to workspace
exoctl portal add ~/git/MyProject my-project

# Submit analysis request (read-only agent)
exoctl request --portal my-project "Analyze src/ architecture"

# Review results (artifact, not git review)
exoctl review list
exoctl review show artifact-<id>

# Approve the analysis
exoctl review approve artifact-<id>
```

**Analysis Workflow:**

- Agent reads portal files for context
- No git branch created (read-only operation)
- Analysis stored as markdown artifact with frontmatter status
- Review via unified `exoctl review` command

#### Feature Development with Portal

Write-capable agents (like `feature-developer`) create feature branches in the portal repository:

```bash
# Submit feature request (write-capable agent)
exoctl request --portal my-project --agent feature-developer "Add user authentication"

# Review changes in portal repository
cd ~/git/MyProject
git log --oneline  # Shows feature branch
git diff main      # Shows actual code changes

# Or review via ExoFrame
exoctl review list
exoctl review show <review-id>

# Approve and merge
exoctl review approve <review-id>
```

**Development Workflow:**

- Agent creates feature branch in portal's .git/
- Code modifications happen in portal workspace
- Review shows only modified files (not entire workspace)
- Feature branch ready for review in source repository

#### Portal Git Integration

**Automatic Behaviors:**

- ✅ Write agents create feature branches in portal repository
- ✅ Reviews reference portal repo, not deployed workspace
- ✅ File modifications happen in portal workspace
- ✅ Git history maintained in correct repository

**Manual Steps:**

- Add portals: `exoctl portal add /path/to/repo alias`
- Review changes: `exoctl review show <id>`
- Approve changes: `exoctl review approve <id>`
- Merge feature branch in portal repo after execution

#### Troubleshooting Portal Issues

##### Issue: Portal not found

```bash
# Verify portal exists
exoctl portal list

# Check portal configuration
exoctl portal show my-project
```

##### Issue: Git operations in wrong repository

```bash
# Verify portal has .git directory
ls -la ~/git/MyProject/.git

# Check review repository reference
exoctl review show <id> | grep repository
```

##### Issue: Review shows all workspace files

```bash
# This indicates portal execution didn't work
# Verify request used --portal flag
exoctl request --portal my-project "..."

# Check that portal path is correct
exoctl portal show my-project
```

#### Migration from Workspace Execution

**Before (workspace execution):**

```bash
exoctl request "Analyze code"
# Result: Operates in ~/ExoFrame
```

**After (portal execution - recommended):**

```bash
exoctl request --portal my-project "Analyze code"
# Result: Operates in ~/git/MyProject
```

**Backward Compatibility:**

- Requests without `--portal` continue to work in deployed workspace
- Existing reviews remain valid
- No data migration required

---

## 6. Advanced Agent Features

ExoFrame includes sophisticated agent orchestration capabilities that enhance output quality, reliability, and context awareness. This section covers the advanced features available for agent configuration.

### 6.1 Reflexion Pattern (Self-Critique)

The Reflexion pattern enables agents to critique and improve their own outputs iteratively.

#### How It Works

1. Agent generates initial response

1.
1.

#### Configuration

Enable reflexion in agent blueprint frontmatter:

```toml
+++
agent_id = "quality-reviewer"
name = "Quality Reviewer"
model = "anthropic:claude-opus-4.5"
capabilities = ["read_file", "search_files"]
reflexive = true
max_reflexion_iterations = 3
confidence_required = 80
+++
```

| Field                      | Default | Description                          |
| -------------------------- | ------- | ------------------------------------ |
| `reflexive`                | `false` | Enable self-critique loop            |
| `max_reflexion_iterations` | `3`     | Maximum refinement passes            |
| `confidence_required`      | `80`    | Minimum confidence (0-100) to accept |

#### When to Use

- **Code review agents**: Catch issues the first pass might miss
- **Technical writing**: Ensure accuracy and completeness
- **Security audits**: Multi-pass vulnerability analysis
- **Quality-critical tasks**: Any output requiring high confidence

#### Trade-offs

- **Higher quality**: More thorough analysis
- **Increased latency**: 2-4x longer response time
- **Higher cost**: Multiple LLM calls per request

### 6.2 Confidence Scoring

Every agent output includes a confidence score indicating how certain the agent is about its response.

#### Understanding Confidence Scores

| Score  | Level     | Interpretation                                         |
| ------ | --------- | ------------------------------------------------------ |
| 90-100 | Very High | Confident response, proceed with caution-free approval |
| 70-89  | High      | Good confidence, standard review recommended           |
| 50-69  | Medium    | Moderate uncertainty, careful review needed            |
| 30-49  | Low       | Significant uncertainty, human verification required   |
| 0-29   | Very Low  | Agent uncertain, consider alternate approach           |

#### Human Review Triggers

Outputs with confidence below threshold are flagged for human review:

```toml
[agents]
confidence_threshold = 70  # Flag outputs below this score
```

When flagged, you'll see warnings in the plan output:

```bash
⚠️ Low confidence (55%): Agent uncertain about database migration strategy.
   Reasoning: Multiple valid approaches exist; recommend architectural review.
```

### 6.3 Session Memory

Session Memory automatically provides relevant context from past interactions to agents.

#### How It Works

1. **Request received**: User submits a request

1.
1.
1.

#### Configuration

```toml
[agents.memory]
enabled = true           # Enable session memory
topK = 5                # Number of memories to inject
threshold = 0.3         # Minimum relevance score (0-1)
maxContextLength = 4000  # Maximum characters for memory context
includeExecutions = true # Include past execution history
includeLearnings = true  # Include approved learnings
includePatterns = true   # Include project patterns
```

#### Memory Types

| Type           | Description                            |
| -------------- | -------------------------------------- |
| **Learnings**  | Approved insights from past executions |
| **Patterns**   | Code patterns identified in projects   |
| **Decisions**  | Architectural decisions and rationale  |
| **Executions** | Past agent execution summaries         |

#### Viewing Memory Context

To see what memories were injected for a request:

```bash
exoctl request show <request-id> --show-context
```

### 6.4 Retry & Recovery

Agents automatically retry failed operations with intelligent backoff.

#### Retry Behavior

| Attempt | Wait Time  | With Jitter |
| ------- | ---------- | ----------- |
| 1       | 1 second   | 0.5-1.5s    |
| 2       | 2 seconds  | 1.0-3.0s    |
| 3       | 4 seconds  | 2.0-6.0s    |
| 4       | 8 seconds  | 4.0-12.0s   |
| 5       | 16 seconds | 8.0-24.0s   |

#### Configuration

```toml
[agents.retry]
maxAttempts = 5
initialDelay = 1000      # ms
maxDelay = 60000         # ms
backoffMultiplier = 2.0
jitterFactor = 0.5
retryableErrors = [
  "rate_limit_exceeded",
  "service_unavailable",
  "timeout",
  "connection_reset"
]
```

#### Non-Retryable Errors

Some errors are not retried:

- Authentication failures
- Invalid input/schema errors
- Permission denied
- Resource not found

### 6.5 Structured Output Validation

Agent outputs are validated against JSON schemas with automatic repair.

#### Validation Process

1. **Extract JSON**: Parse JSON from agent response

1.
1.

#### Auto-Repair Capabilities

| Issue              | Auto-Fix                |
| ------------------ | ----------------------- |
| Trailing commas    | Removed                 |
| Missing quotes     | Added around keys       |
| Unescaped newlines | Escaped                 |
| Comments in JSON   | Stripped                |
| Truncated output   | Detected (not repaired) |

#### Validation Errors

When validation fails, you'll see detailed errors:

```bash
❌ Plan validation failed:
  - steps[2].dependencies: Expected array, got string
  - estimatedDuration: Missing required field
  - steps[0].tools[1]: Unknown tool "invalid_tool"
```

### 6.6 Agent Templates

ExoFrame provides templates for common agent patterns:

| Template               | Pattern                  | Best For                     |
| ---------------------- | ------------------------ | ---------------------------- |
| `pipeline-agent`       | Sequential processing    | Transformations in workflows |
| `collaborative-agent`  | Multi-agent coordination | Handoffs and consensus       |
| `reflexive-agent`      | Self-critique            | Quality-critical tasks       |
| `research-agent`       | Information gathering    | Exploration, documentation   |
| `judge-agent`          | LLM-as-Judge             | Quality gates, approvals     |
| `specialist-agent`     | Domain expertise         | Security, architecture       |
| `conversational-agent` | Multi-turn dialogue      | Interactive sessions         |

#### Using Templates

```bash
# Copy template
cp Blueprints/Agents/templates/reflexive-agent.md.template \
   Blueprints/Agents/my-agent.md

# Edit placeholders
# Validate
exoctl blueprint validate my-agent

# Use
exoctl request "Task" --agent my-agent
```

See `Blueprints/Agents/templates/README.md` for detailed template documentation.

### 6.7 Troubleshooting

#### High Latency

If agent responses are slow:

1. **Check reflexion settings**: Reduce `max_reflexion_iterations`

1.
1.

#### Low Confidence Outputs

If agents consistently produce low-confidence outputs:

1. **Check prompt clarity**: Ensure request is specific

1.
1.

#### Retry Exhaustion

If agents fail after max retries:

1. **Check service status**: Provider may be down

1.
1.

#### Memory Not Found

If relevant memories aren't being injected:

1. **Check threshold**: Lower `threshold` value (e.g., 0.1)

1.
1.

---

## 7. Configuration

ExoFrame is designed to be fully configurable without modifying source code. The primary configuration file is `exo.config.toml` (located in your workspace root).

### 5.1 The "No Magic Values" Policy

We enforce a strict "No Magic Values" policy. This means all timeouts, limits, model names, and provider settings are defined in your configuration file, not hardcoded in the application.

- **Defaults:** A `exo.config.sample.toml` is provided with sensible defaults.
- **Customization:** Copy `exo.config.sample.toml` to `exo.config.toml` to override any setting.

### 5.2 Key Configuration Areas

The main configuration areas in `exo.config.toml` are:

- **[system]:** Workspace paths, logging level
- **[watcher]:** File watching settings (debounce, extensions)
- **[models]:** AI provider configurations
- **[agents]:** Agent blueprint settings
- **[mcp]:** Model Context Protocol client configuration

**Example configuration:**

```toml
[agents]
default_model = "claude-opus-4.5"
max_tokens = 8192

[system]
watcher_timeout_sec = 60
debounce_ms = 200

[mcp]
server_name = "exoframe-mcp"
version = "1.0.0"
enable_stdio = true
enable_sse = false
```

**Best Practices:**

1. **Never modify `src/shared/constants.ts` directly** - All magic values are defined in `exo.config.toml`

1.

### 5.3 Environment Variable Reference

ExoFrame supports environment variables for runtime configuration overrides and API authentication.

#### 5.3.1 Provider API Keys

Cloud providers require API keys set as environment variables:

| Variable            | Provider           | Required When            |
| ------------------- | ------------------ | ------------------------ |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | Using Anthropic provider |
| `OPENAI_API_KEY`    | OpenAI (GPT)       | Using OpenAI provider    |
| `GOOGLE_API_KEY`    | Google (Gemini)    | Using Google provider    |

**Setup (permanent):**

```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.bashrc
echo 'export OPENAI_API_KEY="your-key-here"' >> ~/.bashrc
echo 'export GOOGLE_API_KEY="your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

#### 5.3.2 Runtime Configuration Overrides

Four environment variables allow runtime override of AI provider configuration:

| Variable             | Purpose                    | Validation        | Example                                          |
| -------------------- | -------------------------- | ----------------- | ------------------------------------------------ |
| `EXO_LLM_PROVIDER`   | Override AI provider       | ProviderType enum | `export EXO_LLM_PROVIDER=ollama`                 |
| `EXO_LLM_MODEL`      | Override model name        | Non-empty string  | `export EXO_LLM_MODEL=llama3.2`                  |
| `EXO_LLM_BASE_URL`   | Override provider endpoint | Valid URL         | `export EXO_LLM_BASE_URL=http://localhost:11434` |
| `EXO_LLM_TIMEOUT_MS` | Override request timeout   | 1000-300000ms     | `export EXO_LLM_TIMEOUT_MS=60000`                |

**Usage Example:**

```bash
# Temporarily use local Ollama for a single request
EXO_LLM_PROVIDER=ollama EXO_LLM_MODEL=llama3.2 exoctl request "Explain the codebase"

# Set for the current session
export EXO_LLM_PROVIDER=anthropic
export EXO_LLM_MODEL=claude-opus-4.5
exoctl daemon start
```

**Validation:** All `EXO_LLM_*` variables are validated via Zod schema. Invalid values (e.g., timeout below 1000ms, invalid provider name) are rejected with clear warning messages.

**Best Practice:** Use `exo.config.toml` for persistent configuration. Use environment variables for temporary overrides or testing different providers.

#### 5.3.3 Troubleshooting Environment Variables

**Invalid environment variable warnings:**

If you see warnings like "Invalid EXO_LLM_TIMEOUT_MS: must be ≥ 1000", check:

1. **Value is within valid range** (timeout: 1000-300000ms)

1.
1.

**Environment variables not taking effect:**

1. **Restart the daemon** after setting env vars: `exoctl daemon restart`

1.

For more details, see `templates/exo.config.sample.toml` and [Technical Specification](./dev/ExoFrame_Technical_Spec.md).

## 8. Model Context Protocol (MCP) Server

ExoFrame includes a built-in MCP server, allowing generic AI clients (like Claude Desktop or IDE extensions) to interact with your workspace using standardized tools.

### 8.1 Starting the Server

The standard way to run the MCP server is via the `exoctl` CLI:

```bash
# Start in stdio mode (default, for local clients)
exoctl mcp start

# Start with detailed logging
exoctl mcp start --log-level debug
```

### 8.2 Available Tools

When connected, AI agents have access to high-level domain tools:

- **`exoframe_create_request`**: Create a new request in your workspace.
- **`exoframe_list_plans`**: List pending plans.
- **`exoframe_approve_plan`**: Approve a plan for execution.
- **`exoframe_query_journal`**: Search the Activity Journal for past events.
- **FileSystem & Git**: Standard tools (`read_file`, `write_file`, `git_status`, etc.) are also available, scoped to your workspace.

### 8.3 Client Integration

**Claude Desktop:**
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "exoframe": {
      "command": "exoctl",
      "args": ["mcp", "start"],
      "env": {
        "EXOFRAME_ROOT": "/path/to/your/workspace"
      }
    }
  }
}
```

See `templates/mcp/` for more client configuration examples.

## 9. Security

ExoFrame is built with a "Safety First" architecture, focusing on local execution and explicit permissions.

### 9.1 Key Security Features

- **Sandboxing:** File system access is strictly scoped to your Workspace and configured Portals. Path traversal attempts are blocked.
- **API Keys:** Keys are loaded from environment variables (`ANTHROPIC_API_KEY`, etc.) and never stored in the database or logs.
- **Human-in-the-Loop:** Critical actions (plan approval, file writes via generic agents) require explicit human confirmation unless configured otherwise.
- **Git Safety:** Automated commits are signed with detailed trace IDs.

### 9.2 Best Practices

1. **Review Plans:** Always inspect the diffs in the TUI (`exoctl plan show`) before approving.

1.

---

## 10. Daemon Management & Monitoring

ExoFrame can run as a background daemon to serve the MCP API, run scheduled tasks, and monitor workspace health.

### 10.1 Daemon Control

Use the `exoctl daemon` command to manage the background service:

```bash
# Start the daemon
exoctl daemon start

# Check status (PID, uptime, version)
exoctl daemon status

# View live logs
exoctl daemon logs -f

# Stop the daemon (sends SIGTERM for graceful shutdown)
exoctl daemon stop
```

> [!TIP]
> **Graceful Shutdown:** The daemon handles shutdown signals to ensure critical operations (like database writes or git commits) complete before exiting.

### 10.2 Health Checks

The daemon exposes health endpoints and performs self-monitoring. checking:

- **Database Connectivity**: Verifies SQLite WAL mode and query response.
- **Disk Space**: Monitoring `warn` and `critical` thresholds.
- **Memory Usage**: Tracks heap usage to prevent OOM errors.

```bash
# Perform an ad-hoc health check
exoctl health check
```

### 10.3 Activity Journal

The Activity Journal provides a permanent, searchable audit trail of all agent actions, system events, and errors. It is stored locally in `journal.db` and is essential for debugging, compliance, and understanding system behavior.

**Usage:**

```bash
exoctl journal [options]
```

**Core Options:**

| Option                                   | Description                                     | Default |
| ---------------------------------------- | ----------------------------------------------- | ------- |
| `--tail <n>`, `-n <n>`                   | Show the last N entries                         | 50      |
| `--filter <key=value>`, `-f <key=value>` | Filter by criteria (can be used multiple times) | None    |
| `--format <format>`                      | Output format: `text`, `table`, `json`          | `text`  |
| `--distinct <field>`                     | Return distinct values for specified field      | None    |
| `--count`                                | Return count aggregation by action_type         | false   |
| `--payload <pattern>`                    | Filter by payload LIKE pattern                  | None    |
| `--actor <actor>`                        | Filter by actor                                 | None    |
| `--target <target>`                      | Filter by target                                | None    |

**Filter Keys:**

- `trace_id`: Filter by specific operation UUID (e.g., `trace_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- `action_type`: Filter by event type (e.g., `action_type=request.created`, supports wildcards like `action_type=plan.%`)
- `agent_id`: Filter by agent name (e.g., `agent_id=security-auditor`)
- `since`: Filter by time (e.g., `since=2024-01-01`, `since=2024-01-01T10:00:00`)

#### Basic Usage Examples

```bash
# View recent system activity (last 50 entries)
exoctl journal

# Show only the last 10 entries
exoctl journal --tail 10

# Output in JSON format for scripting
exoctl journal --format json

# Display in table format for better readability
exoctl journal --format table
```

#### Filtering by Trace ID

```bash
# Investigate a specific request's complete lifecycle
exoctl journal --filter trace_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Get the trace ID from a recent request and investigate
TRACE_ID=$(exoctl journal --tail 1 --format json | jq -r '.[0].trace_id')
exoctl journal --filter trace_id=$TRACE_ID
```

#### Filtering by Action Type

```bash
# Show only request creation events
exoctl journal --filter action_type=request.created

# Show all plan-related events (using wildcard)
exoctl journal --filter action_type=plan.%

# Show all errors
exoctl journal --filter action_type=error

# Show blueprint operations
exoctl journal --filter action_type=blueprint.%
```

#### Filtering by Agent

```bash
# Show activity for a specific agent
exoctl journal --filter agent_id=security-auditor

# Show activity for mock agents (using wildcard)
exoctl journal --filter agent_id=mock-%
```

#### Time-Based Filtering

```bash
# Show activity since a specific date
exoctl journal --filter since=2024-01-01

# Show activity since a specific datetime
exoctl journal --filter since=2024-01-01T10:00:00

# Show recent activity (last hour)
exoctl journal --filter since=$(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)
```

#### Payload Pattern Matching

```bash
# Search for activities containing specific text in payload
exoctl journal --payload %security%

# Check for potential credential leaks
exoctl journal --payload %password%
exoctl journal --payload %api_key%
exoctl journal --payload %secret%

# Find token usage information
exoctl journal --payload %tokens%

# Search for cost-related activities
exoctl journal --payload %cost%
```

#### Aggregation and Analysis

```bash
# Count total activities by action type
exoctl journal --count

# Get distinct list of all agents that have performed actions
exoctl journal --distinct agent_id

# Get distinct list of all action types
exoctl journal --distinct action_type

# Get distinct actors (users who performed actions)
exoctl journal --distinct actor
```

#### Advanced Multi-Filter Queries

```bash
# Combine multiple filters: errors from specific agent since date
exoctl journal --filter action_type=error --filter agent_id=security-auditor --filter since=2024-01-01

# Find all failed actions for a specific trace
exoctl journal --filter trace_id=$TRACE_ID --filter action_type=action.failed

# Security audit: check for dangerous commands executed
exoctl journal --filter action_type=action.executing --payload %rm% --payload %sudo%

# Performance analysis: find slow operations
exoctl journal --payload %timeout% --payload %error%
```

#### Real-World Use Cases

**Debugging Failed Requests:**

```bash
# Find the trace ID of a failed request
FAILED_TRACE=$(exoctl journal --filter action_type=request.failed --tail 1 --format json | jq -r '.[0].trace_id')

# Investigate the complete failure chain
exoctl journal --filter trace_id=$FAILED_TRACE
```

**Security Auditing:**

```bash
# Check for unauthorized file access attempts
exoctl journal --payload %permission%denied% --payload %access%denied%

# Audit all portal access
exoctl journal --filter action_type=portal.% --tail 100

# Check for sensitive data in logs
exoctl journal --payload %password% --payload %key% --payload %secret% | wc -l
```

**Performance Monitoring:**

```bash
# Count requests by agent over time
exoctl journal --filter action_type=request.created --distinct agent_id

# Find most active time periods
exoctl journal --count --filter since=$(date -d '7 days ago' +%Y-%m-%d)

# Monitor token usage trends
exoctl journal --payload %tokens% --tail 100 --format json | jq '.[] | .payload.tokens.total // 0' | paste -sd+ | bc
```

**Compliance and Reporting:**

```bash
# Export all activities for a specific month to JSON
exoctl journal --filter since=2024-01-01 --filter since=2024-02-01 --format json > january_activities.json

# Generate audit report for specific agent
exoctl journal --filter agent_id=production-agent --format json > production_audit.json

# Count human approvals vs automated actions
exoctl journal --filter action_type=plan.approved --count
```

#### Power User: Direct SQL Access

For advanced analysis, you can query the SQLite database directly:

```bash
# View the database schema
sqlite3 ~/ExoFrame/.exo/journal.db ".schema activity"

# Complex queries not available via CLI
sqlite3 ~/ExoFrame/.exo/journal.db "
  SELECT action_type, COUNT(*) as count,
         MIN(timestamp) as first_seen,
         MAX(timestamp) as last_seen
  FROM activity
  WHERE timestamp >= '2024-01-01'
  GROUP BY action_type
  ORDER BY count DESC;
"

# Find requests with the most steps
sqlite3 ~/ExoFrame/.exo/journal.db "
  SELECT trace_id, COUNT(*) as steps
  FROM activity
  WHERE action_type LIKE 'step.%'
  GROUP BY trace_id
  ORDER BY steps DESC
  LIMIT 10;
"
```

**Database Maintenance:**

```bash
# Check database integrity
sqlite3 ~/ExoFrame/.exo/journal.db "PRAGMA integrity_check;"

# Vacuum database to reclaim space
sqlite3 ~/ExoFrame/.exo/journal.db "VACUUM;"

# Backup journal before maintenance
cp ~/ExoFrame/.exo/journal.db ~/backups/journal_$(date +%Y%m%d).db
```

## 11. Cost Tracking (Beta)

ExoFrame provides comprehensive cost tracking and budget management for AI provider usage. This feature helps you monitor spending, set limits, and optimize your AI usage costs.

### 11.1 How Cost Tracking Works

Cost tracking operates at multiple levels:

1. **Per-Request Tracking**: Each agent execution logs token usage and estimated cost

1.
1.

### 11.2 Configuration

Configure cost tracking in your `exo.config.toml`:

```toml
[cost_tracking]
enabled = true
max_daily_cost_usd = 50.0  # Daily spending limit

[cost_tracking.rates]
# Override default rates if needed
anthropic_claude_sonnet = 0.000015  # $15 per million tokens
openai_gpt4 = 0.00003               # $30 per million tokens
```

### 11.3 Budget Enforcement

Before each agent execution, ExoFrame checks:

1. **Daily Budget**: Current day's spending vs `max_daily_cost_usd`

1.

If a request would exceed your budget, it's rejected with a clear error message.

### 11.4 Monitoring Usage

Query cost information through the Activity Journal:

```bash
# View recent cost-related activities
exoctl journal --payload %cost% --tail 10

# Find high-cost operations
exoctl journal --payload %tokens% --tail 20 --format json | jq '.[] | select(.payload.cost > 1.0)'

# Daily cost summary (requires external processing)
exoctl journal --filter since=$(date +%Y-%m-%d) --payload %cost% --format json > daily_costs.json
```

### 11.5 Cost Optimization Tips

- **Use Appropriate Models**: Smaller models for simple tasks, larger models for complex reasoning
- **Set Realistic Budgets**: Start with conservative limits and adjust based on usage
- **Monitor Regularly**: Use journal queries to identify expensive operations
- **Batch Requests**: Combine related tasks to reduce overhead
- **Cache Results**: Memory banks help avoid redundant work

### 11.6 Supported Providers

Cost tracking supports all major AI providers:

| Provider  | Token Tracking | Cost Estimation | Budget Enforcement |
| --------- | -------------- | --------------- | ------------------ |
| Anthropic | ✅             | ✅              | ✅                 |
| OpenAI    | ✅             | ✅              | ✅                 |
| Google    | ✅             | ✅              | ✅                 |
| Ollama    | ✅             | ❌ (free)       | ❌                 |
| Mock      | ✅             | ❌              | ❌                 |

---

### End of User Guide
