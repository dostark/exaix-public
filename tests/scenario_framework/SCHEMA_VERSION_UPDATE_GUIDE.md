# Schema Version Update Guide

## How to Update the Schema Version

When you need to update the scenario schema version (e.g., from `1.0.0` to `1.1.0`):

### Step 1: Update the Central Version

Edit `tests/scenario_framework/schema/version.ts`:

```typescript
export const SCHEMA_VERSION = "1.1.0" as const; // Update this line
```

### Step 2: Update Documentation

Update the comment in `tests/scenario_framework/templates/scenario_template.yaml`:

```yaml
# Schema version - use the current SCHEMA_VERSION from tests/scenario_framework/schema/version.ts
# Current version: 1.1.0
schema_version: "1.1.0" # Update this line
```

### Step 3: Update Existing Scenarios (if needed)

For existing scenario YAML files, you have two options:

#### Option A: Bulk Update (if backward compatible)

```bash
# Find and replace all schema versions
find tests/scenario_framework/scenarios -name "*.yaml" -exec \
  sed -i 's/schema_version: "1.0.0"/schema_version: "1.1.0"/g' {} \;
```

#### Option B: Gradual Migration

Keep old scenarios at their original version. The schema validator will accept compatible versions based on the `isCompatibleVersion()` logic.

### Step 4: Update Tests

Update the version assertion test in `tests/scenario_framework/tests/unit/version_test.ts`:

```typescript
Deno.test("[ScenarioFrameworkVersion] SCHEMA_VERSION is a valid semver string", () => {
  assert(VERSION_PATTERN.test(SCHEMA_VERSION));
  assertEquals(SCHEMA_VERSION, "1.1.0"); // Update this line
});
```

### Step 5: Run Tests

Verify all tests pass:

```bash
deno task scenario:test
```

### Step 6: Document Changes

Add an entry to a `CHANGELOG.md` (if you create one) describing:

- What changed in the schema
- Whether it's backward compatible
- Migration steps for users

## Version Numbering Rules

Follow semantic versioning:

- **MAJOR.MINOR.PATCH** (e.g., `1.0.0`, `1.1.0`, `2.0.0`)
- **MAJOR**: Breaking changes to schema structure
- **MINOR**: Backward-compatible additions
- **PATCH**: Backward-compatible fixes

## Compatibility Rules

The `isCompatibleVersion()` function considers versions compatible if:

- Same major version (e.g., `1.0.0` and `1.1.0` are compatible)
- Different major versions are NOT compatible (e.g., `1.0.0` and `2.0.0`)

## Example: Version 1.1.0 Update

Here's a complete example of updating from `1.0.0` to `1.1.0`:

### 1. Update version.ts

```diff
- export const SCHEMA_VERSION = "1.0.0" as const;
+ export const SCHEMA_VERSION = "1.1.0" as const;
```

### 2. Update version_test.ts

```diff
- assertEquals(SCHEMA_VERSION, "1.0.0");
+ assertEquals(SCHEMA_VERSION, "1.1.0");
```

### 3. Update template comment

```diff
- # Current version: 1.0.0
+ # Current version: 1.1.0
```

### 4. Run tests

```bash
deno task scenario:test
```

That's it! All new scenarios generated via `renderScenarioTemplate()` will automatically use version `1.1.0`.
