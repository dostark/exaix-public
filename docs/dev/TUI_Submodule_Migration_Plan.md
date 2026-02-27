# TUI Submodule Migration Plan

This document outlines the steps to move the ExoFrame TUI implementation into a separate Git repository and integrate it back into the main `ExoFrame` repository as a Git submodule.

## Rationale

The new TUI is a significant project with high implementation efforts, separate lifecycle, and potential for independent reuse or specialized tooling. Moving it to a separate repository:

- Decouples TUI-specific UI logic from core business logic and CLI.
- Allows for independent versioning and release cycles.
- Reduces the size and complexity of the main repository.

## Proposed Steps

### Phase 1: Preparation of the New Repository

1. **Initialize New Repository**: Create a new repository (e.g., `ExoFrame-TUI`).
2. **Define Shared Interfaces**: Ensure that all interfaces used by the TUI to interact with the core (e.g., `IRequestService`, `IPlanService`) are strictly defined in `ExoFrame/src/ai/types.ts` or a similar shared location.
3. **Draft `deno.json`**: Initialize the new repository with a `deno.json` that includes necessary dependencies (like `cliffy`, `std`, etc.) and import maps that point back to `ExoFrame` where necessary.

### Phase 2: Code Extraction

1. **Export TUI Core**: Move the contents of `ExoFrame/src/tui` to the new repository.
2. **Export TUI Tests**: Move the contents of `ExoFrame/tests/tui` to the new repository.
3. **Refactor Imports**:
   - Update imports in the new repository to reference the main repository via a specific `exoframe` import map entry or relative paths if testing locally.
   - Ideally, use a published version or a stable branch of the core interfaces.
4. **Setup Independent CI**: Configure Deno linting, formatting, and tests for the new repository.

### Phase 3: Submodule Integration

1. **Remove Old Code**: Delete `src/tui` and `tests/tui` from the main `ExoFrame` repository.
2. **Add Submodule**: Add the new repository as a submodule:
   ```bash
   git submodule add https://github.com/dostark/ExoFrame-TUI.git vendor/tui
   ```
3. **Symlink or Path Mapping**:
   - Create a symlink or update `deno.json` import maps to map `src/tui` to `vendor/tui/src`.
   - Ensure the TUI can still be launched via `exoctl tui`.

### Phase 4: Build and Integration

1. **Update `exoctl`**: Modify the `tui` command in `exoctl` to import the entry point from the submodule.
2. **Handle Assets**: Ensure icons/mockups (like `docs/dev/gallery`) remain in the main repo or are moved to the submodule if they are TUI-exclusive.
3. **Documentation**: Update the User Guide and Developer Guide to reflect the submodule structure and how to contribute to the TUI.

## Potential Challenges

- **Circular Dependencies**: The TUI depends on core services, and `exoctl` depends on the TUI. This needs careful interface management.
- **CI/CD Complexity**: Testing the main repo will now require initializing submodules.
- **Developer Workflow**: Developers working on TUI changes will need to manage commits in two repositories.

---

_Created: 2026-02-27_
_Architectural Layer: Infrastructure / CLI_
