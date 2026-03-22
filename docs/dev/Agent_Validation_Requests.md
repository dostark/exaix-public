---
title: "Agent Blueprint Validation Requests"
created: "2026-01-26T00:00:00Z"
updated: "2026-01-26T00:00:00Z"
author: "system"
scope: "dev"
version: "1.0.0"
---

This document outlines the testing strategy and contains realistic validation requests for each agent blueprint in the ExoFrame system. Each request is designed to test the core functionality of the agent and validate that its logic works correctly with real LLM interactions.

> **Note:** The manual `exoctl` execution steps originally contained in this document have been migrated to the new automated **Scenario Framework**. The `provider_live` scenario pack (`tests/scenario_framework/scenarios/provider_live/`) automatically spins up workspaces, provisions the exact request prompts shown here, runs them using real LLM providers, and asserts on the JSON schema output. See the tests directly for exact schema assertion logic.

## Automated Validation Pipeline

These capabilities are continuously asserted by the `provider_live` scenario pack.

## Core Agents Index

### 1. Code Analyst Agent

**Agent**: `code-analyst.md` - Codebase analysis and structure assessment

**Scenario Blueprint Payload**:

```text
Analyze the CLI command structure in ExoFrame. Examine src/cli/ and src/cli/commands/ to understand:

- Command hierarchy and organization
- Common patterns across command implementations
- Error handling consistency
- CLI argument validation approaches
- Opportunities for command consolidation or refactoring
```

### 2. Performance Engineer Agent

**Agent**: `performance-engineer.md` - Performance analysis and optimization

**Scenario Blueprint Payload**:

````text
Analyze the performance characteristics of ExoFrame's database connection pooling system. Examine src/services/database_connection_pool.ts and related database operations to identify:

- Connection pool sizing and utilization patterns
- Query execution bottlenecks in the request processing pipeline
- Memory usage in database result caching
- Scalability limitations under concurrent agent executions
- Specific optimization recommendations for the SQLite/PostgreSQL implementations

### 3. Product Manager Agent

**Agent**: `product-manager.md` - Requirements analysis and user story creation

**Scenario Blueprint Payload**:
```text
We need to implement a real-time agent monitoring dashboard in the TUI. As a product manager, analyze this requirement and create:

- Detailed user stories with acceptance criteria for monitoring active agents, request queues, and system health
- Technical requirements considering the existing TUI architecture in src/tui/
- Success metrics for the dashboard feature (response time, user satisfaction, error detection)
- Potential risks and dependencies with the daemon and database services
```

### 4. QA Engineer Agent

**Agent**: `qa-engineer.md` - Quality assurance and testing strategy

**Scenario Blueprint Payload**:
```text
Create a comprehensive testing strategy for ExoFrame's portal permission system. Include:

- Unit test cases for portal access validation in src/services/portal_permissions.ts
- Integration tests for cross-portal file operations and security boundaries
- Edge cases for symlinked directories, permission escalation, and concurrent access
- Test data requirements for different portal configurations
- Automation recommendations for CI/CD pipeline integration
```

### 5. Quality Judge Agent

**Agent**: `quality-judge.md` - Code and content quality evaluation

**Scenario Blueprint Payload**:
```text
Evaluate the quality of the security implementation in ExoFrame's context loader. Assess:

- Code correctness in src/services/context_loader.ts for portal access validation
- Security boundary enforcement between workspace and portals
- Input sanitization and path traversal protection
- Error handling for unauthorized access attempts
- Code maintainability and adherence to security best practices
```

### 6. Security Expert Agent

**Agent**: `security-expert.md` - Security assessment and vulnerability analysis

**Scenario Blueprint Payload**:
```text
Perform a security audit of ExoFrame's AI provider API key management system. Identify:

- Key storage security in src/ai/provider_api_key.ts and configuration files
- Encryption practices for sensitive provider credentials
- Access control for API keys across different editions (Solo/Team/Enterprise)
- Key rotation and expiration handling
- Compliance with security best practices for credential management
```

### 7. Senior Coder Agent

**Agent**: `senior-coder.md` - Implementation planning and coding strategy

**Scenario Blueprint Payload**:
```text
Implement a new CLI command for memory bank management in ExoFrame. Plan the implementation including:

- New command structure in src/cli/commands/memory_commands.ts for listing, searching, and managing memory banks
- Integration with existing memory services (src/services/memory_bank.ts, memory_embedding.ts)
- Database schema changes for memory metadata storage
- Input validation and security measures for memory operations
- Error handling strategy and user feedback mechanisms
```

### 8. Software Architect Agent

**Agent**: `software-architect.md` - System architecture design and planning

**Scenario Blueprint Payload**:
```text
Design the architecture for MCP (Model Context Protocol) server support in ExoFrame. Consider:

- Server implementation structure in src/mcp/ for exposing ExoFrame as MCP server
- Integration with existing agent execution pipeline and tool registry
- Authentication and authorization for external MCP clients
- Resource and tool discovery mechanisms for ExoFrame capabilities
- Performance and security requirements for the Team+ edition MCP server
```

### 9. Technical Writer Agent

**Agent**: `technical-writer.md` - Documentation creation and maintenance

**Scenario Blueprint Payload**:
```text
Create comprehensive API documentation for ExoFrame's flow engine. Include:

- Complete API reference for flow definition, execution, and management in src/flows/
- Request/response formats with examples for flow_runner.ts and flow_loader.ts
- Authentication requirements and flow execution permissions
- Error handling documentation for flow validation and execution failures
- Code examples in TypeScript for creating custom flows
- Integration guides for multi-agent workflow orchestration
```

### 10. Test Engineer Agent

**Agent**: `test-engineer.md` - Test implementation and quality assurance

**Scenario Blueprint Payload**:
```text
Implement comprehensive tests for ExoFrame's review registry system. Create:

- Unit tests for review tracking and validation in src/services/review_registry.ts
- Integration tests for git review operations and workspace synchronization
- End-to-end tests for complete review lifecycle (creation, approval, execution)
- Mock data and test fixtures for different review scenarios
- Test automation setup for CI/CD validation of review integrity
```

### 11. API Documenter Agent (Example)

**Agent**: `examples/api-documenter.md` - API documentation generation

**Scenario Blueprint Payload**:
```text
Generate comprehensive documentation for the ExoFrame agent blueprint schema. Document:

- Complete TOML schema specification for agent definitions in Blueprints/Agents/
- All supported blueprint fields, types, and validation rules
- Model configuration options for different AI providers (Claude, GPT, Ollama, Gemini)
- Capability definitions and tool access permissions
- Example blueprints for each agent type with detailed field explanations
- Migration guides for updating blueprints between versions
```

### 12. Code Reviewer Agent (Example)

**Agent**: `examples/code-reviewer.md` - Code review and quality assessment

**Scenario Blueprint Payload**:
```text
Perform a comprehensive code review of ExoFrame's plan executor implementation. Evaluate:

- Code quality and correctness in src/services/plan_executor.ts and related execution logic
- Security validation of plan execution and tool invocation
- Error handling for malformed plans and execution failures
- Performance optimization opportunities in the execution pipeline
- Maintainability concerns with the multi-step plan processing
- Testing coverage and quality for the core execution engine
```
````
