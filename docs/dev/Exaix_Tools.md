---
agent: all
scope: dev
title: Exaix Developer Tools — Complete Guide
short_summary: "Comprehensive guide to all developer tools: installation, usage, and when to use each tool for maximum effectiveness."
version: "1.0"
topics: ["tools", "setup", "productivity", "development", "installation"]
---

# Exaix Developer Tools — Complete Guide

> **⚡ Quick Reference**: For a concise tool summary with quick install commands, see [../../TOOLS.md](../../TOOLS.md).

> **Quick Start**: Run the install script at the end of this document to install all recommended tools automatically.

This document lists all tools available for Exaix development, when to use them, and how to install them.

---

## 🎯 Tool Categories

| Category                | Tools                   | Priority       |
| ----------------------- | ----------------------- | -------------- |
| **Core Runtime**        | Deno, Git, SQLite3      | 🔴 Required    |
| **CLI & Orchestration** | exactl, just, watchexec | 🔴 Required    |
| **Navigation & Search** | fd, ripgrep, fzf        | 🟡 Recommended |
| **Git & Code Review**   | lazygit, delta, bat     | 🟡 Recommended |
| **Containerization**    | Docker                  | 🟡 Recommended |
| **Local AI**            | Ollama                  | 🟢 Optional    |
| **Terminal UX**         | tmux, glow, eza, procs  | 🟢 Optional    |

---

## 🔴 Required Tools (Must Install)

### Deno

**What**: JavaScript/TypeScript runtime (like Node.js but modern)

**When to use**: Running any Exaix code, tests, or scripts

```bash
# Verify installation
deno --version

# Common commands
deno run --allow-all src/cli/exactl.ts    # Run CLI directly
deno test --allow-all tests/              # Run tests
deno task start                           # Start daemon
```

**Install**: https://deno.land/manual/getting_started/installation

```bash
curl -fsSL https://deno.land/install.sh | sh
```

---

### Git

**What**: Version control system

**When to use**: All code changes, branching, commits, code reviews

```bash
# Verify installation
git --version

# Common workflows
git status                    # Check status
git diff | delta              # View diff with syntax highlighting
lazygit                       # Open interactive Git TUI
```

**Install**: `sudo apt install git`

---

### SQLite3

**What**: Database engine for Activity Journal

**When to use**: Debugging database issues, manual queries

```bash
# Verify installation
sqlite3 --version

# Common queries
sqlite3 .exa/journal.db "SELECT COUNT(*) FROM activity;"
sqlite3 .exa/journal.db ".schema activity"
```

**Install**: `sudo apt install sqlite3`

---

### exactl CLI

**What**: Exaix command-line interface

**When to use**: All Exaix operations (requests, plans, reviews, daemon control)

```bash
# Verify installation
exactl --version

# Common commands
exactl daemon start           # Start background daemon
exactl daemon status          # Check daemon status
exactl request "..."          # Create new request
exactl plan list              # List all plans
exactl review list            # List pending reviews
exactl dashboard              # Launch TUI dashboard
exactl journal --tail 20      # View recent activity
```

**Install** (from Exaix repo):

```bash
cd /path/to/exaix
deno install --global --config deno.json --allow-all --name exactl src/cli/exactl.ts
```

---

### just

**What**: Task runner (better than Make)

**When to use**: Running common development tasks, custom workflows

```bash
# Verify installation
just --version

# List available tasks
just --list

# Run tasks
just test                     # Run tests
just lint                     # Lint code
just fmt                      # Format code
just build                    # Build project
```

**Install**:

```bash
curl -fsSL https://github.com/casey/just/releases/download/1.47.1/just-1.47.1-x86_64-unknown-linux-musl.tar.gz -o /tmp/just.tar.gz
tar xzf /tmp/just.tar.gz -C /tmp
install /tmp/just ~/.local/bin/
```

---

### watchexec

**What**: File watcher that runs commands on changes

**When to use**: Auto-running tests/lint on file changes, dev workflows

```bash
# Verify installation
watchexec --version

# Common patterns
watchexec -e ts,md -- deno test --allow-all tests/
watchexec --clear -- deno task fmt
```

**Install**:

```bash
curl -fsSL https://github.com/watchexec/watchexec/releases/download/v2.5.0/watchexec-2.5.0-x86_64-unknown-linux-gnu.tar.xz -o /tmp/watchexec.tar.xz
tar xJf /tmp/watchexec.tar.xz -C /tmp
install /tmp/watchexec-2.5.0-x86_64-unknown-linux-gnu/watchexec ~/.local/bin/
```

---

## 🟡 Recommended Tools (High Value)

### lazygit

**What**: Terminal Git UI

**When to use**: Visual Git operations, branch management, commit history, resolving conflicts

```bash
# Verify installation
lazygit --version

# Launch
lazygit

# Features
# - Visual branch graph
# - Interactive staging
# - Commit history browser
# - Conflict resolution UI
```

**Install**:

```bash
curl -fsSL https://github.com/jesseduffield/lazygit/releases/download/v0.49.0/lazygit_0.49.0_Linux_x86_64.tar.gz -o /tmp/lazygit.tar.gz
tar xzf /tmp/lazygit.tar.gz -C /tmp
install /tmp/lazygit ~/.local/bin/
```

---

### delta

**What**: Syntax-highlighted git diff viewer

**When to use**: Reviewing code changes, git diffs, pull requests

```bash
# Verify installation
delta --version

# Configure git to use delta
git config --global core.pager delta
git config --global interactive.diffFilter "delta --color-only"
git config --global delta.navigate true
git config --global delta.light false
git config --global delta.line-numbers true
git config --global delta.side-by-side true
git config --global merge.conflictstyle diff3
git config --global diff.colorMoved default
```

**Install**:

```bash
curl -fsSL https://github.com/dandavison/delta/releases/download/0.19.1/delta-0.19.1-x86_64-unknown-linux-gnu.tar.gz -o /tmp/delta.tar.gz
tar xzf /tmp/delta.tar.gz -C /tmp
install /tmp/delta-0.19.1-x86_64-unknown-linux-gnu/delta ~/.local/bin/
```

---

### fd

**What**: Fast, simple alternative to `find`

**When to use**: Finding files by name, navigating codebase

```bash
# Verify installation
fd --version

# Common patterns
fd "*.ts"                     # Find all TypeScript files
fd test                       # Find files/dirs with "test" in name
fd -t f "*.md" docs/          # Find markdown files in docs/
fd -x deno fmt {}             # Format all found files
```

**Install**:

```bash
curl -fsSL https://github.com/sharkdp/fd/releases/download/v10.4.2/fd-v10.4.2-x86_64-unknown-linux-gnu.tar.gz -o /tmp/fd.tar.gz
tar xzf /tmp/fd.tar.gz -C /tmp
install /tmp/fd-v10.4.2-x86_64-unknown-linux-gnu/fd ~/.local/bin/
```

---

### ripgrep (rg)

**What**: Fast grep alternative

**When to use**: Searching code content, finding patterns

```bash
# Verify installation
rg --version

# Common patterns
rg "function name"            # Search for function
rg -t ts "import.*from"       # Search in TypeScript files only
rg --files-with-matches "TODO" # List files with TODO
rg -n "error" | head -20      # Show line numbers
```

**Install**: `sudo apt install ripgrep`

---

### fzf

**What**: Fuzzy finder for terminal

**When to use**: Finding files, commands, history, git branches

```bash
# Verify installation
fzf --version

# Common patterns
fd | fzf                      # Fuzzy find files
history | fzf                 # Fuzzy search command history
git branch | fzf              # Fuzzy select branch
```

**Install**: `sudo apt install fzf`

---

### bat

**What**: Better `cat` with syntax highlighting

**When to use**: Viewing file contents, reading documentation

```bash
# Verify installation
bat --version

# Common patterns
bat file.ts                   # View with syntax highlighting
bat -n file.ts                # Show line numbers
bat -p file.ts | less         # Page through output
```

**Install**: `sudo apt install bat` (command is `batcat` on Ubuntu)

---

### Docker

**What**: Containerization platform

**When to use**: Isolated testing, deployment validation, multi-environment testing

```bash
# Verify installation
docker --version
docker info

# Common patterns for Exaix
docker run --rm -v $(pwd):/exaix denoland/deno:latest deno test --allow-all
docker build -t exaix:latest .
docker run --rm exaix:latest exactl --version
```

**Install**: Docker Desktop with WSL integration (Windows) or Docker Engine (Linux)

**WSL Setup** (Windows users):

1. Install Docker Desktop on Windows
2. Open Docker Desktop → Settings → Resources → WSL Integration
3. Enable your WSL distro
4. Apply & Restart

---

## 🟢 Optional Tools (Nice to Have)

### Ollama

**What**: Local LLM runner

**When to use**: Testing with local models, offline development

```bash
# Verify installation
ollama --version

# Common patterns
ollama pull llama3.2          # Download model
ollama run llama3.2           # Run interactive
ollama list                   # List installed models
```

**Install**: https://ollama.ai/download

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

---

### tmux

**What**: Terminal multiplexer

**When to use**: Long-running sessions, multiple panes, daemon monitoring

```bash
# Verify installation
tmux -V

# Common patterns
tmux new -s exaix             # New session named "exaix"
tmux attach -t exaix          # Attach to session
tmux ls                       # List sessions
```

**Install**: `sudo apt install tmux`

---

### glow

**What**: Markdown renderer in terminal

**When to use**: Reading documentation, viewing README files

```bash
# Verify installation
glow --version

# Common patterns
glow README.md                # Render markdown file
glow .                        # Render current directory docs
```

**Install**: `sudo apt install glow`

---

### eza

**What**: Modern `ls` replacement

**When to use**: Listing files with better formatting

```bash
# Verify installation
eza --version

# Common patterns
eza -la                       # Long list with hidden files
eza --tree                    # Tree view
eza -l --git                  # Show git status
```

**Install**: `sudo apt install eza`

---

### jq

**What**: JSON processor

**When to use**: Parsing JSON output, API responses, config files

```bash
# Verify installation
jq --version

# Common patterns
exactl request list --json | jq '.[0].trace_id'
cat package.json | jq '.dependencies'
```

**Install**: `sudo apt install jq`

---

### procs

**What**: Modern `ps` replacement

**When to use**: Monitoring processes, finding PIDs

```bash
# Verify installation
procs --version

# Common patterns
procs | grep deno             # Find Deno processes
procs --tree                  # Tree view
```

**Install**: `sudo apt install procs`

---

## 📦 Quick Install Script

Run this to install all recommended tools at once:

```bash
#!/bin/bash
# Install all Exaix developer tools

set -e

echo "🔧 Installing Exaix developer tools..."

# Create local bin if needed
mkdir -p ~/.local/bin

# Add to PATH if not already
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install via apt where available
echo "📦 Installing apt packages..."
sudo apt update
sudo apt install -y git sqlite3 ripgrep fzf bat jq tmux glow eza procs

# Install from GitHub releases
install_from_github() {
    local repo=$1
    local binary=$2
    local version=$3
    local asset=$4

    echo "⬇️  Installing $binary..."
    curl -fsSL "https://github.com/$repo/releases/download/$version/$asset" -o /tmp/$binary.tar.gz
    tar xzf /tmp/$binary.tar.gz -C /tmp
    find /tmp -name "$binary" -type f -executable -exec install {} ~/.local/bin/ \;
    rm -rf /tmp/$binary*
}

install_from_github "jesseduffield/lazygit" "lazygit" "v0.49.0" "lazygit_0.49.0_Linux_x86_64.tar.gz"
install_from_github "dandavison/delta" "delta" "0.19.1" "delta-0.19.1-x86_64-unknown-linux-gnu.tar.gz"
install_from_github "sharkdp/fd" "fd" "v10.4.2" "fd-v10.4.2-x86_64-unknown-linux-gnu.tar.gz"
install_from_github "casey/just" "just" "1.47.1" "just-1.47.1-x86_64-unknown-linux-musl.tar.gz"
install_from_github "watchexec/watchexec" "watchexec" "v2.5.0" "watchexec-2.5.0-x86_64-unknown-linux-gnu.tar.xz"

echo ""
echo "✅ All tools installed!"
echo ""
echo "Verify with:"
echo "  exactl --version"
echo "  lazygit --version"
echo "  fd --version"
echo "  delta --version"
echo "  just --version"
echo "  watchexec --version"
```

---

## 🔗 Related Documentation

- [Exaix Developer Setup](./docs/dev/Exaix_Developer_Setup.md) - Full development environment setup
- [README.md](./README.md) - Project overview and quick start
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [CODE_STYLE.md](./CODE_STYLE.md) - Coding standards and linting

---

## 🆘 Troubleshooting

### Tool not found after installation

```bash
# Ensure ~/.local/bin is in PATH
export PATH="$HOME/.local/bin:$PATH"

# Add to ~/.bashrc for persistence
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Docker not working in WSL

1. Open Docker Desktop on Windows
2. Settings → Resources → WSL Integration
3. Enable your distro
4. Apply & Restart

### exactl CLI shows "Configuration file not found"

Run exactl from the Exaix project directory or set config path:

```bash
export EXA_CONFIG_PATH=/path/to/exaix/exa.config.toml
```

### Permission denied when installing tools

Install to user directory instead of system:

```bash
install /tmp/binary ~/.local/bin/
```

---

## 📊 Tool Usage Matrix

| Task              | Primary Tool | Alternative |
| ----------------- | ------------ | ----------- |
| Find files        | `fd`         | `find`      |
| Search content    | `rg`         | `grep`      |
| View files        | `bat`        | `cat`       |
| Git operations    | `lazygit`    | `git`       |
| View diffs        | `delta`      | `git diff`  |
| Run tasks         | `just`       | `deno task` |
| Watch files       | `watchexec`  | -           |
| JSON parsing      | `jq`         | -           |
| List files        | `eza`        | `ls`        |
| Process list      | `procs`      | `ps`        |
| Read markdown     | `glow`       | `cat`       |
| Terminal sessions | `tmux`       | -           |
| Fuzzy search      | `fzf`        | -           |
| Run containers    | `docker`     | -           |
| Local LLM         | `ollama`     | -           |

---

**Last Updated**: March 2026\
**Exaix Version**: 1.0.2
