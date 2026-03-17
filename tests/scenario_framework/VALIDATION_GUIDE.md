# ExoFrame Validation & Scenario Framework Guide

This guide provides step-by-step instructions for setting up a clean validation environment using the ExoFrame Scenario Framework. It covers everything from initial workspace deployment to executing complex validation scenarios.

---

## 1. Prepare the Sandbox Environment

Create a dedicated directory for your validation work to ensure isolation from your development environment.

```bash
# Define your sandbox root
export EXOFFRAME_VALIDATION_ROOT="$HOME/exo-validation-sandbox"
export WORKSPACE_DIR="$EXOFFRAME_VALIDATION_ROOT/workspace"
export FRAMEWORK_DIR="$EXOFFRAME_VALIDATION_ROOT/framework"
export EVIDENCE_DIR="$EXOFFRAME_VALIDATION_ROOT/evidence"

mkdir -p "$EXOFFRAME_VALIDATION_ROOT"
```

## 2. Deploy a Clean ExoFrame Workspace

Deploy a fresh ExoFrame runtime. This installs the necessary directory structure (`Memory/`, `Blueprints/`, etc.) and system files.

```bash
# From the ExoFrame repository root:
./scripts/deploy_workspace.sh "$WORKSPACE_DIR"
```

## 3. Configure the AI/LLM Provider

For real agent validation, you must configure a functional LLM provider. Edit the `exo.config.toml` in your workspace.

```bash
# Navigate to the deployed workspace
cd "$WORKSPACE_DIR"

# Create/Edit exo.config.toml with your provider details
cat <<EOF > exo.config.toml
[ai]
provider = "anthropic"  # Change to "openai", "google", or "ollama" as needed
model = "claude-3-5-sonnet-20241022"

[provider_strategy]
allow_local = true
max_daily_cost_usd = 10.00
EOF

# Set your API keys (Replace with your actual keys)
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export GOOGLE_API_KEY="your-key-here"

# Enable paid LLMs for validation if required
export EXO_TEST_ENABLE_PAID_LLM=1
```

## 4. Initialize the Database and Daemon

Ensure the system database is ready and the background daemon is running.

```bash
cd "$WORKSPACE_DIR"

# Initialize the SQLite database
exoctl setup

# Start the ExoFrame daemon
exoctl daemon start
```

## 5. Mount Target Portals

Portals are symlinked repositories that agents will analyze. You should mount the repositories required for your scenarios.

```bash
# Example: Mount the ExoFrame core repository itself
exoctl portal add "/home/dkasymov/git/ExoFrame" portal-exoframe

# Verify the mount
exoctl portal list

# Restart the daemon to ensure services recognize the new portal
exoctl daemon stop
exoctl daemon start
```

## 6. Deploy the Scenario Framework

Package the validation engine and all test assets (scenarios, fixtures) into your sandbox.

```bash
# From the ExoFrame repository root:
./tests/scenario_framework/bin/deploy-framework \
  --destination "$FRAMEWORK_DIR" \
  --workspace "$WORKSPACE_DIR" \
  --output "$EVIDENCE_DIR"
```

## 7. Execute Validation Scenarios

Navigate to your deployed framework and run scenarios. The framework is self-contained and pre-configured to target your sandbox workspace.

```bash
cd "$FRAMEWORK_DIR/scenario_framework"

# 1. Run a Framework Smoke Test (Validates the framework logic itself)
./bin/run-scenarios --scenario framework-smoke-validation --verbose

# 2. Run Agent Flow Validations (Validates ExoFrame Agent behavior)
./bin/run-scenarios --pack agent_flows --verbose

# 3. Run all Smoke Scenarios
./bin/run-scenarios --tag smoke --verbose
```

## 8. Analyzing Results

The framework captures full evidence for every execution.

- **Run Manifest**: Check `${EVIDENCE_DIR}/run_manifest.json` for the overall outcome and per-step status.
- **Evidence Files**: Each step captures stdout/stderr and any generated artifacts (like `_analysis.json`) in `${EVIDENCE_DIR}/scenarios/<scenario-id>/<step-id>/`.
- **Journal**: Inspect the workspace journal at `${WORKSPACE_DIR}/.exo/journal.ndjson` for internal execution traces.

---

## Troubleshooting

- **Daemon Issues**: Check `${WORKSPACE_DIR}/.exo/daemon.log` if the daemon fails to start or process requests.
- **Portal Boundary Errors**: Ensure the `portal-mounted` criterion is passed in your scenario if it depends on external code references.
- **LLM Failures**: Verify your API keys and check that your `exo.config.toml` matches the requirements for the agent being tested.
