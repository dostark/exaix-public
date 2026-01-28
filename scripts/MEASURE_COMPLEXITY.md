# Measure Complexity

This script analyzes code complexity across the `src/` tree.

Permissions

- The script may need network access to load a JS parser from CDNs or `npm:`. Run with:

```bash
deno run --allow-read --allow-net scripts/measure_complexity.ts
```

If you have `npm:` support in Deno and want to use a local parser, run with `--allow-read` only if you installed `npm:@babel/parser` (Deno will fetch it when run):

```bash
deno run --allow-read --allow-net scripts/measure_complexity.ts --threshold 10
```

Options

- `--threshold <num>`: numeric threshold for flagging files/functions (default 10)
- `--topFiles <n>`: how many top files to display (default 5)
- `--topFns <n>`: how many top functions per file to display (default 5)
- `--json`: print full results as JSON (useful for CI)

Example

```bash
# Human-readable output
deno run --allow-read --allow-net scripts/measure_complexity.ts --threshold 15 --topFiles 10

# JSON output for CI
deno run --allow-read --allow-net scripts/measure_complexity.ts --threshold 15 --json > complexity-report.json
```

Notes

- The script prefers a local/npm parser (e.g. `npm:@babel/parser`) or `deno_ast` if available. If no parser can be loaded it falls back to a heuristic text-based analysis per-function.
- When using network imports, ensure you trust the CDNs used in the script.

CI Recommendations

- For CI (e.g., GitHub Actions) prefer running the script with network access and JSON output so results can be programmatically consumed and the job can fail on breaches.

Example GitHub Actions snippet

```yaml
- name: Complexity Check
  run: |
    deno run --allow-read --allow-net scripts/measure_complexity.ts --threshold 15 --json > complexity.json
    deno eval --unstable --allow-read "const txt=await Deno.readTextFile('complexity.json'); const obj=JSON.parse(txt); const files=(obj.exceeding?.files||[]).length; const fns=(obj.exceeding?.functions||[]).length; console.log(`Complexity breaches: files=${files}, functions=${fns}`); if(files>0||fns>0) Deno.exit(1);"
```
