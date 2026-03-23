# Skills Directory

This directory contains **learned and project-specific skills** - procedural memory for Exaix agents.

## What are Skills?

Skills are reusable instruction modules that encode domain expertise, procedures, and best practices. They are automatically injected into agent prompts based on trigger conditions.

## Directory Structure

```
Memory/Skills/
├── index.json          # Skill registry with triggers for fast lookup
├── project/            # Project-specific skills
│   └── {portal}/       # Organized by portal
│       └── *.skill.md
└── learned/            # Skills derived from learnings
    └── *.skill.md
```

## Skill Locations

- **Blueprints/Skills/**: Predefined skill blueprints (templates)
- **Memory/Skills/**: Learned and adapted skills from actual usage

## Migration Note

Core skills have been moved from `Memory/Skills/core/` to `Blueprints/Skills/` to properly separate predefined blueprints from learned memory.

## Skill File Format

Skills use Markdown with YAML frontmatter:

```markdown
---
skill_id: "example-skill"
name: "Example Skill"
version: "1.0.0"
scope: "global"
status: "active"
source: "user"

triggers:
  keywords: ["example", "demo"]
  task_types: ["feature"]
  file_patterns: ["*.ts"]
  tags: ["example"]

constraints:
  - "Always do X"
  - "Never do Y"

quality_criteria:
  - name: "Criterion 1"
    weight: 50
  - name: "Criterion 2"
    weight: 50
---

# Skill Instructions

Your procedural instructions go here in Markdown format.

## Step 1

...

## Step 2

...
```

## CLI Commands

```bash
# List all skills
exactl memory skill list

# Show skill details
exactl memory skill show <skill-id>

# Create new skill
exactl memory skill create <skill-id>

# Test trigger matching
exactl memory skill match "<request>"

# Derive skill from learnings
exactl memory skill derive <learning-ids...>
```

## Core Skills

| Skill ID               | Purpose                             |
| ---------------------- | ----------------------------------- |
| `tdd-methodology`      | Test-Driven Development workflow    |
| `security-first`       | Security-conscious development      |
| `code-review`          | Comprehensive code review checklist |
| `documentation-driven` | Documentation-first approach        |
| `commit-message`       | Conventional commit format          |
| `error-handling`       | Robust error handling patterns      |
| `typescript-patterns`  | TypeScript best practices           |
| `exaix-conventions` | Exaix-specific patterns          |

## Related Documentation

- [Phase 17: Skills Architecture](../../agents/planning/phase-17-skills-architecture.md)
- [Memory Bank Documentation](../../docs/Memory_Bank_Architecture.md)
