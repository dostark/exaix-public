---
title: "Agent Blueprint Validation Requests"
created: "2026-01-26T00:00:00Z"
updated: "2026-01-26T00:00:00Z"
author: "system"
scope: "dev"
version: "1.0.0"
---

This document contains realistic validation requests for each agent blueprint in the ExoFrame system. Each request is designed to test the core functionality of the agent and validate that the JSON output format works correctly with real LLM interactions.

## Setup Requirements

### Prerequisites (Required)

1. **Add portal for the ExoFrame repo** (from the deployed workspace at `~/ExoFrame`):

   ```bash
   exoctl portal add ~/git/ExoFrame portal-exoframe
   exoctl daemon restart
   ```

1.

   ```bash
   export EXO_TEST_ENABLE_PAID_LLM=1
   # Set provider API key(s) as needed for your target model
   export GOOGLE_API_KEY=...
   export OPENAI_API_KEY=...
   export ANTHROPIC_API_KEY=...
   ```

   Then restart the daemon:

   ```bash
   exoctl daemon restart
   ```

### Portal Configuration

- **Portal Path**: `~/git/ExoFrame` (the ExoFrame repository)
- **Workspace**: `~/ExoFrame` (deployed workspace instance)
- **Environment**: Full development environment with all dependencies installed

### Validation Environment

- **LLM Provider**: Real LLM (not mock) for authentic testing
- **Portal Access**: Full read/write access to codebase
- **Dependencies**: All project dependencies installed and functional
- **Database**: Properly configured (if required)

### Request Format

Each request follows this structure:

1. **Agent**: Blueprint name and purpose

1.
1.

## Validation Requests

### 1. Code Analyst Agent

**Agent**: `code-analyst.md` - Codebase analysis and structure assessment

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent code-analyst "Analyze the CLI command structure in ExoFrame. Examine src/cli/exoctl.ts and src/cli/commands/ to understand: - Command hierarchy and organization - Common patterns across command implementations - Error handling consistency - CLI argument validation approaches - Opportunities for command consolidation or refactoring Provide specific recommendations for improving the CLI architecture."
```

**Request**:

```text
Analyze the CLI command structure in ExoFrame. Examine src/cli/ and src/cli/commands/ to understand:

- Command hierarchy and organization
- Common patterns across command implementations
- Error handling consistency
- CLI argument validation approaches
- Opportunities for command consolidation or refactoring

```

**Expected Output**:

- JSON with `analysis` field containing codebase metrics
- File count, language detection, framework identification
- Module dependencies and relationships
- Security findings and recommendations
- Code quality metrics and patterns

**Validation Steps**:

1. Verify JSON output validates against PlanSchema

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor code-analyst --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 2. Performance Engineer Agent

**Agent**: `performance-engineer.md` - Performance analysis and optimization

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent performance-engineer "Analyze the performance characteristics of ExoFrame's database connection pooling system. Examine src/services/database_connection_pool.ts and related database operations to identify: - Connection pool sizing and utilization patterns - Query execution bottlenecks in the request processing pipeline - Memory usage in database result caching - Scalability limitations under concurrent agent executions - Specific optimization recommendations for the SQLite/PostgreSQL implementations"
```

**Request**:

```text
Analyze the performance characteristics of ExoFrame's database connection pooling system. Examine src/services/database_connection_pool.ts and related database operations to identify:

- Connection pool sizing and utilization patterns
- Query execution bottlenecks in the request processing pipeline
- Memory usage in database result caching
- Scalability limitations under concurrent agent executions
- Specific optimization recommendations for the SQLite/PostgreSQL implementations

**Expected Output**:

- JSON with `performance` field containing analysis results
- Current performance metrics and benchmarks
- Identified bottlenecks with specific locations
- Optimization recommendations with code examples
- Scalability assessment and recommendations

**Validation Steps**:

1. Verify JSON output contains performance-specific metrics

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor performance-engineer --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 3. Product Manager Agent

**Agent**: `product-manager.md` - Requirements analysis and user story creation

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent product-manager "We need to implement a real-time agent monitoring dashboard in the TUI. As a product manager, analyze this requirement and create: - Detailed user stories with acceptance criteria for monitoring active agents, request queues, and system health - Technical requirements considering the existing TUI architecture in src/tui/ - Success metrics for the dashboard feature (response time, user satisfaction, error detection) - Potential risks and dependencies with the daemon and database services Structure this as a complete requirements specification for the Team+ edition feature."
```

**Request**:

```text
We need to implement a real-time agent monitoring dashboard in the TUI. As a product manager, analyze this requirement and create:

- Detailed user stories with acceptance criteria for monitoring active agents, request queues, and system health
- Technical requirements considering the existing TUI architecture in src/tui/
- Success metrics for the dashboard feature (response time, user satisfaction, error detection)
- Potential risks and dependencies with the daemon and database services

```

**Expected Output**:

- JSON with `analysis` field containing requirements structure
- User stories with proper acceptance criteria format
- Technical requirements and constraints
- Success metrics and risk assessment
- Prioritized implementation approach

**Validation Steps**:

1. Verify user stories follow standard format (As a/I want/So that)

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor product-manager --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 4. QA Engineer Agent

**Agent**: `qa-engineer.md` - Quality assurance and testing strategy

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent qa-engineer "Create a comprehensive testing strategy for ExoFrame's portal permission system. Include: - Unit test cases for portal access validation in src/services/portal_permissions.ts - Integration tests for cross-portal file operations and security boundaries - Edge cases for symlinked directories, permission escalation, and concurrent access - Test data requirements for different portal configurations - Automation recommendations for CI/CD pipeline integration Provide specific test cases that validate the security boundaries between portals and the main workspace."
```

**Request**:

```text
Create a comprehensive testing strategy for ExoFrame's portal permission system. Include:

- Unit test cases for portal access validation in src/services/portal_permissions.ts
- Integration tests for cross-portal file operations and security boundaries
- Edge cases for symlinked directories, permission escalation, and concurrent access
- Test data requirements for different portal configurations
- Automation recommendations for CI/CD pipeline integration

```

**Expected Output**:

- JSON with `qa` field containing test specifications
- Test summary with coverage metrics
- Detailed test scenarios for each component
- Edge cases and error handling tests
- Automation strategy and recommendations

**Validation Steps**:

1. Verify test cases cover actual portal permission functionality

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor qa-engineer --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 5. Quality Judge Agent

**Agent**: `quality-judge.md` - Code and content quality evaluation

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent quality-judge "Evaluate the quality of the security implementation in ExoFrame's context loader. Assess: - Code correctness in src/services/context_loader.ts for portal access validation - Security boundary enforcement between workspace and portals - Input sanitization and path traversal protection - Error handling for unauthorized access attempts - Code maintainability and adherence to security best practices Provide a detailed quality assessment with specific findings and recommendations for the security-critical context loading functionality."
```

**Request**:

```text
Evaluate the quality of the security implementation in ExoFrame's context loader. Assess:

- Code correctness in src/services/context_loader.ts for portal access validation
- Security boundary enforcement between workspace and portals
- Input sanitization and path traversal protection
- Error handling for unauthorized access attempts
- Code maintainability and adherence to security best practices

```

**Expected Output**:

- JSON with `analysis` field containing evaluation results
- Quality scores for different criteria (0.0-1.0)
- Specific issues found with code locations
- Critical findings with severity levels
- Actionable improvement recommendations

**Validation Steps**:

1. Verify evaluation criteria match the actual codebase quality

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor quality-judge --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 6. Security Expert Agent

**Agent**: `security-expert.md` - Security assessment and vulnerability analysis

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent security-expert "Perform a security audit of ExoFrame's AI provider API key management system. Identify: - Key storage security in src/ai/provider_api_key.ts and configuration files - Encryption practices for sensitive provider credentials - Access control for API keys across different editions (Solo/Team/Enterprise) - Key rotation and expiration handling - Compliance with security best practices for credential management Provide specific remediation steps with code examples for securing the multi-provider API key infrastructure."
```

**Request**:

```text
Perform a security audit of ExoFrame's AI provider API key management system. Identify:

- Key storage security in src/ai/provider_api_key.ts and configuration files
- Encryption practices for sensitive provider credentials
- Access control for API keys across different editions (Solo/Team/Enterprise)
- Key rotation and expiration handling
- Compliance with security best practices for credential management

```

**Expected Output**:

- JSON with `security` field containing audit results
- Vulnerability findings with severity levels
- Specific code locations and attack vectors
- Remediation recommendations with examples
- Compliance assessment against security standards

**Validation Steps**:

1. Verify vulnerabilities identified are actual security issues

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor security-expert --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 7. Senior Coder Agent

**Agent**: `senior-coder.md` - Implementation planning and coding strategy

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent senior-coder "Implement a new CLI command for memory bank management in ExoFrame. Plan the implementation including: - New command structure in src/cli/commands/memory_commands.ts for listing, searching, and managing memory banks - Integration with existing memory services (src/services/memory_bank.ts, memory_embedding.ts) - Database schema changes for memory metadata storage - Input validation and security measures for memory operations - Error handling strategy and user feedback mechanisms Provide a complete implementation plan with specific code changes for the memory management CLI feature."
```

**Request**:

```text
Implement a new CLI command for memory bank management in ExoFrame. Plan the implementation including:

- New command structure in src/cli/commands/memory_commands.ts for listing, searching, and managing memory banks
- Integration with existing memory services (src/services/memory_bank.ts, memory_embedding.ts)
- Database schema changes for memory metadata storage
- Input validation and security measures for memory operations
- Error handling strategy and user feedback mechanisms

```

**Expected Output**:

- JSON with `steps` field containing implementation plan
- Detailed steps with tools, actions, and success criteria
- Dependencies and rollback procedures
- Code examples and file locations
- Testing strategy integrated into the plan

**Validation Steps**:

1. Verify implementation steps are technically sound

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor senior-coder --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 8. Software Architect Agent

**Agent**: `software-architect.md` - System architecture design and planning

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent software-architect "Design the architecture for MCP (Model Context Protocol) server support in ExoFrame. Consider: - Server implementation structure in src/mcp/ for exposing ExoFrame as MCP server - Integration with existing agent execution pipeline and tool registry - Authentication and authorization for external MCP clients - Resource and tool discovery mechanisms for ExoFrame capabilities - Performance and security requirements for the Team+ edition MCP server Provide a complete architectural design with implementation phases for MCP server integration."
```

**Request**:

```text
Design the architecture for MCP (Model Context Protocol) server support in ExoFrame. Consider:

- Server implementation structure in src/mcp/ for exposing ExoFrame as MCP server
- Integration with existing agent execution pipeline and tool registry
- Authentication and authorization for external MCP clients
- Resource and tool discovery mechanisms for ExoFrame capabilities
- Performance and security requirements for the Team+ edition MCP server

```

**Expected Output**:

- JSON with `steps` field containing architectural plan
- Component design with clear responsibilities
- Database schema and API specifications
- Integration points with existing systems
- Scalability and performance considerations

**Validation Steps**:

1. Verify architectural decisions align with system constraints

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor software-architect --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 9. Technical Writer Agent

**Agent**: `technical-writer.md` - Documentation creation and maintenance

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent technical-writer "Create comprehensive API documentation for ExoFrame's flow engine. Include: - Complete API reference for flow definition, execution, and management in src/flows/ - Request/response formats with examples for flow_runner.ts and flow_loader.ts - Authentication requirements and flow execution permissions - Error handling documentation for flow validation and execution failures - Code examples in TypeScript for creating custom flows - Integration guides for multi-agent workflow orchestration Ensure the documentation covers both programmatic and CLI usage patterns for the flow system."
```

**Request**:

```text
Create comprehensive API documentation for ExoFrame's flow engine. Include:

- Complete API reference for flow definition, execution, and management in src/flows/
- Request/response formats with examples for flow_runner.ts and flow_loader.ts
- Authentication requirements and flow execution permissions
- Error handling documentation for flow validation and execution failures
- Code examples in TypeScript for creating custom flows
- Integration guides for multi-agent workflow orchestration

```

**Expected Output**:

- JSON with `steps` field containing documentation plan
- Structured approach to documentation creation
- Content organization and navigation planning
- Quality assurance steps for documentation
- Maintenance and update procedures

**Validation Steps**:

1. Verify documentation plan covers all actual API endpoints

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor technical-writer --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 10. Test Engineer Agent

**Agent**: `test-engineer.md` - Test implementation and quality assurance

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent test-engineer "Implement comprehensive tests for ExoFrame's review registry system. Create: - Unit tests for review tracking and validation in src/services/review_registry.ts - Integration tests for git review operations and workspace synchronization - End-to-end tests for complete review lifecycle (creation, approval, execution) - Mock data and test fixtures for different review scenarios - Test automation setup for CI/CD validation of review integrity Provide specific test implementations that ensure the reliability of the git-based change tracking system."
```

**Request**:

```text
Implement comprehensive tests for ExoFrame's review registry system. Create:

- Unit tests for review tracking and validation in src/services/review_registry.ts
- Integration tests for git review operations and workspace synchronization
- End-to-end tests for complete review lifecycle (creation, approval, execution)
- Mock data and test fixtures for different review scenarios
- Test automation setup for CI/CD validation of review integrity

```

**Expected Output**:

- JSON with `qa` field containing test implementation plan
- Detailed test cases with setup and assertions
- Test data and fixture specifications
- Automation configuration and CI integration
- Test coverage and quality metrics

**Validation Steps**:

1. Verify test cases cover actual code functionality

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor test-engineer --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 11. API Documenter Agent (Example)

**Agent**: `examples/api-documenter.md` - API documentation generation

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent api-documenter "Generate comprehensive documentation for the ExoFrame agent blueprint schema. Document: - Complete TOML schema specification for agent definitions in Blueprints/Agents/ - All supported blueprint fields, types, and validation rules - Model configuration options for different AI providers (Claude, GPT, Ollama, Gemini) - Capability definitions and tool access permissions - Example blueprints for each agent type with detailed field explanations - Migration guides for updating blueprints between versions Base the documentation on the actual blueprint loader implementation in src/services/blueprint_loader.ts."
```

**Request**:

```text
Generate comprehensive documentation for the ExoFrame agent blueprint schema. Document:

- Complete TOML schema specification for agent definitions in Blueprints/Agents/
- All supported blueprint fields, types, and validation rules
- Model configuration options for different AI providers (Claude, GPT, Ollama, Gemini)
- Capability definitions and tool access permissions
- Example blueprints for each agent type with detailed field explanations
- Migration guides for updating blueprints between versions

```

**Expected Output**:

- JSON with `steps` field containing documentation workflow
- Systematic approach to API documentation
- Content generation and validation steps
- Quality assurance procedures
- Maintenance and update processes

**Validation Steps**:

1. Verify documentation covers all actual API endpoints

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor api-documenter --limit 10`
   - Verify trace ID consistency across request, plan, and execution

### 12. Code Reviewer Agent (Example)

**Agent**: `examples/code-reviewer.md` - Code review and quality assessment

**exoctl Command**:

```bash
exoctl request --portal portal-exoframe --agent code-reviewer "Perform a comprehensive code review of ExoFrame's plan executor implementation. Evaluate: - Code quality and correctness in src/services/plan_executor.ts and related execution logic - Security validation of plan execution and tool invocation - Error handling for malformed plans and execution failures - Performance optimization opportunities in the execution pipeline - Maintainability concerns with the multi-step plan processing - Testing coverage and quality for the core execution engine Provide specific recommendations for improving the reliability and security of the plan execution system."
```

**Request**:

```text
Perform a comprehensive code review of ExoFrame's plan executor implementation. Evaluate:

- Code quality and correctness in src/services/plan_executor.ts and related execution logic
- Security validation of plan execution and tool invocation
- Error handling for malformed plans and execution failures
- Performance optimization opportunities in the execution pipeline
- Maintainability concerns with the multi-step plan processing
- Testing coverage and quality for the core execution engine

```

**Expected Output**:

- JSON with `analysis` field containing review results
- Code quality metrics and assessments
- Specific issues with severity levels and locations
- Security findings and recommendations
- Performance optimization suggestions
- Testing and maintainability feedback

**Validation Steps**:

1. Verify review findings reflect actual code issues

1.
1.
1.
1.
   - Review the generated plan: `exoctl plan list --recent 1`
   - Examine plan details: `exoctl plan show <plan-id>`
   - Check for any reviews created: `exoctl review list --recent 1`
   - Review journal events: `exoctl journal events --actor code-reviewer --limit 10`
   - Verify trace ID consistency across request, plan, and execution

## Validation Execution Guidelines

### Pre-Request Setup

1. Ensure portal is properly mapped to `~/git/ExoFrame`

1.
1.

### Request Execution

1. Submit each numbered request to the appropriate agent

1.
1.
1.

### Post-Validation Actions

1. Record validation results for each request

1.
1.
1.

### Success Criteria

- All JSON outputs validate against PlanSchema
- Agent responses are functionally correct and comprehensive
- Code references and examples are accurate
- Recommendations are actionable and relevant
- No critical functionality gaps identified

## Issue Tracking

If validation reveals issues, document them with:

- Request number and agent name
- Issue description and severity
- Expected vs actual behavior
- Recommended fixes
- Re-validation requirements

