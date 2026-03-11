---
agent: general
scope: dev
title: "Feature Planning Template (#plan)"
short_summary: "Template for systematically planning new features with steps, tests, and success criteria."
version: "0.1"
topics: ["planning", "features", "tdd", "requirements"]
---

```text
Key points
- Break down features into actionable steps with success criteria
- Include TDD approach: tests first, then implementation
- Identify dependencies, edge cases, and acceptance criteria
- Plan unit, integration, and regression tests for each step

Canonical prompt (short):
"Plan a new feature for ExoFrame. Break it into steps with success criteria, tests, and dependencies. Ensure TDD approach and reviewable plan."

Examples
- Example prompt: "Plan OAuth2 login support with user registration and session management."
- Example prompt: "Design a new API endpoint for file uploads with validation."

Do / Don't
- ✅ Do break into small, testable steps
- ✅ Do specify success criteria for each step
- ✅ Do include edge cases and error handling
- ✅ Do plan tests (unit, integration, regression)
- ❌ Don't skip TDD planning
- ❌ Don't forget dependencies and interfaces
- ❌ Don't make steps too large or vague

Related templates:
- #step — Implement individual steps from this plan
- #test — Create comprehensive tests for planned features
- #fix — Address bugs discovered during implementation
```

**Success Criteria:**

- ...

**Planned Tests:**

- ...

**Dependencies:**

- ...

**Acceptance Criteria:**

- ...

**Notes:**

- Always use TDD.
- Add regression tests for any bug fixes.
- Do not mark as complete until all tests pass and linting is clean.
