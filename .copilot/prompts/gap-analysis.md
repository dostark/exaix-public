---
agent: general
scope: dev
title: "Planning Document Gap Analysis (#gap-analysis)"
short_summary: "Generic prompt for finding gaps, ambiguities, and risks in a phase planning document before implementation begins."
version: "0.1"
topics: ["planning", "gap-analysis", "architecture", "risk", "quality"]
---

```text
Key points
- Analyse the planning document against the actual source code before writing any implementation
- Identify gaps that would block implementation: missing type definitions, unresolved ambiguities, broken data-flow chains
- Classify every gap by severity so the team can triage quickly
- Output is a prioritised list of gaps with a concrete "To fix:" directive for each one

Canonical prompt (short):
"Perform a gap analysis on the planning document at {PLANNING_DOC_PATH}. Read the source files it references and report every ambiguity, missing contract, or implementation risk before we start coding."

Examples
- Example prompt: "Gap-analyse .copilot/planning/phase-48-acceptance-criteria-propagation.md"
- Example prompt: "Find gaps in the phase-49-memory-bank-v3.md planning document."

Do / Don't
- ✅ Do read every source file cited in the planning document
- ✅ Do follow every input/output data-flow chain end-to-end
- ✅ Do check constructor signatures for every newly injected dependency
- ✅ Do verify Zod schemas have .default() on every optional new field
- ✅ Do check that every new interface is exported from an index file
- ✅ Do look for magic numbers/strings that belong in constants
- ❌ Don't mark a step complete if its data source is undefined
- ❌ Don't ignore backward-compatibility risk on schema changes
- ❌ Don't skip edge cases (empty arrays, missing optional fields, null returns)
- ❌ Don't assume tests cover a path — verify test files explicitly

Related templates:
- #plan  — Draft a new planning document
- #step  — Implement individual steps from the plan
- #review — Review finished implementation against the plan
```

---

## Instructions for Agent

You are performing a **pre-implementation gap analysis** on the planning document provided.
Your output is a **prioritised, actionable gap report** — not an implementation.

### Step-by-step process

1. **Read the planning document in full.**
   Identify every: new type, interface, service, method, Zod schema field, constant, CLI flag, and config key mentioned.

2. **Locate every referenced source file and read it.**
   Confirm each file exists and contains the symbols assumed by the plan.

3. **Trace every data-flow chain.**
   For each piece of data the plan passes between components, answer:
   - Where does it originate? (constructor param / loaded from disk / computed inline)
   - Where is it consumed? (method param / field on a shared type / stored in DB)
   - Is there any step in the chain where the data may be `undefined` or unavailable?

4. **Check constructor contracts.**
   For every service or class that the plan modifies or creates:
   - List all existing constructor parameters.
   - Identify which new parameters the plan adds.
   - Confirm the parameter order is consistent with call-sites.

5. **Audit schema backward compatibility.**
   For every Zod schema field the plan adds or changes:
   - Is `.default()` present for optional fields?
   - Are existing serialised artefacts (JSON files, DB rows) still valid?

6. **Audit deduplication and merge semantics.**
   If the plan merges, caps, or deduplicates collections, verify:
   - The algorithm is fully specified (sort order, similarity definition, cap value).
   - The cap/limit value is in a named constant, not hardcoded.

7. **Verify cross-component ownership.**
   If two components (e.g., a Generator and an Evaluator) share a type or field:
   - Is there a single authoritative definition?
   - Is it imported rather than duplicated?

8. **Check test coverage plan.**
   For every new code path:
   - Is there a planned unit test?
   - Is there a planned integration test?
   - Are edge cases (empty input, null, max-size) explicitly covered?

9. **Identify missing constants.**
   Flag any literal string or number in the plan (threshold, mode name, file name) that should be a named constant exported from `src/shared/constants.ts`.

10. **Check interface export paths.**
    For every new interface or type the plan defines, confirm it will be exported from the appropriate index / barrel file.

---

## Output Format

Produce a structured gap report using the taxonomy below.

### Severity levels

| Symbol | Meaning |
| --- | --- |
| 🔴 Critical | Blocks implementation — must resolve before writing code |
| 🟡 Feasibility | Risky assumption or unspecified algorithm — needs design decision |
| 🟠 Testing | Missing or under-specified test — implementation may ship without coverage |
| 🔵 Conceptual | Minor ambiguity or style issue — low risk, but should be documented |

### Report template

```text
## Gap Analysis: {PLANNING_DOC_NAME}

### Summary
X critical · Y feasibility · Z testing · W conceptual

---

### Gap 1: {short title}  🔴 Critical
**Location in plan:** Step N — "{quoted sentence from plan}"
**Problem:** {what is undefined, missing, or contradictory}
**Impact:** {what breaks at runtime or compile-time if left unresolved}
**To fix:** {concrete, one-sentence instruction}

---

### Gap 2: {short title}  🟡 Feasibility
...

---

### Gap N: {short title}  🔵 Conceptual
...

---

## Recommended Pre-Implementation Actions

1. {ordered list of fixes, most critical first}
```

---

## Template

**Planning document:**
{PLANNING_DOC_PATH}

**Source files to read** (add all files referenced or implied by the plan):

- ...

**Known dependencies / prior phases:**

- ...

**Specific concerns** (optional — add anything the reviewer should pay extra attention to):

- ...
