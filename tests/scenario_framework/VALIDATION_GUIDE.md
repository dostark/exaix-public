# ExoFrame Validation & Scenario Framework Guide

This guide provides step-by-step instructions for setting up a clean validation environment using the ExoFrame Scenario Framework. It covers everything from initial workspace deployment to executing complex validation scenarios.

---

## 1. Automated Setup (Recommended)

The easiest way to deploy a fully configured validation sandbox is using the automated `setup_sandbox.ts` script. This handles workspace deployment, provider configuration, database initialization, portal mounting, and framework deployment.

```bash
# Navigate to the ExoFrame repository root
cd "$HOME/git/ExoFrame"

# Define your sandbox root directory
export EXOFFRAME_VALIDATION_ROOT="$HOME/exo-validation-sandbox"

# Option A: Fast Local Testing (Mock Provider)
# Set up a sandbox locally without making external API calls
deno run -A scripts/setup_sandbox.ts --dir "$EXOFFRAME_VALIDATION_ROOT" --provider "mock" --model "test"

# Option B: Real LLM Validation (Google Gemini Flash)
# To test real agent behaviors, provide your API key and configure the model
export GOOGLE_API_KEY="your-api-key-here"
deno run -A scripts/setup_sandbox.ts --dir "$EXOFFRAME_VALIDATION_ROOT" --provider "google" --model "gemini-1.5-flash"
```

Once the script completes, it will output the necessary environment variables to export to interact with the sandbox.

```bash
# Export the binary path so the sandbox exoctl takes precedence
export PATH="$EXOFFRAME_VALIDATION_ROOT/bin:$PATH"

# Export the config path so the daemon uses the sandbox configuration
export EXO_CONFIG_PATH="$EXOFFRAME_VALIDATION_ROOT/workspace/exo.config.toml"

# Set API keys if necessary (e.g., if using a real provider)
# export ANTHROPIC_API_KEY="your-key-here"

# Start the daemon in the background
exoctl daemon start
```

---

## 2. Manual Setup (Advanced)

If you need fine-grained control over the deployment process, you can perform the setup manually:

### 2.1. Prepare the Sandbox Environment

Create a dedicated directory for your validation work to ensure isolation from your development environment.

```bash
# Define your sandbox root
export EXOFFRAME_VALIDATION_ROOT="$HOME/exo-validation-sandbox"
export WORKSPACE_DIR="$EXOFFRAME_VALIDATION_ROOT/workspace"
export FRAMEWORK_DIR="$EXOFFRAME_VALIDATION_ROOT/framework"
export EVIDENCE_DIR="$EXOFFRAME_VALIDATION_ROOT/evidence"

# Optional: Install the sandbox exoctl binary to a dedicated folder instead of
# overwriting the global ~/.deno/bin/exoctl. Downstream steps use EXO_BIN_PATH
# to resolve exoctl and EXO_CONFIG_PATH to pin the config file.
export EXO_BIN_PATH="$EXOFFRAME_VALIDATION_ROOT/bin"
export EXO_CONFIG_PATH="$WORKSPACE_DIR/exo.config.toml"

mkdir -p "$EXOFFRAME_VALIDATION_ROOT"
```

### 2.2. Deploy a Clean ExoFrame Workspace

Deploy a fresh ExoFrame runtime. This installs the necessary directory structure (`Memory/`, `Blueprints/`, etc.) and system files.

```bash
# From the ExoFrame repository root.
# If EXO_BIN_PATH is set, the deploy script writes an isolated exoctl shim
# to $EXO_BIN_PATH/exoctl instead of installing globally. The shim will
# automatically export EXO_CONFIG_PATH so that binary always targets this
# sandbox workspace regardless of the current working directory.
./scripts/deploy_workspace.sh "$WORKSPACE_DIR"

# After deployment, add your sandbox bin folder to PATH so the sandbox
# binary takes precedence in this shell session:
export PATH="$EXO_BIN_PATH:$PATH"
```

### 2.3. Configure the AI/LLM Provider

For real agent validation, you must configure a functional LLM provider.

```bash
# Navigate to the deployed workspace
cd "$WORKSPACE_DIR"

# Initialize your config from the sample
cp exo.config.sample.toml exo.config.toml

# Edit exo.config.toml to set your preferred provider and model
# For example, using Google Gemini Flash:
#   [ai] provider = "google"
#   [ai] model = "gemini-1.5-flash"

# Set your API keys (Replace with your actual keys)
export GOOGLE_API_KEY="your-google-api-key"
# export ANTHROPIC_API_KEY="your-anthropic-api-key"
# export OPENAI_API_KEY="your-openai-api-key"

# Enable paid LLMs for validation if required
export EXO_TEST_ENABLE_PAID_LLM=1
```

### 2.4. Start the Daemon

Ensure the background daemon is running.

```bash
cd "$WORKSPACE_DIR"

# If EXO_BIN_PATH is set the sandbox exoctl shim is used; otherwise the
# globally installed exoctl is called. EXO_CONFIG_PATH ensures the daemon
# reads the config from this specific sandbox workspace.
exoctl daemon start
```

### 2.5. Mount Target Portals

Portals are symlinked repositories that agents will analyze. You should mount the repositories required for your scenarios.

```bash
# Example: Mount the ExoFrame core repository itself
exoctl portal add "$HOME/git/ExoFrame" portal-exoframe

# Verify the mount
exoctl portal list

# Restart the daemon to ensure services recognize the new portal
exoctl daemon stop
exoctl daemon start
```

### 2.6. Deploy the Scenario Framework

Package the validation engine and all test assets (scenarios, fixtures) into your sandbox.

```bash
cd "$HOME/git/ExoFrame"
./tests/scenario_framework/bin/deploy-framework \
  --destination "$FRAMEWORK_DIR" \
  --workspace "$WORKSPACE_DIR" \
  --output "$EVIDENCE_DIR"
```

## 3. Execute Validation Scenarios

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

For a full list of runner flags (such as filtering by `--mode` or `--profile`), refer to the [CLI Reference in `README.md`](./README.md#running-scenarios-cli-reference).

## 4. Analyzing Results

The framework captures full evidence for every execution.

- **Run Manifest**: Check `${EVIDENCE_DIR}/run_manifest.json` for the overall outcome and per-step status.
- **Evidence Files**: Each step captures stdout/stderr and any generated artifacts (like `_analysis.json`) in `${EVIDENCE_DIR}/scenarios/<scenario-id>/<step-id>/`.
- **Journal**: Inspect the workspace journal at `${WORKSPACE_DIR}/.exo/journal.ndjson` for internal execution traces.

---

## Troubleshooting

- **Daemon Issues**: Check `${WORKSPACE_DIR}/.exo/daemon.log` if the daemon fails to start or process requests.
- **Portal Boundary Errors**: Ensure the `portal-mounted` criterion is passed in your scenario if it depends on external code references.
- **LLM Failures**: Verify your API keys and check that your `exo.config.toml` matches the requirements for the agent being tested.
- **Wrong exoctl version**: Run `which exoctl` to confirm the binary path. If `EXO_BIN_PATH` is set, ensure `$EXO_BIN_PATH` appears before `~/.deno/bin` in your `$PATH`. If not, re-export: `export PATH="$EXO_BIN_PATH:$PATH"`.
- **Config not found**: If `exoctl` cannot find `exo.config.toml`, verify `EXO_CONFIG_PATH` points to the correct file: `echo $EXO_CONFIG_PATH`. The config service checks this variable before falling back to the current working directory.
