---
title: "Agent Blueprint Validation Requests"
created: "2026-01-26T00:00:00Z"
updated: "2026-03-22T00:00:00Z"
author: "system"
scope: "dev"
version: "2.0.0"
---

# Agent Validation Scenario Framework

This document provides an index of agent validation scenarios for the Exaix system. Each scenario tests an identity blueprint's core functionality using realistic prompts validated against real LLM providers.

## Automated Validation

All scenarios below are **automated** and continuously validated by the **Scenario Framework** in the `provider_live` scenario pack.

- **Location**: `tests/scenario_framework/scenarios/provider_live/`
- **Fixtures**: `tests/scenario_framework/fixtures/requests/provider_live/`
- **Execution**: `deno test -A tests/scenario_framework/`

Each scenario:

1. Spins up an isolated workspace
2. Provisions the request prompt fixture
3. Executes the agent using `exactl request`
4. Waits for artifact generation (`*_analysis.json` or `*_plan.yaml`)
5. Asserts structural JSON schema output

## Core Agents Index

### 1. Code Analyst Agent

**Blueprint**: `code-analyst.md`
**Scenario**: `code-analyst-validation.yaml`
**Fixture**: `code_analyst_cli_structure.md`
**Focus**: Codebase analysis and structure assessment

**Request Prompt**:

```text
Analyze the CLI command structure in Exaix. Examine src/cli/ and src/cli/commands/ to understand:

- Command hierarchy and organization
- Common patterns across command implementations
- Error handling consistency
- CLI argument validation approaches
- Opportunities for command consolidation or refactoring
```

### 2. Performance Engineer Agent

**Blueprint**: `performance-engineer.md`
**Scenario**: `performance-engineer-validation.yaml`
**Fixture**: `performance_engineer.md`
**Focus**: Performance analysis and optimization

**Request Prompt**:

```text
Analyze the performance characteristics of Exaix's database connection pooling system. Examine src/services/database_connection_pool.ts and related database operations to identify:

- Connection pool sizing and utilization patterns
- Query execution bottlenecks in the request processing pipeline
- Memory usage in database result caching
- Scalability limitations under concurrent agent executions
- Specific optimization recommendations for the SQLite/PostgreSQL implementations
```

### 3. Product Manager Agent

**Blueprint**: `product-manager.md`
**Scenario**: `product-manager-validation.yaml`
**Fixture**: `product_manager.md`
**Focus**: Requirements analysis and user story creation

**Request Prompt**:

```text
We need to implement a real-time agent monitoring dashboard in the TUI. As a product manager, analyze this requirement and create:

- Detailed user stories with acceptance criteria for monitoring active agents, request queues, and system health
- Technical requirements considering the existing TUI architecture in src/tui/
- Success metrics for the dashboard feature (response time, user satisfaction, error detection)
- Potential risks and dependencies with the daemon and database services
```

### 4. QA Engineer Agent

**Blueprint**: `qa-engineer.md`
**Scenario**: `qa-engineer-validation.yaml`
**Fixture**: `qa_engineer.md`
**Focus**: Quality assurance and testing strategy

**Request Prompt**:

```text
Create a comprehensive testing strategy for Exaix's portal permission system. Include:

- Unit test cases for portal access validation in src/services/portal_permissions.ts
- Integration tests for cross-portal file operations and security boundaries
- Edge cases for symlinked directories, permission escalation, and concurrent access
- Test data requirements for different portal configurations
- Automation recommendations for CI/CD pipeline integration
```

### 5. Quality Judge Agent

**Blueprint**: `quality-judge.md`
**Scenario**: `quality-judge-validation.yaml`
**Fixture**: `quality_judge.md`
**Focus**: Code and content quality evaluation

**Request Prompt**:

```text
Evaluate the quality of the security implementation in Exaix's context loader. Assess:

- Code correctness in src/services/context_loader.ts for portal access validation
- Security boundary enforcement between workspace and portals
- Input sanitization and path traversal protection
- Error handling for unauthorized access attempts
- Code maintainability and adherence to security best practices
```

### 6. Security Expert Agent

**Blueprint**: `security-expert.md`
**Scenario**: `security-expert-validation.yaml`
**Fixture**: `security_expert.md`
**Focus**: Security assessment and vulnerability analysis

**Request Prompt**:

```text
Perform a security audit of Exaix's AI provider API key management system. Identify:

- Key storage security in src/ai/provider_api_key.ts and configuration files
- Encryption practices for sensitive provider credentials
- Access control for API keys across different editions (Solo/Team/Enterprise)
- Key rotation and expiration handling
- Compliance with security best practices for credential management
```

### 7. Senior Coder Agent

**Blueprint**: `senior-coder.md`
**Scenario**: `senior-coder-validation.yaml`
**Fixture**: `senior_coder.md`
**Focus**: Implementation planning and coding strategy

**Request Prompt**:

```text
Implement a new CLI command for memory bank management in Exaix. Plan the implementation including:

- New command structure in src/cli/commands/memory_commands.ts for listing, searching, and managing memory banks
- Integration with existing memory services (src/services/memory_bank.ts, memory_embedding.ts)
- Database schema changes for memory metadata storage
- Input validation and security measures for memory operations
- Error handling strategy and user feedback mechanisms
```

### 8. Software Architect Agent

**Blueprint**: `software-architect.md`
**Scenario**: `software-architect-validation.yaml`
**Fixture**: `software_architect.md`
**Focus**: System architecture design and planning

**Request Prompt**:

```text
Design the architecture for MCP (Model Context Protocol) server support in Exaix. Consider:

- Server implementation structure in src/mcp/ for exposing Exaix as MCP server
- Integration with existing agent execution pipeline and tool registry
- Authentication and authorization for external MCP clients
- Resource and tool discovery mechanisms for Exaix capabilities
- Performance and security requirements for the Team+ edition MCP server
```

### 9. Technical Writer Agent

**Blueprint**: `technical-writer.md`
**Scenario**: `technical-writer-validation.yaml`
**Fixture**: `technical_writer.md`
**Focus**: Documentation creation and maintenance

**Request Prompt**:

```text
Create comprehensive API documentation for Exaix's flow engine. Include:

- Complete API reference for flow definition, execution, and management in src/flows/
- Request/response formats with examples for flow_runner.ts and flow_loader.ts
- Authentication requirements and flow execution permissions
- Error handling documentation for flow validation and execution failures
- Code examples in TypeScript for creating custom flows
- Integration guides for multi-agent workflow orchestration
```

### 10. Test Engineer Agent

**Blueprint**: `test-engineer.md`
**Scenario**: `test-engineer-validation.yaml`
**Fixture**: `test_engineer.md`
**Focus**: Test implementation and quality assurance

**Request Prompt**:

```text
Implement comprehensive tests for Exaix's review registry system. Create:

- Unit tests for review tracking and validation in src/services/review_registry.ts
- Integration tests for git review operations and workspace synchronization
- End-to-end tests for complete review lifecycle (creation, approval, execution)
- Mock data and test fixtures for different review scenarios
- Test automation setup for CI/CD validation of review integrity
```

### 11. API Documenter Agent

**Blueprint**: `examples/api-documenter.md`
**Scenario**: `api-documenter-validation.yaml`
**Fixture**: `api_documenter.md`
**Focus**: API documentation generation

**Request Prompt**:

```text
Generate comprehensive documentation for the Exaix identity blueprint schema. Document:

- Complete TOML schema specification for agent definitions in Blueprints/Identities/
- All supported blueprint fields, types, and validation rules
- Model configuration options for different AI providers (Claude, GPT, Ollama, Gemini)
- Capability definitions and tool access permissions
- Example blueprints for each agent type with detailed field explanations
- Migration guides for updating blueprints between versions
```

### 12. Code Reviewer Agent

**Blueprint**: `examples/code-reviewer.md`
**Scenario**: `code-reviewer-validation.yaml`
**Fixture**: `code_reviewer.md`
**Focus**: Code review and quality assessment

**Request Prompt**:

```text
Perform a comprehensive code review of Exaix's plan executor implementation. Evaluate:

- Code quality and correctness in src/services/plan_executor.ts and related execution logic
- Security validation of plan execution and tool invocation
- Error handling for malformed plans and execution failures
- Performance optimization opportunities in the execution pipeline
- Maintainability concerns with the multi-step plan processing
- Testing coverage and quality for the core execution engine
```

## Multi-Agent Flow Scenarios

In addition to individual agent validation, the framework includes multi-agent flow scenarios that test handoffs and sequential agent interactions:

- **multi-agent-tui-flow.yaml**: Product Manager → Software Architect workflow for TUI dashboard development

## Running Validation

```bash
# Run all provider_live scenarios
deno test -A tests/scenario_framework/

# Run specific agent validation
deno test -A tests/scenario_framework/ -- --filter code-analyst

# Dry-run scenario compilation
run-scenarios --pack provider_live --dry-run
```
