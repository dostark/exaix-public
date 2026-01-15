# Contributing to ExoFrame

Thank you for your interest in contributing to ExoFrame! This guide details the development standards, patterns, and workflows to ensure a high-quality, maintainable codebase.

## 1. Coding Standards

### 1.1 No Magic Numbers or Strings

ExoFrame enforces a strict policy against "magic numbers" and "magic strings" in the codebase.

*   **Policy:** **NEVER** introduce new hardcoded values (timeouts, limits, model names, providers, pricing, file names, status strings, etc.) directly in service logic or components.
*   **Externalization:**
    *   **User-Confgiurable:** Add to `exo.config.sample.toml`, update `src/config/schema.ts`, and provide defaults in `src/config/constants.ts` (via `ai_config.ts`).
    *   **Internal Constants:** Add to `src/constants.ts` or module-specific `constants.ts` files.
    *   **CLI/TUI Defaults:** Add to `src/cli/cli.config.ts` or `src/tui/tui.config.ts`.
    *   **Enums:** Use TypeScript enums (`src/enums.ts`) for status, types, and fixed sets of strings.

### 1.2 Configuration Workflow

To add a new user-facing configuration option:

1.  **Define:** Add the option to `exo.config.sample.toml` with a clear comment and sensible default.
2.  **Schema:** Update `src/config/schema.ts` to include the new field in the Zod schema.
3.  **Defaults:** Ensure `src/config/constants.ts` has the default value if it's a fallback constants.
4.  **Load:** The `ConfigService` (`src/config/ai_config.ts`) automatically loads and validates the config against the schema.

### 1.3 TypeScript Enums

Use `src/enums.ts` for all shared enumerations.

*   **Do:** `status === RequestStatus.PENDING`
*   **Don't:** `status === "pending"`

## 2. Testing

### 2.1 Configuration Testing

When adding new configuration options:

*   **Unit Tests:** Add tests to `tests/config/config_test.ts` (or equivalent) to verify the option is loaded correctly from TOML.
*   **Integration Tests:** Verify that changing the config value actually changes system behavior.

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

## 4. Pull Request Checklist

- [ ] No new magic numbers or strings introduced.
- [ ] New configuration options added to `exo.config.sample.toml`.
- [ ] Zod schema updated in `src/config/schema.ts`.
- [ ] Tests added for new configuration options.
- [ ] Documentation updated if behavior changes.
