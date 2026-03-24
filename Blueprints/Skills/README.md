# Blueprints/Skills/

This directory contains **skill blueprints** - predefined templates for capabilities, patterns, and behaviors that agents can use.

## Purpose

Skills in this directory are **blueprints** (templates) rather than learned knowledge:

- **Blueprints**: Predefined, curated capabilities (this directory)
- **Memory/Skills/**: Learned and adapted knowledge from actual usage

## Structure

- `*.skill.md`: Skill definition files with YAML frontmatter and markdown instructions
- Each skill contains triggers, constraints, and procedural instructions

## Migration

Core skills have been migrated from `Memory/Skills/core/` to this location to properly separate blueprints from learned memory.

## Usage

Skills in this directory are loaded by the SkillsService and can be referenced by agents and flows for automatic capability injection.
