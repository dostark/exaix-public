---
agent: antigravity
scope: dev
title: "Phase 38: Core Tool Expansion & Grounding"
short_summary: "Technical specification for adding research, discovery, and refactoring tools to the ExoFrame ToolRegistry."
version: "1.0"
topics: ["tools", "tool-registry", "research", "refactoring", "git", "deno"]
---

**Goal:** Equip ExoFrame agents with a comprehensive, industry-standard toolset for autonomous software engineering.

**Status:** 🏗️ Implementation Ready
**Timebox:** 1–2 weeks
**Entry Criteria:** Phase 37 completed.
**Exit Criteria:** All 6 tool categories implemented, secured, and verifying in CI.

---

## 1. Configuration Schema Updates

To support secure external access, we must extend `src/config/schema.ts`.

### New `tools` Section

We will add a dedicated `tools` configuration object to the root `ConfigSchema`.

(See `src/config/schema.ts`)

---

## 2. Tool Implementation Specifications

### 2.1 Network Tool: `fetch_url`

**Context:** Agents currently lack internet access, making it impossible to read external documentation or research libraries. This creates a blind spot where agents must guess or hallucinate API usage.

**Purpose:** Allow agents to retrieve external documentation or data.

**Parameters (Zod):**
(See `src/services/tool_registry.ts`)

**Implementation Logic:**

1. **Validation:** Check if `config.tools.fetch_url.enabled` is true.
2. **Whitelist Check:** Parse hostname from `url` and verify it matches `allowed_domains`.
3. **Fetch:** Use `fetch(url, { signal: AbortSignal.timeout(timeout_ms) })`.
4. **Size Check:** Check `Content-Length` header or stream counting. Abort if > `max_response_size_kb`.
5. **Conversion:** If `format="markdown"`, use a basic HTML-to-Markdown converter (or just return `innerText` for MVP).

**Security:**

- 🛡️ **SSRF Protection:** Agents cannot access local IPs (127.0.0.1, 192.168.x.x) or metadata services (169.254.169.254).
- 🛡️ **Whitelist:** Strict opt-in domain list.

---

### 2.2 Content Discovery: `grep_search`

**Context:** The existing `search_files` tool only matches filenames. To find code usage or patterns, agents must `read_file` indiscriminately, wasting tokens and context window space. `grep` allows precise, content-based discovery.

**Purpose:** Find code patterns efficiently without reading every file.

**Parameters (Zod):**
(See `src/services/tool_registry.ts`)

**Implementation Logic:**

1. **Resolve Path:** Use `PathResolver` to ensure `path` is within allowed roots.
2. **Command:** Use `git grep -nI` (if in a git repo) or `grep -rI` (fallback).
   - Flags: `-n` (line numbers), `-I` (ignore binary), `--max-count=50`.
3. **Output:** Parse stdout into structured JSON:
   ```json
   [
     { "file": "src/utils.ts", "line": 45, "content": "export const foo = ..." }
   ]
   ```

**Security:**

- 🛡️ **Command Injection:** Pattern must be escaped or passed as a distinct argument to `Deno.Command`.
- 🛡️ **Path Traversal:** Verified via `PathResolver`.

---

### 2.3 Refactoring Suite: `move_file`, `copy_file`, `delete_file`

**Context:** Agents frequently attempt to "move" files by reading content, creating a new file, and deleting the old one. This is error-prone and loses git history. Explicit `move/copy/delete` tools are safer and atomic.

**Purpose:** Atomic file operations.

**Parameters (Zod):**

- **move/copy**: `{ source: string, destination: string, overwrite: boolean }`
- **delete**: `{ path: string }`

**Implementation Logic:**

- **move**: `await Deno.rename(src, dest)`
- **copy**: `await Deno.copyFile(src, dest)`
- **delete**: `await Deno.remove(path)`

**Security:**

- 🛡️ **Scope**: Both source and destination (and delete target) MUST resolve to allowed roots via `PathResolver`.
- 🛡️ **Logging**: All destructive actions (delete, overwrite) must log to Activity Journal.

---

### 2.4 Git Info: `git_info`

**Context:** Agents currently parse raw `git status` output, which is brittle and unstructured. Providing JSON output allows agents to reliably understand repository state, ensuring they don't lose track of their own changes.

**Purpose:** Provide structured repository state.

**Parameters (Zod):**
(See `src/services/tool_registry.ts`)

**Implementation Logic:**

- **Status:** Run `git status --porcelain`. Parse into:
  ```json
  { "modified": ["src/foo.ts"], "staged": [], "untracked": ["tests/new.ts"] }
  ```
- **Branch:** `git branch --show-current`.
- **Diff Summary:** `git diff --stat`.

---

### 2.5 Ecosystem Tool: `deno_task`

**Context:** Agents need a standard way to verify their work using the ecosystem's native tools (`fmt`, `lint`, `test`). Wrapping these in a structured tool prevents agents from guessing CLI arguments and parsing diverse error formats.

**Purpose:** Standardized verification.

**Parameters (Zod):**
(See `src/services/tool_registry.ts`)

**Implementation Logic:**

- **check/lint**: Run `deno lint --json [path]`. Return structured errors.
- **fmt**: Run `deno fmt --check [path]`. Return unformatted files list.
- **test**: Run `deno test --reporter=json [path]`. Return structured results (passed/failed tests).

**Security:**

- 🛡️ **Resource Limits:** Enforce timeouts.

---

### 2.6 Patching Tool: `patch_file`

**Context:** Updating a single line in a large file currently requires rewriting the entire file. `patch_file` enables surgical edits, significantly reducing token usage and the risk of syntax errors in unrelated code blocks.

**Purpose:** Token-efficient partial edits.

**Parameters (Zod):**
(See `src/services/tool_registry.ts`)

**Implementation Logic:**

1. Read file content.
2. Count occurrences of `search_content`.
   - If 0: properties error "Content not found".
   - If > 1: properties error "Ambiguous match (found 2 times)".
3. Replace and write back.

---

## 3. Integration Plan

### 3.1 `ToolRegistry` Update

- Import new schemas and implementations.
- Register new tools in `registerCoreTools()`.
- Inject `ToolsConfig` into `ToolRegistry`.

### 3.2 Agent Blueprints

- Update `capabilities` array in **all** agent blueprints (`Blueprints/Agents/*.md`) to include relevant tools.
  - `code-analyst` -> `grep_search`, `fetch_url`, `git_info`
  - `senior-coder` -> All above + `move_file`, `patch_file`, `deno_task`

---

## 4. Verification & Testing

### 4.1 Integration Tests (`tests/tools/`)

Create a new test file for each category:

- `tests/tools/network_tool_test.ts`: Mock `fetch` and verify whitelist.
- `tests/tools/search_tool_test.ts`: Create dummy file structure and grep it.
- `tests/tools/refactor_tool_test.ts`: Verify file operations and path security.

### 4.2 End-to-End Scenario

Create `tests/scenarios/refactoring_scenario_test.ts`:

1. Agent identifies a "messy" file structure.
2. Uses `grep_search` to find imports.
3. Uses `move_file` to reorganize.
4. Uses `deno_task("test")` to verify nothing broke.

---

## 5. Implementation Status & Verification

### Completed Success Criteria

- [x] **Configuration Schema Updated**: `src/config/schema.ts` includes `ToolsConfigSchema` with security settings.
- [x] **Network Tool (`fetch_url`)**: Implemented with whitelist and size limits.
- [x] **Search Tool (`grep_search`)**: Implemented with regex support and efficient parsing.
- [x] **Refactoring Suite**: Implemented `move_file`, `copy_file`, `delete_file` with path security.
- [x] **Git Info (`git_info`)**: Implemented structured status, branch, and diff output.
- [x] **Ecosystem Tool (`deno_task`)**: Implemented standard task execution (`test`, `lint`, `fmt`).
- [x] **Patching Tool (`patch_file`)**: Implemented token-efficient file editing.
- [x] **Agent Blueprints Updated**: All agents enriched with appropriate tools.

### Implemented Tests

- [x] `tests/tools/fetch_url_test.ts`: Verifies whitelist enforcement and fetching.
- [x] `tests/tools/grep_search_test.ts`: Verifies pattern matching and directory exclusion.
- [x] `tests/tools/refactor_tool_test.ts`: Verifies atomic operations and path security.
- [x] `tests/tools/git_info_test.ts`: Verifies git status parsing.
- [x] `tests/tools/deno_task_test.ts`: Verifies task execution.
- [x] `tests/tools/patch_file_test.ts`: Verifies patching logic and error handling.
- [x] `tests/tools/e2e_tool_test.ts`: Verifies full multi-tool workflow (git -> fix -> refactor).
