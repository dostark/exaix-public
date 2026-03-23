# Exaix - Deployed Workspace

This directory is a runtime workspace created from the Exaix repository.

## Quick Start

1. **Configure Exaix:**
   ```bash
   cp exa.config.sample.toml exa.config.toml
   # Edit exa.config.toml to customize paths and settings
   ```

````markdown
# Exaix — Deployed Workspace

This directory represents a deployed runtime workspace created from the Exaix repository. It contains the runtime layout that agents operate against.

## Quick Start

1. Copy the sample config and edit as needed:

```bash
cp exa.config.sample.toml exa.config.toml
# edit exa.config.toml to customize paths and settings
```

2. Start the daemon

```bash
exactl daemon start
```

3. Verify status

```bash
exactl daemon status
```

4. Create your first request

```bash
exactl request "Add a hello world function"
```

## Daemon Management

```bash
exactl daemon start    # Start in background
exactl daemon stop     # Stop gracefully
exactl daemon status   # Check if running
exactl daemon restart  # Restart daemon
```

## Directory Structure

- `Blueprints/` — Agent definitions and templates
- `Workspace/` — Requests, Plans, and Changesets
- `Memory/` — Persistent memory banks (copied during deploy)
- `.exa/` — Runtime state: DB, logs, active tasks (replaces former `System/`)
- `Portals/` — Symlinks to external project repositories

## Getting Help

```bash
exactl --help
exactl request --help
exactl plan --help
exactl blueprint --help
exactl portal --help
```
````
