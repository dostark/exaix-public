# Blueprint Fragments

This directory contains reusable markdown fragments that can be injected into agent blueprints using the fragment syntax.

## Usage

In any agent blueprint (`Blueprints/Agents/*.md`), use the following syntax:

`{{include:fragment_name}}`

This will be replaced by the contents of `Blueprints/Fragments/fragment_name.md` when the blueprint is loaded.

## Standard Fragments

- **[standard-response-format.md](standard-response-format.md)**: Defines the mandatory `<thought>` and `<content>` tag structure.
- **[plan-schema-full.md](plan-schema-full.md)**: Provides the complete JSON schema for executable plans and analysis reports.
- **[blueprint-best-practices.md](blueprint-best-practices.md)**: Instructions for agents on how to generate high-quality, executable plans.

## Benefits

1. **Consistency**: Ensure all agents follow the same response format and schema.
2. **Maintainability**: Update a schema or instruction in one place and have it reflect across all agents.
3. **Readability**: Keeps individual blueprint files focused on the agent's persona rather than boilerplate instructions.

## Recursive Inclusion

Fragments can include other fragments. The `BlueprintLoader` resolves these recursively.

> [!CAUTION]
> Avoid circular inclusions as they will be detected and blocked by the loader.
