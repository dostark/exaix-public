---
phase: 31
title: "Agent Blueprint JSON Migration"
status: planning
created: "2026-01-26T00:00:00Z"
updated: "2026-01-26T00:00:00Z"
author: "system"
agent: "claude"
scope: "dev"
short_summary: "Migrate all agent blueprints from XML/markdown to JSON format with Zod validation for consistent, machine-readable output."
version: "0.1"
topics: ["agents", "blueprints", "json", "validation", "migration"]
---

## Executive Summary

**Problem**: Agent blueprints currently provide results in XML/markdown format instead of structured JSON, making automated validation and processing difficult.

**Solution**: Migrate all agent blueprints to use JSON format validated by Zod schemas for consistent, machine-readable output.

**Impact**: Enables reliable automated processing of agent outputs, improves system reliability, and standardizes agent responses.

**Timeline**: 2-3 weeks implementation with testing.

## Current State Analysis

### Existing Format Issues

Current agent blueprints use inconsistent response formats:

1. **XML Structure**: Agents wrap responses in `<thought>` and `<content>` tags
2. **Markdown Content**: The `<content>` section contains human-readable markdown
3. **No Validation**: No automated validation of response structure
4. **Inconsistent Schema**: Each agent defines its own output format

### Successful Examples

Two agents have been successfully migrated to JSON format:

- **`senior-coder.md`**: Uses structured JSON plan with steps, actions, and validation
- **`default.md`**: Uses the same JSON schema with comprehensive field validation

Both agents now use the `PlanSchema` from `src/schemas/plan_schema.ts` for Zod validation.

## Migration Scope

### Target Files

All agent blueprint files in the following locations:

```text
Blueprints/Agents/
├── *.md (main agents)
├── examples/*.md
└── templates/*.md
```

**Total Files**: 18+ agent blueprints requiring updates

### Files to Update

**Main Agents** (12 files):

- code-analyst.md
- mock-agent.md
- performance-engineer.md
- product-manager.md
- qa-engineer.md
- quality-judge.md
- security-expert.md
- software-architect.md
- technical-writer.md
- test-engineer.md

**Example Agents** (5 files):

- api-documenter.md
- code-reviewer.md
- feature-developer.md
- research-synthesizer.md
- security-auditor.md

**Template Agents** (7 files):

- collaborative-agent.md.template
- conversational-agent.md.template
- judge-agent.md.template
- pipeline-agent.md.template
- reflexive-agent.md.template
- research-agent.md.template
- specialist-agent.md.template

## Technical Implementation

### JSON Schema Structure

All agents will use the standardized `PlanSchema` defined in the [Agent Content Schema Reference](.copilot/source/agent-content-schema.md):

```json
{
  "title": "Plan title (1-300 chars)",
  "description": "What the plan accomplishes",
  "steps": [
    {
      "step": 1,
      "title": "Step title (1-200 chars)",
      "description": "What this step does",
      "actions": [
        {
          "tool": "read_file",
          "params": { "path": "file.ts" },
          "description": "Optional action description"
        }
      ],
      "tools": ["read_file", "write_file"],
      "successCriteria": ["Criterion 1"],
      "dependencies": [2, 3],
      "rollback": "Undo procedure"
    }
  ],
  "estimatedDuration": "2-3 hours",
  "risks": ["Risk 1", "Risk 2"]
}
```

**See [.copilot/source/agent-content-schema.md](.copilot/source/agent-content-schema.md) for complete schema documentation, field requirements, and examples.**

### Response Format Migration

**Before** (XML + Markdown):

```xml
<thought>
Analysis and reasoning...
</thought>

<content>
## Analysis Report

### Section 1
- Item 1
- Item 2
</content>
```

**After** (XML + JSON):

```xml
<thought>
Analysis and reasoning...
</thought>

<content>
{
  "title": "Analysis Report",
  "description": "Structured analysis results",
  "steps": [...],
  "estimatedDuration": "1 hour",
  "risks": [...]
}
</content>
```

**See [.copilot/source/agent-content-schema.md](.copilot/source/agent-content-schema.md) for complete response format templates and migration examples.**

### Zod Validation Integration

Each agent response will be validated against `PlanSchema`:

```typescript
import { PlanSchema } from "../schemas/plan_schema.ts";

// In processing pipeline
const result = PlanSchema.parse(jsonContent);
```

## Implementation Plan

### Phase 31.1: Schema Enhancement (Week 1)

**Goal**: Ensure PlanSchema supports all agent use cases

**Tasks**:

1. Review current PlanSchema limitations
2. Add optional fields for specialized agents (analysis results, QA metrics, etc.)
3. Update schema documentation
4. Add comprehensive test coverage

**Success Criteria**:

- PlanSchema validates all agent output types
- Schema is extensible for future agent types
- Full test coverage for new schema features

### Phase 31.2: Core Agent Migration (Week 2)

**Goal**: Migrate main agent blueprints to JSON format

**Tasks**:

1. Update 12 main agents in `Blueprints/Agents/`
2. Convert markdown output formats to JSON structures
3. Test each agent with new format
4. Update agent documentation

**Migration Pattern**:

- Keep `<thought>` section unchanged
- Replace markdown `<content>` with JSON `PlanSchema` structure
- Reference [.copilot/source/agent-content-schema.md](.copilot/source/agent-content-schema.md) for complete schema documentation
- Update examples and documentation

### Phase 31.3: Example & Template Migration (Week 2-3)

**Goal**: Complete migration of all blueprint files

**Tasks**:

1. Update 5 example agents
2. Update 7 template agents
3. Ensure template consistency
4. Validate all blueprints

### Phase 31.4: Integration Testing (Week 3)

**Goal**: Verify end-to-end functionality

**Tasks**:

1. Test agent execution with JSON output
2. Validate Zod schema enforcement
3. Test error handling for invalid JSON
4. Performance testing with structured output

## Risk Assessment

### Technical Risks

**Schema Compatibility**: Some agents may need schema extensions

- **Mitigation**: Start with flexible schema, extend as needed

**Performance Impact**: JSON parsing overhead

- **Mitigation**: Benchmark and optimize if needed

**Backward Compatibility**: Existing flows may expect markdown

- **Mitigation**: Update flow processing to handle both formats during transition

### Operational Risks

**Agent Response Quality**: Structured JSON may limit expressiveness

- **Mitigation**: Allow flexible fields in schema, comprehensive testing

**Migration Errors**: Incomplete migration could break agents

- **Mitigation**: Migrate and test agents individually

## Success Criteria

### Functional Requirements

1. **All Agents Use JSON**: Every blueprint file uses JSON format in `<content>`
2. **Zod Validation**: All JSON responses validate against PlanSchema
3. **Backward Compatibility**: System handles both old and new formats during transition
4. **Performance**: No significant performance degradation

### Quality Assurance

1. **Test Coverage**: All agents tested with new format
2. **Schema Validation**: 100% of responses pass Zod validation
3. **Error Handling**: Invalid JSON responses handled gracefully
4. **Documentation**: All blueprints updated with JSON examples

### Validation Steps

1. **Unit Tests**: Schema validation tests pass
2. **Integration Tests**: Agent execution produces valid JSON
3. **End-to-End Tests**: Complete flows work with JSON output
4. **Performance Tests**: Response processing meets latency requirements

## Dependencies

### Pre-Requisites

- Phase 18: Blueprint modernization (completed)
- PlanSchema implementation (completed)
- Zod validation infrastructure (completed)

### Post-Requisites

- Phase 32: Flow processing updates for JSON input
- Phase 33: Agent orchestration improvements
- Phase 34: Performance optimization

## Rollback Plan

### Emergency Rollback

If JSON migration causes critical issues:

1. **Immediate**: Disable Zod validation temporarily
2. **Short-term**: Revert agent blueprints to markdown format
3. **Long-term**: Fix schema issues and re-attempt migration

### Gradual Rollback

For non-critical issues:

1. Allow agents to use either format during transition
2. Gradually migrate remaining agents
3. Monitor error rates and performance

## Timeline and Milestones

### Week 1: Schema Enhancement

- [ ] Review PlanSchema limitations
- [ ] Add specialized fields for different agent types
- [ ] Update schema tests
- [ ] Document schema extensions

### Week 2: Core Migration

- [ ] Migrate 12 main agents
- [ ] Test each agent individually
- [ ] Update documentation
- [ ] Validate JSON output

### Week 3: Completion and Testing

- [ ] Migrate examples and templates
- [ ] Full integration testing
- [ ] Performance validation
- [ ] Documentation updates

## Resource Requirements

### Team Resources

- **1 Senior Engineer**: Schema design and core migration
- **1 QA Engineer**: Testing and validation
- **1 Technical Writer**: Documentation updates

### Technical Resources

- **Development Environment**: Access to all agent blueprints
- **Testing Infrastructure**: Agent execution testing
- **CI/CD Pipeline**: Automated validation of JSON responses

## Monitoring and Metrics

### Key Metrics

1. **Migration Progress**: Percentage of agents migrated
2. **Validation Success Rate**: JSON responses passing Zod validation
3. **Performance Impact**: Response processing latency
4. **Error Rate**: Invalid JSON response frequency

### Monitoring Setup

1. **Schema Validation Logs**: Track validation failures
2. **Performance Metrics**: Response processing times
3. **Agent Health Checks**: Ensure all agents produce valid output
4. **Integration Tests**: Automated testing of agent flows

## Future Phases

### Phase 31.5: Thought Section Standardization

Following JSON migration, standardize the `<thought>` section structure across all agents for consistent reasoning patterns.

**Rationale**: While `<content>` sections will be JSON, `<thought>` sections remain free-form text. Standardizing their structure will improve reasoning consistency and enable better analysis of agent decision-making.

**Implementation**:

- Define structured `<thought>` format with required sections (Problem Analysis, Context Assessment, Solution Approach, etc.)
- Update all agent blueprints to use standardized format
- Create documentation in `.copilot/source/agent-thought-standardization.md`
- Validate reasoning quality and consistency

**Timeline**: 1-2 weeks after Phase 31 completion
**Dependencies**: Phase 31 completion

### Phase 31.6: Output Formatting Improvements

Following JSON migration and thought standardization, enhance the `exoctl plan show` command with beautified formatting for improved readability and user experience.

**Rationale**: Raw text output of `<thought>` and JSON `<content>` sections is difficult to read. Structured formatting will improve developer experience when reviewing agent outputs.

**Implementation**:

- **Thought Section Formatting**:
  - Parse structured thought sections into readable format
  - Use color coding and indentation for different sections
  - Add section headers and visual separators
  - Handle both standardized and legacy thought formats

- **JSON Content Formatting**:
  - Pretty-print JSON with syntax highlighting
  - Add collapsible sections for long content
  - Include field descriptions and validation status
  - Show schema compliance indicators

- **Command Enhancements**:
  - Add `--format` flag (table, json, markdown, raw)
  - Add `--sections` flag to show/hide thought or content
  - Add `--validate` flag to show schema validation results
  - Support pager for long outputs

- **UI Improvements**:
  - Color-coded output (green=success, yellow=warnings, red=errors)
  - Progress indicators for long operations
  - Interactive elements for large JSON structures
  - Responsive formatting for different terminal widths

**Technical Details**:

1. **Parser Updates**: Extend plan parsing to handle beautified output
2. **Terminal Detection**: Auto-detect color support and terminal capabilities
3. **Schema Integration**: Show validation results inline with formatted output
4. **Performance**: Lazy loading for large JSON structures

**Timeline**: 1 week after Phase 31.5 completion
**Dependencies**: Phase 31.5 completion, terminal UI libraries

## Conclusion

Phase 31 represents a critical infrastructure improvement that will:

1. **Standardize** agent outputs for reliable processing
2. **Enable** automated validation and error detection
3. **Improve** system reliability and maintainability
4. **Facilitate** future agent development and integration

The migration follows proven patterns from successful senior-coder and default agent implementations, ensuring a smooth transition to structured JSON output across all agent blueprints.
