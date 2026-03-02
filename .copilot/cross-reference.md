---
agent: general
scope: dev
title: Agent Documentation Cross-Reference Map
short_summary: "Quick reference mapping task types to relevant agent documentation files."
version: "0.1"
topics: ["navigation", "quick-reference", "task-mapping"]
---

## Agent Documentation Cross-Reference Map

## Task → Agent Doc Quick Reference

| Task Type                           | Primary Doc                                                                      | Secondary Docs                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Write unit tests                    | [tests/testing.md](tests/testing.md)                                             | [source/exoframe.md](source/exoframe.md)                                                     |
| Refactor code                       | [source/exoframe.md](source/exoframe.md)                                         | [tests/testing.md](tests/testing.md)                                                         |
| Update documentation                | [docs/documentation.md](docs/documentation.md)                                   | -                                                                                            |
| Fix TypeScript errors               | [source/exoframe.md](source/exoframe.md)                                         | [copilot/exoframe.md](copilot/exoframe.md)                                                   |
| Add new feature                     | [source/exoframe.md](source/exoframe.md) + [tests/testing.md](tests/testing.md)  | [docs/documentation.md](docs/documentation.md)                                               |
| Compose commit message              | [prompts/commit-message.md](prompts/commit-message.md)                           | [../Blueprints/Skills/commit-message.skill.md](../Blueprints/Skills/commit-message.skill.md) |
| Debug test failures                 | [tests/testing.md](tests/testing.md)                                             | [source/exoframe.md](source/exoframe.md)                                                     |
| Fix CI failures                     | [tests/testing.md](tests/testing.md) (#CI)                                       | [source/exoframe.md](source/exoframe.md)                                                     |
| Security audit                      | [.copilot/tests/testing.md](tests/testing.md) (#Security Tests)                  | [.copilot/source/exoframe.md](source/exoframe.md) (#System Constraints)                      |
| Claude-specific guidance            | [providers/claude.md](providers/claude.md)                                       | [README.md](README.md)                                                                       |
| RAG/embeddings usage                | [providers/claude-rag.md](providers/claude-rag.md)                               | [README.md](README.md) (#Building embeddings)                                                |
| VS Code Copilot setup               | [copilot/exoframe.md](copilot/exoframe.md)                                       | [README.md](README.md)                                                                       |
| OpenAI integration                  | [providers/openai.md](providers/openai.md)                                       | [README.md](README.md)                                                                       |
| OpenAI RAG/embeddings usage         | [providers/openai-rag.md](providers/openai-rag.md)                               | [providers/openai.md](providers/openai.md)                                                   |
| Google integration                  | [providers/google.md](providers/google.md)                                       | [README.md](README.md)                                                                       |
| Gemini Long-Context                 | [providers/google-long-context.md](providers/google-long-context.md)             | [providers/google.md](providers/google.md)                                                   |
| Instruction gaps / self-improvement | [process/self-improvement.md](process/self-improvement.md)                       | [prompts/self-improvement-loop.md](prompts/self-improvement-loop.md)                         |
| Architecture review / improvement   | [process/review-research-improvement.md](process/review-research-improvement.md) | [planning/](planning/)                                                                       |

## Search by Topic

- **`tdd`** → [source/exoframe.md](source/exoframe.md), [tests/testing.md](tests/testing.md)
- **`security`** → [tests/testing.md](tests/testing.md) (Security Tests as First-Class Citizens)
- **`database`** → [tests/testing.md](tests/testing.md) (Database Initialization, initTestDbService)
- **`docs`** → [docs/documentation.md](docs/documentation.md)
- **`patterns`** → [source/exoframe.md](source/exoframe.md) (Service Pattern, Module Documentation)
- **`helpers`** → [tests/testing.md](tests/testing.md) (Test Organization, Helpers)
- **`embeddings`** → [providers/claude-rag.md](providers/claude-rag.md), [README.md](README.md)
- **`rag`** → [providers/claude-rag.md](providers/claude-rag.md)
- **`openai`** → [providers/openai.md](providers/openai.md), [providers/openai-rag.md](providers/openai-rag.md)
- **`prompts`** → [providers/claude.md](providers/claude.md), [providers/openai.md](providers/openai.md)
- **`commit`** → [prompts/commit-message.md](prompts/commit-message.md), [../Blueprints/Skills/commit-message.skill.md](../Blueprints/Skills/commit-message.skill.md)
- **`refactoring`** → [source/exoframe.md](source/exoframe.md), [providers/claude.md](providers/claude.md)
- **`debugging`** → [providers/claude.md](providers/claude.md)
- **`coverage`** → [tests/testing.md](tests/testing.md)
- **`gemini`** → [providers/google.md](providers/google.md), [providers/google-long-context.md](providers/google-long-context.md)
- **`long-context`** → [providers/google-long-context.md](providers/google-long-context.md)
- **`self-improvement`** → [process/self-improvement.md](process/self-improvement.md), [prompts/self-improvement-loop.md](prompts/self-improvement-loop.md)
- **`architecture`** → [process/review-research-improvement.md](process/review-research-improvement.md)
- **`improvement-planning`** → [process/review-research-improvement.md](process/review-research-improvement.md), [planning/](planning/)

## Workflow Examples

### "I want to add a new feature"

1. Read [docs/ExoFrame_Implementation_Plan.md](../docs/ExoFrame_Implementation_Plan.md) to find or create Implementation Plan step

1.
1.

### "I want to fix a bug"

1. Check Implementation Plan for related step

1.
1.

### "I want to use Claude effectively"

1. Read [providers/claude.md](providers/claude.md) for prompt templates

1.
1.

### "I want to use Gemini effectively"

1. Read [providers/google.md](providers/google.md) for optimized prompts

1.

### "I want to add security tests"

1. Review [tests/testing.md](tests/testing.md) security section

1.
1.

### "I want to set up RAG for semantic search"

1. Read [providers/claude-rag.md](providers/claude-rag.md) for workflow

1.
1.

## Provider-Specific Quick Links

### Claude

- **Main guide**: [providers/claude.md](providers/claude.md)
- **RAG setup**: [providers/claude-rag.md](providers/claude-rag.md)
- **System prompts**: TDD, Refactoring, Debugging, Documentation (in claude.md)
- **Context window**: 200k tokens (4-6 chunks recommended)

### VS Code Copilot

- **Main guide**: [copilot/exoframe.md](copilot/exoframe.md)
- **Quick summary**: [copilot/summary.md](copilot/summary.md)
- **Pattern**: Consult `.copilot/manifest.json` first

### OpenAI

- **Main guide**: [providers/openai.md](providers/openai.md)
- **RAG guide**: [providers/openai-rag.md](providers/openai-rag.md)
- **Prompt templates**: See `.copilot/prompts/openai-*.md`
- **Budgets**: Uses simple/standard/complex output budgets (see openai.md)

### Google

- **Main guide**: [providers/google.md](providers/google.md)
- **Long-context**: [providers/google-long-context.md](providers/google-long-context.md)
- **Context window**: 1M-2M tokens (use "Saturation" pattern)

## Common Task Patterns

### Test-Driven Development (TDD)

1. **Docs**: [source/exoframe.md](source/exoframe.md), [tests/testing.md](tests/testing.md)

1.

### Code Refactoring

1. **Docs**: [source/exoframe.md](source/exoframe.md), [providers/claude.md](providers/claude.md)

1.

### Documentation Updates

1. **Docs**: [docs/documentation.md](docs/documentation.md)

1.

### Debugging

1. **Docs**: [providers/claude.md](providers/claude.md) (Debugging section)

1.

## Canonical Prompt (Short)

"You are a developer working on ExoFrame. Before starting work, consult this cross-reference map to find the most relevant agent documentation. Use the task-to-doc mapping table to quickly locate guidance for your specific task type."

## Examples

- Example prompt: "I need to add a security feature. Which docs should I read?" → Answer: Start with [.copilot/tests/testing.md](tests/testing.md) security section and [.copilot/source/exoframe.md](source/exoframe.md) system constraints.
- Example prompt: "How do I set up Claude with RAG?" → Answer: Read [providers/claude-rag.md](providers/claude-rag.md) for the complete workflow.
- Example prompt: "What's the TDD workflow?" → Answer: See [source/exoframe.md](source/exoframe.md) and [tests/testing.md](tests/testing.md) for patterns and helpers.
