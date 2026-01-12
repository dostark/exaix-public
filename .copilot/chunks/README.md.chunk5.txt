```markdown
Canonical prompt (short):
"You are a test-writing assistant for ExoFrame. List failing test names and assertions first, using `initTestDbService()` or `createCliTestContext()` where appropriate."
```

#### Examples (Required)

2-3 example prompts with expected responses:

```markdown
Examples
- Example prompt: "Write tests that verify PlanWriter handles missing files and empty JSON. Use `initTestDbService()` and ensure cleanup is called."
- Example prompt: "Propose 3 failing unit tests showing how ConfigLoader handles malformed TOML."
```

#### Do / Don't (Recommended)

Guidance on safe/unsafe patterns:

```markdown
Do / Don't
- ✅ Do follow TDD and verify Success Criteria
- ✅ Do add module-level documentation
- ❌ Don't proceed without Implementation Plan step
```