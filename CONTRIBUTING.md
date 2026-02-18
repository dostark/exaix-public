# Contributing to ExoFrame

Thank you for your interest in contributing to ExoFrame! This guide details the development standards, patterns, and workflows to ensure a high-quality, maintainable codebase.

## 1. Coding Standards

### 1.1 No Magic Numbers or Strings

ExoFrame enforces a strict policy against "magic numbers" and "magic strings" in the codebase.

- **Policy:** **NEVER** introduce new hardcoded values (timeouts, limits, model names, providers, pricing, file names, status strings, etc.) directly in service logic or components.
- **Externalization:**
  - **User-Confgiurable:** Add to `exo.config.sample.toml`, update `src/config/schema.ts`, and provide defaults in `src/config/constants.ts` (via `ai_config.ts`).
  - **Internal Constants:** Add to `src/constants.ts` or module-specific `constants.ts` files.
  - **CLI/TUI Defaults:** Add to `src/cli/cli.config.ts` or `src/tui/tui.config.ts`.
  - **Enums:** Use TypeScript enums (`src/enums.ts`) for status, types, and fixed sets of strings.

### 1.2 Configuration Workflow

To add a new user-facing configuration option:

1. **Define:** Add the option to `exo.config.sample.toml` with a clear comment and sensible default.
2. **Schema:** Update `src/config/schema.ts` to include the new field in the Zod schema.
3. **Defaults:** Ensure `src/config/constants.ts` has the default value if it's a fallback constants.
4. **Load:** The `ConfigService` (`src/config/ai_config.ts`) automatically loads and validates the config against the schema.

### 1.3 TypeScript Enums

Use `src/enums.ts` for all shared enumerations.

- **Do:** `status === RequestStatus.PENDING`
- **Don't:** `status === "pending"`

### 1.4 Import Statements

All import statements **MUST** be placed at the top of the module. Dynamic imports using `await import()` are generally discouraged unless absolutely necessary for conditional loading of large modules or circular dependencies, and should be justified.

- **Do:**
  ```typescript
  import { join } from "@std/path";
  import { MyService } from "./service.ts";

  export class MyClass { ... }
  ```
- **Don't:**
  ```typescript
  export class MyClass {
    async method() {
      const { join } = await import("@std/path");
      ...
    }
  ```

### 1.5 Strict Type Safety

ExoFrame enforces a strict **No `any`, No implicit types** policy to ensure type safety and maintainability.

- **Always annotate:** Every variable, parameter, return value, and data structure **must** have an explicit type annotation. Never rely on implicit inference to avoid writing a type.
- **No `any`:** **NEVER** use the `any` type in variable declarations, function parameters, or return types. This includes both explicit `any` and implicit `any` from missing annotations.
- **No `as any` casting:** **NEVER** use `value as any` to bypass TypeScript's type checking. This defeats the purpose of using TypeScript and hides real type issues. Use proper type guards, narrowing techniques, or define the correct type.
- **No `as typeof var` casting:** **NEVER** use `value as typeof variable` to cast to another variable's type. This pattern is effectively equivalent to using `any` and completely bypasses type safety. Instead, define explicit interfaces, use intersection types, or leverage proper type inference.
- **No `unknown` as a stored type:** `unknown` is not a substitute for a real type. Permitted uses of `unknown` are limited to:
  - The parameter of a `catch` clause: `catch (e: unknown)`
  - A *transient* value inside a type-narrowing guard before it is cast to a concrete type
  - Never use `unknown` as a parameter type, return type, or field type — define a named interface or type alias instead.
- **Alternatives:**
  - **Generics:** Use generic types (`<T>`) for flexible functions or classes so callers supply the concrete type.
  - **Named interfaces / type aliases:** If the shape does not exist yet, create one. Prefer specific interfaces over `Record<string, ...>` when the keys are known.
  - **Zod schemas:** Use Zod schemas to validate external/dynamic data and infer types with `z.infer<typeof Schema>`.
- **Exceptions:** Extremely rare cases (e.g., specific library interop) require a `// deno-lint-ignore no-explicit-any` comment with a clear justification comment explaining why no typed alternative exists.

## 2. Testing

### 2.1 Configuration Testing

When adding new configuration options:

- **Unit Tests:** Add tests to `tests/config/config_test.ts` (or equivalent) to verify the option is loaded correctly from TOML.
- **Integration Tests:** Verify that changing the config value actually changes system behavior.

### 2.2 Validation

Before submitting a PR, verify you haven't introduced magic values:

```bash
# Search for potential magic numbers (excluding 0, 1, -1)
grep -rEn --include='*.ts' '([^a-zA-Z_]|^)([2-9][0-9]*|[1-9][0-9]{2,})' src/

# Search for potential magic strings (common keywords)
grep -rEn --include='*.ts' '"(ollama|anthropic|openai|pending|active|timeout)"' src/
```

## 3. Migration Guide

If you are updating legacy code, refer to `docs/dev/Migration_Guide_Phase27.md` for detailed instructions on replacing hardcoded values with the new configuration system.

## 4. AI Agent Development Workflow

### 4.1 Mandatory Pre-Task Steps

**If you are an AI agent (Claude, Copilot, etc.), you MUST:**

1. **Read [`CLAUDE.md`](CLAUDE.md)** for project orientation and quick reference
2. **Consult [`.copilot/cross-reference.md`](.copilot/cross-reference.md)** for task-specific guidance
3. **Read relevant `.copilot/` documentation** before implementation:
   - `.copilot/source/exoframe.md` — Source code patterns
   - `.copilot/tests/testing.md` — Test patterns and helpers
   - `.copilot/docs/documentation.md` — Documentation guidelines
   - `.copilot/planning/*.md` — Phase planning documents
4. **Cite consulted documents** in your implementation plan

**Example citation:**

> "I consulted `.copilot/tests/testing.md` for test helpers and `.copilot/source/exoframe.md` for service architecture patterns."

### 4.2 Agent Documentation Index

All available agent documentation is indexed in `.copilot/manifest.json`. Use the quick reference tables in `CLAUDE.md` to find relevant docs for your task.

**Failure to consult `.copilot/` documentation is considered a project standards violation.**

## 5. Pull Request Checklist

- [ ] **(AI Agents)** Consulted relevant `.copilot/` documentation and cited in implementation plan.
- [ ] No new magic numbers or strings introduced.
- [ ] New configuration options added to `exo.config.sample.toml`.
- [ ] Zod schema updated in `src/config/schema.ts`.
- [ ] **Environment Variables:** If using `EXO_LLM_*` vars, validated via `getValidatedEnvOverrides()` (no direct `Deno.env.get()`).
- [ ] **Test Variables:** Test-related env vars use `EXO_TEST_*` prefix and helper functions (`isTestMode()`, `isCIMode()`).
- [ ] Tests added for new configuration options.
- [ ] Documentation updated if behavior changes.
- [ ] All tests pass (`deno task test`).
- [ ] Code formatted (`deno task fmt`).

## 6. Architecture

For a comprehensive overview of the system architecture, component interactions, and code organization, please refer to [ARCHITECTURE.md](../ARCHITECTURE.md) in the project root. This document is the ground truth for understanding how ExoFrame works.
