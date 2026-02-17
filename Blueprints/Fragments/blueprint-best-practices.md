## Best Practices

1. **Precision**: Use `patch_file` for large files to avoid overwriting unrelated changes.
2. **Safety**: Always provide a `rollback` procedure for actions that modify the state (write_file, run_command).
3. **Verification**: Include `deno_task test` or `deno_task lint` actions to verify your changes.
4. **Context**: Use `grep_search` and `list_directory` to ensure you have the full context before making edits.
5. **Dependencies**: Ensure `dependencies` correctly reflect the order of operations to enable parallelization where possible.
