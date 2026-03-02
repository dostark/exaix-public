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

1.

### Phase 2: Code Extraction

1. **Export TUI Core**: Move the contents of `ExoFrame/src/tui` to the new repository.

1.
   - Update imports in the new repository to reference the main repository via a specific `exoframe` import map entry or relative paths if testing locally.
   - Ideally, use a published version or a stable branch of the core interfaces.
1.

### Phase 3: Submodule Integration

1. **Remove Old Code**: Delete `src/tui` and `tests/tui` from the main `ExoFrame` repository.

   ```bash
   git submodule add https://github.com/dostark/ExoFrame-TUI.git vendor/tui
   ```
1.
   - Create a symlink or update `deno.json` import maps to map `src/tui` to `vendor/tui/src`.
   - Ensure the TUI can still be launched via `exoctl tui`.

### Phase 4: Build and Integration

1. **Update `exoctl`**: Modify the `tui` command in `exoctl` to import the entry point from the submodule.

1.

## Potential Challenges

- **Circular Dependencies**: The TUI depends on core services, and `exoctl` depends on the TUI. This needs careful interface management.
- **CI/CD Complexity**: Testing the main repo will now require initializing submodules.
- **Developer Workflow**: Developers working on TUI changes will need to manage commits in two repositories.

---

# Created: 2026-02-27
