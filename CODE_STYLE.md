# Code Style & Standards

> 🚨 Original documents now point to this file for the authoritative style rules.

---

## 1. Strict Type Safety

- **Every** variable, parameter, return value, and data structure **must** have an
  explicit type annotation.  Never rely on implicit inference to avoid writing a
  type.
- **No `any`.**  Explicit `any` and implicit `any` (from missing annotations) are
  forbidden.  Use generics (`<T>`), named interfaces, or Zod-inferred types.
- **No `as any` casting.**  Do not bypass the type system; use proper guards,
  narrowing, or define the correct type instead.
- **No `as typeof var` casting.**  This is equivalent to `any` and defeats
  safety – define explicit interfaces or use proper inference.
- **No `unknown` as a stored type.**  `unknown` may only appear briefly inside a
  `catch (e: unknown)` block or during runtime narrowing.  It must **never** be
  used as a parameter type, return type, field type, or alias.  Name the shape
  with an interface or a type alias instead.
- **No double casting (`... as unknown as ...`).**  This pattern hides bugs and is
  prohibited.  Use type guards or structural typing to narrow correctly.
- **No TypeScript suppression pragmas.**  Never use `@ts-expect-error`,
  `@ts-ignore`, `@ts-nocheck`, or similar comments to bypass the compiler.  All
  type errors must be resolved by writing correct types or refactoring the
  code; suppressing them defeats the purpose of TypeScript and is strictly
  prohibited.  (This rule applies equally in test code.)
- **No lint ignores for `any`.**  Never add
  `// deno-lint-ignore no-explicit-any` to silence problems.  Address the root
  cause with proper typing.
- **Always name it.**  If a type doesn’t exist yet, create one explicitly.  When
  the keys are known, prefer specific interfaces over `Record<string, …>`.
- **Avoid `Record<string, any>`.**  This type is extremely weak and effectively
  re-introduces `any` for every property.  Instead, define a precise interface
  or type alias describing the expected shape.  If you believe the structure is
  genuinely unbounded, `Record<string, unknown>` may be acceptable but **only
  in rare, well‑justified cases**; document why no stronger type can be used and
  validate access via helpers or Zod.  Prefer a generic with a constrained key
  type or a runtime schema for any dynamic data.

These rules are enforced by linting and are referenced by multiple existing
checklists (pre‑commit, CI, etc.).

---

## 2. No Magic Numbers or Strings

- Never hardcode numeric literals or string constants in production or test code
  (timeouts, status values, provider names, etc.).
- **User‑configurable values** belong in `exo.config.sample.toml` with a
  comment, the matching Zod schema (`src/config/schema.ts`), and a default in
  `src/config/constants.ts` (the config service handles loading).
- **Internal constants** belong in `src/constants.ts` or a module‑scoped
  `constants.ts` file.  Use descriptive names and group related values.
- **CLI/TUI defaults** go in `src/cli/cli.config.ts` or
  `src/tui/tui.config.ts` respectively.
- **Test‑specific constants** belong in `tests/config/constants.ts` (e.g.
  prompts, mock keys, environment variable names).
- **Enums.**  Whenever a set of fixed strings is used (statuses, types,
  providers), define a TypeScript `enum` in `src/enums.ts` and reference it.
  Compare against `RequestStatus.PENDING`, never the literal string.

Search helpers are provided in the repository to locate inadvertent magic values
(`grep -rEn ...` commands are included in older docs).

---

## 3. Import Statements

All import declarations **must** appear at the top of the file.  Dynamic imports
with `await import()` are discouraged; if they are used (for large conditional
modules or to avoid circularity) the rationale must be documented.

Good:

```ts
import { join } from "@std/path";
import { MyService } from "./service.ts";

export class MyClass { ... }
```

Bad:

```ts
export class MyClass {
  async method() {
    const { join } = await import("@std/path");
    // …
  }
}
```

---

## 4. Dependency Injection & Interfaces

- **Interface naming:** All interfaces (injectable or otherwise) **must** use
  the `IInterfaceName` prefix convention.  This makes it obvious at a glance
  that the symbol is an interface rather than a class or type alias.
- **Placement:** Interfaces should be declared at the top of the module, above
  any implementing classes or other logic.  Keeping them grouped near the
  import section improves readability and prevents hoisting surprises.
- Every injectable class `Foo` **must** export a companion interface `IFoo`.
  Consumers depend on the interface, never on the concrete implementation.
- Dependencies are supplied via constructors; module‑level singletons or static
  accessors are prohibited.
- Test mocks **must** implement the full interface; avoid `as any` or partial
  objects unless the test explicitly documents why the missing members aren’t
  invoked.
- Factory functions and registries reference `IFoo`, not `Foo`.
- Prefer narrow interfaces: if a consumer only needs two methods, define an
  interface with those two rather than importing a fat interface.

Example:

```ts
export interface IGitService { commit(msg: string): Promise<void>; }
export class GitService implements IGitService { ... }

export class PlanExecutor {
  constructor(private git: IGitService, private db: IDatabaseService) {}
}
```

---

## 5. Environment Variables

Environment‑variable rules were formalised in Phase 28 and are part of the
style guide:

- **Production overrides** are limited to the `EXO_LLM_*` family:
  `PROVIDER`, `MODEL`, `BASE_URL`, and `TIMEOUT_MS`.
- **All** env vars **must** be validated via the Zod schema in
  `src/config/env_schema.ts` – use `getValidatedEnvOverrides()`, not
  `Deno.env.get()` directly.
- **Test variables** use the `EXO_TEST_*` prefix and helpers such as
  `isTestMode()` and `isCIMode()` for detection.
- Never read `EXO_LLM_*` vars without validation; direct access is prohibited.

These guidelines ensure consistent error handling and prevent a class of
runtime bugs.

---

## 6. Additional Style Notes

- **No magic values in tests:** the same constant‑externalisation rules apply to
  test code; keep test constants separate from production ones.
- **File comments:** modules should start with a brief description and the
  Implementation Plan step they satisfy.  Keep top‑level imports and type
  definitions near the top of the file.

## 7. Related Documents

This file is the single source for code style.  Original sections remain in the
following documents only as cross‑references:

- [`CLAUDE.md`](CLAUDE.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`.copilot/source/exoframe.md`](.copilot/source/exoframe.md)
- [`.copilot/README.md`](.copilot/README.md)

When editing those documents in the future, update the link above if this file’s
location changes.

---

> ⚠️ Keep this file short and focused.  Architectural patterns such as timeout
> protection, file locking, or error classification belong in other guides
> (e.g. `.copilot/source/exoframe.md`) and **are not** repeated here unless they
> directly impact the way code is written.
