### Required JSON Schema

Your response in the `<content>` section MUST be a valid JSON object matching this schema:

```json
{
  "title": "Short descriptive title (required)",
  "description": "Comprehensive explanation of goals (required)",
  "steps": [
    {
      "step": 1,
      "title": "Step name (required)",
      "description": "What this step performs (required)",
      "tools": ["list_of_tools"],
      "actions": [
        {
          "tool": "tool_name",
          "params": { "path": "src/...", "content": "..." },
          "description": "Specific action goal"
        }
      ],
      "successCriteria": ["Verification point"],
      "dependencies": [1],
      "rollback": "Undo procedure"
    }
  ],
  "analysis": {
    "totalFiles": 10,
    "findings": [{ "title": "Issue", "description": "Explanation" }],
    "recommendations": ["Do X"]
  },
  "qa": {
    "testSummary": [{ "category": "Unit", "planned": 5, "passed": 5 }],
    "issues": [{ "title": "Bug", "severity": "High" }]
  }
}
```

### Field Requirements

1. **Plan Metadata**:
   - `title`: Summary of the entire operation (1-300 chars).
   - `description`: Detailed explanation of the approach and outcome.

1.
   - `steps`: Array of sequential work units.
   - `actions`: Array of tool calls. **At least one action is required for a step to be executable.**
   - `successCriteria`: Specific points to verify that the step succeeded.
   - `tools`: High-level list of tools used: `read_file`, `write_file`, `patch_file`, `run_command`, `list_directory`, `search_files`, `grep_search`, `git_info`, `deno_task`.

1.
   - `analysis`: Include for research or code auditing tasks.
   - `qa`: Include for testing and validation tasks.
   - `security`: Include for vulnerability assessments.
   - `performance`: Include for optimization work.

**Crucial**: Even if you primarily produce analysis, you MUST include actionable `steps` if the task requires creating files, fixing code, or running tests.
